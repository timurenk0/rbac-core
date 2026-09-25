import { writeFileSync } from "fs";
import os from "os";
import pg from "pg";
import { MemoryAdapter } from "@roleforge/core";
import { PostgresAdapter } from "@roleforge/adapter-postgres";
import { createDataset, HIERARCHY_DEPTH, MEASURED_CHECKS, PERMISSION_COUNT, REPETITIONS, ROLE_COUNT, SUBJECT_COUNT, WARMUP_CHECKS } from "./dataset.js";
import { seedRoleForgeModel } from "./seed.js";
import { benchmarkRoleForge } from "./roleforge.js";
import { benchmarkCasbin } from "./casbin.js";
import { benchmarkLoopbackPdp } from "./pdp.js";
import { BenchmarkReport, BenchmarkResult } from "./types.js";

const { Pool } = pg;
const dataset = createDataset();
const results: BenchmarkResult[] = [];

// (a) RoleForge, in-memory adapter
console.log("rf-memory: seeding…");
const memoryAdapter = new MemoryAdapter();
await seedRoleForgeModel(memoryAdapter, dataset);
results.push(await benchmarkRoleForge(memoryAdapter, dataset, { label: "roleforge-memory", cacheEnabled: true }));

// (b, c) RoleForge over PostgreSQL — cache on / off (skipped without DATABASE_URL)
const databaseUrl = process.env.DATABASE_URL;
let postgresVersion: string | null = null;
if (databaseUrl) {
    console.log("rf-postgres: seeding…");
    const seedPool = new Pool({ connectionString: databaseUrl });
    postgresVersion = (await seedPool.query("SHOW server_version")).rows[0].server_version;
    const pgAdapter = new PostgresAdapter({ pool: seedPool });
    await seedRoleForgeModel(pgAdapter, dataset);
    results.push(await benchmarkRoleForge(pgAdapter, dataset, { label: "roleforge-postgres-cache", cacheEnabled: true }));
    const pgAdapterNoCache = new PostgresAdapter({ pool: new Pool({ connectionString: databaseUrl }) });
    results.push(await benchmarkRoleForge(pgAdapterNoCache, dataset, { label: "roleforge-postgres-no-cache", cacheEnabled: false }));
} else {
    console.log("DATABASE_URL not set — postgres configurations skipped (point it at an EMPTY database; the seeder creates the model)");
}

// (d) node-casbin in-process on the equivalent seeded model
console.log("casbin: seeding…");
results.push(await benchmarkCasbin(dataset));

// (e) loopback HTTP decision point
console.log("loopback-pdp: seeding…");
results.push(await benchmarkLoopbackPdp(dataset));

const report: BenchmarkReport = {
    generatedAt: new Date().toISOString(),
    workload: {
        subjects: SUBJECT_COUNT, roles: ROLE_COUNT, hierarchyDepth: HIERARCHY_DEPTH,
        permissions: PERMISSION_COUNT, warmupChecks: WARMUP_CHECKS, measuredChecks: MEASURED_CHECKS, repetitions: REPETITIONS
    },
    environment: {
        nodeVersion: process.version,
        platform: `${os.type()} ${os.release()}`,
        architecture: `${os.arch()} · ${os.cpus()[0].model} · ${os.cpus().length} core(s)` + (postgresVersion ? ` · PostgreSQL ${postgresVersion}` : ""),
        cpuCount: os.cpus().length,
        postgresUrl: databaseUrl ? databaseUrl.replace(/\/\/.*@/, "//***@") : "(not used)"
    },
    results
};
writeFileSync(new URL("../results.json", import.meta.url), JSON.stringify(report, null, 2));

console.log("\n| Configuration | mean ± SD (ms) | p50 | p95 | p99 |");
console.log("|---|---|---|---|---|");
for (const r of results) {
    const a = r.aggregate;
    console.log(`| ${r.configuration} | ${a.meanMs.toFixed(3)} ± ${a.standardDeviationMs.toFixed(3)} | ${a.p50Ms.toFixed(3)} | ${a.p95Ms.toFixed(3)} | ${a.p99Ms.toFixed(3)} |`);
}
console.log("\nwritten: bench/results.json (± is between-run SD of means; per-run detail inside)");

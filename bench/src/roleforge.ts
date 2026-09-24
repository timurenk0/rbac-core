import { RoleForge, StorageAdapter } from "@roleforge/core";
import { BenchmarkDataset, MEASURED_CHECKS, REPETITIONS, WARMUP_CHECKS } from "./dataset.js";
import process from "process";
import { calculateStatistics } from "./statistics.js";
import { BenchmarkResult } from "./types.js";

export async function benchmarkRoleForge(
    adapter: StorageAdapter,
    dataset: BenchmarkDataset,
    cacheEnabled: boolean
): Promise<BenchmarkResult> {
    const rf = await RoleForge.init({
        adapter,
        cache: {
            enabled: cacheEnabled,
            ttlMs: 60000
        }
    });

    const runs = [];

    for (let run = 1; run <= REPETITIONS; run++) {
        const requests = dataset.requests;

        for (let i = 0; i < WARMUP_CHECKS; i++) {
            await rf.check(requests[i]);
        }
        
        const timings: number[] = [];
        let granted = 0;
        let denied = 0;

        for (let i = WARMUP_CHECKS; i < WARMUP_CHECKS + MEASURED_CHECKS; i++) {
            const request = requests[i];

            const start = process.hrtime.bigint();
            const result = await rf.check(request);
            const end = process.hrtime.bigint();

            timings.push(Number(end-start) / 1000000);

            if (result) {
                granted++;
            } else {
                denied++;
            }
        }

        runs.push({
            run,
            stats: calculateStatistics(timings),
            granted,
            denied
        });
    }

    return {
        configuration: cacheEnabled ? "roleforge-cache" : "roleforge-no-cache",
        warmupChecks: WARMUP_CHECKS,
        measuredChecks: MEASURED_CHECKS,
        repetition: REPETITIONS,
        runs,
        aggregate: calculateStatistics(runs.flatMap(r => [r.stats.meanMs, r.stats.p50Ms, r.stats.p95Ms, r.stats.p99Ms]))
    }
}
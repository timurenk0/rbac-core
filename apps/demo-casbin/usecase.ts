// Same scenario as apps/demo, protected by node-casbin.
// Run: npx tsx apps/demo-casbin/src/usecase.ts [hour]
import { buildAuthz, can } from "./authz.js";

type Case = readonly [subject: string, action: string, resource: string, tenant: string, expected: boolean, label: string];

const hour = Number(process.argv[2] ?? 14);
const enforcer = await buildAuthz();

const CASES: readonly Case[] = [
    ["alice", "delete", "task",   "acme",   true,  "admin deletes (direct grant)"],
    ["alice", "read",   "task",   "globex", true,  "admin reads via admin→manager→member chain"],
    ["bob",   "read",   "report", "acme",   true,  "acme-manager reads report inside acme"],
    ["bob",   "read",   "report", "globex", false, "same role denied outside its tenant"],
    ["bob",   "delete", "task",   "acme",   false, "manager-level role cannot delete"],
    ["carol", "read",   "report", "acme",   hour >= 22 || hour < 6, `night-auditor at ${String(hour).padStart(2, "0")}:00`],
    ["dave",  "read",   "task",   "acme",   false, "unknown subject denied by default"],
];

let failures = 0;
console.log(`\n=== node-casbin demo — simulated hour ${hour} ===`);
for (const [subject, action, resource, tenant, expected, label] of CASES) {
    const granted = await can(enforcer, subject, action, resource, { tenantId: tenant, hour });
    const ok = granted === expected;
    if (!ok) failures++;
    console.log(` ${ok ? "✓" : "✗ FAIL"}  ${label.padEnd(46)} ${subject} ${action}:${resource}@${tenant} → ${granted}`);
}
console.log(`\n${failures === 0 ? "SCENARIO: ALL PASS" : `SCENARIO: ${failures} FAILURES`}`);
process.exit(failures ? 1 : 0);

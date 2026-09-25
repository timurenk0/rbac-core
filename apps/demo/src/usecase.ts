import { buildAuthz, DemoContext } from "./authz.js";

type Case = readonly [subject: string, action: string, resource: string, context: DemoContext, expected: boolean, label: string];

const hour = Number(process.argv[2] ?? 14);
const clock = () => new Date(2026, 8, 25, hour, 30);
const rf = await buildAuthz({ clock });

const CASES: readonly Case[] = [
    ["alice", "delete", "task",   { tenantId: "acme" },   true,  "admin deletes (direct grant)"],
    ["alice", "read",   "task",   { tenantId: "globex" }, true,  "admin reads via admin→manager→member chain"],
    ["bob",   "read",   "report", { tenantId: "acme" },   true,  "acme-manager reads report inside acme"],
    ["bob",   "read",   "report", { tenantId: "globex" }, false, "same role vetoed outside its tenant"],
    ["bob",   "delete", "task",   { tenantId: "acme" },   false, "manager-level role cannot delete"],
    ["carol", "read",   "report", { tenantId: "acme" },   hour >= 22 || hour < 6, `night-auditor at ${String(hour).padStart(2, "0")}:30`],
    ["dave",  "read",   "task",   { tenantId: "acme" },   false, "unknown subject denied by default"],
];

let failures = 0;
console.log(`\n=== RoleForge demo — simulated time ${String(hour).padStart(2, "0")}:30 ===`);
for (const [subject, action, resource, context, expected, label] of CASES) {
    const granted = await rf.check({ subject, action, resource, context });
    const ok = granted === expected;
    if (!ok) failures++;
    console.log(` ${ok ? "✓" : "✗ FAIL"}  ${label.padEnd(46)} ${subject} ${action}:${resource} → ${granted}`);
}

console.log("\n--- explain(): why is bob denied in globex? ---");
const decision = await rf.explain({ subject: "bob", action: "read", resource: "report", context: { tenantId: "globex" } });
for (const node of decision.trace) {
    const veto = node.conditions.find(c => !c.admissible);
    const source = node.source === "direct" ? "direct" : `inherited via ${node.source.inheritedVia}`;
    console.log(`  role ${node.roleName} [${source}] → ${veto ? `VETO: ${veto.reason}` : node.matchedPermissions ? "match" : "no matching permission"}`);
}

console.log(`\n${failures === 0 ? "SCENARIO: ALL PASS" : `SCENARIO: ${failures} FAILURES`}`);
process.exit(failures ? 1 : 0);

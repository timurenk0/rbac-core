# RoleForge

**Embeddable, type-safe, extensible RBAC for TypeScript applications.**

RoleForge is an authorization library — not a service. It runs inside your application's process, stores its model in **your existing PostgreSQL database** (namespaced `rbac_*` tables), answers per-object permission checks in-process, can **explain every decision it makes**, and is extended by implementing one typed interface — never by patching its core.

- 🚫 No external authorization service to deploy, sync, or pay for per-MAU
- 🗄️ Your database, your backups, your transactions — data never leaves your infrastructure
- 🧩 Plugin contract: add conditions (time windows, ownership, tenancy…) as ordinary typed code
- 🔍 `explain()` returns the full decision trace — which roles were considered, why each was admitted or vetoed, and what matched
- ✅ Strict TypeScript, ESM, zero runtime dependencies in the core

> Status: pre-1.0 research artifact (bachelor's thesis project). API may change. Not yet published to npm — consume via workspace/git for now.

## Packages

| Package | What it is |
|---|---|
| `@roleforge/core` | Engine, types, plugin contract, in-memory adapter (for tests), management & introspection API |
| `@roleforge/adapter-postgres` | `StorageAdapter` implementation for PostgreSQL + SQL migration |
| `@roleforge/plugin-temporal` | Reference plugin: time-based role validity (date range, weekdays, daily hours) |

## Quickstart

```ts
import { RoleForge } from "@roleforge/core";
import { PostgresAdapter } from "@roleforge/adapter-postgres";
import { temporalPlugin } from "@roleforge/plugin-temporal"; // ready-made instance
import { Pool } from "pg";

const rf = await RoleForge.init({
  adapter: new PostgresAdapter({ pool: new Pool({ connectionString: process.env.DATABASE_URL }) }),
  plugins: [temporalPlugin],
  // cache: { enabled: true, ttlMs: 5000 },   // defaults shown
  // clock: () => new Date(),                 // inject a clock in tests
});
// init() runs the idempotent migration automatically (CREATE TABLE IF NOT EXISTS …).
// If your production DB user has no DDL rights, apply migrations/001_initial.sql manually.

// Build a model (management API; every write invalidates the cache)
const member  = await rf.createRole({ name: "member",  parentId: null });
const manager = await rf.createRole({ name: "manager", parentId: member.id });
const admin   = await rf.createRole({ name: "admin",   parentId: manager.id });

const readTask = await rf.createPermission({ action: "read", resource: "task" });
await rf.grantPermission(member.id, readTask.id);
await rf.assignRole("user-123", admin.id);

// Check (in-process, boolean)
await rf.check({ subject: "user-123", action: "read", resource: "task" }); // true — inherited via admin → manager → member

// Explain (same evaluation, full trace)
const decision = await rf.explain({ subject: "user-123", action: "delete", resource: "task" });
// decision.granted === false; decision.trace lists every candidate role,
// its provenance (direct | inheritedVia), each plugin verdict with reason, and any matched permission.
```

### Hierarchy semantics (read this once)

`parentId` names the role being **extended**: a role inherits the permissions of its ancestor chain. `admin.parentId = manager` means *admin does everything a manager does, and more*. Cycles are rejected at write time (`HierarchyCycleError`). Single-parent only (a tree, not a DAG).

### Temporal roles

Attach a rule to the role's `meta` — it lives in the same table, backup, and transaction as the rest of your model:

```ts
await rf.createRole({
  name: "night-auditor",
  parentId: null,
  meta: { temporal: { hours: { from: "22:00", until: "06:00" } } }, // overnight windows supported
});
// Optional fields: validFrom / validUntil (ISO dates), weekdays (0–6, Sun–Sat)
```

⏰ Times are evaluated in the **server process's local timezone** via the injected clock. Pin your service's TZ (or inject a clock) if that matters to you.

## Writing a plugin

Implement one interface; register it at `init`. Plugins are consulted **per candidate role** with **AND semantics** — a plugin can only *restrict* access, never widen it, so adding one can never accidentally grant what your base model denies.

```ts
import type { ConditionResolver } from "@roleforge/core";

export class OwnershipResolver implements ConditionResolver<{ ownerId?: string; userId: string }> {
  readonly name = "ownership";
  resolve({ role, context }) {
    if (role.meta?.ownership !== true) return { admissible: true };       // not my role → pass
    return context?.ownerId === context?.userId
      ? { admissible: true }
      : { admissible: false, reason: `Role ${role.name} requires resource ownership` };
  }
}
```

Rules of the contract: read your config from `role.meta[yourName]`; be a pure function of the input (a `now: Date` is injected — never call `new Date()` yourself); return a reason on every veto — it surfaces verbatim in `explain()` traces. Duplicate plugin names are rejected at `init` (`DuplicatePluginError`).

## API surface (core)

`check`, `explain`, `graph`, `subjectRoles` · `createRole`, `deleteRole`, `setRoleParent` · `createPermission`, `deletePermission` · `assignRole`, `unassignRole`, `grantPermission`, `revokePermission` · errors: `RoleForgeError` and typed subclasses.

## Storage

Four namespaced tables in **your** database, created by `migrations/001_initial.sql` (guarded by `rbac_migrations`, idempotent): `rbac_roles` (self-FK `parent_id`, `meta JSONB`), `rbac_permissions` (`UNIQUE(action, resource)`), `rbac_role_permissions`, `rbac_subject_roles`. Subjects are your user IDs — RoleForge is **authorization only**; authentication stays with your app/IdP.

Other databases: implement the `StorageAdapter` interface from `@roleforge/core` (the in-memory adapter is a ~180-line reference).

## Demo applications & the visualizer

The repository ships a runnable multi-tenant demonstration (two tenants, an admin → manager → member hierarchy, a tenant-limited role, a time-limited night-auditor) in two variants — protected by RoleForge and, for comparison, by node-casbin:

```bash
npm install && npm run build          # build once: the apps import the built packages
npx tsx apps/demo/src/usecase.ts 14         # RoleForge variant, simulated 14:30
npx tsx apps/demo/src/usecase.ts 23         # same scenario at 23:30 (night-auditor active)
npx tsx apps/demo-casbin/src/usecase.ts 14  # identical scenario under node-casbin
```

On top of the same model runs a **read-only visualizer** — a live role graph plus a decision simulator:

```bash
npm start --workspace=@roleforge/visualizer   # → http://localhost:5173
```

The left panel renders the role graph from `graph()` (each role with its direct grants, parent link, and plugin settings). A subjects panel lists who holds which roles, via `subjectRoles()`. The simulator sends your chosen subject, action, resource, tenant, and time of day to `explain()` and renders the verdict with the full trace: every candidate role colored by outcome — rejected (with the plugin's reason), passed-but-no-matching-grant, or the role where the permission matched. The page contains no authorization logic of its own; everything on screen is the engine's own output. Editing the model from the UI is intentionally not supported.

## Development & tests

```bash
npm install
npm run build                 # builds core (required before plugin tests resolve @roleforge/core)
npx vitest run                # core + plugin suites

# PostgreSQL integration suite (runs only when TEST_DATABASE_URL is set):
docker compose up -d
TEST_DATABASE_URL=postgres://roleforge:roleforge@localhost:54329/roleforge_test npx vitest run packages/adapters/postgres
```

## License

MIT — see [LICENSE](./LICENSE).

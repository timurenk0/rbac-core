import { ConditionResolver, RoleForge, MemoryAdapter, StorageAdapter } from "@roleforge/core";
import { temporalPlugin } from "@roleforge/plugin-temporal";

export interface DemoContext {
    tenantId?: string;
}

export const tenancyPlugin: ConditionResolver<DemoContext> = {
    name: "tenancy",
    resolve({ role, context }) {
        const required = role.meta?.tenant as string | undefined;
        if (required === undefined) return { admissible: true };
        return context?.tenantId === required
            ? { admissible: true }
            : { admissible: false, reason: `Role ${role.name} is scoped to tenant ${required}` };
    }
};

export async function buildAuthz(options?: { adapter?: StorageAdapter; clock?: () => Date }) {
    const rf = await RoleForge.init<DemoContext>({
        adapter: options?.adapter ?? new MemoryAdapter(),
        plugins: [temporalPlugin, tenancyPlugin],
        clock: options?.clock
    });

    const member  = await rf.createRole({ name: "member",  parentId: null });
    const manager = await rf.createRole({ name: "manager", parentId: member.id });
    const admin   = await rf.createRole({ name: "admin",   parentId: manager.id });
    
    const acmeManager = await rf.createRole({ name: "acme-manager", parentId: null, meta: { tenant: "acme" } });
    const auditor = await rf.createRole({
        name: "night-auditor", parentId: null,
        meta: { temporal: { hours: { from: "22:00", until: "06:00" } } }
    });

    const permission = async (action: string, resource: string) => rf.createPermission({ action, resource });
    const readTask   = await permission("read", "task");
    const createTask = await permission("create", "task");
    const deleteTask = await permission("delete", "task");
    const readReport = await permission("read", "report");

    await rf.grantPermission(member.id,      readTask.id);
    await rf.grantPermission(member.id,      createTask.id);
    await rf.grantPermission(manager.id,     readReport.id);
    await rf.grantPermission(admin.id,       deleteTask.id);
    await rf.grantPermission(auditor.id,     readReport.id);
    await rf.grantPermission(acmeManager.id, readTask.id);
    await rf.grantPermission(acmeManager.id, readReport.id);

    await rf.assignRole("alice", admin.id);        // global admin
    await rf.assignRole("bob",   acmeManager.id);  // manager inside acme only
    await rf.assignRole("carol", auditor.id);      // temporal auditor

    return rf;
}

import { RoleForge, StorageAdapter } from "@roleforge/core";
import type { Enforcer } from "casbin";
import { BenchmarkDataset, HIERARCHY_DEPTH, mulberry32, ROLE_COUNT, SUBJECT_COUNT } from "./dataset.js";

export async function seedRoleForgeModel(adapter: StorageAdapter, dataset: BenchmarkDataset): Promise<void> {
    const rf = await RoleForge.init({ adapter });
    const rnd = mulberry32(42);
    const roleIds: string[] = [];
    let parentId: string | null = null;
    for (let i = 0; i < ROLE_COUNT; i++) {
        if (i % HIERARCHY_DEPTH === 0) parentId = null;
        const role = await rf.createRole({ name: dataset.roleNames[i], parentId });
        roleIds.push(role.id);
        parentId = role.id;
    }
    for (const { action, resource } of dataset.permissions) {
        const permission = await rf.createPermission({ action, resource });
        await rf.grantPermission(roleIds[Math.floor(rnd() * ROLE_COUNT)], permission.id);
    }
    for (let s = 0; s < SUBJECT_COUNT; s++) {
        const subject = `subject-${String(s + 1).padStart(4, "0")}`;
        const count = 1 + Math.floor(rnd() * 3);
        const mine = new Set<string>();
        for (let k = 0; k < count; k++) {
            const roleId = roleIds[Math.floor(rnd() * ROLE_COUNT)];
            if (!mine.has(roleId)) { mine.add(roleId); await rf.assignRole(subject, roleId); }
        }
    }
}

export async function seedCasbinModel(enforcer: Enforcer, dataset: BenchmarkDataset): Promise<void> {
    const rnd = mulberry32(42);
    for (let i = 0; i < ROLE_COUNT; i++)
        if (i % HIERARCHY_DEPTH !== 0)
            await enforcer.addNamedGroupingPolicy("g", dataset.roleNames[i], dataset.roleNames[i - 1]);
    for (const { action, resource } of dataset.permissions)
        await enforcer.addPolicy(dataset.roleNames[Math.floor(rnd() * ROLE_COUNT)], resource, action);
    for (let s = 0; s < SUBJECT_COUNT; s++) {
        const subject = `subject-${String(s + 1).padStart(4, "0")}`;
        const count = 1 + Math.floor(rnd() * 3);
        const mine = new Set<string>();
        for (let k = 0; k < count; k++) {
            const role = dataset.roleNames[Math.floor(rnd() * ROLE_COUNT)];
            if (!mine.has(role)) { mine.add(role); await enforcer.addNamedGroupingPolicy("g", subject, role); }
        }
    }
}

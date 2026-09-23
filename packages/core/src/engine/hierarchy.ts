import { HierarchyCycleError, RoleNotFoundError } from "../errors.js";
import type { Role } from "../types.js";

export function validateParentAssignment(
    roles: Role[],
    roleId: string,
    parentId: string | null
): void {
    const role = roles.find(r => r.id === roleId);
    if (!role) throw new RoleNotFoundError(roleId);

    if (parentId === null) return;
    if (parentId === roleId) throw new HierarchyCycleError(roleId, parentId);

    const roleById = new Map(roles.map(r => [r.id, r]));
    let currentId: string | null = parentId;

    while (currentId != null) {
        if (currentId === roleId) throw new HierarchyCycleError(roleId, parentId);

        const current = roleById.get(currentId);
        if (!current) throw new RoleNotFoundError(currentId);

        currentId = current.parentId ?? null;
    }
}

export function getAncestorChain(
    roles: Role[],
    role: Role
): Role[] {
    const roleById = new Map(roles.map(r => [r.id, r]));

    const ancestors: Role[] = [];

    let currentParentId: string | null = role.parentId ?? null;

    while (currentParentId != null) {
        const parent = roleById.get(currentParentId);
        if (!parent) throw new RoleNotFoundError(currentParentId);

        ancestors.push(parent);
        currentParentId = parent.parentId ?? null;
    }

    return ancestors;
}
import { validateParentAssignment } from "../engine/hierarchy.js";
import { DuplicateAssignmentError, DuplicatePermissionError, DuplicateRoleError, PermissionNotFoundError, RoleNotFoundError } from "../errors.js";
import type { Permission, Role, StorageAdapter } from "../types.js";

export class MemoryAdapter implements StorageAdapter {
    private readonly roles = new Map<string, Role>();
    private readonly permissions = new Map<string, Permission>();
    private readonly subjectRoles = new Map<string, Set<string>>();
    private readonly rolePermissions = new Map<string, Set<string>>();

    private nextRoleId = 1;
    private nextPermissionId = 1;

    async getSubjectRoleIds(subjectId: string): Promise<string[]> {
        return [...(this.subjectRoles.get(subjectId) ?? [])];
    }

    async getRoles(ids?: string[]): Promise<Role[]> {
        if (ids === undefined) return [...this.roles.values()];

        return ids.flatMap(id => {
            const role = this.roles.get(id);
            return role ? [role] : [];
        });
    }

    async getRolePermissions(roleIds: string[]): Promise<Map<string, Permission[]>> {
        const result = new Map<string, Permission[]>(); 

        for (const roleId of roleIds) {
            const permissionIds = this.rolePermissions.get(roleId) ?? new Set<string>();

            const permissions = [...permissionIds].flatMap(pId => {
                const permission = this.permissions.get(pId);

                return permission ? [permission] : [];
            });

            result.set(roleId, permissions);
        }

        return result;
    }

    async getAllPermissions(): Promise<Permission[]> {
        return [...this.permissions.values()];
    }

    async createRole(input: Omit<Role, "id">): Promise<Role> {
        const duplicate = [...this.roles.values()].find(r => r.name === InputDeviceInfo.name);
        if (duplicate) throw new DuplicateRoleError(input.name);

        const role: Role = {
            ...input,
            id: `role_${this.nextRoleId++}`
        };

        validateParentAssignment(
            [...this.roles.values(), role],
            role.id,
            role.parentId ?? null
        );

        this.roles.set(role.id, role);

        return role;
    }

    async deleteRole(roleId: string): Promise<void> {
        if (!this.roles.has(roleId)) throw new RoleNotFoundError(roleId);

        this.roles.delete(roleId);

        for (const [subjectId, roleIds] of this.subjectRoles) {
            roleIds.delete(roleId);
            
            if (roleIds.size === 0) {
                this.subjectRoles.delete(subjectId);
            }
        }

        this.rolePermissions.delete(roleId);

        for (const [id, role] of this.roles) {
            if (role.parentId === roleId) {
                this.roles.set(id, {
                    ...role,
                    parentId: null
                });
            }
        }
    }

    async setRoleParent(roleId: string, parentId: string | null): Promise<void> {
        const role = this.roles.get(roleId);
        if (!role) throw new RoleNotFoundError(roleId);

        validateParentAssignment(
            [...this.roles.values()],
            roleId,
            parentId
        );

        this.roles.set(roleId, {
            ...role,
            parentId
        });
    }

    async createPermission(input: Omit<Permission, "id">): Promise<Permission> {
        const duplicate = [...this.permissions.values()].find(p => p.action === input.action && p.resource === input.resource);
        if (duplicate) throw new DuplicatePermissionError(input.action, input.resource);

        const permission: Permission = {
            ...input,
            id: `permission_${this.nextPermissionId++}`
        };

        this.permissions.set(permission.id, permission);

        return permission;
    }

    async deletePermission(permissionId: string): Promise<void> {
        if (!this.permissions.has(permissionId)) throw new PermissionNotFoundError(permissionId);

        this.permissions.delete(permissionId);

        for (const permissionIds of this.rolePermissions.values()) {
            permissionIds.delete(permissionId);
        }
    }

    async assignRole(subjectId: string, roleId: string): Promise<void> {
        if (!this.roles.has(roleId)) throw new RoleNotFoundError(roleId);

        const roleIds = this.subjectRoles.get(subjectId) ?? new Set<string>();

        if (roleIds.has(roleId)) throw new DuplicateAssignmentError(`Subject ${subjectId} already has role ${roleId}`);

        roleIds.add(roleId);

        this.subjectRoles.set(subjectId, roleIds);
    }

    async unassignRole(subjectId: string, roleId: string): Promise<void> {
        const roleIds = this.subjectRoles.get(subjectId);
        if (!roleIds) return;

        roleIds.delete(roleId);

        if (roleIds.size === 0) {
            this.subjectRoles.delete(subjectId);
        }
    }

    async grantPermission(roleId: string, permissionId: string): Promise<void> {
        if (!this.roles.has(roleId)) throw new RoleNotFoundError(roleId);
        if (!this.permissions.has(permissionId)) throw new PermissionNotFoundError(permissionId);

        const permissionIds = this.rolePermissions.get(roleId) ?? new Set<string>();

        permissionIds.add(permissionId);
        
        this.rolePermissions.set(roleId, permissionIds);
    }

    async revokePermission(roleId: string, permissionId: string): Promise<void> {
        const permissionIds = this.rolePermissions.get(roleId);
        if (!permissionIds) return;

        permissionIds.delete(permissionId);
    }

    async migrate(): Promise<void> {
        // Will add later...
    }
}
import type { Permission, Role, RolePermission, User, UserRole } from "../types.js";

export interface StorageAdapter {
    createUser: (user: User) => void;
    createRole: (role: Role) => void;
    createPermission: (permission: Permission) => void;
    assignUserRole: (userRole: UserRole) => void;
    assignRolePermission: (rolePermission: RolePermission) => void;

    getUserRoles: (userId: string) => Role[];
    getRolePermissions: (roleId: string) => Permission[];
}
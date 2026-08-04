import type { Permission, Role } from "../types.js";

export interface StorageAdapter {
    getUserRoles: (userId: string) => Role[];
    getRolePermissions: (roleId: string) => Permission[];
}
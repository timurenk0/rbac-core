import type { StorageAdapter } from "../../adapters/StorageAdapter.js";
import type { Role, Permission } from "../../types.js";

export class PermissionResolver {
    constructor(
        private readonly storage: StorageAdapter
    ) {}


    getUserPermissions(userId: string) {
        const userPermissions: Record<string, string[]> = {};

        const userRoles = this.storage.getUserRoles(userId);
        for (const role of userRoles) {
            const permissions = this.storage.getRolePermissions(role.id);
        
        }
    }
}
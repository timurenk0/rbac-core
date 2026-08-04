import type { StorageAdapter } from "../../adapters/StorageAdapter.js";
import type { Permission, Role } from "../../types.js";

export class Evaluator {
    constructor(
        private readonly storage: StorageAdapter
    ) {}
    
    async can(userId: string, action: string, resource: string): Promise<boolean> {
        const userRoles = await this.storage.getUserRoles(userId);


        for (const role of userRoles) {
            const rolePermissions = await this.storage.getRolePermissions(role.id);

            if (rolePermissions.some(p => p.action === action && p.resource === resource)) return true;
        }
        
        return false;
    }
}
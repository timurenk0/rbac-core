import type { Permission, Role, RolePermission, User, UserRole } from "../../types.js";
import type { StorageAdapter } from "../StorageAdapter.js";

export class MemoryAdapter implements StorageAdapter {
    private users: User[] = [];    
    private roles: Role[] = [];    
    private permissions: Permission[] = [];
    
    private userRoles: UserRole[] = [];
    private rolePermissions: RolePermission[] = [];
    
    createUser(user: User) {
        this.users.push(user);
    }

    createRole(role: Role) {
        this.roles.push(role);
    }

    createPermission(permission: Permission) {
        this.permissions.push(permission);
    }

    createUserRole(userRole: UserRole) {
        this.userRoles.push(userRole);
    }

    createRolePermission(rolePermission: RolePermission) {
        this.rolePermissions.push(rolePermission);
    }
    
    getUserRoles(userId: string) {
        const roleIds = this.userRoles.filter(ur => ur.userId === userId).map(ur => ur.roleId); 
        
        return this.roles.filter(r => roleIds.includes(r.id));
    }

    getRolePermissions(roleId: string) {
        const permissionIds = this.rolePermissions.filter(rp => rp.roleId === roleId).map(rp => rp.permissionId);

        return this.permissions.filter(p => permissionIds.includes(p.id));
    }
}
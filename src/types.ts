export interface User {
    id: string;
    username: string;
}

export interface Role {
    id: string;
    name: string;
}

export interface Permission {
    id: string;
    resource: string;
    action: string;
}

export interface UserRole {
    userId: string;
    roleId: string;
}

export interface RolePermission {
    roleId: string;
    permissionId: string;
}
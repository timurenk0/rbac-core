export interface Subject {
    readonly id: string;
}

export interface Role {
    readonly id: string;
    readonly parentId?: string | null;
    readonly name: string;
    readonly meta?: Record<string, unknown>;
}

export interface Permission {
    readonly id: string;
    readonly action: string;
    readonly resource: string;
}

export interface RoleAssignment {
    readonly subjectId: string;
    readonly roleId: string;
}

export interface RolePermissionAssignment {
    readonly roleId: string;
    readonly permissionId: string;
}

export interface Edge {
    readonly from: string;
    readonly to: string;
}

export interface CheckRequest<Context = unknown> {
    readonly subject: string;
    readonly action: string;
    readonly resource: string;
    readonly context?: Context;
}

export type ConditionVerdict =
    | {
        readonly admissible: true;
    }
    | {
        readonly admissible: false;
        readonly reason: string
    }

export interface ConditionResolver<Context = unknown> {
    readonly name: string;

    resolve(input: {
        readonly subject: Subject;
        readonly role: Role;
        readonly context: Context;
        readonly now: Date;
    }): Promise<ConditionVerdict> | ConditionVerdict;
}

export interface TraceCondition {
    readonly plugin: string;
    readonly admissible: boolean;
    readonly reason?: string;
}

export interface TraceNode {
    readonly roleId: string;
    readonly roleName: string;
    readonly source:
    | "direct"
    | {
        readonly inheritedVia: string;
    };
    readonly conditions: TraceCondition[];
    readonly matchedPermissions?: {
        readonly action: string;
        readonly resource: string;
    };
}

export interface Decision {
    readonly granted: boolean;
    readonly subject: string;
    readonly action: string;
    readonly resource: string;
    readonly evaluatedAt: string;
    readonly trace: TraceNode[]
}

export interface Graph {
    readonly roles: Role[];
    readonly permissions: Permission[];
    readonly rolePermissions: Edge[];
    readonly hierarchy: Edge[];
}

export interface SubjectRoles {
    readonly direct: Role[];
    readonly effective: Role[];
}

export interface CacheOptions {
    readonly enabled?: boolean;
    readonly ttlMs?: number;
}

export interface StorageAdapter {
    getSubjectRoleIds(subjectId: string): Promise<string[]>;

    getRoles(ids?: string[]): Promise<Role[]>;

    getRolePermissions(roleIds: string[]): Promise<Map<string, Permission[]>>;

    getAllPermissions(): Promise<Permission[]>;

    createRole(role: Omit<Role, "id">): Promise<Role>;

    deleteRole(roleId: string): Promise<void>;

    setRoleParent(roleId: string, parentId: string | null): Promise<void>;

    createPermission(permission: Omit<Permission, "id">): Promise<Permission>;

    deletePermission(permissionId: string): Promise<void>;

    assignRole(subjectId: string, roleId: string): Promise<void>;    

    unassignRole(subjectId: string, roleId: string): Promise<void>;    

    grantPermission(roleId: string, permissionId: string): Promise<void>;

    revokePermission(roleId: string, permissionId: string): Promise<void>;

    migrate(): Promise<void>;
}
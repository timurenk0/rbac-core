export class RoleForgeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RoleForgeError";
    }
}

export class RoleNotFoundError extends RoleForgeError {
    constructor(roleId: string) {
        super(`Role ${roleId} does not exist`);
        this.name = "RoleNotFoundError";
    }
}

export class PermissionNotFoundError extends RoleForgeError {
    constructor(permissionId: string) {
        super(`Permission ${permissionId} does not exist`);
        this.name = "PermissionNotFoundError";
    }
}

export class HierarchyCycleError extends RoleForgeError {
    constructor(roleId: string, parentId: string) {
        super(`Assigning parent ${parentId} to role ${roleId} would create a hierarchy cycle`);
        this.name = "HierarchyCycleError";
    }
}

export class DuplicateRoleError extends RoleForgeError {
    constructor(roleName: string) {
        super(`Role named ${roleName} already exists`);
        this.name = "DuplicateRoleError";
    }
}

export class DuplicatePermissionError extends RoleForgeError {
    constructor(action: string, resource: string) {
        super(`Permission ${action}:${resource} already exists`);
        this.name = "DuplicatePermissionError";
    }
}

export class DuplicateAssignmentError extends RoleForgeError {
    constructor(message: string) {
        super(message);
        this.name = "DuplicateAssignmentError";
    }
}
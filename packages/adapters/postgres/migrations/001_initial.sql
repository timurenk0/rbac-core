CREATE TABLE IF NOT EXISTS rbac_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rbac_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    parent_id TEXT NULL,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT rbac_roles_parent_fk
        FOREIGN KEY (parent_id)
        REFERENCES rbac_roles(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS rbac_permissions (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,

    CONSTRAINT rbac_permissions_action_resource_unique
        UNIQUE (action, resource)
);

CREATE TABLE IF NOT EXISTS rbac_role_permissions (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,

    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT rbac_role_permissions_role_fk
        FOREIGN KEY (role_id)
        REFERENCES rbac_roles(id)
        ON DELETE CASCADE,

    CONSTRAINT rbac_role_permissions_permission_fk
        FOREIGN KEY (permission_id)
        REFERENCES rbac_permissions(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rbac_subject_roles (
    subject_id TEXT NOT NULL,
    role_id TEXT NOT NULL,

    PRIMARY KEY (subject_id, role_id),

    CONSTRAINT rbac_subject_roles_role_fk
        FOREIGN KEY (role_id)
        REFERENCES rbac_roles(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS rbac_roles_parent_id_idx
    ON rbac_roles(parent_id);

CREATE INDEX IF NOT EXISTS rbac_role_permissions_permission_id_idx
    ON rbac_role_permissions(permission_id);

CREATE INDEX IF NOT EXISTS rbac_subject_roles_role_id_idx
    ON rbac_subject_roles(role_id);
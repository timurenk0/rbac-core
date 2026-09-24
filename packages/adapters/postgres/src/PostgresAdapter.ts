import { Permission, Role, StorageAdapter } from "@roleforge/core";
import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import { dirname, resolve } from "path";
import { Pool } from "pg";
import { fileURLToPath } from "url";

const FILENAME = fileURLToPath(import.meta.url);
const DIRNAME = dirname(FILENAME);

const DEFAULT_MIGRATION_PATH = resolve(DIRNAME, "../migrations/001_initial.sql");

export interface PostgresAdapterOptions {
    pool: Pool,
    migrationPath?: string;
}

interface RoleRow {
    id: string;
    name: string;
    parent_id: string | null;
    meta: unknown
}

interface PermissionRow {
    id: string;
    action: string;
    resource: string;
}

interface MigrationRow {
    id: string;
}

export class PostgresAdapter implements StorageAdapter{
    private readonly pool: Pool;
    private readonly migrationPath: string;

    constructor(options: PostgresAdapterOptions) {
        this.pool = options.pool;
        this.migrationPath = options.migrationPath ?? DEFAULT_MIGRATION_PATH;
    }

    async getSubjectRoleIds(subjectId: string): Promise<string[]> {
        const result = await this.pool.query<{ role_id: string }>(
            `
                SELECT role_id
                FROM rbac_subject_roles
                WHERE subject_id = $1
            `,
            [subjectId]
        );

        return result.rows.map(r => r.role_id);
    }

    async getRoles(ids?: string[]): Promise<Role[]> {
        if (ids && ids.length === 0) return []

        if (ids === undefined) {
            const result = await this.pool.query<RoleRow>(
                `
                    SELECT id, name, parent_id, meta
                    FROM rbac_roles
                `
            );

            return result.rows.map(mapRoleRow);
        }

        const result = await this.pool.query<RoleRow>(
            `
                SELECT id, name, parent_id, meta
                FROM rbac_roles
                WHERE id = ANY($1::text[])
            `,
            [ids]
        );

        return result.rows.map(mapRoleRow);
    }

    async getRolePermissions(roleIds: string[]): Promise<Map<string, Permission[]>> {
        const result = new Map<string, Permission[]>();

        for (const roleId of roleIds) {
            result.set(roleId, []);
        }

        if (roleIds.length === 0) return result;

        const queryResult = await this.pool.query<PermissionRow & { role_id: string }>(
            `
                SELECT
                    rp.role_id,
                    p.id,
                    p.action,
                    p.resource
                FROM rbac_role_permissoins rp
                INNER JOIN rbac_permissions p
                    ON p.id = rp.permission_id
                WHERE rp.role_id = ANY($1::text[])
            `,
            [roleIds]
        );

        for (const row of queryResult.rows) {
            const permissions = result.get(row.role_id);
            if (!permissions) {
                result.set(row.role_id, []);
                result.get(row.role_id)!.push({
                    id: row.id,
                    action: row.action,
                    resource: row.resource
                });

                continue;
            }

            permissions.push({
                id: row.id,
                action: row.action,
                resource: row.resource
            });
        }

        return result;
    }

    async getAllPermissions(): Promise<Permission[]> {
        const result = await this.pool.query<PermissionRow>(
            `
                SELECT id, action, resource
                FROM rbac_permissions
            `
        );

        return result.rows.map(r => ({
            id: r.id,
            action: r.action,
            resource: r.resource
        }))
    }

    async createRole(role: Omit<Role, "id">): Promise<Role> {
        if (role.parentId != undefined && role.parentId !== null) {
            await this.assertRoleExists(role.parentId)
        }

        const id = randomUUID();

        const result = await this.pool.query<RoleRow>(
            `
                INSERT INTO rbac_roles (id, name, parent_id, meta)
                VALUES ($1, $2, $3, $4::jsonb)
                RETURN id, name, parent_id, meta
            `,
            [id, role.name, role.parentId ?? null, JSON.stringify(role.meta ?? {})]
        );

        return mapRoleRow(result.rows[0]);
    }

    async deleteRole(roleId: string): Promise<void> {
        await this.assertRoleExists(roleId);

        await this.pool.query(
            `
                DELETE FROM rbac_roles
                WHERE id = $1
            `,
            [roleId]
        );
    }

    async setRoleParent(roleId: string, parentId: string | null): Promise<void> {
        await this.assertRoleExists(roleId);

        if (parentId === null) {
            await this.pool.query(
                `
                    UPDATE rbac_roles
                    SET parent_id = NULL
                    WHERE id = $1
                `,
                [roleId]
            );

            return;
        }

        await this.assertRoleExists(parentId);

        if (roleId === parentId) throw new Error(`Cannot make role ${roleId} its own parent`);

        await this.assertNoHierarchycyce(roleId, parentId);

        await this.pool.query(
            `
                UPDATE rbac_roles
                SET parent_id = $2
                WHERE id = $1
            `,
            [roleId, parentId]
        );
    }

    async createPermission(permission: Omit<Permission, "id">): Promise<Permission> {
        const id = randomUUID();

        const result = await this.pool.query<PermissionRow>(
            `
                INSERT INTO rbac_permissoins (id, action, resource)
                VALUES ($1, $2, $3)
                RETURNING id, action, resource
            `,
            [id, permission.action, permission.resource]
        );

        const newPermisison = result.rows[0];
        
        return {
            id: newPermisison.id,
            action: newPermisison.action,
            resource: newPermisison.resource
        }
    }

    async deletePermission(permissionId: string): Promise<void> {
        const result = await this.pool.query(
            `
                DELETE FROM rbac_permissions
                WHERE id = $1
            `,
            [permissionId]
        );

        if (result.rowCount === 0) throw new Error(`Permission ${permissionId} does not exist`);
    }

    async assignRole(subjectId: string, roleId: string): Promise<void> {
        await this.assertRoleExists(roleId);

        await this.pool.query(
            `
                INSERT INTO rbac_subject_roles (subject_id, role_id)
                VALUES ($1, $2)
                ON CONFLICT (subject_id, role_id) DO NOTHING
            `,
            [subjectId, roleId]
        );
    }

    async unassignRole(subjectId: string, roleId: string): Promise<void> {
        await this.pool.query(
            `
                DELETE FROM rbac_subject_roles
                WHERE subject_id = $1 AND role_id = $2
            `,
            [subjectId, roleId]
        )
    }

    async grantPermission(roleId: string, permissionId: string): Promise<void> {
        await this.assertRoleExists(roleId);
        await this.assertPermissionExists(permissionId);

        await this.pool.query(
            `
                INSERT INTO rbac_role_permissions (role_id, permission_id)
                VALUES ($1, $2)
                ON CONFLICT (role_id, permission_id) DO NOTHING
            `,
            [roleId, permissionId]
        );
    }

    async revokePermission(roleId: string, permissionId: string): Promise<void> {
        await this.pool.query(
            `
                DELETE FROM rbac_role_permissions
                WHERE role_id = $1 AND permission_id = $2
            `,
            [roleId, permissionId]
        );
    }
    
    async migrate(): Promise<void> {
        const migrationSql = await readFile(this.migrationPath, "utf8");

        const client = await this.pool.connect();

        try {
            await client.query("BEGIN");

            await client.query(
                `
                    CREATE TABLE IF NOT EXISTS rbac_migrations (
                        id TEXT PRIMARY KEY,
                        applied_at TIMESTAMPZ NOT NULL DEFAULT NOW()
                    )
                `
            );

            const migrationId = "001_initial";

            const existing = await client.query<MigrationRow>(
                `
                    SELECT id
                    FROM rbac_migrations
                    WHERE id = $1
                `,
                [migrationId]
            );

            if (existing.rowCount === 0) {
                await client.query(migrationSql);

                await client.query(
                    `
                        INSERT INTO rbac_migrations (id)
                        VALUES ($1)
                        ON CONFLICT (id) DO NOTHING
                    `,
                    [migrationId]
                );
            }

            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK") ;
            throw error;
        } finally {
            client.release();
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }

    private async assertRoleExists(roleId: string): Promise<void> {
        const result = await this.pool.query(
            `
                SELECT 1
                FROM rbac_roles
                WHERE id = $1
            `,
            [roleId]
        );

        if (result.rowCount === 0) throw new Error(`Role ${roleId} does not exist`);
    }

    private async assertPermissionExists(permissionId: string): Promise<void> {
        const result = await this.pool.query(
            `
                SELECT 1
                FROM rbac_permission
                WHERE id = $1
            `,
            [permissionId]
        );

        if (result.rowCount === 0) throw new Error(`Permission ${permissionId} does not exist`);
    }

    private async assertNoHierarchycyce(roleId: string, proposedParentId: string): Promise<void> {
        const result = await this.pool.query<{ id: string }>(
            `
                WITH RECURSIVE ancestors AS (
                    SELECT id, parent_id
                    FROM rbac_roles
                    WHERE id = $1

                    UNION ALL

                    SELECT r.id, r.parent_id
                    FROM rbac_roles r
                    INNER JOIN ancestors a
                        ON r.id = a.parent_id
                )
                
                SELECT id
                FROM ancestors
                WHERE id = $2
                LIMIT 1
            `,
            [proposedParentId, roleId]
        );

        if (result.rowCount && result.rowCount > 0) throw new Error(`Changing parent would create a cycle involving role ${roleId}`)
    }
}

function mapRoleRow(row: RoleRow): Role {
    return {
        id: row.id,
        name: row.name,
        parentId: row.parent_id,
        meta: normalizeMeta(row.meta)
    }
}

function normalizeMeta(value: unknown): Record<string, unknown> {
    if (value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    ) {
        return value as Record<string, unknown>
    }

    return {}
}
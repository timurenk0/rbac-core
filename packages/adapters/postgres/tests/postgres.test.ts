import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createPostgresPool, PostgresAdapter } from "../src/index.js"

const databaseUrl = process.env.TEST_DATABASE_URL;

const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase("PostgreSQL Adapter", () => {
  const pool = createPostgresPool({
    connectionString: databaseUrl
  });

  const adapter = new PostgresAdapter({ pool });

  beforeAll(async () => {
    await adapter.migrate();
  });
  
  beforeEach(async () => {
    await pool.query(`
            TRUNCATE TABLE
                rbac_subject_roles,
                rbac_role_permissions,
                rbac_permissions,
                rbac_roles
            CASCADE
        `)
  })

  afterAll(async () => {
    await pool.end();
  });

  it("creates role", async () => {
    const role = await adapter.createRole({
        name: "manager",
        parentId: null,
        meta: {}
    });

    expect(role.name).toBe("manager");
    expect(role.parentId).toBeNull();
  });

  it("creates a role with a parent", async () => {
    const parent = await adapter.createRole({
        name: "parent",
        parentId: null,
        meta: {}
    });

    const child = await adapter.createRole({
        name: "child",
        parentId: parent.id,
        meta: {}
    });

    expect(child.parentId).toBe(parent.id);
  });

  it("loads roles", async () => {
    const role = await adapter.createRole({
        name: "engineer",
        parentId: null,
        meta: {
            department: "software engineering"
        }
    });

    const roles = await adapter.getRoles([role.id]);

    expect(roles).toHaveLength(1);
    expect(roles[0]).toEqual(role);
  });

  it("assigns roles to subjects", async () => {
    const role = await adapter.createRole({
        name: "manager",
        parentId: null,
        meta: {}
    });

    await adapter.assignRole("subject-1", role.id);

    expect(await adapter.getSubjectRoleIds("subject-1")).toEqual([role.id]);
  });

  it("creates and grants permissions", async () => {
    const role = await adapter.createRole({
        name: "admin",
        parentId: null,
        meta: {}
    });

    const permission = await adapter.createPermission({
        action: "delete",
        resource: "task"
    });

    await adapter.grantPermission(role.id, permission.id);

    const permissions = await adapter.getRolePermissions([role.id]);

    expect(permissions.get(role.id)).toEqual([permission]);
  });

  it("prevents hierarchy cycles", async () => {
    const a = await adapter.createRole({
        name: "a",
        parentId: null,
        meta: {}
    });

    const b = await adapter.createRole({
        name: "b",
        parentId: a.id,
        meta: {}
    });

    await expect(
        adapter.setRoleParent(a.id, b.id)
    ).rejects.toThrow(/cycle/i);
  });

  it("allows removing a role parent", async () => {
    const parent = await adapter.createRole({
        name: "parent",
        parentId: null,
        meta: {}
    });

    const child = await adapter.createRole({
        name: "child",
        parentId: parent.id,
        meta: {}
    });

    await adapter.setRoleParent(child.id, null);

    const roles = await adapter.getRoles([child.id]);
  
    expect(roles[0].parentId).toBeNull();
  });

  it("is idempotent when migrate is called twice", async () => {
    await adapter.migrate();
    await adapter.migrate();

    const result = await pool.query(
        `
            SELECT id
            FROM rbac_migrations
        `
    );

    expect(
        result.rows.filter(r => r.id === "001_initial")
    ).toHaveLength(1);
  });

  it("unassigns roles", async () => {
    const role = await adapter.createRole({
        name: "manager",
        parentId: null,
        meta: {}
    });

    await adapter.assignRole("subject-1", role.id);
    await adapter.unassignRole("subject-1", role.id);

    expect(
        await adapter.getSubjectRoleIds("subject-1")
    ).toEqual([]);
  });

  it("revokes permissions", async () => {
    const role = await adapter.createRole({
        name: "admin",
        parentId: null,
        meta: {}
    });

    const permission = await adapter.createPermission({
        action: "delete",
        resource: "task"
    });

    await adapter.grantPermission(role.id, permission.id);
    await adapter.revokePermission(role.id, permission.id);

    const permissions = await adapter.getRolePermissions([role.id]);

    expect(permissions.get(role.id)).toEqual([]);
  });
})
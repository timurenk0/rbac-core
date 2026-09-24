import { beforeEach, describe, expect, it } from "vitest";
import { DuplicatePermissionError, DuplicatePluginError, DuplicateRoleError, MemoryAdapter, PermissionNotFoundError, RoleForge, RoleNotFoundError } from "../src/index.js";

describe("management API", () => {
    let adapter: MemoryAdapter;
    let rf: RoleForge;

    beforeEach(async () => {
        adapter = new MemoryAdapter();
        rf = await RoleForge.init({
            adapter
        });
    });

    it("creates roles", async () => {
        const role = await rf.createRole({
            name: "manager"
        });

        expect(role.id).toBeDefined();
        expect(role.name).toBe("manager");
    });

    it("rejects duplicate role names", async () => {
        await rf.createRole({
            name: "manager"
        });

        await expect(
            rf.createRole({
            name: "manager"
            })
        ).rejects.toBeInstanceOf(DuplicateRoleError);
    });

    it("creates and grants permissions", async () => {
        const role = await rf.createRole({
            name: "manager"
        });

        const permission = await rf.createPermission({
            action: "update",
            resource: "task"
        });

        await rf.grantPermission(role.id, permission.id);

        await rf.assignRole("user-1", role.id);

        await expect(
            rf.check({
                subject: "user-1",
                action: "update",
                resource: "task"
            })
        ).resolves.toBe(true);
    });

    it("rejects duplicate permissions", async () => {
        await rf.createPermission({
            action: "read",
            resource: "task"
        });

        await expect(
            rf.createPermission({
                action: "read",
                resource: "task"
            })
        ).rejects.toBeInstanceOf(DuplicatePermissionError);
    });

    it("supports revoking permissions", async () => {
        const role = await rf.createRole({
            name: "manager"
        });

        const permission = await rf.createPermission({
            action: "delete",
            resource: "task"
        });


        await rf.grantPermission(role.id, permission.id);

        await rf.assignRole("user-1", role.id);

        await expect(
            rf.check({
                subject: "user-1",
                action: "delete",
                resource: "task"
            })
        ).resolves.toBe(true);
    
        await rf.revokePermission(role.id, permission.id);

        await expect(
            rf.check({
                subject: "user-1",
                action: "delete",
                resource: "task"
            })
        ).resolves.toBe(false);
    });

    it("supports unassigning roles", async () => {
        const role = await rf.createRole({
            name: "manager"
        });

        const permission = await rf.createPermission({
            action: "read",
            resource: "task"
        });

        await rf.grantPermission(role.id, permission.id);

        await rf.assignRole("user-1", role.id);

        await rf.unassignRole("user-1", role.id);

        await expect(
            rf.check({
                subject: "user-1",
                action: "read",
                resource: "task"
            })
        ).resolves.toBe(false);
    });

    it("reports graph structure", async () => {
        const admin = await rf.createRole({
            name: "admin"
        });

        const manager = await rf.createRole({
            name: "manager",
            parentId: admin.id
        });

        const permission = await rf.createPermission({
            action: "read",
            resource: "task"
        });

        await rf.grantPermission(admin.id, permission.id);

        const graph = await rf.graph();

        expect(graph.roles).toHaveLength(2);
        expect(graph.permissions).toHaveLength(1);

        expect(graph.rolePermissions).toContainEqual({
            from: admin.id,
            to: permission.id
        });
    });
    
    it("reports direct and effective subject roles", async () => {
        const admin = await rf.createRole({
            name: "admin"
        });

        const manager = await rf.createRole({
            name: "manager",
            parentId: admin.id
        });

        await rf.assignRole("user-1", manager.id);

        const result = await rf.subjectRoles("user-1");

        expect(
            result.direct.map(role => role.name)
        ).toEqual(["manager"]);

        expect(
            result.effective.map(role => role.name)
        ).toEqual(["manager", "admin"]);
    });

    it("rejects operations on missing roles", async () => {
        await expect(
            rf.assignRole("user-1", "missing")
        ).rejects.toBeInstanceOf(RoleNotFoundError);
    });

    it("rejects granting missing permissions", async () => {
        const role = await rf.createRole({
            name: "manager"
        });

        await expect(
            rf.grantPermission(role.id, "missing")
        ).rejects.toBeInstanceOf(PermissionNotFoundError);
    });

    it("rejects duplicate plugin names", async () => {
        const plugin = {
            name: "temporal",
            resolve: () => ({ admissible: true as const })
        }

        await expect(
            RoleForge.init({
                adapter,
                plugins: [plugin, plugin]
            })
        ).rejects.toBeInstanceOf(DuplicatePluginError);
    });
})
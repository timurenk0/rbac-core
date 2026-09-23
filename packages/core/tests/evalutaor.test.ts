import { beforeEach, describe, expect, it } from "vitest"
import { MemoryAdapter, RoleForge } from "../src/index.js"

describe("RoleForge evaluation", () => {
    let adapter: MemoryAdapter;
    let rf: RoleForge;
    
    beforeEach(async () => {
        adapter = new MemoryAdapter();
        rf = await RoleForge.init({ adapter });
    });
    
    
    it("grants a permission assigned directly to a role", async () => {
        const role = await rf.createRole({ name: "manager" });

        const permission = await rf.createPermission({
            action: "read",
            resource: "task"
        });

        await rf.grantPermission(role.id, permission.id);

        await rf.assignRole("user-1", role.id);

        await expect(
            rf.check({
                subject: "user-1",
                action: "read",
                resource: "task"
            })
        ).resolves.toBe(true);
    });

    it ("denies when no matching permission exists", async () => {
        const role = await rf.createRole({ name: "viewer" });


        await rf.assignRole("user-1", role.id);

        await expect(
            rf.check({
                subject: "user-1",
                action: "delete",
                resource: "task"
            })
        ).resolves.toBe(false);
    });

    it("inherits permissions from parent roles", async () => {
        const admin = await rf.createRole({
            name: "admin"
        });

        const manager = await rf.createRole({
            name: "manager",
            parentId: admin.id
        });

        const permission = await rf.createPermission({
            action: "delete",
            resource: "task"
        });

        await rf.grantPermission(admin.id, permission.id);

        await rf.assignRole("user-1", manager.id);

        await expect(
            rf.check({
                subject: "user-1",
                action: "delete",
                resource: "task"
            })
        ).resolves.toBe(true);
    });

    it("does not inherit permissions from child roles", async () => {
        const admin = await rf.createRole({
            name: "admin"
        });

        const manager = await rf.createRole({
            name: "manager",
            parentId: admin.id
        });

        const permission = await rf.createPermission({
            action: "delete",
            resource: "task"
        });

        await rf.grantPermission(manager.id, permission.id);

        await rf.assignRole("user-1", admin.id);

        await expect(
            rf.check({
                subject: "user-1",
                action: "delete",
                resource: "task"
            })
        ).resolves.toBe(false);
    });

    it("returns a complete successful trace", async () => {
        rf = await RoleForge.init({
            adapter,
            clock: () => new Date("2026-09-23T12:00:00.000Z")
        });

        const admin = await rf.createRole({
            name: "admin"
        });

        const manager = await rf.createRole({
            name: "manager",
            parentId: admin.id
        });

        const permissoin = await rf.createPermission({
            action: "delete",
            resource: "task"
        });

        await rf.grantPermission(admin.id, permissoin.id);

        await rf.assignRole("user-1", manager.id);

        const decision = await rf.explain({
            subject: "user-1",
            action: "delete",
            resource: "task"
        });

        expect(decision.granted).toBe(true);

        expect(decision.evaluatedAt).toBe("2026-09-23T12:00:00.000Z");

        expect(decision.trace).toHaveLength(2);

        expect(decision.trace[0]?.source).toBe("direct");

        expect(decision.trace[1]?.source).toEqual({
            inheritedVia: manager.id
        });
    });
});
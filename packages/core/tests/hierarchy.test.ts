import { beforeEach, describe, expect, it } from "vitest";
import { HierarchyCycleError, MemoryAdapter, RoleForge } from "../src/index.js";


describe("role hierarchy", () => {
    let adapter: MemoryAdapter;
    let rf: RoleForge;
    
    beforeEach(async () => {
        adapter = new MemoryAdapter();
        rf = await RoleForge.init({ adapter });
    });

    it("rejects assigning a role as its own parent", async () => {
        const role = await rf.createRole({
            name: "admin"
        });

        await expect(
            rf.setRoleParent(role.id, role.id)
        ).rejects.toBeInstanceOf(HierarchyCycleError);
    });

    it("rejects indirect hierarchy cycles", async () => {
        const a = await rf.createRole({
            name: "a"
        });

        const b = await rf.createRole({
            name: "b",
            parentId: a.id
        });

        const c = await rf.createRole({
            name: "c",
            parentId: b.id
        });

        await expect(
            rf.setRoleParent(a.id, c.id)
        ).rejects.toBeInstanceOf(HierarchyCycleError);
    });

    it("allows detaching a role from its parent", async () => {
        const parent = await rf.createRole({
            name: "parent"
        });

        const child = await rf.createRole({
            name: "child",
            parentId: parent.id
        });

        await rf.setRoleParent(child.id, null);

        const roles = await adapter.getRoles([child.id]);

        expect(roles[0]?.parentId).toBeNull();
    })
})
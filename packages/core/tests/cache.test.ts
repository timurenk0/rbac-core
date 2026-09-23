import { beforeEach, describe, expect, it } from "vitest";
import { MemoryAdapter, RoleForge } from "../src/index.js";

describe("authorization model cache", () => {
    let adapter: MemoryAdapter;
    let rf: RoleForge;
    
    beforeEach(async () => {
        adapter = new MemoryAdapter();
        rf = await RoleForge.init({
            adapter
        });
    });

    it("reflects writes immediately after cache invalidation", async () => {
        const rf = await RoleForge.init({
            adapter,
            cache: {
                enabled: true,
                ttlMs: 60000
            }
        });
        
        const role = await rf.createRole({
            name: "viewer"
        });

        const permission = await rf.createPermission({
            action: "read",
            resource: "task"
        });

        await rf.assignRole("user-1", role.id);

        await expect(
            rf.check({
                subject: "user-1",
                action: "read",
                resource: "task"
            })
        ).resolves.toBe(false);
        
        await rf.grantPermission(role.id, permission.id);

        await expect(
            rf.check({
                subject: "user-1",
                action: "read",
                resource: "task"
            })
        ).resolves.toBe(true);
    });

    it("supports disabled caching", async () => {
        const rf = await RoleForge.init({
            adapter,
            cache: {
                enabled: false
            }
        });

        const role = await rf.createRole({
            name: "viewer"
        });

        const permission = await rf.createPermission({
            action: "read",
            resource: "task"
        });

        await rf.assignRole("user-1", role.id);

        await rf.grantPermission(role.id, permission.id);

        await expect(
            rf.check({
                subject: "user-1",
                action: "read",
                resource: "task"
            })
        ).resolves.toBe(true);
    });
})
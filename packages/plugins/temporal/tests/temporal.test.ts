import { beforeEach, describe, expect, it } from "vitest"
import { MemoryAdapter, RoleForge } from "@roleforge/core";
import { temporalPlugin } from "../src/index.js"

describe("temporal RBAC ", () => {
    let adapter: MemoryAdapter;
    let rf: RoleForge;
    
    beforeEach(async () => {
        adapter = new MemoryAdapter();
        rf = await RoleForge.init({
            adapter
        });
    });
    
    it("allows a role inside its configured hours", async () => {
        rf = await RoleForge.init({
            adapter,
            plugins: [
                temporalPlugin
            ],
            clock: () => new Date("2026-09-23T23:00:00")
        });

        const role = await rf.createRole({
            name: "night-viewer",
            meta: {
                temporal: {
                    hours: {
                        from: "22:00",
                        until: "06:00"
                    }
                }
            }
        });

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

    it("rejects a role outside its configured hours", async () => {
        rf = await RoleForge.init({
            adapter,
            plugins: [
                temporalPlugin
            ],
            clock: () => new Date("2026-09-23T12:00:00")
        });

        const role = await rf.createRole({
            name: "night-viewer",
            meta: {
                temporal: {
                    hours: {
                        from: "22:00",
                        until: "06:00"
                    }
                }
            }
        });

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
        ).resolves.toBe(false);
    });

    it("handles midnight-spanning intervals", async () => {
        const rf = await RoleForge.init({
            adapter,
            plugins: [
                temporalPlugin
            ],
            clock: () => new Date("2026-09-24T02:30:00")
        });

        const role = await rf.createRole({
            name: "night-viewer",
            meta: {
                temporal: {
                    hours: {
                        from: "22:00",
                        until: "06:00"
                    }
                }
            }
        });

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

    it("rejects exactly at the end boundary", async () => {
        const rf = await RoleForge.init({
        adapter,
        plugins: [
            temporalPlugin
        ],
        clock: () => new Date("2026-09-24T06:00:00")
        });

        const role = await rf.createRole({
            name: "night-viewer",
            meta: {
                temporal: {
                    hours: {
                        from: "22:00",
                        until: "06:00"
                    }
                }
            }
        });

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
        ).resolves.toBe(false);
    });

    it("enforces validFrom", async () => {
        const rf = await RoleForge.init({
            adapter,
            plugins: [
                temporalPlugin
            ],
            clock: () => new Date("2026-09-23T21:00:00")
        });

        const role = await rf.createRole({
            name: "future-viewer",
            meta: {
                temporal: {
                    validFrom: "2026-09-23T22:00:00"
                }
            }
        });

        const permission = await rf.createPermission({
            action: "read",
            resource: "task"
        });

        await rf.grantPermission(role.id, permission.id);

        await rf.assignRole("user-1", role.id);

        const decision = await rf.explain({
            subject: "user-1",
            action: "read",
            resource: "task"
        });

        expect(decision.granted).toBe(false);

        expect(
            decision.trace[0]?.conditions[0]?.reason
        ).toBe(
            "Role future-viewer is not active"
        );
    });

    it("enforces validUntil", async () => {
        const rf = await RoleForge.init({
            adapter,
            plugins: [
                temporalPlugin
            ],
            clock: () => new Date("2026-09-23T23:00:00")
        });

        const role = await rf.createRole({
            name: "expired-viewer",
            meta: {
                temporal: {
                    validUntil: "2026-09-23T22:00:00"
                }
            }
        });

        const permission = await rf.createPermission({
            action: "read",
            resource: "task"
        });

        await rf.grantPermission(role.id, permission.id);

        await rf.assignRole("user-1", role.id);

        const decision = await rf.explain({
            subject: "user-1",
            action: "read",
            resource: "task"
        });

        expect(decision.granted).toBe(false);

        expect(
            decision.trace[0]?.conditions[0]?.reason
        ).toBe("Role expired-viewer has expired");
    });

    it("enforces weekdays", async () => {
        const rf = await RoleForge.init({
            adapter,
            plugins: [
                temporalPlugin
            ],
            clock: () => new Date("2026-09-23T12:00:00")
        });

        const role = await rf.createRole({
            name: "weekday-viewer",
            meta: {
                temporal: {
                    weekdays: [1, 2, 3, 4, 5]
                }
            }
        });

        const permission = await rf.createPermission({
            action: "read",
            resource: "task"
        });

        await rf.grantPermission(role.id, permission.id);

        await rf.assignRole("user-1", role.id        );

        await expect(
            rf.check({
                subject: "user-1",
                action: "read",
                resource: "task"
            })
        ).resolves.toBe(true);
    });
});
import { describe, expect, it } from "vitest";
import { MemoryAdapter, RoleForge } from "@roleforge/core";
import { temporalPlugin } from "../src/index.js";
 
async function bootWithWindow(from: string, until: string, clock: () => Date) {
    const rf = await RoleForge.init({ adapter: new MemoryAdapter(), plugins: [temporalPlugin], clock });
    const role = await rf.createRole({ name: "windowed", parentId: null, meta: { temporal: { hours: { from, until } } } });
    const perm = await rf.createPermission({ action: "read", resource: "report" });
    await rf.grantPermission(role.id, perm.id);
    await rf.assignRole("u", role.id);
    return rf;
}
const at = (h: number, m: number) => () => new Date(2026, 8, 24, h, m); // Thu, local time
const check = (rf: RoleForge) => rf.check({ subject: "u", action: "read", resource: "report" });
 
describe("temporal hours — minute-granular boundaries (regression for f859c56)", () => {
    // Daytime window 09:00–17:00
    it("grants at 09:30", async () => {
        expect(await check(await bootWithWindow("09:00", "17:00", at(9, 30)))).toBe(true);
    });
    it("denies at 17:45", async () => {
        expect(await check(await bootWithWindow("09:00", "17:00", at(17, 45)))).toBe(false);
    });
    it("denies at 08:59 (one minute before opening)", async () => {
        expect(await check(await bootWithWindow("09:00", "17:00", at(8, 59)))).toBe(false);
    });
    it("grants at 16:59 and denies at exactly 17:00 (until is exclusive)", async () => {
        expect(await check(await bootWithWindow("09:00", "17:00", at(16, 59)))).toBe(true);
        expect(await check(await bootWithWindow("09:00", "17:00", at(17, 0)))).toBe(false);
    });
    // Overnight window 22:00–06:00
    it("grants at 22:30 and 05:59 (inside, both segments)", async () => {
        expect(await check(await bootWithWindow("22:00", "06:00", at(22, 30)))).toBe(true);
        expect(await check(await bootWithWindow("22:00", "06:00", at(5, 59)))).toBe(true);
    });
    it("denies at 21:59 and 06:30 (outside, both edges)", async () => {
        expect(await check(await bootWithWindow("22:00", "06:00", at(21, 59)))).toBe(false);
        expect(await check(await bootWithWindow("22:00", "06:00", at(6, 30)))).toBe(false);
    });
    it("treats from === until as always-on", async () => {
        expect(await check(await bootWithWindow("12:00", "12:00", at(3, 17)))).toBe(true);
    });
});
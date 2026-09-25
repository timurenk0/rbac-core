import { Enforcer, newEnforcer } from "casbin";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ANY = "*";

export interface DemoContext {
    tenantId: string;
    hour: number;
}

export async function buildAuthz(): Promise<Enforcer> {
    const enforcer = await newEnforcer(join(HERE, "..", "model.conf"));

    enforcer.addFunction("timeInWindow", (hourStr: string, tstart: string, tend: string): boolean => {
        if (tstart === ANY) return true;
        const hour = Number(hourStr), from = Number(tstart), until = Number(tend);
        if (from === until) return true;
        return from < until ? hour >= from && hour < until : hour >= from || hour < until;
    });

    for (const domain of ["acme", "globex"]) {
        await enforcer.addNamedGroupingPolicy("g", "admin", "manager", domain);
        await enforcer.addNamedGroupingPolicy("g", "manager", "member", domain);
    }

    for (const domain of ["acme", "globex"]) {
        await enforcer.addPolicy("member",  domain, "task",   "read",   ANY, ANY);
        await enforcer.addPolicy("member",  domain, "task",   "create", ANY, ANY);
        await enforcer.addPolicy("manager", domain, "report", "read",   ANY, ANY);
        await enforcer.addPolicy("admin",   domain, "task",   "delete", ANY, ANY);
        await enforcer.addPolicy("auditor", domain, "report", "read",   "22", "6"); // 22:00-06:00
    }

    await enforcer.addPolicy("acme-manager", "acme", "task",   "read", ANY, ANY);
    await enforcer.addPolicy("acme-manager", "acme", "report", "read", ANY, ANY);

    for (const domain of ["acme", "globex"]) {
        await enforcer.addNamedGroupingPolicy("g", "alice", "admin", domain);
        await enforcer.addNamedGroupingPolicy("g", "carol", "auditor", domain);
    }
    await enforcer.addNamedGroupingPolicy("g", "bob", "acme-manager", "acme");

    return enforcer;
}

export const can = (enforcer: Enforcer, subject: string, action: string, resource: string, context: DemoContext): Promise<boolean> =>
    enforcer.enforce(subject, context.tenantId, resource, action, String(context.hour));

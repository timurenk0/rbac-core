// RoleForge visualizer — read-only. Serves a single page and two JSON endpoints
// on top of the public introspection API (graph(), explain()). No editing.
// Run: npx tsx apps/visualizer/server.ts   → http://localhost:5173
import { createServer } from "http";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { buildAuthz, DemoContext } from "../demo/src/authz.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5173);

// The simulated clock is a mutable value read by the engine's injected clock,
// so the simulation panel can ask "what would happen at 23:00?" without re-init.
let simulatedHour = 14;
const rf = await buildAuthz({ clock: () => new Date(2026, 8, 25, simulatedHour, 30) });

const META = {
    subjects: ["alice", "bob", "carol", "dave"],
    actions: ["read", "create", "delete"],
    resources: ["task", "report"],
    tenants: ["acme", "globex"],
};

const server = createServer(async (req, res) => {
    const send = (code: number, body: string, type = "application/json") => {
        res.writeHead(code, { "content-type": type });
        res.end(body);
    };
    try {
        if (req.method === "GET" && req.url === "/") {
            return send(200, readFileSync(join(HERE, "index.html"), "utf8"), "text/html; charset=utf-8");
        }
        if (req.method === "GET" && req.url === "/api/meta") {
            return send(200, JSON.stringify(META));
        }
        if (req.method === "GET" && req.url === "/api/graph") {
            return send(200, JSON.stringify(await rf.graph()));
        }
        if (req.method === "GET" && req.url === "/api/subjects") {
            const out: Record<string, { id: string; name: string }[]> = {};
            for (const subject of META.subjects) {
                const { direct } = await rf.subjectRoles(subject);
                out[subject] = direct.map(r => ({ id: r.id, name: r.name }));
            }
            return send(200, JSON.stringify(out));
        }
        if (req.method === "POST" && req.url === "/api/explain") {
            let raw = "";
            req.on("data", c => (raw += c));
            req.on("end", async () => {
                const { subject, action, resource, tenantId, hour } = JSON.parse(raw);
                simulatedHour = Number(hour);
                const context: DemoContext = { tenantId };
                const decision = await rf.explain({ subject, action, resource, context });
                send(200, JSON.stringify(decision));
            });
            return;
        }
        send(404, JSON.stringify({ error: "not found" }));
    } catch (err) {
        send(500, JSON.stringify({ error: String(err) }));
    }
});
server.listen(PORT, () => console.log(`RoleForge visualizer: http://localhost:${PORT}`));

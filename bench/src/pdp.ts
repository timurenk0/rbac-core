import { createServer, Server } from "http";
import { RoleForge, MemoryAdapter } from "@roleforge/core";
import { BenchmarkDataset } from "./dataset.js";
import { runConfiguration } from "./runner.js";
import { seedRoleForgeModel } from "./seed.js";
import { BenchmarkResult } from "./types.js";

const PORT = 18080;

export async function benchmarkLoopbackPdp(dataset: BenchmarkDataset): Promise<BenchmarkResult> {
    const adapter = new MemoryAdapter();
    await seedRoleForgeModel(adapter, dataset);
    const rf = await RoleForge.init({ adapter });

    const server: Server = createServer((req, res) => {
        let body = "";
        req.on("data", chunk => (body += chunk));
        req.on("end", async () => {
            const request = JSON.parse(body);
            const granted = await rf.check(request);
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ granted }));
        });
    });
    await new Promise<void>(resolve => server.listen(PORT, resolve));
    try {
        return await runConfiguration("loopback-http-pdp", dataset, async request => {
            const response = await fetch(`http://127.0.0.1:${PORT}/`, { method: "POST", body: JSON.stringify(request) });
            return (await response.json() as { granted: boolean }).granted;
        });
    } finally {
        server.close();
    }
}

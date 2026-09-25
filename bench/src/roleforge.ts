import { RoleForge, StorageAdapter } from "@roleforge/core";
import { BenchmarkDataset } from "./dataset.js";
import { runConfiguration } from "./runner.js";
import { BenchmarkResult } from "./types.js";

export async function benchmarkRoleForge(
    adapter: StorageAdapter,
    dataset: BenchmarkDataset,
    options: { label: string; cacheEnabled: boolean }
): Promise<BenchmarkResult> {
    const rf = await RoleForge.init({
        adapter,
        cache: { enabled: options.cacheEnabled, ttlMs: 60000 }
    });
    return runConfiguration(options.label, dataset, request => rf.check(request));
}

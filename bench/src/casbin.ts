import { newEnforcer } from "casbin";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { BenchmarkDataset } from "./dataset.js";
import { runConfiguration } from "./runner.js";
import { seedCasbinModel } from "./seed.js";
import { BenchmarkResult } from "./types.js";

const MODEL_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "casbin-model.conf");

export async function benchmarkCasbin(dataset: BenchmarkDataset): Promise<BenchmarkResult> {
    const enforcer = await newEnforcer(MODEL_PATH);
    await seedCasbinModel(enforcer, dataset);
    return runConfiguration("casbin-in-process", dataset, r => enforcer.enforce(r.subject, r.resource, r.action));
}

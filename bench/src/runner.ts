import process from "process";
import { BenchmarkDataset, createRequests, MEASURED_CHECKS, REPETITIONS, WARMUP_CHECKS } from "./dataset.js";
import { aggregateAcrossRuns, calculateStatistics } from "./statistics.js";
import { BenchmarkRequest, BenchmarkResult, BenchmarkRun } from "./types.js";

export type CheckFn = (request: BenchmarkRequest) => Promise<boolean>;

export async function runConfiguration(
    configuration: string,
    dataset: BenchmarkDataset,
    check: CheckFn
): Promise<BenchmarkResult> {
    const runs: BenchmarkRun[] = [];
    for (let run = 1; run <= REPETITIONS; run++) {
        const requests = createRequests(dataset, 1000 + run);
        for (let i = 0; i < WARMUP_CHECKS; i++) await check(requests[i]);

        const timings: number[] = [];
        let granted = 0, denied = 0;
        for (let i = WARMUP_CHECKS; i < WARMUP_CHECKS + MEASURED_CHECKS; i++) {
            const request = requests[i];
            const start = process.hrtime.bigint();
            const result = await check(request);
            const end = process.hrtime.bigint();
            timings.push(Number(end - start) / 1_000_000);
            result ? granted++ : denied++;
        }
        runs.push({ run, stats: calculateStatistics(timings), granted, denied });
        console.log(`  ${configuration} run ${run}/${REPETITIONS}: mean ${runs[run-1].stats.meanMs.toFixed(3)} ms, granted ${granted}/${MEASURED_CHECKS}`);
    }
    return {
        configuration,
        warmupChecks: WARMUP_CHECKS,
        measuredChecks: MEASURED_CHECKS,
        repetition: REPETITIONS,
        runs,
        aggregate: aggregateAcrossRuns(runs.map(r => r.stats)),
    };
}

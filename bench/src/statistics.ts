import { BenchmarkStats } from "./types.js";

function getPercentageValue(values: number[], percentage: number): number {
    const sorted = [...values].sort((a, b) => a-b);

    if (sorted.length === 0) return 0;

    const idx = (percentage / 100) * (sorted.length-1);

    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);

    if (lower === upper) return sorted[lower];

    const weight = idx - lower;

    return sorted[lower] + (sorted[upper] - sorted[lower]) * weight
}

export function calculateStatistics(values: number[]): BenchmarkStats {
    if (values.length === 0) throw new Error("Cannot calculate stats for an empty dataset");

    const mean = values.reduce((sum, val) => sum+val, 0) / values.length;

    const variance = values.reduce((sum, val) => sum+Math.pow(val-mean, 2), 0) / values.length;

    return {
        meanMs: mean,
        standardDeviationMs: Math.sqrt(variance),
        p50Ms: getPercentageValue(values, 50),
        p95Ms: getPercentageValue(values, 95),
        p99Ms: getPercentageValue(values, 99),
        minMs: Math.min(...values),
        maxMs: Math.max(...values),
    }
}

export function aggregateAcrossRuns(runStats: BenchmarkStats[]): BenchmarkStats {
    if (runStats.length === 0) throw new Error("Cannot aggregate zero runs");
    const avg = (pick: (s: BenchmarkStats) => number) =>
        runStats.reduce((sum, s) => sum + pick(s), 0) / runStats.length;
    const meanOfMeans = avg(s => s.meanMs);
    const betweenRunVariance =
        runStats.reduce((sum, s) => sum + Math.pow(s.meanMs - meanOfMeans, 2), 0) / runStats.length;
    return {
        meanMs: meanOfMeans,
        standardDeviationMs: Math.sqrt(betweenRunVariance),
        p50Ms: avg(s => s.p50Ms),
        p95Ms: avg(s => s.p95Ms),
        p99Ms: avg(s => s.p99Ms),
        minMs: Math.min(...runStats.map(s => s.minMs)),
        maxMs: Math.max(...runStats.map(s => s.maxMs)),
    };
}

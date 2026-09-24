export interface BenchmarkRequest {
    subject: string;
    action: string;
    resource: string;
}

export interface BenchmarkStats {
    meanMs: number;
    standardDeviationMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    minMs: number;
    maxMs: number;
}

export interface BenchmarkRun {
    run: number;
    stats: BenchmarkStats;
    granted: number;
    denied: number;
}

export interface BenchmarkResult {
    configuration: string;
    warmupChecks: number;
    measuredChecks: number;
    repetition: number;
    runs: BenchmarkRun[];
    aggregate: BenchmarkStats;
}

export interface BenchmarkEnvironment {
    nodeVersion: string;
    platform: string;
    architecure: string;
    cpuCount: number;
    postgresUrl: string
}

export interface BenchmarkReport {
    generatedAt: string;
    workload: {
        subjects: number;
        roles: number;
        hierarchyDepth: number;
        permissions: number;
        warmupChecks: number;
        measuredChecks: number;
        repetitions: number;
    };
    environment: BenchmarkEnvironment;
    results: BenchmarkResult[];
}
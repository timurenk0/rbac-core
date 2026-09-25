import { BenchmarkRequest } from "./types.js";

export const SUBJECT_COUNT = 1000;
export const ROLE_COUNT = 20;
export const HIERARCHY_DEPTH = 3;
export const PERMISSION_COUNT = 100;

export const WARMUP_CHECKS = 1000;
export const MEASURED_CHECKS = 10000;
export const REPETITIONS = 5;

export interface BenchmarkDataset {
    roleNames: string[];
    permissions: Array<{ action: string; resource: string }>;
}

/** Deterministic PRNG so every repetition draws its own, reproducible request stream
 *  (protocol: uniform-random subject and permission, PRNG seeded per repetition). */
export function mulberry32(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function createDataset(): BenchmarkDataset {
    const roleNames = Array.from({ length: ROLE_COUNT }, (_, idx) => `role-${idx + 1}`);
    const permissions = Array.from({ length: PERMISSION_COUNT }, (_, idx) => ({
        action: `action-${idx + 1}`,
        resource: `resource-${idx + 1}`
    }));
    return { roleNames, permissions };
}

/** One repetition's request stream: WARMUP + MEASURED uniform-random draws. */
export function createRequests(dataset: BenchmarkDataset, runSeed: number): BenchmarkRequest[] {
    const rnd = mulberry32(runSeed);
    const requests: BenchmarkRequest[] = [];
    for (let i = 0; i < WARMUP_CHECKS + MEASURED_CHECKS; i++) {
        const subjectIdx = Math.floor(rnd() * SUBJECT_COUNT);
        const permission = dataset.permissions[Math.floor(rnd() * PERMISSION_COUNT)];
        requests.push({
            subject: `subject-${String(subjectIdx + 1).padStart(4, "0")}`,
            action: permission.action,
            resource: permission.resource
        });
    }
    return requests;
}

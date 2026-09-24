import { BenchmarkRequest } from "./types.js";

export const SUBJECT_COUNT = 1000;
export const ROLE_COUNT = 20;
export const PERMISSION_COUNT = 100;

export const WARMUP_CHECKS = 1000;
export const MEASURED_CHECKS = 10000;
export const REPETITIONS = 5;

export interface BenchmarkDataset {
    requests: BenchmarkRequest[];
    roleNames: string[];
    permissions: Array<{
        action: string;
        resource: string;
    }>;
}

export function createDataset(): BenchmarkDataset {
    const roleNames = Array.from({ length: ROLE_COUNT }, (_, idx) => `role-${idx+1}`);
    const permissions = Array.from({ length: PERMISSION_COUNT }, (_, idx) => ({ action: `action-${idx+1}`, resource: `resource-${idx+1}` }));

    const requests: BenchmarkRequest[] = [];

    for (let i = 0; i < MEASURED_CHECKS + WARMUP_CHECKS; i++) {
        const subjectIdx = i % SUBJECT_COUNT;

        const permissionIdx = (i * 17 + 3) % PERMISSION_COUNT;
        const permission = permissions[permissionIdx];

        requests.push({
            subject: `subject-${String(subjectIdx+1).padStart(4, "0")}`,
            action: permission.action,
            resource: permission.resource
        });
    }

    return {
        requests,
        roleNames,
        permissions
    }
}
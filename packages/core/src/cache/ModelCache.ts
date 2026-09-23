import type { Permission, Role, StorageAdapter } from "../types.js";

interface CacheEntry<T> {
    readonly value: T;
    readonly expiresAt: number;
}

export interface AuthorizationModel {
    readonly roles: Role[];
    readonly permissions: Permission[];
}

export class ModelCache {
    private entry: CacheEntry<AuthorizationModel> | null = null;

    constructor(
        private readonly adapter: StorageAdapter,
        private readonly ttlMs: number
    ) {}

    async get(): Promise<AuthorizationModel> {
        const now = Date.now();
        if (this.entry != null && this.entry.expiresAt > now) return this.entry.value;

        const [roles, permissions] = await Promise.all([
            this.adapter.getRoles(),
            this.adapter.getAllPermissions()
        ]);

        const model: AuthorizationModel = { roles, permissions };

        this.entry = {
            value: model,
            expiresAt: now + this.ttlMs
        };
        
        return model;
    }

    invalidate(): void {
        this.entry = null;
    }
}
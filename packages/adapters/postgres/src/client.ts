import { Pool, type PoolConfig } from "pg"


export interface PostgresClientOptions {
    connectionString?: string;
    pool?: PoolConfig;
}

export function createPostgresPool(
    options: PostgresClientOptions = {}
): Pool {
    return new Pool({
        connectionString: options.connectionString ?? process.env.DATABASE_URl,
        ...options.pool
    });
}
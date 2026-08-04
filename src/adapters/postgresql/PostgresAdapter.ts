import { Pool } from "pg";

export class PostgresAdapter {
    readonly pool: Pool;

    constructor(connectionString: string) {
        this.pool = new Pool({
            connectionString
        });
    }

    async query(sql: string, params: unknown[] = []) {
        return this.pool.query(sql, params);
    }

    async disconnect() {
        await this.pool.end();
    }
}
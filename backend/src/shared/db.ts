import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

export function getDbPool(databaseUrl: string): Pool {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString: databaseUrl
  });

  return pool;
}

export async function queryDb<T extends QueryResultRow>(
  databaseUrl: string,
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const activePool = getDbPool(databaseUrl);
  const result = await activePool.query<T>(text, params);
  return result.rows;
}

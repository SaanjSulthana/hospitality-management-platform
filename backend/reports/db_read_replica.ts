import { SQLDatabase } from "encore.dev/storage/sqldb";

// Create read replica connection for scaling to 1M organizations
// Use shared hospitality database to access finance tables (revenues, expenses)
// This is a read-only connection to the same database as other services
// Use SQLDatabase.named() to reference the existing database declared in auth service
export const reportsReadDB = SQLDatabase.named("hospitality");

// Use read replica for all SELECT queries to reduce load on main database
export async function queryReadReplica<T>(
  query: string,
  ...params: any[]
): Promise<T[]> {
  return reportsReadDB.query(query, ...params);
}

// Use read replica for single row queries
export async function queryRowReadReplica<T>(
  query: string,
  ...params: any[]
): Promise<T | null> {
  return reportsReadDB.queryRow(query, ...params);
}

// Use read replica for count queries
export async function queryCountReadReplica(
  query: string,
  ...params: any[]
): Promise<number> {
  const result = await reportsReadDB.queryRow(query, ...params);
  return result?.count || 0;
}

// Health check for read replica
export async function checkReadReplicaHealth(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    await reportsReadDB.queryRow`SELECT 1 as health_check`;
    const latency = Date.now() - startTime;
    
    return {
      healthy: true,
      latency
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

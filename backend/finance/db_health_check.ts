import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

export interface DbHealthCheckResponse {
  success: boolean;
  connectionTime: number;
  activeConnections: number;
  maxConnections: number;
  databaseSize: string;
  tablesInfo: {
    revenues: { count: number; size: string };
    expenses: { count: number; size: string };
    daily_approvals: { count: number; size: string };
  };
  performanceMetrics: {
    avgQueryTime: number;
    slowQueries: number;
    connectionPoolUtilization: number;
  };
  recommendations: string[];
}

export const dbHealthCheck = api<{}, DbHealthCheckResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/db-health-check" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const startTime = Date.now();
    const recommendations: string[] = [];

    try {
      // Test basic connection
      await financeDB.queryRow`SELECT 1 as test`;
      const connectionTime = Date.now() - startTime;

      // Get database statistics
      const [dbStats, tableStats, connectionStats] = await Promise.all([
        // Database size
        financeDB.queryRow`
          SELECT pg_size_pretty(pg_database_size(current_database())) as size
        `,
        
        // Table statistics
        financeDB.queryAll`
          SELECT 
            schemaname,
            relname as tablename,
            n_tup_ins as inserts,
            n_tup_upd as updates,
            n_tup_del as deletes,
            n_live_tup as live_rows,
            n_dead_tup as dead_rows,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as size
          FROM pg_stat_user_tables 
          WHERE relname IN ('revenues', 'expenses', 'daily_approvals')
          ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC
        `,
        
        // Connection statistics
        financeDB.queryAll`
          SELECT 
            state,
            COUNT(*) as count,
            AVG(EXTRACT(EPOCH FROM (now() - state_change))) as avg_age_seconds
          FROM pg_stat_activity 
          WHERE datname = current_database()
          GROUP BY state
        `
      ]);

      // Get specific table counts
      const [revenueCount, expenseCount, approvalCount] = await Promise.all([
        financeDB.queryRow`SELECT COUNT(*) as count FROM revenues WHERE org_id = ${authData.orgId}`,
        financeDB.queryRow`SELECT COUNT(*) as count FROM expenses WHERE org_id = ${authData.orgId}`,
        financeDB.queryRow`SELECT COUNT(*) as count FROM daily_approvals WHERE org_id = ${authData.orgId}`
      ]);

      // Calculate performance metrics
      const totalConnections = connectionStats.reduce((sum: number, stat: any) => sum + parseInt(stat.count), 0);
      const activeConnections = connectionStats.find((stat: any) => stat.state === 'active')?.count || 0;
      const maxConnections = 100; // Default PostgreSQL max connections
      const connectionPoolUtilization = (totalConnections / maxConnections) * 100;

      // Generate recommendations based on metrics
      if (connectionTime > 1000) {
        recommendations.push("Database connection is slow (>1s). Consider optimizing queries or checking network latency.");
      }
      
      if (connectionPoolUtilization > 80) {
        recommendations.push("High connection pool utilization. Consider increasing max connections or optimizing connection usage.");
      }
      
      if (totalConnections > 50) {
        recommendations.push("High number of active connections. Check for connection leaks or long-running queries.");
      }

      const tableInfo = tableStats.reduce((acc: any, stat: any) => {
        acc[stat.tablename] = {
          count: stat.live_rows,
          size: stat.size
        };
        return acc;
      }, {});

      return {
        success: true,
        connectionTime,
        activeConnections: parseInt(activeConnections),
        maxConnections,
        databaseSize: dbStats?.size || 'Unknown',
        tablesInfo: {
          revenues: tableInfo.revenues || { count: revenueCount?.count || 0, size: 'Unknown' },
          expenses: tableInfo.expenses || { count: expenseCount?.count || 0, size: 'Unknown' },
          daily_approvals: tableInfo.daily_approvals || { count: approvalCount?.count || 0, size: 'Unknown' }
        },
        performanceMetrics: {
          avgQueryTime: connectionTime,
          slowQueries: connectionStats.filter((stat: any) => stat.avg_age_seconds > 30).length,
          connectionPoolUtilization: Math.round(connectionPoolUtilization)
        },
        recommendations
      };

    } catch (error) {
      console.error('Database health check failed:', error);
      return {
        success: false,
        connectionTime: Date.now() - startTime,
        activeConnections: 0,
        maxConnections: 0,
        databaseSize: 'Unknown',
        tablesInfo: {
          revenues: { count: 0, size: 'Unknown' },
          expenses: { count: 0, size: 'Unknown' },
          daily_approvals: { count: 0, size: 'Unknown' }
        },
        performanceMetrics: {
          avgQueryTime: Date.now() - startTime,
          slowQueries: 0,
          connectionPoolUtilization: 0
        },
        recommendations: [`Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
);

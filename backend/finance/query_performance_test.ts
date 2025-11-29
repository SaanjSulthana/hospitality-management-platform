import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

export interface QueryPerformanceTestResponse {
  success: boolean;
  testResults: Array<{
    query: string;
    duration: number;
    resultCount: number;
    status: 'fast' | 'slow' | 'error';
  }>;
  recommendations: string[];
}

export const queryPerformanceTest = api<{}, QueryPerformanceTestResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/query-performance-test" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const recommendations: string[] = [];
    const testResults: any[] = [];

    // Test 1: Simple connection test
    try {
      const start = Date.now();
      const result = await financeDB.queryRow`SELECT 1 as test`;
      const duration = Date.now() - start;
      testResults.push({
        query: "Simple connection test",
        duration,
        resultCount: 1,
        status: duration > 1000 ? 'slow' : 'fast'
      });
      if (duration > 1000) {
        recommendations.push("Basic database connection is slow (>1s). Check network latency or database server performance.");
      }
    } catch (error) {
      testResults.push({
        query: "Simple connection test",
        duration: 0,
        resultCount: 0,
        status: 'error'
      });
      recommendations.push(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test 2: Count queries (should be fast)
    try {
      const start = Date.now();
      const [revenueCount, expenseCount] = await Promise.all([
        financeDB.queryRow`SELECT COUNT(*) as count FROM revenues WHERE org_id = ${authData.orgId}`,
        financeDB.queryRow`SELECT COUNT(*) as count FROM expenses WHERE org_id = ${authData.orgId}`
      ]);
      const duration = Date.now() - start;
      testResults.push({
        query: "Count queries (revenues + expenses)",
        duration,
        resultCount: (revenueCount?.count || 0) + (expenseCount?.count || 0),
        status: duration > 500 ? 'slow' : 'fast'
      });
      if (duration > 500) {
        recommendations.push("Count queries are slow. Consider adding indexes on org_id columns.");
      }
    } catch (error) {
      testResults.push({
        query: "Count queries",
        duration: 0,
        resultCount: 0,
        status: 'error'
      });
    }

    // Test 3: JOIN queries (like in pending transactions)
    try {
      const start = Date.now();
      const result = await financeDB.queryAll`
        SELECT 
          r.id,
          'revenue' as type,
          r.source,
          r.amount_cents,
          p.name as property_name,
          u.display_name as created_by_name,
          r.created_at
        FROM revenues r
        JOIN properties p ON r.property_id = p.id AND p.org_id = ${authData.orgId}
        JOIN users u ON r.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
        WHERE r.org_id = ${authData.orgId}
          AND DATE(r.created_at) = CURRENT_DATE
        LIMIT 10
      `;
      const duration = Date.now() - start;
      testResults.push({
        query: "JOIN query (revenues with properties + users)",
        duration,
        resultCount: result.length,
        status: duration > 1000 ? 'slow' : 'fast'
      });
      if (duration > 1000) {
        recommendations.push("JOIN queries are slow. Consider adding indexes on foreign key columns and created_at.");
      }
    } catch (error) {
      testResults.push({
        query: "JOIN query",
        duration: 0,
        resultCount: 0,
        status: 'error'
      });
    }

    // Test 4: Schema check query (like in delete endpoints)
    try {
      const start = Date.now();
      const result = await financeDB.queryAll`
        SELECT table_name, column_name FROM information_schema.columns 
        WHERE table_name IN ('expenses', 'revenues') AND column_name = 'status'
      `;
      const duration = Date.now() - start;
      testResults.push({
        query: "Schema check query (information_schema)",
        duration,
        resultCount: result.length,
        status: duration > 500 ? 'slow' : 'fast'
      });
      if (duration > 500) {
        recommendations.push("Schema queries are slow. Consider caching schema information.");
      }
    } catch (error) {
      testResults.push({
        query: "Schema check query",
        duration: 0,
        resultCount: 0,
        status: 'error'
      });
    }

    // Test 5: Complex query with multiple conditions
    try {
      const start = Date.now();
      const result = await financeDB.queryAll`
        WITH pending_transactions AS (
          SELECT 
            r.id,
            'revenue' as type,
            r.source,
            NULL as category,
            r.amount_cents,
            r.description,
            p.name as property_name,
            u.display_name as created_by_name,
            r.created_at,
            COALESCE(r.status, 'pending') as status
          FROM revenues r
          JOIN properties p ON r.property_id = p.id AND p.org_id = ${authData.orgId}
          JOIN users u ON r.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
          WHERE r.org_id = ${authData.orgId}
            AND DATE(r.created_at) = CURRENT_DATE
            AND COALESCE(r.status, 'pending') = 'pending'
          
          UNION ALL
          
          SELECT 
            e.id,
            'expense' as type,
            NULL as source,
            e.category,
            e.amount_cents,
            e.description,
            p.name as property_name,
            u.display_name as created_by_name,
            e.created_at,
            COALESCE(e.status, 'pending') as status
          FROM expenses e
          JOIN properties p ON e.property_id = p.id AND p.org_id = ${authData.orgId}
          JOIN users u ON e.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
          WHERE e.org_id = ${authData.orgId}
            AND DATE(e.created_at) = CURRENT_DATE
            AND COALESCE(e.status, 'pending') = 'pending'
        )
        SELECT * FROM pending_transactions
        ORDER BY created_at DESC
        LIMIT 10
      `;
      const duration = Date.now() - start;
      testResults.push({
        query: "Complex UNION query (pending transactions)",
        duration,
        resultCount: result.length,
        status: duration > 2000 ? 'slow' : 'fast'
      });
      if (duration > 2000) {
        recommendations.push("Complex UNION queries are very slow. This is likely the cause of timeout issues. Consider query optimization.");
      }
    } catch (error) {
      testResults.push({
        query: "Complex UNION query",
        duration: 0,
        resultCount: 0,
        status: 'error'
      });
    }

    return {
      success: true,
      testResults,
      recommendations
    };
  }
);





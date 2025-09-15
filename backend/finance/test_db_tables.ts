import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

export interface TestDbTablesResponse {
  success: boolean;
  tables: {
    revenues: boolean;
    expenses: boolean;
    daily_approvals: boolean;
    users: boolean;
    properties: boolean;
  };
  error?: string;
}

// Test endpoint to check if database tables exist
export const testDbTables = api<{}, TestDbTablesResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/test-db-tables" },
  async (req) => {
    console.log('=== TEST DB TABLES FUNCTION CALLED ===');
    
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    try {
      // Test if tables exist by running simple queries
      const tables = {
        revenues: false,
        expenses: false,
        daily_approvals: false,
        users: false,
        properties: false,
      };

      // Test revenues table
      try {
        await financeDB.queryRow`SELECT COUNT(*) FROM revenues LIMIT 1`;
        tables.revenues = true;
        console.log('Revenues table exists');
      } catch (error) {
        console.log('Revenues table does not exist:', error);
      }

      // Test expenses table
      try {
        await financeDB.queryRow`SELECT COUNT(*) FROM expenses LIMIT 1`;
        tables.expenses = true;
        console.log('Expenses table exists');
      } catch (error) {
        console.log('Expenses table does not exist:', error);
      }

      // Test daily_approvals table
      try {
        await financeDB.queryRow`SELECT COUNT(*) FROM daily_approvals LIMIT 1`;
        tables.daily_approvals = true;
        console.log('Daily approvals table exists');
      } catch (error) {
        console.log('Daily approvals table does not exist:', error);
      }

      // Test users table
      try {
        await financeDB.queryRow`SELECT COUNT(*) FROM users LIMIT 1`;
        tables.users = true;
        console.log('Users table exists');
      } catch (error) {
        console.log('Users table does not exist:', error);
      }

      // Test properties table
      try {
        await financeDB.queryRow`SELECT COUNT(*) FROM properties LIMIT 1`;
        tables.properties = true;
        console.log('Properties table exists');
      } catch (error) {
        console.log('Properties table does not exist:', error);
      }

      console.log('Database tables test completed');
      
      return {
        success: true,
        tables,
      };
    } catch (error) {
      console.error('Database tables test error:', error);
      return {
        success: false,
        tables: {
          revenues: false,
          expenses: false,
          daily_approvals: false,
          users: false,
          properties: false,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);


import { api } from "encore.dev/api";
import { financeDB } from "./db";

// Check database status without authentication
export const checkDbStatus = api(
  { auth: false, expose: true, method: "GET", path: "/finance/check-db-status" },
  async () => {
    try {
      console.log("Checking database status...");
      
      // Test basic connection
      const connectionTest = await financeDB.queryRow`SELECT NOW() as current_time`;
      console.log("Database connection test:", connectionTest);
      
      // Check if basic tables exist
      const tables = ['organizations', 'users', 'properties', 'revenues', 'expenses'];
      const tableStatus = [];
      
      for (const tableName of tables) {
        try {
          const exists = await financeDB.queryRow`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = ${tableName}
            )
          `;
          tableStatus.push({ table: tableName, exists: exists?.exists || false });
        } catch (error) {
          tableStatus.push({ 
            table: tableName, 
            exists: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
      
      // Check if we have any data
      let orgCount = 0;
      let userCount = 0;
      let propertyCount = 0;
      let revenueCount = 0;
      let expenseCount = 0;
      
      try {
        const orgResult = await financeDB.queryRow`SELECT COUNT(*) as count FROM organizations`;
        orgCount = orgResult?.count || 0;
      } catch (error) {
        console.log("Could not count organizations:", error);
      }
      
      try {
        const userResult = await financeDB.queryRow`SELECT COUNT(*) as count FROM users`;
        userCount = userResult?.count || 0;
      } catch (error) {
        console.log("Could not count users:", error);
      }
      
      try {
        const propertyResult = await financeDB.queryRow`SELECT COUNT(*) as count FROM properties`;
        propertyCount = propertyResult?.count || 0;
      } catch (error) {
        console.log("Could not count properties:", error);
      }
      
      try {
        const revenueResult = await financeDB.queryRow`SELECT COUNT(*) as count FROM revenues`;
        revenueCount = revenueResult?.count || 0;
      } catch (error) {
        console.log("Could not count revenues:", error);
      }
      
      try {
        const expenseResult = await financeDB.queryRow`SELECT COUNT(*) as count FROM expenses`;
        expenseCount = expenseResult?.count || 0;
      } catch (error) {
        console.log("Could not count expenses:", error);
      }
      
      return {
        message: "Database status check completed",
        connectionTest,
        tableStatus,
        counts: {
          organizations: orgCount,
          users: userCount,
          properties: propertyCount,
          revenues: revenueCount,
          expenses: expenseCount
        },
        allTablesExist: tableStatus.every(t => t.exists),
        hasData: orgCount > 0 && userCount > 0
      };
    } catch (error) {
      console.error('Database status check error:', error);
      return {
        message: "Database status check failed",
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      };
    }
  }
);


import { api, APIError } from "encore.dev/api";
import { financeDB } from "./db";

// Initialize database tables without authentication
export const initDb = api(
  { auth: false, expose: true, method: "POST", path: "/finance/init-db" },
  async () => {
    try {
      console.log("Initializing database tables...");
      
      const tx = await financeDB.begin();
      try {
        // Check if basic tables exist
        const organizationsExists = await tx.queryRow`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'organizations'
          )
        `;
        
        const usersExists = await tx.queryRow`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
          )
        `;
        
        const propertiesExists = await tx.queryRow`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'properties'
          )
        `;
        
        const revenuesExists = await tx.queryRow`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'revenues'
          )
        `;
        
        const expensesExists = await tx.queryRow`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'expenses'
          )
        `;
        
        console.log("Table existence check:", {
          organizations: organizationsExists?.exists,
          users: usersExists?.exists,
          properties: propertiesExists?.exists,
          revenues: revenuesExists?.exists,
          expenses: expensesExists?.exists
        });
        
        // If basic tables don't exist, we need to run migrations
        if (!organizationsExists?.exists || !usersExists?.exists || !propertiesExists?.exists) {
          console.log("Basic tables missing - database needs initialization");
          await tx.rollback();
          return {
            message: "Database needs initialization - basic tables missing",
            tables: {
              organizations: organizationsExists?.exists || false,
              users: usersExists?.exists || false,
              properties: propertiesExists?.exists || false,
              revenues: revenuesExists?.exists || false,
              expenses: expensesExists?.exists || false
            },
            needsInit: true
          };
        }
        
        // Check revenues table structure
        let revenuesSchema = [];
        if (revenuesExists?.exists) {
          revenuesSchema = await tx.queryAll`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'revenues'
            ORDER BY ordinal_position
          `;
        }
        
        // Check expenses table structure
        let expensesSchema = [];
        if (expensesExists?.exists) {
          expensesSchema = await tx.queryAll`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'expenses'
            ORDER BY ordinal_position
          `;
        }
        
        await tx.commit();
        
        return {
          message: "Database check completed",
          tables: {
            organizations: organizationsExists?.exists || false,
            users: usersExists?.exists || false,
            properties: propertiesExists?.exists || false,
            revenues: revenuesExists?.exists || false,
            expenses: expensesExists?.exists || false
          },
          revenuesSchema,
          expensesSchema,
          needsInit: false
        };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Database initialization check error:', error);
      return {
        message: "Database check failed",
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      };
    }
  }
);


import { usersDB } from "./users/db";
import log from "encore.dev/log";

export async function fixUserSchemaIssues(): Promise<{
  success: boolean;
  message: string;
  fixes: string[];
}> {
  const fixes: string[] = [];
  
  try {
    log.info("Starting user schema fixes...");
    
    // Check if columns exist and add them if missing
    const columnChecks = [
      { column: 'login_count', type: 'INTEGER DEFAULT 0' },
      { column: 'timezone', type: 'TEXT DEFAULT \'UTC\'' },
      { column: 'locale', type: 'TEXT DEFAULT \'en-US\'' },
      { column: 'updated_at', type: 'TIMESTAMPTZ DEFAULT NOW()' }
    ];
    
    for (const { column, type } of columnChecks) {
      try {
        // Check if column exists
        const exists = await usersDB.queryRow`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name = ${column}
          AND table_schema = 'public'
        `;
        
        if (!exists) {
          await usersDB.rawExec(`ALTER TABLE users ADD COLUMN ${column} ${type}`);
          fixes.push(`Added missing column: ${column}`);
          log.info(`Added missing column: ${column}`);
        } else {
          log.info(`Column ${column} already exists`);
        }
      } catch (error) {
        log.error(`Error checking/adding column ${column}:`, error);
        throw error;
      }
    }
    
    // Create indexes if they don't exist
    const indexes = [
      { name: 'idx_users_login_count', column: 'login_count' },
      { name: 'idx_users_updated_at', column: 'updated_at' }
    ];
    
    for (const { name, column } of indexes) {
      try {
        const exists = await usersDB.queryRow`
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = 'users' 
          AND indexname = ${name}
        `;
        
        if (!exists) {
          await usersDB.rawExec(`CREATE INDEX ${name} ON users(${column})`);
          fixes.push(`Created index: ${name}`);
          log.info(`Created index: ${name}`);
        } else {
          log.info(`Index ${name} already exists`);
        }
      } catch (error) {
        log.error(`Error creating index ${name}:`, error);
        // Don't throw here, indexes are not critical
      }
    }
    
    // Create trigger function if it doesn't exist
    try {
      const functionExists = await usersDB.queryRow`
        SELECT proname 
        FROM pg_proc 
        WHERE proname = 'update_updated_at_column'
      `;
      
      if (!functionExists) {
        await usersDB.rawExec(`
          CREATE OR REPLACE FUNCTION update_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
          END;
          $$ language 'plpgsql'
        `);
        fixes.push("Created trigger function: update_updated_at_column");
        log.info("Created trigger function: update_updated_at_column");
      }
      
      // Create trigger if it doesn't exist
      const triggerExists = await usersDB.queryRow`
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE trigger_name = 'update_users_updated_at'
        AND event_object_table = 'users'
      `;
      
      if (!triggerExists) {
        await usersDB.rawExec(`
          CREATE TRIGGER update_users_updated_at 
              BEFORE UPDATE ON users 
              FOR EACH ROW 
              EXECUTE FUNCTION update_updated_at_column()
        `);
        fixes.push("Created trigger: update_users_updated_at");
        log.info("Created trigger: update_users_updated_at");
      }
    } catch (error) {
      log.error("Error creating trigger function/trigger:", error);
      // Don't throw here, triggers are not critical
    }
    
    // Verify user_properties table exists
    try {
      const tableExists = await usersDB.queryRow`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'user_properties' 
        AND table_schema = 'public'
      `;
      
      if (!tableExists) {
        await usersDB.rawExec(`
          CREATE TABLE user_properties (
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, property_id)
          )
        `);
        fixes.push("Created user_properties table");
        log.info("Created user_properties table");
      } else {
        log.info("user_properties table already exists");
      }
    } catch (error) {
      log.error("Error checking/creating user_properties table:", error);
      throw error;
    }
    
    log.info("User schema fixes completed successfully", { fixesApplied: fixes.length });
    
    return {
      success: true,
      message: `Successfully applied ${fixes.length} schema fixes`,
      fixes
    };
    
  } catch (error) {
    log.error("User schema fix failed:", error);
    return {
      success: false,
      message: `Schema fix failed: ${error instanceof Error ? error.message : String(error)}`,
      fixes
    };
  }
}

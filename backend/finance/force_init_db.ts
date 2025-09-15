import { api, APIError } from "encore.dev/api";
import { financeDB } from "./db";

// Force initialize database tables without authentication
export const forceInitDb = api(
  { auth: false, expose: true, method: "POST", path: "/finance/force-init-db" },
  async () => {
    try {
      console.log("Force initializing database tables...");
      
      const tx = await financeDB.begin();
      try {
        const results = {
          organizations: { created: false, exists: false },
          users: { created: false, exists: false },
          properties: { created: false, exists: false },
          revenues: { created: false, exists: false },
          expenses: { created: false, exists: false },
          errors: [] as string[]
        };
        
        // 1. Create organizations table if it doesn't exist
        try {
          const orgExists = await tx.queryRow`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'organizations'
            )
          `;
          
          if (!orgExists?.exists) {
            console.log("Creating organizations table...");
            await tx.exec`
              CREATE TABLE organizations (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                primary_domain TEXT,
                subdomain_prefix TEXT UNIQUE,
                theme_json JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW()
              )
            `;
            results.organizations.created = true;
          } else {
            results.organizations.exists = true;
          }
        } catch (error) {
          results.errors.push(`Organizations table error: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // 2. Create users table if it doesn't exist
        try {
          const usersExists = await tx.queryRow`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'users'
            )
          `;
          
          if (!usersExists?.exists) {
            console.log("Creating users table...");
            await tx.exec`
              CREATE TABLE users (
                id BIGSERIAL PRIMARY KEY,
                org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                email TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER')),
                display_name TEXT NOT NULL,
                created_by_user_id BIGINT REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                last_login_at TIMESTAMPTZ,
                UNIQUE(org_id, email)
              )
            `;
            results.users.created = true;
          } else {
            results.users.exists = true;
          }
        } catch (error) {
          results.errors.push(`Users table error: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // 3. Create properties table if it doesn't exist
        try {
          const propsExists = await tx.queryRow`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'properties'
            )
          `;
          
          if (!propsExists?.exists) {
            console.log("Creating properties table...");
            await tx.exec`
              CREATE TABLE properties (
                id BIGSERIAL PRIMARY KEY,
                org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                region_id BIGINT,
                name TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('hostel', 'hotel', 'resort', 'apartment')),
                address_json JSONB DEFAULT '{}',
                amenities_json JSONB DEFAULT '{}',
                capacity_json JSONB DEFAULT '{}',
                status TEXT DEFAULT 'active',
                created_at TIMESTAMPTZ DEFAULT NOW()
              )
            `;
            results.properties.created = true;
          } else {
            results.properties.exists = true;
          }
        } catch (error) {
          results.errors.push(`Properties table error: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // 4. Create revenues table if it doesn't exist
        try {
          const revenuesExists = await tx.queryRow`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'revenues'
            )
          `;
          
          if (!revenuesExists?.exists) {
            console.log("Creating revenues table...");
            await tx.exec`
              CREATE TABLE revenues (
                id BIGSERIAL PRIMARY KEY,
                org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
                source TEXT NOT NULL CHECK (source IN ('room', 'addon', 'other')),
                amount_cents BIGINT NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                description TEXT,
                receipt_url TEXT,
                occurred_at TIMESTAMPTZ NOT NULL,
                created_by_user_id BIGINT NOT NULL REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
                approved_by_user_id BIGINT REFERENCES users(id),
                approved_at TIMESTAMPTZ,
                payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank')),
                bank_reference VARCHAR(255),
                receipt_file_id INTEGER,
                meta_json JSONB DEFAULT '{}'
              )
            `;
            results.revenues.created = true;
          } else {
            results.revenues.exists = true;
          }
        } catch (error) {
          results.errors.push(`Revenues table error: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // 5. Create expenses table if it doesn't exist
        try {
          const expensesExists = await tx.queryRow`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'expenses'
            )
          `;
          
          if (!expensesExists?.exists) {
            console.log("Creating expenses table...");
            await tx.exec`
              CREATE TABLE expenses (
                id BIGSERIAL PRIMARY KEY,
                org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
                category TEXT NOT NULL,
                amount_cents BIGINT NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                description TEXT,
                receipt_url TEXT,
                expense_date DATE NOT NULL,
                created_by_user_id BIGINT NOT NULL REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                approved_by_user_id BIGINT REFERENCES users(id),
                approved_at TIMESTAMPTZ,
                status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
                payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank')),
                bank_reference VARCHAR(255),
                receipt_file_id INTEGER
              )
            `;
            results.expenses.created = true;
          } else {
            results.expenses.exists = true;
          }
        } catch (error) {
          results.errors.push(`Expenses table error: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // 6. Create user_properties table if it doesn't exist
        try {
          const userPropsExists = await tx.queryRow`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'user_properties'
            )
          `;
          
          if (!userPropsExists?.exists) {
            console.log("Creating user_properties table...");
            await tx.exec`
              CREATE TABLE user_properties (
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, property_id)
              )
            `;
          }
        } catch (error) {
          results.errors.push(`User properties table error: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // 7. Insert default organization and admin user if they don't exist
        try {
          const orgExists = await tx.queryRow`
            SELECT id FROM organizations WHERE subdomain_prefix = 'example'
          `;
          
          if (!orgExists) {
            console.log("Creating default organization...");
            await tx.exec`
              INSERT INTO organizations (name, subdomain_prefix, theme_json) 
              VALUES ('Example Company', 'example', '{"primaryColor": "#3b82f6", "brandName": "Example Company", "secondaryColor": "#64748b", "accentColor": "#10b981", "backgroundColor": "#ffffff", "textColor": "#1f2937", "currency": "USD", "dateFormat": "MM/DD/YYYY", "timeFormat": "12h"}')
            `;
          }
          
          const adminExists = await tx.queryRow`
            SELECT id FROM users WHERE email = 'admin@example.com'
          `;
          
          if (!adminExists) {
            console.log("Creating default admin user...");
            const orgId = await tx.queryRow`
              SELECT id FROM organizations WHERE subdomain_prefix = 'example'
            `;
            
            if (orgId) {
              await tx.exec`
                INSERT INTO users (org_id, email, password_hash, role, display_name) 
                VALUES (${orgId.id}, 'admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXig/pjLw3jm', 'ADMIN', 'System Administrator')
              `;
            }
          }
        } catch (error) {
          results.errors.push(`Default data error: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        await tx.commit();
        
        return {
          message: "Database force initialization completed",
          results,
          success: results.errors.length === 0
        };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Force database initialization error:', error);
      return {
        message: "Force database initialization failed",
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      };
    }
  }
);


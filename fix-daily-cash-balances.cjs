#!/usr/bin/env node

/**
 * Fix for missing daily_cash_balances table
 * This script creates the missing table that's causing the 500 error
 */

const { Client } = require('pg');

async function fixDailyCashBalancesTable() {
    console.log('🔧 Fixing missing daily_cash_balances table...');
    
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'password',
        database: 'encore'
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Step 1: Create the daily_cash_balances table if it doesn't exist
        console.log('📋 Creating daily_cash_balances table...');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_cash_balances (
                id SERIAL PRIMARY KEY,
                org_id INTEGER NOT NULL,
                property_id INTEGER NOT NULL,
                balance_date DATE NOT NULL,
                opening_balance_cents INTEGER DEFAULT 0,
                cash_received_cents INTEGER DEFAULT 0,
                bank_received_cents INTEGER DEFAULT 0,
                cash_expenses_cents INTEGER DEFAULT 0,
                bank_expenses_cents INTEGER DEFAULT 0,
                closing_balance_cents INTEGER DEFAULT 0,
                created_by_user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                
                -- Foreign key constraints
                CONSTRAINT fk_daily_cash_balances_org_id FOREIGN KEY (org_id) REFERENCES organizations(id),
                CONSTRAINT fk_daily_cash_balances_property_id FOREIGN KEY (property_id) REFERENCES properties(id),
                CONSTRAINT fk_daily_cash_balances_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id),
                
                -- Ensure one balance record per property per day
                UNIQUE(org_id, property_id, balance_date)
            )
        `);

        // Step 2: Add enhancement columns if they don't exist
        console.log('📋 Adding enhancement columns...');
        
        const columns = [
            { name: 'is_opening_balance_auto_calculated', type: 'BOOLEAN DEFAULT FALSE' },
            { name: 'calculated_closing_balance_cents', type: 'INTEGER' },
            { name: 'balance_discrepancy_cents', type: 'INTEGER DEFAULT 0' }
        ];

        for (const column of columns) {
            const checkColumn = await client.query(`
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'daily_cash_balances' AND column_name = $1
            `, [column.name]);

            if (checkColumn.rows.length === 0) {
                await client.query(`ALTER TABLE daily_cash_balances ADD COLUMN ${column.name} ${column.type}`);
                console.log(`  ✅ Added column: ${column.name}`);
            } else {
                console.log(`  ⏭️  Column already exists: ${column.name}`);
            }
        }

        // Step 3: Create indexes if they don't exist
        console.log('📋 Creating indexes...');
        
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_org_date ON daily_cash_balances(org_id, balance_date)',
            'CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_property_date ON daily_cash_balances(property_id, balance_date)',
            'CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_prev_day ON daily_cash_balances(org_id, property_id, balance_date DESC)'
        ];

        for (const indexQuery of indexes) {
            await client.query(indexQuery);
        }

        // Step 4: Add column comments
        console.log('📋 Adding column comments...');
        
        await client.query(`
            COMMENT ON COLUMN daily_cash_balances.is_opening_balance_auto_calculated IS 'True if opening balance was automatically calculated from previous day, false if manually set'
        `);
        await client.query(`
            COMMENT ON COLUMN daily_cash_balances.calculated_closing_balance_cents IS 'The closing balance as calculated from opening + cash revenue - cash expenses'
        `);
        await client.query(`
            COMMENT ON COLUMN daily_cash_balances.balance_discrepancy_cents IS 'Difference between manual closing balance and calculated closing balance'
        `);

        // Step 5: Verify the table was created successfully
        const result = await client.query(`
            SELECT COUNT(*) as column_count
            FROM information_schema.columns 
            WHERE table_name = 'daily_cash_balances'
        `);

        console.log('✅ daily_cash_balances table created successfully!');
        console.log(`📊 Table has ${result.rows[0].column_count} columns`);
        console.log('🎉 The 500 error should now be fixed!');
        
        console.log('\n🎯 Next steps:');
        console.log('1. Refresh your browser page');
        console.log('2. The daily reports should now work without 500 errors');
        console.log('3. Check the browser console to confirm the error is gone');

    } catch (error) {
        console.error('❌ Error fixing daily_cash_balances table:', error.message);
        console.log('\n💡 Manual fix:');
        console.log('Run this SQL in your database client:');
        console.log('psql -h localhost -p 5432 -U postgres -d encore -f fix_daily_cash_balances_table.sql');
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Run the fix
fixDailyCashBalancesTable().catch(console.error);

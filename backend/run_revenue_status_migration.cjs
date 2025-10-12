const { Client } = require('pg');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hospitality'
  });

  try {
    await client.connect();
    console.log('Connected to database');
    
    // Check if status column already exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'revenues' 
      AND column_name = 'status'
      AND table_schema = 'public'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('Status column already exists in revenues table');
      return;
    }
    
    // Run the migration
    console.log('Adding status column to revenues table...');
    await client.query(`
      ALTER TABLE revenues ADD COLUMN status VARCHAR(20) DEFAULT 'pending' NOT NULL;
    `);
    
    await client.query(`
      ALTER TABLE revenues ADD COLUMN approved_by_user_id INTEGER;
    `);
    
    await client.query(`
      ALTER TABLE revenues ADD COLUMN approved_at TIMESTAMP;
    `);
    
    await client.query(`
      ALTER TABLE revenues ADD CONSTRAINT fk_revenues_approved_by_user_id 
      FOREIGN KEY (approved_by_user_id) REFERENCES users(id);
    `);
    
    await client.query(`
      UPDATE revenues SET status = 'pending' WHERE status IS NULL;
    `);
    
    console.log('Migration completed successfully');
    
    // Verify the column was added
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'revenues' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('Current revenues table schema:');
    console.table(verifyResult.rows);
    
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();

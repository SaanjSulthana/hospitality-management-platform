const { Client } = require('pg');

async function fixSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hospitality'
  });

  try {
    await client.connect();
    console.log('Connected to database');
    
    // Read and execute the schema fix
    const fs = require('fs');
    const sql = fs.readFileSync('./fix_revenue_status.sql', 'utf8');
    
    await client.query(sql);
    console.log('Schema fix applied successfully');
    
    // Check the current schema
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'revenues' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('Current revenues table schema:');
    console.table(result.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

fixSchema();


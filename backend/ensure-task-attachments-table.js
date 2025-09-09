const { Client } = require('pg');

async function ensureTaskAttachmentsTable() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'hospitality',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'task_attachments'
      )
    `);

    if (!tableExists.rows[0].exists) {
      console.log('Creating task_attachments table...');
      
      await client.query(`
        CREATE TABLE task_attachments (
          id BIGSERIAL PRIMARY KEY,
          org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          file_name TEXT NOT NULL,
          file_url TEXT NOT NULL,
          file_size BIGINT,
          mime_type TEXT,
          uploaded_by_user_id BIGINT NOT NULL REFERENCES users(id),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create indexes
      await client.query(`CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id)`);
      await client.query(`CREATE INDEX idx_task_attachments_org_id ON task_attachments(org_id)`);
      await client.query(`CREATE INDEX idx_task_attachments_uploaded_by ON task_attachments(uploaded_by_user_id)`);
      await client.query(`CREATE INDEX idx_task_attachments_created_at ON task_attachments(created_at)`);
      
      console.log('Task attachments table created successfully!');
    } else {
      console.log('Task attachments table already exists');
    }

    // Check table structure
    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'task_attachments'
      ORDER BY ordinal_position
    `);

    console.log('Table schema:');
    schema.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

ensureTaskAttachmentsTable();

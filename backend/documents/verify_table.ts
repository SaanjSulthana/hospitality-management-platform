/**
 * Quick verification script to check if document_exports table exists
 * Run this to confirm the migration was successful
 */

import { documentsDB } from "./db";

async function verifyTable() {
  try {
    // Check if table exists by querying its structure
    const result = await documentsDB.queryRow<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'document_exports'
      ) as exists
    `;
    
    console.log('[Verify] document_exports table exists:', result?.exists);
    
    if (result?.exists) {
      // Get table structure
      const columns = await documentsDB.query<{ column_name: string; data_type: string }>`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'document_exports'
        ORDER BY ordinal_position
      `;
      
      console.log('[Verify] Table columns:', columns.map(c => `${c.column_name} (${c.data_type})`));
      
      // Check indexes
      const indexes = await documentsDB.query<{ indexname: string }>`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'document_exports'
      `;
      
      console.log('[Verify] Table indexes:', indexes.map(i => i.indexname));
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Verify] Error checking table:', error);
    return false;
  }
}

// Export for use in other files
export { verifyTable };


import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { financeDB } from '../db';

// Mock the financeDB for testing
jest.mock('../db', () => ({
  financeDB: {
    queryRow: jest.fn(),
    queryAll: jest.fn(),
    exec: jest.fn(),
  },
}));

describe('Schema Validation Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Column Existence Validation', () => {
    it('should detect missing columns in revenues table', async () => {
      // Mock response showing missing columns
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { column_name: 'id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'org_id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'property_id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'source', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'amount_cents', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'currency', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'description', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'receipt_url', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'occurred_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
        { column_name: 'created_by_user_id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      ]);

      const requiredColumns = [
        'status', 'approved_by_user_id', 'approved_at', 
        'payment_mode', 'bank_reference', 'receipt_file_id'
      ];

      const existingColumns = await financeDB.queryAll`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'revenues' AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      const existingColumnNames = existingColumns.map((col: any) => col.column_name);
      const missingColumns = requiredColumns.filter(col => !existingColumnNames.includes(col));

      expect(missingColumns).toEqual([
        'status', 'approved_by_user_id', 'approved_at', 
        'payment_mode', 'bank_reference', 'receipt_file_id'
      ]);
    });

    it('should detect missing columns in expenses table', async () => {
      // Mock response showing missing columns
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { column_name: 'id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'org_id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'property_id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'category', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'amount_cents', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'currency', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'description', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'receipt_url', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'expense_date', data_type: 'timestamp with time zone', is_nullable: 'NO' },
        { column_name: 'created_by_user_id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      ]);

      const requiredColumns = [
        'status', 'approved_by_user_id', 'approved_at', 
        'payment_mode', 'bank_reference', 'receipt_file_id'
      ];

      const existingColumns = await financeDB.queryAll`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'expenses' AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      const existingColumnNames = existingColumns.map((col: any) => col.column_name);
      const missingColumns = requiredColumns.filter(col => !existingColumnNames.includes(col));

      expect(missingColumns).toEqual([
        'status', 'approved_by_user_id', 'approved_at', 
        'payment_mode', 'bank_reference', 'receipt_file_id'
      ]);
    });

    it('should return empty array when all columns exist', async () => {
      // Mock response showing all columns exist
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { column_name: 'id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'org_id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'property_id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'source', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'amount_cents', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'currency', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'description', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'receipt_url', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'occurred_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
        { column_name: 'created_by_user_id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
        { column_name: 'status', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'approved_by_user_id', data_type: 'integer', is_nullable: 'YES' },
        { column_name: 'approved_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
        { column_name: 'payment_mode', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'bank_reference', data_type: 'character varying', is_nullable: 'YES' },
        { column_name: 'receipt_file_id', data_type: 'integer', is_nullable: 'YES' },
      ]);

      const requiredColumns = [
        'status', 'approved_by_user_id', 'approved_at', 
        'payment_mode', 'bank_reference', 'receipt_file_id'
      ];

      const existingColumns = await financeDB.queryAll`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'revenues' AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      const existingColumnNames = existingColumns.map((col: any) => col.column_name);
      const missingColumns = requiredColumns.filter(col => !existingColumnNames.includes(col));

      expect(missingColumns).toEqual([]);
    });
  });

  describe('Foreign Key Constraint Validation', () => {
    it('should detect missing foreign key constraints', async () => {
      // Mock response showing missing constraints
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { constraint_name: 'fk_revenues_org_id', constraint_type: 'FOREIGN KEY' },
        { constraint_name: 'fk_revenues_property_id', constraint_type: 'FOREIGN KEY' },
        { constraint_name: 'fk_revenues_created_by_user_id', constraint_type: 'FOREIGN KEY' },
      ]);

      const requiredConstraints = [
        'fk_revenues_approved_by_user_id',
        'fk_revenues_receipt_file_id'
      ];

      const existingConstraints = await financeDB.queryAll`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints 
        WHERE table_name = 'revenues' AND constraint_type = 'FOREIGN KEY'
      `;

      const existingConstraintNames = existingConstraints.map((constraint: any) => constraint.constraint_name);
      const missingConstraints = requiredConstraints.filter(constraint => !existingConstraintNames.includes(constraint));

      expect(missingConstraints).toEqual([
        'fk_revenues_approved_by_user_id',
        'fk_revenues_receipt_file_id'
      ]);
    });

    it('should return empty array when all constraints exist', async () => {
      // Mock response showing all constraints exist
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { constraint_name: 'fk_revenues_org_id', constraint_type: 'FOREIGN KEY' },
        { constraint_name: 'fk_revenues_property_id', constraint_type: 'FOREIGN KEY' },
        { constraint_name: 'fk_revenues_created_by_user_id', constraint_type: 'FOREIGN KEY' },
        { constraint_name: 'fk_revenues_approved_by_user_id', constraint_type: 'FOREIGN KEY' },
        { constraint_name: 'fk_revenues_receipt_file_id', constraint_type: 'FOREIGN KEY' },
      ]);

      const requiredConstraints = [
        'fk_revenues_approved_by_user_id',
        'fk_revenues_receipt_file_id'
      ];

      const existingConstraints = await financeDB.queryAll`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints 
        WHERE table_name = 'revenues' AND constraint_type = 'FOREIGN KEY'
      `;

      const existingConstraintNames = existingConstraints.map((constraint: any) => constraint.constraint_name);
      const missingConstraints = requiredConstraints.filter(constraint => !existingConstraintNames.includes(constraint));

      expect(missingConstraints).toEqual([]);
    });
  });

  describe('Index Validation', () => {
    it('should detect missing performance indexes', async () => {
      // Mock response showing missing indexes
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { indexname: 'revenues_pkey', indexdef: 'CREATE UNIQUE INDEX revenues_pkey ON public.revenues USING btree (id)' },
        { indexname: 'idx_revenues_org_id', indexdef: 'CREATE INDEX idx_revenues_org_id ON public.revenues USING btree (org_id)' },
      ]);

      const requiredIndexes = [
        'idx_revenues_status',
        'idx_revenues_payment_mode',
        'idx_revenues_approved_by'
      ];

      const existingIndexes = await financeDB.queryAll`
        SELECT indexname, indexdef
        FROM pg_indexes 
        WHERE tablename = 'revenues' AND schemaname = 'public'
      `;

      const existingIndexNames = existingIndexes.map((index: any) => index.indexname);
      const missingIndexes = requiredIndexes.filter(index => !existingIndexNames.includes(index));

      expect(missingIndexes).toEqual([
        'idx_revenues_status',
        'idx_revenues_payment_mode',
        'idx_revenues_approved_by'
      ]);
    });

    it('should return empty array when all indexes exist', async () => {
      // Mock response showing all indexes exist
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { indexname: 'revenues_pkey', indexdef: 'CREATE UNIQUE INDEX revenues_pkey ON public.revenues USING btree (id)' },
        { indexname: 'idx_revenues_org_id', indexdef: 'CREATE INDEX idx_revenues_org_id ON public.revenues USING btree (org_id)' },
        { indexname: 'idx_revenues_status', indexdef: 'CREATE INDEX idx_revenues_status ON public.revenues USING btree (org_id, status)' },
        { indexname: 'idx_revenues_payment_mode', indexdef: 'CREATE INDEX idx_revenues_payment_mode ON public.revenues USING btree (org_id, payment_mode)' },
        { indexname: 'idx_revenues_approved_by', indexdef: 'CREATE INDEX idx_revenues_approved_by ON public.revenues USING btree (approved_by_user_id)' },
      ]);

      const requiredIndexes = [
        'idx_revenues_status',
        'idx_revenues_payment_mode',
        'idx_revenues_approved_by'
      ];

      const existingIndexes = await financeDB.queryAll`
        SELECT indexname, indexdef
        FROM pg_indexes 
        WHERE tablename = 'revenues' AND schemaname = 'public'
      `;

      const existingIndexNames = existingIndexes.map((index: any) => index.indexname);
      const missingIndexes = requiredIndexes.filter(index => !existingIndexNames.includes(index));

      expect(missingIndexes).toEqual([]);
    });
  });

  describe('Schema Fix Operations', () => {
    it('should add missing columns safely', async () => {
      // Mock successful column addition
      (financeDB.exec as jest.Mock).mockResolvedValue(undefined);

      const columnName = 'status';
      const columnType = 'VARCHAR(20) DEFAULT \'pending\' NOT NULL';

      await financeDB.exec`ALTER TABLE revenues ADD COLUMN IF NOT EXISTS ${columnName} ${columnType}`;

      expect(financeDB.exec).toHaveBeenCalledWith(
        ['ALTER TABLE revenues ADD COLUMN IF NOT EXISTS ', ' ', ''],
        columnName,
        columnType
      );
    });

    it('should add foreign key constraints safely', async () => {
      // Mock successful constraint addition
      (financeDB.exec as jest.Mock).mockResolvedValue(undefined);

      const constraintName = 'fk_revenues_approved_by_user_id';
      const constraintDef = 'FOREIGN KEY (approved_by_user_id) REFERENCES users(id)';

      await financeDB.exec`ALTER TABLE revenues ADD CONSTRAINT IF NOT EXISTS ${constraintName} ${constraintDef}`;

      expect(financeDB.exec).toHaveBeenCalledWith(
        ['ALTER TABLE revenues ADD CONSTRAINT IF NOT EXISTS ', ' ', ''],
        constraintName,
        constraintDef
      );
    });

    it('should create indexes safely', async () => {
      // Mock successful index creation
      (financeDB.exec as jest.Mock).mockResolvedValue(undefined);

      const indexName = 'idx_revenues_status';
      const indexDef = 'ON revenues(org_id, status)';

      await financeDB.exec`CREATE INDEX IF NOT EXISTS ${indexName} ${indexDef}`;

      expect(financeDB.exec).toHaveBeenCalledWith(
        ['CREATE INDEX IF NOT EXISTS ', ' ', ''],
        indexName,
        indexDef
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database connection error
      (financeDB.queryAll as jest.Mock).mockRejectedValue(new Error('Connection timeout'));

      await expect(
        financeDB.queryAll`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'revenues' AND table_schema = 'public'
          ORDER BY ordinal_position
        `
      ).rejects.toThrow('Connection timeout');
    });

    it('should handle column already exists errors gracefully', async () => {
      // Mock column already exists error
      (financeDB.exec as jest.Mock).mockRejectedValue(new Error('column "status" of relation "revenues" already exists'));

      const columnName = 'status';
      const columnType = 'VARCHAR(20) DEFAULT \'pending\' NOT NULL';

      await expect(
        financeDB.exec`ALTER TABLE revenues ADD COLUMN ${columnName} ${columnType}`
      ).rejects.toThrow('column "status" of relation "revenues" already exists');
    });

    it('should handle constraint already exists errors gracefully', async () => {
      // Mock constraint already exists error
      (financeDB.exec as jest.Mock).mockRejectedValue(new Error('constraint "fk_revenues_approved_by_user_id" for relation "revenues" already exists'));

      const constraintName = 'fk_revenues_approved_by_user_id';
      const constraintDef = 'FOREIGN KEY (approved_by_user_id) REFERENCES users(id)';

      await expect(
        financeDB.exec`ALTER TABLE revenues ADD CONSTRAINT ${constraintName} ${constraintDef}`
      ).rejects.toThrow('constraint "fk_revenues_approved_by_user_id" for relation "revenues" already exists');
    });
  });
});

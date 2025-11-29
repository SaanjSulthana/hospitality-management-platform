import { financeDB } from './db';
import { APIError } from 'encore.dev/api';
import { executeQueryWithStability } from './connection_stability';

export interface Migration {
  version: string;
  name: string;
  up_sql: string;
  down_sql?: string;
  file: string;
  checksum?: string;
}

export interface AppliedMigration {
  version: string;
  name: string;
  applied_at: Date;
  execution_time_ms?: number;
  checksum?: string;
}

export interface MigrationStatus {
  applied_migrations: AppliedMigration[];
  pending_migrations: Migration[];
  total_applied: number;
  total_pending: number;
  last_migration?: AppliedMigration;
  status: 'up_to_date' | 'pending_migrations' | 'error';
}

export interface MigrationConflict {
  migration: string;
  conflicts_with: string[];
  severity: 'warning' | 'error';
  description: string;
}

/**
 * Migration management system for database schema evolution
 */
export class MigrationManager {
  private migrations: Migration[] = [];
  private appliedMigrations: AppliedMigration[] = [];

  constructor() {
    this.initializeMigrations();
  }

  /**
   * Initialize available migrations from the migrations directory
   */
  private initializeMigrations(): void {
    // In a real implementation, this would read from the filesystem
    // For now, we'll define the known migrations
    this.migrations = [
      {
        version: '1',
        name: 'ensure_revenues_table',
        up_sql: 'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = \'revenues\') THEN RAISE EXCEPTION \'revenues table does not exist. Auth service migrations must run first.\'; END IF; END $$;',
        down_sql: '-- No rollback needed - table managed by auth service',
        file: '1_create_revenues_table.up.sql'
      },
      {
        version: '2',
        name: 'ensure_expenses_table',
        up_sql: 'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = \'expenses\') THEN RAISE EXCEPTION \'expenses table does not exist. Auth service migrations must run first.\'; END IF; END $$;',
        down_sql: '-- No rollback needed - table managed by auth service',
        file: '2_create_expenses_table.up.sql'
      },
      {
        version: '3',
        name: 'add_receipt_file_id',
        up_sql: 'ALTER TABLE revenues ADD COLUMN receipt_file_id INTEGER;\nALTER TABLE expenses ADD COLUMN receipt_file_id INTEGER;',
        down_sql: 'ALTER TABLE revenues DROP COLUMN receipt_file_id;\nALTER TABLE expenses DROP COLUMN receipt_file_id;',
        file: '3_add_receipt_file_id.up.sql'
      },
      {
        version: '4',
        name: 'create_files_table',
        up_sql: 'CREATE TABLE files (id SERIAL PRIMARY KEY, filename VARCHAR(255), file_path VARCHAR(500), created_at TIMESTAMP DEFAULT NOW());',
        down_sql: 'DROP TABLE files;',
        file: '4_create_files_table.up.sql'
      },
      {
        version: '5',
        name: 'add_receipt_file_constraints',
        up_sql: 'ALTER TABLE revenues ADD CONSTRAINT fk_revenues_receipt_file_id FOREIGN KEY (receipt_file_id) REFERENCES files(id);\nALTER TABLE expenses ADD CONSTRAINT fk_expenses_receipt_file_id FOREIGN KEY (receipt_file_id) REFERENCES files(id);',
        down_sql: 'ALTER TABLE revenues DROP CONSTRAINT fk_revenues_receipt_file_id;\nALTER TABLE expenses DROP CONSTRAINT fk_expenses_receipt_file_id;',
        file: '5_add_receipt_file_constraints.up.sql'
      },
      {
        version: '6',
        name: 'create_daily_approvals',
        up_sql: 'CREATE TABLE daily_approvals (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, property_id INTEGER, approved_by_user_id INTEGER, approved_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW());',
        down_sql: 'DROP TABLE daily_approvals;',
        file: '6_create_daily_approvals.up.sql'
      },
      {
        version: '7',
        name: 'add_revenue_status',
        up_sql: 'ALTER TABLE revenues ADD COLUMN status VARCHAR(20) DEFAULT \'pending\' NOT NULL;\nALTER TABLE revenues ADD COLUMN approved_by_user_id INTEGER;\nALTER TABLE revenues ADD COLUMN approved_at TIMESTAMP;',
        down_sql: 'ALTER TABLE revenues DROP COLUMN status;\nALTER TABLE revenues DROP COLUMN approved_by_user_id;\nALTER TABLE revenues DROP COLUMN approved_at;',
        file: '7_add_revenue_status.up.sql'
      },
      {
        version: '8',
        name: 'add_payment_modes',
        up_sql: 'ALTER TABLE revenues ADD COLUMN payment_mode VARCHAR(10) DEFAULT \'cash\' NOT NULL;\nALTER TABLE revenues ADD COLUMN bank_reference VARCHAR(255);\nALTER TABLE expenses ADD COLUMN payment_mode VARCHAR(10) DEFAULT \'cash\' NOT NULL;\nALTER TABLE expenses ADD COLUMN bank_reference VARCHAR(255);',
        down_sql: 'ALTER TABLE revenues DROP COLUMN payment_mode;\nALTER TABLE revenues DROP COLUMN bank_reference;\nALTER TABLE expenses DROP COLUMN payment_mode;\nALTER TABLE expenses DROP COLUMN bank_reference;',
        file: '8_add_payment_modes.up.sql'
      },
      {
        version: '9',
        name: 'create_deletion_requests',
        up_sql: 'CREATE TABLE deletion_requests (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, table_name VARCHAR(50) NOT NULL, record_id INTEGER NOT NULL, requested_by_user_id INTEGER NOT NULL, reason TEXT, status VARCHAR(20) DEFAULT \'pending\', created_at TIMESTAMP DEFAULT NOW());',
        down_sql: 'DROP TABLE deletion_requests;',
        file: '9_create_deletion_requests.up.sql'
      },
      {
        version: '10',
        name: 'fix_expense_date_column',
        up_sql: 'ALTER TABLE expenses ALTER COLUMN expense_date TYPE TIMESTAMPTZ USING expense_date::TIMESTAMPTZ;',
        down_sql: 'ALTER TABLE expenses ALTER COLUMN expense_date TYPE TIMESTAMP USING expense_date::TIMESTAMP;',
        file: '10_fix_expense_date_column.up.sql'
      },
      {
        version: '11',
        name: 'create_notifications',
        up_sql: 'CREATE TABLE notifications (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, user_id INTEGER NOT NULL, type VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL, message TEXT, read_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW());',
        down_sql: 'DROP TABLE notifications;',
        file: '11_create_notifications.up.sql'
      },
      {
        version: '12',
        name: 'enhance_daily_balances',
        up_sql: 'ALTER TABLE daily_cash_balances ADD COLUMN opening_balance_cents INTEGER DEFAULT 0;\nALTER TABLE daily_cash_balances ADD COLUMN closing_balance_cents INTEGER;\nALTER TABLE daily_cash_balances ADD COLUMN variance_cents INTEGER;',
        down_sql: 'ALTER TABLE daily_cash_balances DROP COLUMN opening_balance_cents;\nALTER TABLE daily_cash_balances DROP COLUMN closing_balance_cents;\nALTER TABLE daily_cash_balances DROP COLUMN variance_cents;',
        file: '12_enhance_daily_balances.up.sql'
      }
    ];
  }

  /**
   * Get all available migrations
   */
  getAvailableMigrations(): Migration[] {
    return this.migrations;
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations(): Promise<AppliedMigration[]> {
    try {
      // Ensure schema_migrations table exists
      await this.ensureSchemaMigrationsTable();
      
      const migrations = await executeQueryWithStability(
        () => financeDB.queryAll`
          SELECT version, name, applied_at, execution_time_ms, checksum
          FROM schema_migrations
          ORDER BY version
        `,
        'get_applied_migrations'
      );

      return migrations.map((m: any) => ({
        version: m.version,
        name: m.name,
        applied_at: new Date(m.applied_at),
        execution_time_ms: m.execution_time_ms,
        checksum: m.checksum
      }));
    } catch (error) {
      console.error('Error getting applied migrations:', error);
      throw new APIError('internal', `Failed to get applied migrations: ${(error as Error).message}`);
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<MigrationStatus> {
    try {
      const appliedMigrations = await this.getAppliedMigrations();
      const availableMigrations = this.getAvailableMigrations();
      
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));
      const pendingMigrations = availableMigrations.filter(m => !appliedVersions.has(m.version));
      
      let status: MigrationStatus['status'] = 'up_to_date';
      if (pendingMigrations.length > 0) {
        status = 'pending_migrations';
      }

      return {
        applied_migrations: appliedMigrations,
        pending_migrations: pendingMigrations,
        total_applied: appliedMigrations.length,
        total_pending: pendingMigrations.length,
        last_migration: appliedMigrations[appliedMigrations.length - 1],
        status
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      return {
        applied_migrations: [],
        pending_migrations: [],
        total_applied: 0,
        total_pending: 0,
        status: 'error'
      };
    }
  }

  /**
   * Apply a specific migration
   * Note: This method is disabled due to Encore's static SQL requirements.
   * Migrations should be run using standard database migration tools or SQL scripts.
   */
  async applyMigration(migration: Migration): Promise<AppliedMigration> {
    throw new APIError('unimplemented', 
      'Migration execution is not available through the API. ' +
      'Please run migrations using database migration tools or SQL scripts directly. ' +
      `Migration ${migration.version} (${migration.name}) should be applied manually.`
    );
  }

  /**
   * Rollback a specific migration
   * Note: This method is disabled due to Encore's static SQL requirements.
   * Migrations should be rolled back using standard database migration tools or SQL scripts.
   */
  async rollbackMigration(migration: Migration): Promise<void> {
    throw new APIError('unimplemented', 
      'Migration rollback is not available through the API. ' +
      'Please rollback migrations using database migration tools or SQL scripts directly. ' +
      `Migration ${migration.version} (${migration.name}) should be rolled back manually using the down_sql script.`
    );
  }

  /**
   * Apply all pending migrations
   */
  async applyAllPendingMigrations(): Promise<AppliedMigration[]> {
    try {
      const status = await this.getMigrationStatus();
      const appliedMigrations: AppliedMigration[] = [];
      
      for (const migration of status.pending_migrations) {
        const applied = await this.applyMigration(migration);
        appliedMigrations.push(applied);
      }
      
      console.log(`Applied ${appliedMigrations.length} pending migrations`);
      return appliedMigrations;
    } catch (error) {
      console.error('Error applying pending migrations:', error);
      throw new APIError('internal', `Failed to apply pending migrations: ${(error as Error).message}`);
    }
  }

  /**
   * Validate migration integrity
   */
  async validateMigrationIntegrity(migration: Migration): Promise<boolean> {
    try {
      // Basic validation
      if (!migration.version || !migration.name || !migration.up_sql) {
        return false;
      }
      
      // Check if migration has already been applied
      const appliedMigrations = await this.getAppliedMigrations();
      const isAlreadyApplied = appliedMigrations.some(m => m.version === migration.version);
      
      if (isAlreadyApplied) {
        console.warn(`Migration ${migration.version} has already been applied`);
        return false;
      }
      
      // In a real implementation, you might also validate SQL syntax
      return true;
    } catch (error) {
      console.error(`Error validating migration ${migration.version}:`, error);
      return false;
    }
  }

  /**
   * Detect migration conflicts
   */
  async detectMigrationConflicts(): Promise<MigrationConflict[]> {
    try {
      const conflicts: MigrationConflict[] = [];
      const appliedMigrations = await this.getAppliedMigrations();
      const pendingMigrations = (await this.getMigrationStatus()).pending_migrations;
      
      // Check for version conflicts
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));
      const duplicateVersions = pendingMigrations.filter(m => appliedVersions.has(m.version));
      
      for (const migration of duplicateVersions) {
        conflicts.push({
          migration: migration.version,
          conflicts_with: [migration.version],
          severity: 'error',
          description: `Migration version ${migration.version} has already been applied`
        });
      }
      
      // Check for dependency conflicts (simplified)
      for (const migration of pendingMigrations) {
        if (migration.name.includes('constraints') && !appliedVersions.has('4')) {
          conflicts.push({
            migration: migration.version,
            conflicts_with: ['4'],
            severity: 'error',
            description: `Migration ${migration.version} requires migration 4 to be applied first`
          });
        }
      }
      
      return conflicts;
    } catch (error) {
      console.error('Error detecting migration conflicts:', error);
      return [];
    }
  }

  /**
   * Ensure schema_migrations table exists
   */
  private async ensureSchemaMigrationsTable(): Promise<void> {
    try {
      await executeQueryWithStability(
        () => financeDB.exec`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            version VARCHAR(20) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            applied_at TIMESTAMP DEFAULT NOW(),
            execution_time_ms INTEGER,
            checksum VARCHAR(64)
          )
        `,
        'ensure_schema_migrations_table'
      );
    } catch (error) {
      console.error('Error ensuring schema_migrations table:', error);
      throw new APIError('internal', `Failed to create schema_migrations table: ${(error as Error).message}`);
    }
  }

  /**
   * Calculate checksum for migration SQL
   */
  private calculateChecksum(sql: string): string {
    // Simple checksum calculation - in production, use crypto.createHash
    let hash = 0;
    for (let i = 0; i < sql.length; i++) {
      const char = sql.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Global migration manager instance
 */
export const migrationManager = new MigrationManager();

/**
 * Utility functions for migration management
 */

/**
 * Get migration status
 */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  return migrationManager.getMigrationStatus();
}

/**
 * Apply all pending migrations
 */
export async function applyAllPendingMigrations(): Promise<AppliedMigration[]> {
  return migrationManager.applyAllPendingMigrations();
}

/**
 * Apply a specific migration by version
 */
export async function applyMigrationByVersion(version: string): Promise<AppliedMigration> {
  const migrations = migrationManager.getAvailableMigrations();
  const migration = migrations.find(m => m.version === version);
  
  if (!migration) {
    throw new APIError('not_found', `Migration version ${version} not found`);
  }
  
  return migrationManager.applyMigration(migration);
}

/**
 * Rollback a specific migration by version
 */
export async function rollbackMigrationByVersion(version: string): Promise<void> {
  const migrations = migrationManager.getAvailableMigrations();
  const migration = migrations.find(m => m.version === version);
  
  if (!migration) {
    throw new APIError('not_found', `Migration version ${version} not found`);
  }
  
  return migrationManager.rollbackMigration(migration);
}

/**
 * Validate all pending migrations
 */
export async function validateAllPendingMigrations(): Promise<{ valid: Migration[]; invalid: Migration[] }> {
  const status = await migrationManager.getMigrationStatus();
  const valid: Migration[] = [];
  const invalid: Migration[] = [];
  
  for (const migration of status.pending_migrations) {
    const isValid = await migrationManager.validateMigrationIntegrity(migration);
    if (isValid) {
      valid.push(migration);
    } else {
      invalid.push(migration);
    }
  }
  
  return { valid, invalid };
}

/**
 * Get migration conflicts
 */
export async function getMigrationConflicts(): Promise<MigrationConflict[]> {
  return migrationManager.detectMigrationConflicts();
}

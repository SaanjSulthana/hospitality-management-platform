import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { 
  getMigrationStatus, 
  applyAllPendingMigrations, 
  applyMigrationByVersion, 
  rollbackMigrationByVersion,
  validateAllPendingMigrations,
  getMigrationConflicts,
  MigrationStatus,
  AppliedMigration,
  MigrationConflict
} from "./migration_management";

export interface MigrationStatusResponse {
  status: MigrationStatus;
  conflicts: MigrationConflict[];
  validation: {
    valid: number;
    invalid: number;
  };
}

export interface ApplyMigrationsResponse {
  applied_migrations: AppliedMigration[];
  total_applied: number;
  execution_time_ms: number;
}

export interface ApplyMigrationResponse {
  migration: AppliedMigration;
  execution_time_ms: number;
}

export interface RollbackMigrationResponse {
  version: string;
  name: string;
  execution_time_ms: number;
}

/**
 * Get migration status endpoint
 * GET /finance/migration-status
 */
export const getMigrationStatusEndpoint = api(
  { auth: true, expose: true, method: "GET", path: "/finance/migration-status" },
  async (): Promise<MigrationStatusResponse> => {
    try {
      console.log('Getting migration status...');
      
      const [status, conflicts, validation] = await Promise.all([
        getMigrationStatus(),
        getMigrationConflicts(),
        validateAllPendingMigrations()
      ]);
      
      return {
        status,
        conflicts,
        validation: {
          valid: validation.valid.length,
          invalid: validation.invalid.length
        }
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      throw new APIError('internal', `Failed to get migration status: ${(error as Error).message}`);
    }
  }
);

/**
 * Apply all pending migrations endpoint
 * POST /finance/apply-migrations
 */
export const applyAllMigrationsEndpoint = api(
  { auth: true, expose: true, method: "POST", path: "/finance/apply-migrations" },
  async (): Promise<ApplyMigrationsResponse> => {
    try {
      // Require admin role for applying migrations
      const authData = getAuthData();
      requireRole(authData, "ADMIN");
      
      console.log('Applying all pending migrations...');
      const startTime = Date.now();
      
      const appliedMigrations = await applyAllPendingMigrations();
      const executionTime = Date.now() - startTime;
      
      console.log(`Applied ${appliedMigrations.length} migrations in ${executionTime}ms`);
      
      return {
        applied_migrations: appliedMigrations,
        total_applied: appliedMigrations.length,
        execution_time_ms: executionTime
      };
    } catch (error) {
      console.error('Error applying migrations:', error);
      throw new APIError('internal', `Failed to apply migrations: ${(error as Error).message}`);
    }
  }
);

/**
 * Apply specific migration endpoint
 * POST /finance/apply-migration/:version
 */
export const applyMigrationEndpoint = api(
  { auth: true, expose: true, method: "POST", path: "/finance/apply-migration/:version" },
  async ({ version }: { version: string }): Promise<ApplyMigrationResponse> => {
    try {
      // Require admin role for applying migrations
      const authData = getAuthData();
      requireRole(authData, "ADMIN");
      
      console.log(`Applying migration version ${version}...`);
      const startTime = Date.now();
      
      const migration = await applyMigrationByVersion(version);
      const executionTime = Date.now() - startTime;
      
      console.log(`Applied migration ${version} in ${executionTime}ms`);
      
      return {
        migration,
        execution_time_ms: executionTime
      };
    } catch (error) {
      console.error(`Error applying migration ${version}:`, error);
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('internal', `Failed to apply migration ${version}: ${(error as Error).message}`);
    }
  }
);

/**
 * Rollback specific migration endpoint
 * POST /finance/rollback-migration/:version
 */
export const rollbackMigrationEndpoint = api(
  { auth: true, expose: true, method: "POST", path: "/finance/rollback-migration/:version" },
  async ({ version }: { version: string }): Promise<RollbackMigrationResponse> => {
    try {
      // Require admin role for rolling back migrations
      const authData = getAuthData();
      requireRole(authData, "ADMIN");
      
      console.log(`Rolling back migration version ${version}...`);
      const startTime = Date.now();
      
      await rollbackMigrationByVersion(version);
      const executionTime = Date.now() - startTime;
      
      console.log(`Rolled back migration ${version} in ${executionTime}ms`);
      
      return {
        version,
        name: `migration_${version}`,
        execution_time_ms: executionTime
      };
    } catch (error) {
      console.error(`Error rolling back migration ${version}:`, error);
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('internal', `Failed to rollback migration ${version}: ${(error as Error).message}`);
    }
  }
);

/**
 * Validate pending migrations endpoint
 * GET /finance/validate-migrations
 */
export const validateMigrationsEndpoint = api(
  { auth: true, expose: true, method: "GET", path: "/finance/validate-migrations" },
  async (): Promise<{ valid: any[]; invalid: any[]; conflicts: MigrationConflict[] }> => {
    try {
      console.log('Validating pending migrations...');
      
      const [validation, conflicts] = await Promise.all([
        validateAllPendingMigrations(),
        getMigrationConflicts()
      ]);
      
      return {
        valid: validation.valid,
        invalid: validation.invalid,
        conflicts
      };
    } catch (error) {
      console.error('Error validating migrations:', error);
      throw new APIError('internal', `Failed to validate migrations: ${(error as Error).message}`);
    }
  }
);

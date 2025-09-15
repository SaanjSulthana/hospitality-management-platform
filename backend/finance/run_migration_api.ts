import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { runPaymentModeMigration } from "./run_migration_script";

export interface RunMigrationApiResponse {
  success: boolean;
  message: string;
}

// API endpoint to run the payment mode migration
export const runMigrationApi = api<{}, RunMigrationApiResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/run-migration-auth" },
  async () => {
    console.log('=== RUNNING MIGRATION VIA API ===');
    
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    try {
      await runPaymentModeMigration();
      
      return {
        success: true,
        message: "Payment mode migration completed successfully"
      };
    } catch (error) {
      console.error('Error running migration via API:', error);
      throw APIError.internal(`Failed to run migration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

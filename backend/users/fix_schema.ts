import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { fixUserSchemaIssues } from "../fix_user_schema_issues";
import log from "encore.dev/log";

export interface FixUserSchemaRequest {}

export interface FixUserSchemaResponse {
  success: boolean;
  message: string;
  fixes: string[];
}

// Fixes user schema issues (Admin only)
export const fixSchema = api<FixUserSchemaRequest, FixUserSchemaResponse>(
  { auth: true, expose: true, method: "POST", path: "/users/fix-schema" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    try {
      log.info("Admin requested user schema fix", { 
        adminId: authData.userID,
        orgId: authData.orgId 
      });

      const result = await fixUserSchemaIssues();
      
      if (result.success) {
        log.info("User schema fix completed successfully", { 
          adminId: authData.userID,
          fixesApplied: result.fixes.length 
        });
      } else {
        log.error("User schema fix failed", { 
          adminId: authData.userID,
          error: result.message 
        });
      }

      return result;
    } catch (error) {
      log.error('Fix user schema error', { 
        error: error instanceof Error ? error.message : String(error),
        adminId: authData.userID,
        orgId: authData.orgId
      });
      
      throw APIError.internal("Failed to fix user schema issues");
    }
  }
);

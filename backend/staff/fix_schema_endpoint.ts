import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { fixStaffSchemaIssues } from "./fix_schema_issues";

export interface FixSchemaRequest {
  // No parameters needed
}

export interface FixSchemaResponse {
  success: boolean;
  message: string;
  details?: any;
}

// Admin endpoint to fix staff schema issues
export const fixSchema = api<FixSchemaRequest, FixSchemaResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/fix-schema" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    try {
      console.log(`Admin ${authData.userID} (org ${authData.orgId}) fixing staff schema...`);
      
      const result = await fixStaffSchemaIssues();
      
      return {
        success: true,
        message: "Staff schema fixed successfully",
        details: result
      };
    } catch (error) {
      console.error('Fix schema error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw APIError.internal(`Failed to fix staff schema: ${errorMessage}`);
    }
  }
);

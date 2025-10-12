import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { completeSchemaRepair, SchemaRepairResult } from "./schema_repair";

export interface SchemaFixRequest {
  // No parameters needed for this endpoint
}

export interface SchemaFixApiResponse {
  success: boolean;
  message: string;
  results: string[];
  errors: string[];
  summary: {
    columns_added: number;
    constraints_added: number;
    indexes_added: number;
    total_operations: number;
  };
  timestamp: string;
}

/**
 * POST /finance/fix-schema
 * 
 * Automatically fix database schema issues by adding missing columns, constraints, and indexes
 * to both revenues and expenses tables.
 * 
 * This endpoint performs comprehensive schema repair operations including:
 * - Adding missing columns with proper data types and defaults
 * - Creating foreign key constraints for referential integrity
 * - Creating performance indexes for better query performance
 * - Updating existing records with default values
 * - Validating the final schema state
 * 
 * All operations are performed safely using "IF NOT EXISTS" clauses to prevent errors
 * if the schema elements already exist.
 */
export const fixSchema = api<SchemaFixRequest, SchemaFixApiResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/fix-schema" },
  async () => {
    console.log('=== SCHEMA FIX ENDPOINT CALLED ===');
    
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    
    // Only ADMIN role can fix schema issues
    requireRole("ADMIN")(authData);
    
    console.log('Auth data:', { userId: authData?.userID, role: authData?.role, orgId: authData?.orgId });

    try {
      console.log('Starting comprehensive schema fix...');
      
      // Perform complete schema repair
      const repairResult: SchemaRepairResult = await completeSchemaRepair();
      
      // Transform the result to match the API response format
      const response: SchemaFixApiResponse = {
        success: repairResult.success,
        message: repairResult.message,
        results: repairResult.results,
        errors: repairResult.errors,
        summary: repairResult.summary,
        timestamp: new Date().toISOString()
      };

      console.log('Schema fix completed:', {
        success: response.success,
        totalOperations: response.summary.total_operations,
        columnsAdded: response.summary.columns_added,
        constraintsAdded: response.summary.constraints_added,
        indexesAdded: response.summary.indexes_added,
        resultsCount: response.results.length,
        errorsCount: response.errors.length
      });

      // Log detailed results for debugging
      if (response.results.length > 0) {
        console.log('Schema fix results:', response.results);
      }
      
      if (response.errors.length > 0) {
        console.error('Schema fix errors:', response.errors);
      }

      return response;
    } catch (error) {
      console.error('Schema fix error:', error);
      
      // Provide detailed error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('Error details:', {
        message: errorMessage,
        stack: errorStack,
        name: error instanceof Error ? error.name : undefined
      });

      // Return a structured error response
      const errorResponse: SchemaFixApiResponse = {
        success: false,
        message: `Schema fix failed: ${errorMessage}`,
        results: [],
        errors: [`Schema fix operation failed: ${errorMessage}`],
        summary: {
          columns_added: 0,
          constraints_added: 0,
          indexes_added: 0,
          total_operations: 0
        },
        timestamp: new Date().toISOString()
      };

      // If it's an APIError, re-throw it to maintain proper HTTP status codes
      if (error instanceof APIError) {
        throw error;
      }

      // For other errors, throw an internal server error with detailed information
      throw APIError.internal(`Schema fix failed: ${errorMessage}`);
    }
  }
);

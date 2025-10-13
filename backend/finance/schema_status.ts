import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { validateFinanceSchema, SchemaStatusResponse } from "./schema_validation";

export interface SchemaStatusRequest {
  // No parameters needed for this endpoint
}

export interface SchemaStatusApiResponse {
  success: boolean;
  message: string;
  revenues: {
    missing_columns: string[];
    existing_columns: string[];
    missing_constraints: string[];
    existing_constraints: string[];
    missing_indexes: string[];
    existing_indexes: string[];
    is_complete: boolean;
  };
  expenses: {
    missing_columns: string[];
    existing_columns: string[];
    missing_constraints: string[];
    existing_constraints: string[];
    missing_indexes: string[];
    existing_indexes: string[];
    is_complete: boolean;
  };
  overall_status: 'complete' | 'incomplete' | 'error';
  timestamp: string;
}

/**
 * GET /finance/schema-status
 * 
 * Check current database schema status and identify missing columns, constraints, and indexes
 * for both revenues and expenses tables.
 * 
 * This endpoint provides comprehensive schema validation information to help diagnose
 * database connection and schema mismatch issues.
 */
export const getSchemaStatus = api<SchemaStatusRequest, SchemaStatusApiResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/schema-status" },
  async () => {
    console.log('=== SCHEMA STATUS ENDPOINT CALLED ===');
    
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    
    // Allow both ADMIN and MANAGER roles to check schema status
    requireRole("ADMIN", "MANAGER")(authData);
    
    console.log('Auth data:', { userId: authData?.userID, role: authData?.role, orgId: authData?.orgId });

    try {
      console.log('Starting schema status check...');
      
      // Validate the finance schema
      const validationResult: SchemaStatusResponse = await validateFinanceSchema();
      
      if (!validationResult.success) {
        console.error('Schema validation failed:', validationResult.message);
        throw APIError.internal(`Schema validation failed: ${validationResult.message}`);
      }

      // Transform the result to match the API response format
      const response: SchemaStatusApiResponse = {
        success: true,
        message: validationResult.message,
        revenues: {
          missing_columns: validationResult.revenues.missing_columns,
          existing_columns: validationResult.revenues.existing_columns,
          missing_constraints: validationResult.revenues.missing_constraints,
          existing_constraints: validationResult.revenues.existing_constraints,
          missing_indexes: validationResult.revenues.missing_indexes,
          existing_indexes: validationResult.revenues.existing_indexes,
          is_complete: validationResult.revenues.is_complete
        },
        expenses: {
          missing_columns: validationResult.expenses.missing_columns,
          existing_columns: validationResult.expenses.existing_columns,
          missing_constraints: validationResult.expenses.missing_constraints,
          existing_constraints: validationResult.expenses.existing_constraints,
          missing_indexes: validationResult.expenses.missing_indexes,
          existing_indexes: validationResult.expenses.existing_indexes,
          is_complete: validationResult.expenses.is_complete
        },
        overall_status: validationResult.overall_status,
        timestamp: new Date().toISOString()
      };

      console.log('Schema status check completed successfully:', {
        overallStatus: response.overall_status,
        revenuesComplete: response.revenues.is_complete,
        expensesComplete: response.expenses.is_complete,
        missingColumns: {
          revenues: response.revenues.missing_columns.length,
          expenses: response.expenses.missing_columns.length
        },
        missingConstraints: {
          revenues: response.revenues.missing_constraints.length,
          expenses: response.expenses.missing_constraints.length
        },
        missingIndexes: {
          revenues: response.revenues.missing_indexes.length,
          expenses: response.expenses.missing_indexes.length
        }
      });

      return response;
    } catch (error) {
      console.error('Schema status check error:', error);
      
      // Provide detailed error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('Error details:', {
        message: errorMessage,
        stack: errorStack,
        name: error instanceof Error ? error.name : undefined
      });

      // Return a structured error response
      const errorResponse: SchemaStatusApiResponse = {
        success: false,
        message: `Schema status check failed: ${errorMessage}`,
        revenues: {
          missing_columns: [],
          existing_columns: [],
          missing_constraints: [],
          existing_constraints: [],
          missing_indexes: [],
          existing_indexes: [],
          is_complete: false
        },
        expenses: {
          missing_columns: [],
          existing_columns: [],
          missing_constraints: [],
          existing_constraints: [],
          missing_indexes: [],
          existing_indexes: [],
          is_complete: false
        },
        overall_status: 'error',
        timestamp: new Date().toISOString()
      };

      // If it's an APIError, re-throw it to maintain proper HTTP status codes
      if (error instanceof APIError) {
        throw error;
      }

      // For other errors, throw an internal server error with detailed information
      throw APIError.internal(`Schema status check failed: ${errorMessage}`);
    }
  }
);

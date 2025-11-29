import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { brandingDB } from "./db";
import { brandingEvents } from "./events";
import { v4 as uuidv4 } from "uuid";
import { requireRole } from "../auth/middleware";

export interface UpdateThemeRequest {
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  currency?: string;
  dateFormat?: string;
  timeFormat?: string;
}

export interface UpdateThemeResponse {
  success: boolean;
}

// Shared handler for updating theme configuration
async function updateThemeHandler(req: UpdateThemeRequest): Promise<UpdateThemeResponse> {
    try {
      const authData = getAuthData();
      if (!authData) {
        throw APIError.unauthenticated("Authentication required");
      }
      requireRole("ADMIN")(authData);

      console.log('Theme update request:', { orgId: authData.orgId, request: req });

      // Validate required fields
      if (!authData.orgId) {
        throw APIError.invalidArgument("Organization ID is required");
      }

      // Test database connection
      try {
        console.log('Testing database connection...');
        const testResult = await brandingDB.queryRow`SELECT 1 as test`;
        console.log('Database connection test result:', testResult);
        
        // Test if we can read from the organizations table
        console.log('Testing organizations table access...');
        const orgTest = await brandingDB.queryRow`
          SELECT id, name FROM organizations WHERE id = ${authData.orgId}
        `;
        console.log('Organization test result:', orgTest);
        
      } catch (dbTestError: any) {
        console.error('Database connection test failed:', dbTestError);
        throw APIError.internal(`Database connection failed: ${dbTestError.message}`);
      }

      // Clean and validate the request data
      const cleanedRequest: any = {};
      
      // Only include non-empty values, but allow empty logoUrl for removal
      Object.entries(req).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Allow empty logoUrl to remove the logo
          if (key === 'logoUrl' && value === '') {
            cleanedRequest[key] = null; // Set to null to remove logo
          } else if (value !== '') {
            cleanedRequest[key] = value;
          }
        }
      });

      console.log('Cleaned request:', cleanedRequest);

      // Get current theme
      console.log('Fetching current organization data...');
      const orgRow = await brandingDB.queryRow`
        SELECT name, theme_json FROM organizations WHERE id = ${authData.orgId}
      `;

      if (!orgRow) {
        console.log('Organization not found for ID:', authData.orgId);
        throw APIError.notFound("Organization not found");
      }

      console.log('Current organization data:', { 
        name: orgRow.name, 
        themeJson: orgRow.theme_json 
      });

      // Safely parse and validate the current theme (JSONB from PostgreSQL)
      let currentTheme: any = {};
      let needsCleanup = false;
      
      if (orgRow.theme_json) {
        try {
          // PostgreSQL JSONB is returned as a JavaScript object
          if (typeof orgRow.theme_json === 'object' && orgRow.theme_json !== null) {
            // Validate that it's a reasonable object (not corrupted)
            if (Object.keys(orgRow.theme_json).length < 100) {
              currentTheme = orgRow.theme_json;
            } else {
              console.warn('Theme JSON appears to be corrupted, will reset to default');
              currentTheme = {};
              needsCleanup = true;
            }
          } else {
            console.warn('Unexpected theme_json type:', typeof orgRow.theme_json);
            currentTheme = {};
          }
        } catch (parseError: any) {
          console.error('Error processing theme JSON:', parseError);
          console.warn('Using empty theme object due to processing error');
          currentTheme = {};
          needsCleanup = true;
        }
      }

      const updatedTheme = { ...currentTheme, ...cleanedRequest };

      console.log('Updated theme:', updatedTheme);

      // Validate the updated theme object
      console.log('Updated theme object:', updatedTheme);
      
      // For JSONB, we pass the object directly, not a string
      if (!updatedTheme || typeof updatedTheme !== 'object') {
        throw APIError.invalidArgument("Invalid theme data");
      }

      console.log('Theme object keys:', Object.keys(updatedTheme));

      // Update organization name if provided
      try {
        if (cleanedRequest.brandName) {
          console.log('Updating organization name and theme...');
          console.log('Update parameters:', {
            brandName: cleanedRequest.brandName,
            themeJson: JSON.stringify(updatedTheme).substring(0, 100) + '...',
            orgId: authData.orgId
          });
          
          await brandingDB.exec`
            UPDATE organizations 
            SET name = ${cleanedRequest.brandName}, theme_json = ${updatedTheme}
            WHERE id = ${authData.orgId}
          `;
        } else {
          console.log('Updating theme only...');
          console.log('Update parameters:', {
            themeJson: JSON.stringify(updatedTheme).substring(0, 100) + '...',
            orgId: authData.orgId
          });
          
          await brandingDB.exec`
            UPDATE organizations 
            SET theme_json = ${updatedTheme}
            WHERE id = ${authData.orgId}
          `;
        }
        
        if (needsCleanup) {
          console.log('Theme data has been cleaned up and reset');
        }
        
        console.log('Database update completed successfully');
      } catch (dbError: any) {
        console.error('Database update failed:', dbError);
        console.error('Database error details:', {
          message: dbError.message,
          code: dbError.code,
          detail: dbError.detail,
          hint: dbError.hint
        });
        throw APIError.internal(`Database update failed: ${dbError.message}`);
      }

      console.log('Theme updated successfully');
      console.log('Final theme data in database:', {
        orgId: authData.orgId,
        themeJson: JSON.stringify(updatedTheme).substring(0, 200) + '...',
        themeJsonLength: JSON.stringify(updatedTheme).length
      });

      // Publish event
      try {
        await brandingEvents.publish({
          eventId: uuidv4(),
          eventVersion: "v1",
          eventType: "theme_updated",
          orgId: authData.orgId,
          userId: Number(authData.userID) || null,
          propertyId: null,
          timestamp: new Date(),
          entityId: authData.orgId,
          entityType: "branding",
          metadata: {
            ...cleanedRequest,
          },
        });
      } catch (pubErr) {
        console.warn("[BrandingRealtime] Failed to publish theme_updated event:", pubErr);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Theme update failed:', error);
      
      // Re-throw API errors as-is
      if (error instanceof APIError) {
        throw error;
      }
      
      // Log the full error for debugging
      console.error('Full error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Convert other errors to internal server error
      throw APIError.internal("Failed to update theme configuration");
    }
}

// LEGACY: Updates theme configuration (keep for backward compatibility)
export const updateTheme = api<UpdateThemeRequest, UpdateThemeResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/branding/theme" },
  updateThemeHandler
);

// V1: Updates theme configuration
export const updateThemeV1 = api<UpdateThemeRequest, UpdateThemeResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/v1/branding/theme" },
  updateThemeHandler
);

// Shared handler for cleaning up corrupted theme data
async function cleanupCorruptedThemeHandler(req: void): Promise<{ success: boolean }> {
    try {
      const authData = getAuthData();
      if (!authData) {
        throw APIError.unauthenticated("Authentication required");
      }
      requireRole("ADMIN")(authData);

      console.log('Cleaning up corrupted theme data for organization:', authData.orgId);

      // Reset theme_json to a safe default
      const safeDefaultTheme = {
        brandName: "Hospitality Platform",
        primaryColor: "#3b82f6",
        secondaryColor: "#64748b",
        accentColor: "#10b981",
        backgroundColor: "#ffffff",
        textColor: "#1f2937",
        currency: "USD",
        dateFormat: "MM/DD/YYYY",
        timeFormat: "12h",
      };

      await brandingDB.exec`
        UPDATE organizations 
        SET theme_json = ${JSON.stringify(safeDefaultTheme)}
        WHERE id = ${authData.orgId}
      `;

      // Publish event
      try {
        await brandingEvents.publish({
          eventId: uuidv4(),
          eventVersion: "v1",
          eventType: "theme_cleaned",
          orgId: authData.orgId,
          userId: Number(authData.userID) || null,
          propertyId: null,
          timestamp: new Date(),
          entityId: authData.orgId,
          entityType: "branding",
          metadata: {
            action: "cleanup",
          },
        });
      } catch (pubErr) {
        console.warn("[BrandingRealtime] Failed to publish theme_cleaned event:", pubErr);
      }

      console.log('Theme cleanup completed successfully');
      return { success: true };
    } catch (error: any) {
      console.error('Theme cleanup failed:', error);
      throw APIError.internal("Failed to cleanup theme data");
    }
}

// LEGACY: Cleans up corrupted theme (keep for backward compatibility)
export const cleanupCorruptedTheme = api<void, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/branding/cleanup-theme" },
  cleanupCorruptedThemeHandler
);

// V1: Cleans up corrupted theme
export const cleanupCorruptedThemeV1 = api<void, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/v1/branding/cleanup-theme" },
  cleanupCorruptedThemeHandler
);

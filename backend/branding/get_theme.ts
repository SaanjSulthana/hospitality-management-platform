import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { brandingDB } from "./db";

export interface Theme {
  brandName: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  currency: string;
  dateFormat: string;
  timeFormat: string;
}

export interface GetThemeRequest {}

export interface GetThemeResponse {
  theme: Theme;
}

// Gets the theme configuration for the organization
export const getTheme = api<GetThemeRequest, GetThemeResponse>(
  { auth: true, expose: true, method: "GET", path: "/branding/theme" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    try {

      console.log('Getting theme for organization:', authData.orgId);

      const orgRow = await brandingDB.queryRow`
        SELECT name, theme_json FROM organizations WHERE id = ${authData.orgId}
      `;

      if (!orgRow) {
        console.log('Organization not found for ID:', authData.orgId);
        throw APIError.notFound("Organization not found");
      }

      console.log('Organization data:', {
        name: orgRow.name,
        themeJsonType: typeof orgRow.theme_json,
        themeJsonKeys: orgRow.theme_json ? Object.keys(orgRow.theme_json).length : 0,
        themeJsonValue: orgRow.theme_json ? JSON.stringify(orgRow.theme_json).substring(0, 200) + '...' : 'null',
        themeJsonRaw: orgRow.theme_json
      });

      const defaultTheme: Theme = {
        brandName: orgRow.name,
        primaryColor: "#3b82f6",
        secondaryColor: "#64748b",
        accentColor: "#10b981",
        backgroundColor: "#ffffff",
        textColor: "#1f2937",
        currency: "USD",
        dateFormat: "MM/DD/YYYY",
        timeFormat: "12h",
      };

      // Safely handle the theme_json field (JSONB from PostgreSQL)
      let customTheme: Partial<Theme> = {};
      
      if (orgRow.theme_json) {
        try {
          // PostgreSQL JSONB is returned as a JavaScript object
          const themeData = orgRow.theme_json;
          
          console.log('Processing theme data:', {
            type: typeof themeData,
            keys: Object.keys(themeData || {}),
            data: themeData
          });
          
          // Only extract known theme properties to avoid enumeration issues
          const themeKeys: (keyof Theme)[] = [
            'brandName', 'logoUrl', 'primaryColor', 'secondaryColor', 
            'accentColor', 'backgroundColor', 'textColor', 'currency', 
            'dateFormat', 'timeFormat'
          ];
          
          themeKeys.forEach(key => {
            if (themeData && themeData[key] !== undefined && themeData[key] !== null) {
              customTheme[key] = themeData[key];
            }
          });
          
          console.log('Custom theme extracted:', Object.keys(customTheme));
          console.log('Custom theme values:', customTheme);
        } catch (themeError: any) {
          console.error('Error processing theme_json:', themeError);
          // Continue with default theme if there's an issue
          customTheme = {};
        }
      }

      const theme = { ...defaultTheme, ...customTheme };

      console.log('Final theme:', {
        brandName: theme.brandName,
        primaryColor: theme.primaryColor,
        hasLogoUrl: !!theme.logoUrl,
        currency: theme.currency,
        dateFormat: theme.dateFormat
      });

      return { theme };
    } catch (error: any) {
      console.error('Get theme failed:', error);
      
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
      
      // Return a safe default theme instead of throwing
      const safeDefaultTheme: Theme = {
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
      
      return { theme: safeDefaultTheme };
    }
  }
);

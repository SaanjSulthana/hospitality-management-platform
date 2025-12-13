import { api, APIError, Header } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { brandingDB } from "./db";
import { 
  trackMetrics,
  generateETag,
  checkConditionalGet,
  generateCacheHeaders,
  recordETagCheck
} from "../middleware";

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

export interface GetThemeRequest {
  // Conditional GET headers for cache validation
  ifNoneMatch?: Header<"If-None-Match">;
}

export interface GetThemeResponse {
  theme: Theme;
  // Cache metadata
  _meta?: {
    etag?: string;
    cacheControl?: string;
    cached?: boolean;  // True if this is a 304-equivalent response
  };
}

// Shared handler for getting theme configuration
async function getThemeHandler(req: GetThemeRequest): Promise<GetThemeResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    
    // Wrap with metrics tracking and ETag support
    return trackMetrics('/v1/branding/theme', async (timer) => {
      timer.checkpoint('auth');
      requireRole("ADMIN", "MANAGER")(authData);

      const { ifNoneMatch } = req;

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

      timer.checkpoint('db_complete');
      
      // Generate ETag for response
      const response = { theme };
      const etag = generateETag(response);
      
      // Check if client has valid cached version
      if (ifNoneMatch && checkConditionalGet(etag, ifNoneMatch)) {
        recordETagCheck('/v1/branding/theme', true);
        console.log('[Branding] 304 Not Modified - ETag match:', etag);
        // Return minimal response (empty theme signals use cached version)
        return { 
          theme: {
            brandName: '',
            primaryColor: '',
            secondaryColor: '',
            accentColor: '',
            backgroundColor: '',
            textColor: '',
            currency: '',
            dateFormat: '',
            timeFormat: ''
          }, 
          _meta: { 
            etag, 
            cacheControl: 'public, s-maxage=1800, stale-while-revalidate=86400',
            cached: true
          } 
        };
      }
      
      recordETagCheck('/v1/branding/theme', false);
      
      // Generate cache headers (theme rarely changes - 30 min CDN cache)
      const cacheHeaders = generateCacheHeaders('metadata', {
        orgId: authData.orgId,
      });
      
      return { 
        theme, 
        _meta: { 
          etag, 
          cacheControl: cacheHeaders['Cache-Control'] 
        } 
      };
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
  }); // End trackMetrics
}

// LEGACY: Gets theme configuration (keep for backward compatibility)
export const getTheme = api<GetThemeRequest, GetThemeResponse>(
  { auth: true, expose: true, method: "GET", path: "/branding/theme" },
  getThemeHandler
);

// V1: Gets theme configuration
export const getThemeV1 = api<GetThemeRequest, GetThemeResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/branding/theme" },
  getThemeHandler
);

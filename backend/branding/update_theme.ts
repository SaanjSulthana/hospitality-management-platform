import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { brandingDB } from "./db";
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

// Updates the theme configuration for the organization
export const updateTheme = api<UpdateThemeRequest, UpdateThemeResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/branding/theme" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole('CORP_ADMIN')(authData);

    // Get current theme
    const orgRow = await brandingDB.queryRow`
      SELECT name, theme_json FROM organizations WHERE id = ${authData.orgId}
    `;

    if (!orgRow) {
      throw APIError.notFound("Organization not found");
    }

    const currentTheme = orgRow.theme_json || {};
    const updatedTheme = { ...currentTheme, ...req };

    // Update organization name if provided
    if (req.brandName) {
      await brandingDB.exec`
        UPDATE organizations 
        SET name = ${req.brandName}, theme_json = ${JSON.stringify(updatedTheme)}
        WHERE id = ${authData.orgId}
      `;
    } else {
      await brandingDB.exec`
        UPDATE organizations 
        SET theme_json = ${JSON.stringify(updatedTheme)}
        WHERE id = ${authData.orgId}
      `;
    }

    return { success: true };
  }
);

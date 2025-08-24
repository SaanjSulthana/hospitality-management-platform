import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
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

export interface GetThemeResponse {
  theme: Theme;
}

// Gets the theme configuration for the organization
export const getTheme = api<void, GetThemeResponse>(
  { auth: true, expose: true, method: "GET", path: "/branding/theme" },
  async () => {
    const authData = getAuthData()!;

    const orgRow = await brandingDB.queryRow`
      SELECT name, theme_json FROM organizations WHERE id = ${authData.orgId}
    `;

    if (!orgRow) {
      throw new Error("Organization not found");
    }

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

    const customTheme = orgRow.theme_json || {};
    const theme = { ...defaultTheme, ...customTheme };

    return { theme };
  }
);

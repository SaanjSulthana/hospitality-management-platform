import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { orgsDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface CreateOrgRequest {
  name: string;
  subdomainPrefix: string;
  primaryDomain?: string;
}

export interface CreateOrgResponse {
  id: number;
  name: string;
  subdomainPrefix: string;
  primaryDomain?: string;
  themeJson: Record<string, any>;
  createdAt: Date;
}

// Creates a new organization (Admin only)
export const create = api<CreateOrgRequest, CreateOrgResponse>(
  { auth: true, expose: true, method: "POST", path: "/orgs" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { name, subdomainPrefix, primaryDomain } = req;

    // Check if subdomain is already taken
    const existingOrg = await orgsDB.queryRow`
      SELECT id FROM organizations WHERE subdomain_prefix = ${subdomainPrefix}
    `;

    if (existingOrg) {
      throw APIError.alreadyExists("Subdomain prefix already taken");
    }

    // Create organization
    const orgRow = await orgsDB.queryRow`
      INSERT INTO organizations (name, subdomain_prefix, primary_domain, theme_json)
      VALUES (${name}, ${subdomainPrefix}, ${primaryDomain || null}, '{}')
      RETURNING id, name, subdomain_prefix, primary_domain, theme_json, created_at
    `;

    if (!orgRow) {
      throw new Error('Failed to create organization');
    }

    return {
      id: orgRow.id,
      name: orgRow.name,
      subdomainPrefix: orgRow.subdomain_prefix,
      primaryDomain: orgRow.primary_domain,
      themeJson: orgRow.theme_json,
      createdAt: orgRow.created_at,
    };
  }
);


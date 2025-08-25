import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { orgsDB } from "./db";
import { requireRole } from "../auth/middleware";
import { UserRole } from "../auth/types";
import * as crypto from "crypto";

export interface InviteUserRequest {
  email: string;
  role: UserRole;
}

export interface InviteUserResponse {
  inviteUrl: string;
  token: string;
}

// Invites a user to join the organization (Admin only, invites MANAGERs)
export const invite = api<InviteUserRequest, InviteUserResponse>(
  { auth: true, expose: true, method: "POST", path: "/orgs/invite" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN")(authData);

    const { email, role } = req;

    if (role !== "MANAGER") {
      throw APIError.invalidArgument("Only MANAGER role can be invited");
    }

    // Check if user already exists in organization
    const existingUser = await orgsDB.queryRow`
      SELECT id FROM users WHERE org_id = ${authData.orgId} AND email = ${email}
    `;

    if (existingUser) {
      throw APIError.alreadyExists("User already exists in this organization");
    }

    // Check if there's already a pending invitation
    const existingToken = await orgsDB.queryRow`
      SELECT id FROM signup_tokens 
      WHERE org_id = ${authData.orgId} AND email = ${email} AND used_at IS NULL AND expires_at > NOW()
    `;

    if (existingToken) {
      throw APIError.alreadyExists("Invitation already sent to this email");
    }

    // Generate signup token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await orgsDB.exec`
      INSERT INTO signup_tokens (org_id, email, token, role, expires_at)
      VALUES (${authData.orgId}, ${email}, ${token}, ${role}, ${expiresAt})
    `;

    // Get organization subdomain for invite URL
    const orgRow = await orgsDB.queryRow`
      SELECT subdomain_prefix FROM organizations WHERE id = ${authData.orgId}
    `;

    const inviteUrl = `https://${orgRow.subdomain_prefix}.example.com/signup?token=${token}`;

    return {
      inviteUrl,
      token,
    };
  }
);

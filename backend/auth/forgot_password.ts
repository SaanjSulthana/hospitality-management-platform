import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import * as crypto from "crypto";

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

// Shared handler for forgot password logic
async function forgotPasswordHandler(req: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const { email } = req;

    try {
      // Find user by email
      const userRow = await authDB.queryRow`
        SELECT u.id, u.org_id, u.email, u.display_name, o.name as org_name
        FROM users u
        JOIN organizations o ON u.org_id = o.id
        WHERE u.email = ${email}
      `;

      if (!userRow) {
        // Don't reveal if email exists or not for security
        return {
          success: true,
          message: "If an account with that email exists, a password reset link has been sent.",
        };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      await authDB.exec`
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES (${userRow.id}, ${resetToken}, ${expiresAt})
        ON CONFLICT (user_id) DO UPDATE SET
          token = ${resetToken},
          expires_at = ${expiresAt},
          created_at = NOW()
      `;

      // In a real application, you would send an email here
      // For demo purposes, we'll just log the reset link
      console.log(`Password reset link for ${email}: /reset-password?token=${resetToken}`);

      return {
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      throw APIError.internal("Failed to process password reset request");
    }
}

// LEGACY: Initiates password reset process (keep for backward compatibility)
export const forgotPassword = api<ForgotPasswordRequest, ForgotPasswordResponse>(
  { expose: true, method: "POST", path: "/auth/forgot-password" },
  forgotPasswordHandler
);

// V1: Initiates password reset process
export const forgotPasswordV1 = api<ForgotPasswordRequest, ForgotPasswordResponse>(
  { expose: true, method: "POST", path: "/v1/auth/forgot-password" },
  forgotPasswordHandler
);

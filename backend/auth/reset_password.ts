import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import { hashPassword } from "./utils";

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

// Shared handler for reset password logic
async function resetPasswordHandler(req: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    const { token, newPassword } = req;

    try {
      if (newPassword.length < 8) {
        throw APIError.invalidArgument("Password must be at least 8 characters");
      }

      // Find valid reset token
      const tokenRow = await authDB.queryRow`
        SELECT prt.user_id, prt.expires_at, u.email
        FROM password_reset_tokens prt
        JOIN users u ON prt.user_id = u.id
        WHERE prt.token = ${token} AND prt.expires_at > NOW()
      `;

      if (!tokenRow) {
        throw APIError.invalidArgument("Invalid or expired reset token");
      }

      // Hash new password
      const passwordHash = await hashPassword(newPassword);

      // Update password and delete reset token
      const transaction = await authDB.begin();
      
      try {
        await transaction.exec`
          UPDATE users 
          SET password_hash = ${passwordHash}
          WHERE id = ${tokenRow.user_id}
        `;

        await transaction.exec`
          DELETE FROM password_reset_tokens 
          WHERE user_id = ${tokenRow.user_id}
        `;

        // Invalidate all sessions for this user
        await transaction.exec`
          DELETE FROM sessions 
          WHERE user_id = ${tokenRow.user_id}
        `;

        await transaction.commit();

        return {
          success: true,
          message: "Password has been reset successfully. Please log in with your new password.",
        };
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      
      console.error('Reset password error:', error);
      throw APIError.internal("Failed to reset password");
    }
}

// LEGACY: Resets password using reset token (keep for backward compatibility)
export const resetPassword = api<ResetPasswordRequest, ResetPasswordResponse>(
  { expose: true, method: "POST", path: "/auth/reset-password" },
  resetPasswordHandler
);

// V1: Resets password using reset token
export const resetPasswordV1 = api<ResetPasswordRequest, ResetPasswordResponse>(
  { expose: true, method: "POST", path: "/v1/auth/reset-password" },
  resetPasswordHandler
);

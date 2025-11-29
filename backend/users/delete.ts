import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { usersDB } from "./db";
import { v1Path } from "../shared/http";
import log from "encore.dev/log";
import { usersEvents } from "./events";
import { v4 as uuidv4 } from "uuid";

export interface DeleteUserRequest {
  id: number;
}

export interface DeleteUserResponse {
  success: boolean;
  message: string;
  deletedRecords: {
    user: number;
    userProperties: number;
    sessions: number;
    passwordResetTokens: number;
    createdTasks: number;
    taskAttachments: number;
    createdExpenses: number;
    createdRevenues: number;
    staffRecords: number;
    notifications: number;
    approvalsRequested: number;
    approvalsApproved: number;
  };
}

// Deletes a user and all related data (Admin only)
async function deleteUserHandler(req: DeleteUserRequest): Promise<DeleteUserResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { id: userId } = req;
    
    // Convert userId to number if it's a string (from URL path)
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    
    if (isNaN(userIdNum)) {
      throw APIError.invalidArgument("Invalid user ID");
    }

    // Prevent admin from deleting themselves
    if (parseInt(authData.userID) === userIdNum) {
      throw APIError.invalidArgument("Cannot delete your own account");
    }

    const tx = await usersDB.begin();
    try {
      log.info("Deleting user", { 
        userId: userIdNum, 
        orgId: authData.orgId, 
        deletedBy: authData.userID 
      });

      // Verify user exists and belongs to organization
      const userRow = await tx.queryRow`
        SELECT id, email, display_name, role
        FROM users
        WHERE id = ${userIdNum} AND org_id = ${authData.orgId}
      `;
      
      if (!userRow) {
        throw APIError.notFound("User not found");
      }

      // Count related records before deletion for reporting
      const counts = await tx.queryRow`
        SELECT 
          (SELECT COUNT(*) FROM user_properties WHERE user_id = ${userIdNum}) as user_properties_count,
          (SELECT COUNT(*) FROM sessions WHERE user_id = ${userIdNum}) as sessions_count,
          (SELECT COUNT(*) FROM password_reset_tokens WHERE user_id = ${userIdNum}) as password_reset_tokens_count,
          (SELECT COUNT(*) FROM tasks WHERE created_by_user_id = ${userIdNum} AND org_id = ${authData.orgId}) as created_tasks_count,
          (SELECT COUNT(*) FROM task_attachments WHERE uploaded_by_user_id = ${userIdNum} AND org_id = ${authData.orgId}) as task_attachments_count,
          (SELECT COUNT(*) FROM expenses WHERE created_by_user_id = ${userIdNum} AND org_id = ${authData.orgId}) as created_expenses_count,
          (SELECT COUNT(*) FROM revenues WHERE created_by_user_id = ${userIdNum} AND org_id = ${authData.orgId}) as created_revenues_count,
          (SELECT COUNT(*) FROM staff WHERE user_id = ${userIdNum} AND org_id = ${authData.orgId}) as staff_records_count,
          (SELECT COUNT(*) FROM notifications WHERE user_id = ${userIdNum} AND org_id = ${authData.orgId}) as notifications_count,
          (SELECT COUNT(*) FROM approvals WHERE requested_by_user_id = ${userIdNum} AND org_id = ${authData.orgId}) as approvals_requested_count,
          (SELECT COUNT(*) FROM approvals WHERE approver_user_id = ${userIdNum} AND org_id = ${authData.orgId}) as approvals_approved_count
      `;

      // Delete related records in proper order (respecting foreign key constraints)
      
      // 1. Delete user property assignments
      await tx.exec`
        DELETE FROM user_properties WHERE user_id = ${userIdNum}
      `;

      // 2. Delete user sessions
      await tx.exec`
        DELETE FROM sessions WHERE user_id = ${userIdNum}
      `;

      // 3. Delete password reset tokens
      await tx.exec`
        DELETE FROM password_reset_tokens WHERE user_id = ${userIdNum}
      `;

      // 4. Delete notifications
      await tx.exec`
        DELETE FROM notifications WHERE user_id = ${userIdNum} AND org_id = ${authData.orgId}
      `;

      // 5. Delete approvals (both requested and approved by this user)
      await tx.exec`
        DELETE FROM approvals WHERE requested_by_user_id = ${userIdNum} AND org_id = ${authData.orgId}
      `;
      await tx.exec`
        DELETE FROM approvals WHERE approver_user_id = ${userIdNum} AND org_id = ${authData.orgId}
      `;

      // 6. Delete task attachments uploaded by this user
      await tx.exec`
        DELETE FROM task_attachments WHERE uploaded_by_user_id = ${userIdNum} AND org_id = ${authData.orgId}
      `;

      // 7. Delete tasks created by this user
      await tx.exec`
        DELETE FROM tasks WHERE created_by_user_id = ${userIdNum} AND org_id = ${authData.orgId}
      `;

      // 8. Delete expenses created by this user
      await tx.exec`
        DELETE FROM expenses WHERE created_by_user_id = ${userIdNum} AND org_id = ${authData.orgId}
      `;

      // 9. Delete revenues created by this user
      await tx.exec`
        DELETE FROM revenues WHERE created_by_user_id = ${userIdNum} AND org_id = ${authData.orgId}
      `;

      // 10. Delete staff records for this user
      await tx.exec`
        DELETE FROM staff WHERE user_id = ${userIdNum} AND org_id = ${authData.orgId}
      `;

      // 11. Finally, delete the user
      await tx.exec`
        DELETE FROM users WHERE id = ${userIdNum} AND org_id = ${authData.orgId}
      `;

      await tx.commit();

      log.info("User deleted successfully", { 
        userId: userIdNum, 
        userEmail: userRow.email,
        deletedBy: authData.userID 
      });

      // Publish user_deleted event
      try {
        await usersEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: 'user_deleted',
          orgId: authData.orgId,
          propertyId: null,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: userIdNum,
          entityType: 'user',
          metadata: {
            email: userRow.email,
            displayName: userRow.display_name,
            role: userRow.role,
          },
        });
      } catch (e) {
        log.warn("Users event publish failed (user_deleted)", { error: e instanceof Error ? e.message : String(e) });
      }

      return {
        success: true,
        message: `User ${userRow.display_name} (${userRow.email}) and all related data have been successfully deleted`,
        deletedRecords: {
          user: 1,
          userProperties: parseInt(counts?.user_properties_count || '0') || 0,
          sessions: parseInt(counts?.sessions_count || '0') || 0,
          passwordResetTokens: parseInt(counts?.password_reset_tokens_count || '0') || 0,
          createdTasks: parseInt(counts?.created_tasks_count || '0') || 0,
          taskAttachments: parseInt(counts?.task_attachments_count || '0') || 0,
          createdExpenses: parseInt(counts?.created_expenses_count || '0') || 0,
          createdRevenues: parseInt(counts?.created_revenues_count || '0') || 0,
          staffRecords: parseInt(counts?.staff_records_count || '0') || 0,
          notifications: parseInt(counts?.notifications_count || '0') || 0,
          approvalsRequested: parseInt(counts?.approvals_requested_count || '0') || 0,
          approvalsApproved: parseInt(counts?.approvals_approved_count || '0') || 0,
        },
      };
    } catch (error) {
      await tx.rollback();
      console.error('Delete user error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to delete user");
    }
}

export const deleteUser = api<DeleteUserRequest, DeleteUserResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/users/:id" },
  deleteUserHandler
);

export const deleteUserV1 = api<DeleteUserRequest, DeleteUserResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/v1/users/:id" },
  deleteUserHandler
);


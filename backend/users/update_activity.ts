import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { usersDB } from "./db";
import log from "encore.dev/log";

export interface UpdateUserActivityRequest {
  userId?: number; // Make optional to allow using authenticated user's ID
  activityType: 'login' | 'activity' | 'logout';
  ipAddress?: string;
  userAgent?: string;
  locationData?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
}

export interface UpdateUserActivityResponse {
  success: boolean;
  message: string;
}

// Updates user activity and login information
export const updateActivity = api<UpdateUserActivityRequest, UpdateUserActivityResponse>(
  { auth: true, expose: true, method: "POST", path: "/users/activity" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { userId: requestedUserId, activityType, ipAddress, userAgent, locationData } = req;

    // Use authenticated user ID if no userId provided
    const targetUserId = requestedUserId || parseInt(authData.userID);
    
    // Users can only update their own activity, or admins can update any user's activity
    if (authData.userID !== targetUserId.toString() && authData.role !== 'ADMIN') {
      throw APIError.permissionDenied("You can only update your own activity");
    }

    try {
      const tx = await usersDB.begin();
      
      try {
        if (activityType === 'login') {
          // Update login information
          await tx.exec`
            UPDATE users 
            SET 
              last_login_at = NOW(),
              last_activity_at = NOW(),
              login_count = login_count + 1,
              last_login_ip = ${ipAddress || null},
              last_login_user_agent = ${userAgent || null},
              last_login_location_json = ${locationData ? JSON.stringify(locationData) : null}
            WHERE id = ${targetUserId} AND org_id = ${authData.orgId}
          `;
          
          log.info("User login activity updated", { 
            userId: targetUserId, 
            orgId: authData.orgId,
            ipAddress,
            locationData 
          });
        } else if (activityType === 'activity') {
          // Update general activity timestamp
          await tx.exec`
            UPDATE users 
            SET last_activity_at = NOW()
            WHERE id = ${targetUserId} AND org_id = ${authData.orgId}
          `;
        } else if (activityType === 'logout') {
          // Update last activity timestamp
          await tx.exec`
            UPDATE users 
            SET last_activity_at = NOW()
            WHERE id = ${targetUserId} AND org_id = ${authData.orgId}
          `;
        }

        await tx.commit();
        
        return {
          success: true,
          message: `User ${activityType} activity updated successfully`
        };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    } catch (error) {
      log.error('Update user activity error', { 
        error: error instanceof Error ? error.message : String(error),
        userId: targetUserId,
        activityType,
        orgId: authData.orgId
      });
      
      throw APIError.internal("Failed to update user activity");
    }
  }
);


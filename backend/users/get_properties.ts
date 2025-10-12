import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { usersDB } from "./db";
import log from "encore.dev/log";

export interface GetUserPropertiesRequest {
  id?: number; // Optional - if not provided, gets current user's properties
}

export interface GetUserPropertiesResponse {
  userId: number;
  propertyIds: number[];
  properties: Array<{
    id: number;
    name: string;
    type: string;
    status: string;
  }>;
}

// Gets user's assigned properties with details (Admin can get any user's, Manager can get their own)
export const getProperties = api<GetUserPropertiesRequest, GetUserPropertiesResponse>(
  { auth: true, expose: true, method: "GET", path: "/users/properties" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    
    const { id: requestedUserId } = req;
    const targetUserId = requestedUserId || parseInt(authData.userID);
    
    // Admins can get any user's properties, managers can only get their own
    if (authData.role === "MANAGER" && targetUserId !== parseInt(authData.userID)) {
      throw APIError.permissionDenied("You can only view your own properties");
    }
    
    requireRole("ADMIN", "MANAGER")(authData);

    const tx = await usersDB.begin();
    try {
      log.info("Getting user properties", { 
        targetUserId, 
        requestedBy: authData.userID,
        orgId: authData.orgId 
      });

      // Validate user exists and belongs to org
      const userRow = await tx.queryRow`
        SELECT id, org_id, role FROM users WHERE id = ${targetUserId} AND org_id = ${authData.orgId}
      `;
      
      if (!userRow) {
        throw APIError.notFound("User not found");
      }

      // Get user's assigned properties with details
      const properties = await tx.queryAll`
        SELECT 
          p.id,
          p.name,
          p.type,
          p.status
        FROM user_properties up
        JOIN properties p ON up.property_id = p.id
        WHERE up.user_id = ${targetUserId} AND p.org_id = ${authData.orgId}
        ORDER BY p.name
      `;

      const propertyIds = properties.map((p: any) => p.id as number);

      await tx.commit();
      
      log.info("User properties retrieved successfully", { 
        userId: targetUserId, 
        propertyCount: properties.length,
        orgId: authData.orgId 
      });

      return {
        userId: targetUserId,
        propertyIds,
        properties: properties.map((p: any) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          status: p.status
        }))
      };
    } catch (error) {
      await tx.rollback();
      log.error('Get user properties error', { 
        error: error instanceof Error ? error.message : String(error),
        targetUserId,
        orgId: authData.orgId,
        requestedBy: authData.userID
      });
      
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      
      throw APIError.internal("Failed to fetch user properties");
    }
  }
);

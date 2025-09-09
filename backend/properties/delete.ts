import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { propertiesDB } from "./db";
import log from "encore.dev/log";

export interface DeletePropertyRequest {
  id: number;
}

export interface DeletePropertyResponse {
  success: boolean;
  id: number;
}

// Deletes a property (Admin only)
export const deleteProperty = api<DeletePropertyRequest, DeletePropertyResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/properties/:id" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    
    // Only ADMIN can delete properties
    requireRole("ADMIN")(authData);

    const { id } = req;
    
    // Ensure ID is a number
    const propertyId = parseInt(id.toString(), 10);
    if (isNaN(propertyId)) {
      throw APIError.invalidArgument("Invalid property ID");
    }

    try {
      log.info("Deleting property", { 
        propertyId: propertyId, 
        originalId: id,
        orgId: authData.orgId, 
        userId: authData.userID,
        role: authData.role,
        requestData: req
      });

      // First, let's see what properties exist for this organization
      const allProperties = await propertiesDB.queryAll`
        SELECT id, name, org_id FROM properties WHERE org_id = ${authData.orgId}
      `;
      
      log.info("All properties for organization", { 
        orgId: authData.orgId, 
        properties: allProperties,
        requestedId: propertyId,
        requestedIdType: typeof propertyId
      });

      // Verify property exists and belongs to the organization
      const propertyRow = await propertiesDB.queryRow`
        SELECT id, name, org_id FROM properties WHERE id = ${propertyId} AND org_id = ${authData.orgId}
      `;
      
      if (!propertyRow) {
        log.error("Property not found", { 
          requestedId: propertyId, 
          orgId: authData.orgId,
          availableProperties: allProperties
        });
        throw APIError.notFound("Property not found");
      }

      // Delete the property (CASCADE will handle related data cleanup)
      await propertiesDB.exec`
        DELETE FROM properties WHERE id = ${propertyId} AND org_id = ${authData.orgId}
      `;
        
      log.info("Property deleted successfully", { 
        propertyId: propertyId, 
        propertyName: propertyRow.name,
        orgId: authData.orgId 
      });

      return { success: true, id: propertyId };
      
    } catch (error) {
      log.error('Delete property error', { 
        error: error instanceof Error ? error.message : String(error),
        propertyId: propertyId,
        orgId: authData.orgId,
        userId: authData.userID
      });
      
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      
      throw APIError.internal("Failed to delete property", error as Error);
    }
  }
);

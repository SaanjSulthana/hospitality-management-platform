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

      // Check if there are staff members assigned to this property
      const staffCount = await propertiesDB.queryRow`
        SELECT COUNT(*) as count FROM staff 
        WHERE property_id = ${propertyId} AND org_id = ${authData.orgId}
      `;
      
      if (staffCount && parseInt(staffCount.count) > 0) {
        log.warn("Cannot delete property with assigned staff", { 
          propertyId: propertyId,
          propertyName: propertyRow.name,
          staffCount: staffCount.count,
          orgId: authData.orgId
        });
        
        throw APIError.invalidArgument(
          `Cannot delete property "${propertyRow.name}" because it has ${staffCount.count} staff member(s) assigned to it. ` +
          `Please reassign or delete the staff members first, then try deleting the property again.`
        );
      }

      // Check if there are any other dependent records (revenues, expenses, tasks, etc.)
      const revenueCount = await propertiesDB.queryRow`
        SELECT COUNT(*) as count FROM revenues 
        WHERE property_id = ${propertyId} AND org_id = ${authData.orgId}
      `;
      
      const expenseCount = await propertiesDB.queryRow`
        SELECT COUNT(*) as count FROM expenses 
        WHERE property_id = ${propertyId} AND org_id = ${authData.orgId}
      `;
      
      const taskCount = await propertiesDB.queryRow`
        SELECT COUNT(*) as count FROM tasks 
        WHERE property_id = ${propertyId} AND org_id = ${authData.orgId}
      `;

      const totalDependencies = 
        (revenueCount ? parseInt(revenueCount.count) : 0) +
        (expenseCount ? parseInt(expenseCount.count) : 0) +
        (taskCount ? parseInt(taskCount.count) : 0);

      if (totalDependencies > 0) {
        log.warn("Cannot delete property with dependent records", { 
          propertyId: propertyId,
          propertyName: propertyRow.name,
          revenueCount: revenueCount?.count || 0,
          expenseCount: expenseCount?.count || 0,
          taskCount: taskCount?.count || 0,
          totalDependencies,
          orgId: authData.orgId
        });
        
        const dependencyDetails = [];
        if (revenueCount && parseInt(revenueCount.count) > 0) {
          dependencyDetails.push(`${revenueCount.count} revenue record(s)`);
        }
        if (expenseCount && parseInt(expenseCount.count) > 0) {
          dependencyDetails.push(`${expenseCount.count} expense record(s)`);
        }
        if (taskCount && parseInt(taskCount.count) > 0) {
          dependencyDetails.push(`${taskCount.count} task(s)`);
        }
        
        throw APIError.invalidArgument(
          `Cannot delete property "${propertyRow.name}" because it has ${totalDependencies} dependent record(s): ${dependencyDetails.join(', ')}. ` +
          `Please delete or reassign these records first, then try deleting the property again.`
        );
      }

      // Delete the property (no dependent records exist)
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

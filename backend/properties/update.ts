import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { propertiesDB } from "./db";
import { v1Path } from "../shared/http";
import type { PropertyType } from "./types";
import { propertyEvents } from "./events";
import { v4 as uuidv4 } from "uuid";

export interface UpdatePropertyRequest {
  id: number;
  name?: string;
  type?: PropertyType;
  mobileNumber?: string;
  regionId?: number | null;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  } | null;
  amenities?: string[] | null;
  capacity?: {
    totalRooms?: number | null;
    totalBeds?: number | null;
    maxGuests?: number | null;
  } | null;
  status?: string;
}

export interface UpdatePropertyResponse {
  success: boolean;
  id: number;
  property: {
    id: number;
    name: string;
    type: PropertyType;
    mobileNumber: string;
    regionId?: number;
    addressJson: Record<string, any>;
    amenitiesJson: Record<string, any>;
    capacityJson: Record<string, any>;
    status: string;
    createdAt: Date;
  };
}

// Handler function for updating a property
async function updatePropertyHandler(req: UpdatePropertyRequest): Promise<UpdatePropertyResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const {
      id,
      name,
      type,
      mobileNumber,
      regionId,
      address,
      amenities,
      capacity,
      status,
    } = req;

    // Validate mobile number if provided
    if (mobileNumber !== undefined) {
      if (!mobileNumber || mobileNumber.trim() === '') {
        throw APIError.invalidArgument("Mobile number cannot be empty");
      }
      const mobileRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
      if (!mobileRegex.test(mobileNumber.trim())) {
        throw APIError.invalidArgument("Invalid mobile number format");
      }
    }

    // Validate address if provided
    if (address !== undefined && address !== null) {
      if (!address.street || !address.city || !address.state || !address.country || !address.zipCode) {
        throw APIError.invalidArgument("Complete address (street, city, state, country, zipCode) is required");
      }
    }

    // Ensure ID is a number
    const propertyId = parseInt(id.toString(), 10);
    if (isNaN(propertyId)) {
      throw APIError.invalidArgument("Invalid property ID");
    }

    // Verify property exists and org access
    const propertyRow = await propertiesDB.queryRow`
      SELECT id, org_id FROM properties WHERE id = ${propertyId} AND org_id = ${authData.orgId}
    `;
    if (!propertyRow) {
      throw APIError.notFound("Property not found");
    }

    // Managers must have access to the property
    if (authData.role === "MANAGER") {
      const accessCheck = await propertiesDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
      `;
      if (!accessCheck) {
        throw APIError.permissionDenied("No access to this property");
      }
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      params.push(type);
    }
    if (mobileNumber !== undefined) {
      updates.push(`mobile_number = $${paramIndex++}`);
      params.push(mobileNumber.trim());
    }
    if (regionId !== undefined) {
      updates.push(`region_id = $${paramIndex++}`);
      params.push(regionId);
    }
    if (address !== undefined) {
      updates.push(`address_json = $${paramIndex++}`);
      params.push(address ? JSON.stringify(address) : JSON.stringify({}));
    }
    if (amenities !== undefined) {
      updates.push(`amenities_json = $${paramIndex++}`);
      params.push(amenities ? JSON.stringify({ amenities }) : JSON.stringify({ amenities: [] }));
    }
    if (capacity !== undefined) {
      updates.push(`capacity_json = $${paramIndex++}`);
      params.push(capacity ? JSON.stringify(capacity) : JSON.stringify({}));
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (updates.length === 0) {
      // No updates, but still need to return the property data
      const currentProperty = await propertiesDB.queryRow`
        SELECT id, name, type, mobile_number, region_id, address_json, amenities_json, capacity_json, status, created_at
        FROM properties 
        WHERE id = ${propertyId} AND org_id = ${authData.orgId}
      `;

      if (!currentProperty) {
        throw APIError.notFound("Property not found");
      }

      return { 
        success: true, 
        id: propertyId,
        property: {
          id: currentProperty.id,
          name: currentProperty.name,
          type: currentProperty.type,
          mobileNumber: currentProperty.mobile_number,
          regionId: currentProperty.region_id,
          addressJson: typeof currentProperty.address_json === 'string' 
            ? JSON.parse(currentProperty.address_json) 
            : currentProperty.address_json,
          amenitiesJson: typeof currentProperty.amenities_json === 'string' 
            ? JSON.parse(currentProperty.amenities_json) 
            : currentProperty.amenities_json,
          capacityJson: typeof currentProperty.capacity_json === 'string' 
            ? JSON.parse(currentProperty.capacity_json) 
            : currentProperty.capacity_json,
          status: currentProperty.status,
          createdAt: currentProperty.created_at,
        }
      };
    }

    params.push(propertyId);

    const query = `
      UPDATE properties
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
    `;

    await propertiesDB.rawExec(query, ...params);

    // Fetch and return the updated property data
    const updatedProperty = await propertiesDB.queryRow`
      SELECT id, name, type, mobile_number, region_id, address_json, amenities_json, capacity_json, status, created_at
      FROM properties 
      WHERE id = ${propertyId} AND org_id = ${authData.orgId}
    `;

    if (!updatedProperty) {
      throw APIError.notFound("Property not found after update");
    }

    const response = { 
      success: true, 
      id: propertyId,
      property: {
        id: updatedProperty.id,
        name: updatedProperty.name,
        type: updatedProperty.type,
        mobileNumber: updatedProperty.mobile_number,
        regionId: updatedProperty.region_id,
        addressJson: typeof updatedProperty.address_json === 'string' 
          ? JSON.parse(updatedProperty.address_json) 
          : updatedProperty.address_json,
        amenitiesJson: typeof updatedProperty.amenities_json === 'string' 
          ? JSON.parse(updatedProperty.amenities_json) 
          : updatedProperty.amenities_json,
        capacityJson: typeof updatedProperty.capacity_json === 'string' 
          ? JSON.parse(updatedProperty.capacity_json) 
          : updatedProperty.capacity_json,
        status: updatedProperty.status,
        createdAt: updatedProperty.created_at,
      }
    };

    console.log('Property update response:', response);

    // Publish property_updated event
    try {
      await propertyEvents.publish({
        eventId: uuidv4(),
        eventVersion: 'v1',
        eventType: 'property_updated',
        orgId: authData.orgId,
        propertyId: updatedProperty.id,
        userId: parseInt(authData.userID),
        timestamp: new Date(),
        entityId: updatedProperty.id,
        entityType: 'property',
        metadata: {
          name: updatedProperty.name,
          status: updatedProperty.status,
          regionId: updatedProperty.region_id,
        },
      });
    } catch (e) {
      console.warn("Property event publish failed (property_updated)", e);
    }
    return response;
}

// Legacy path
export const update = api<UpdatePropertyRequest, UpdatePropertyResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/properties/:id" },
  updatePropertyHandler
);

// Versioned path
export const updateV1 = api<UpdatePropertyRequest, UpdatePropertyResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/v1/properties/:id" },
  updatePropertyHandler
);

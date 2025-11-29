import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { propertiesDB } from "./db";
import { PropertyType } from "./types";
import { v1Path } from "../shared/http";
import log from "encore.dev/log";
import { propertyEvents } from "./events";
import { v4 as uuidv4 } from "uuid";

export interface CreatePropertyRequest {
  name: string;
  type: PropertyType;
  mobileNumber: string;
  regionId?: number;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  amenities?: string[];
  capacity?: {
    totalRooms?: number;
    totalBeds?: number;
    maxGuests?: number;
  };
}

export interface CreatePropertyResponse {
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
}

// Handler function for creating a property
async function createPropertyHandler(req: CreatePropertyRequest): Promise<CreatePropertyResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { name, type, mobileNumber, regionId, address, amenities, capacity } = req;

    // Validate required fields
    if (!mobileNumber || mobileNumber.trim() === '') {
      throw APIError.invalidArgument("Mobile number is required");
    }

    if (!address || !address.street || !address.city || !address.state || !address.country || !address.zipCode) {
      throw APIError.invalidArgument("Complete address (street, city, state, country, zipCode) is required");
    }

    // Validate mobile number format (basic validation)
    const mobileRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (!mobileRegex.test(mobileNumber.trim())) {
      throw APIError.invalidArgument("Invalid mobile number format");
    }

    const addressJson = address;
    const amenitiesJson = { amenities: amenities || [] };
    const capacityJson = capacity || {};

    const tx = await propertiesDB.begin();
    try {
      log.info("Creating property", { 
        name, 
        type, 
        orgId: authData.orgId, 
        userId: authData.userID,
        role: authData.role 
      });

      const propertyRow = await tx.queryRow`
        INSERT INTO properties (org_id, region_id, name, type, mobile_number, address_json, amenities_json, capacity_json, status)
        VALUES (${authData.orgId}, ${regionId || null}, ${name}, ${type}, ${mobileNumber.trim()}, ${JSON.stringify(addressJson)}, ${JSON.stringify(amenitiesJson)}, ${JSON.stringify(capacityJson)}, 'active')
        RETURNING id, org_id, region_id, name, type, mobile_number, address_json, amenities_json, capacity_json, status, created_at
      `;

      if (!propertyRow) {
        throw new Error("Failed to create property");
      }

      // If a MANAGER creates a property, automatically grant them access to it.
      if (authData.role === "MANAGER") {
        await tx.exec`
          INSERT INTO user_properties (user_id, property_id)
          VALUES (${parseInt(authData.userID)}, ${propertyRow.id})
          ON CONFLICT DO NOTHING
        `;
        log.info("Granted property access to manager", { 
          userId: authData.userID, 
          propertyId: propertyRow.id 
        });
      }

      await tx.commit();
      log.info("Property created successfully", { 
        propertyId: propertyRow.id, 
        name, 
        orgId: authData.orgId 
      });

      // Publish property_created event
      try {
        await propertyEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: 'property_created',
          orgId: authData.orgId,
          propertyId: propertyRow.id,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: propertyRow.id,
          entityType: 'property',
          metadata: {
            name,
            type,
            regionId,
            status: propertyRow.status,
          },
        });
      } catch (e) {
        log.warn("Property event publish failed (property_created)", { error: e instanceof Error ? e.message : String(e) });
      }

      return {
        id: propertyRow.id,
        name: propertyRow.name,
        type: propertyRow.type as PropertyType,
        mobileNumber: propertyRow.mobile_number,
        regionId: propertyRow.region_id,
        addressJson: propertyRow.address_json,
        amenitiesJson: propertyRow.amenities_json,
        capacityJson: propertyRow.capacity_json,
        status: propertyRow.status,
        createdAt: propertyRow.created_at,
      };
    } catch (error) {
      await tx.rollback();
      log.error('Create property error', { 
        error: error instanceof Error ? error.message : String(error),
        name,
        type,
        orgId: authData.orgId,
        userId: authData.userID
      });
      
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      
      throw APIError.internal("Failed to create property", error as Error);
    }
}

// Legacy path
export const create = api<CreatePropertyRequest, CreatePropertyResponse>(
  { auth: true, expose: true, method: "POST", path: "/properties" },
  createPropertyHandler
);

// Versioned path
export const createV1 = api<CreatePropertyRequest, CreatePropertyResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/properties" },
  createPropertyHandler
);


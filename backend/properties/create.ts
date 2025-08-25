import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { propertiesDB } from "./db";
import { requireRole } from "../auth/middleware";
import { PropertyType } from "./types";

export interface CreatePropertyRequest {
  name: string;
  type: PropertyType;
  regionId?: number;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
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
  regionId?: number;
  addressJson: Record<string, any>;
  amenitiesJson: Record<string, any>;
  capacityJson: Record<string, any>;
  status: string;
  createdAt: Date;
}

// Creates a new property
export const create = api<CreatePropertyRequest, CreatePropertyResponse>(
  { auth: true, expose: true, method: "POST", path: "/properties" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    const { name, type, regionId, address, amenities, capacity } = req;

    const addressJson = address || {};
    const amenitiesJson = { amenities: amenities || [] };
    const capacityJson = capacity || {};

    const propertyRow = await propertiesDB.queryRow`
      INSERT INTO properties (org_id, region_id, name, type, address_json, amenities_json, capacity_json, status)
      VALUES (${authData.orgId}, ${regionId || null}, ${name}, ${type}, ${JSON.stringify(addressJson)}, ${JSON.stringify(amenitiesJson)}, ${JSON.stringify(capacityJson)}, 'active')
      RETURNING id, org_id, region_id, name, type, address_json, amenities_json, capacity_json, status, created_at
    `;

    return {
      id: propertyRow.id,
      name: propertyRow.name,
      type: propertyRow.type as PropertyType,
      regionId: propertyRow.region_id,
      addressJson: propertyRow.address_json,
      amenitiesJson: propertyRow.amenities_json,
      capacityJson: propertyRow.capacity_json,
      status: propertyRow.status,
      createdAt: propertyRow.created_at,
    };
  }
);

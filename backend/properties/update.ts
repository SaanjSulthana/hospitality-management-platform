import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { propertiesDB } from "./db";
import { requireRole } from "../auth/middleware";
import type { PropertyType } from "./types";

export interface UpdatePropertyRequest {
  id: number;
  name?: string;
  type?: PropertyType;
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
}

// Updates an existing property (Admin or Manager with access)
export const update = api<UpdatePropertyRequest, UpdatePropertyResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/properties/:id" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    const {
      id,
      name,
      type,
      regionId,
      address,
      amenities,
      capacity,
      status,
    } = req;

    // Verify property exists and org access
    const propertyRow = await propertiesDB.queryRow`
      SELECT id, org_id FROM properties WHERE id = ${id} AND org_id = ${authData.orgId}
    `;
    if (!propertyRow) {
      throw APIError.notFound("Property not found");
    }

    // Managers must have access to the property
    if (authData.role === "MANAGER") {
      const accessCheck = await propertiesDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${id}
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
      return { success: true, id };
    }

    params.push(id);

    const query = `
      UPDATE properties
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
    `;

    await propertiesDB.rawExec(query, ...params);

    return { success: true, id };
  }
);

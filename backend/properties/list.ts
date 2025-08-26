import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { propertiesDB } from "./db";
import { PropertyType } from "./types";

export interface ListPropertiesRequest {
  regionId?: Query&lt;number&gt;;
  type?: Query&lt;PropertyType&gt;;
}

export interface PropertyInfo {
  id: number;
  name: string;
  type: PropertyType;
  regionId?: number;
  addressJson: Record&lt;string, any&gt;;
  amenitiesJson: Record&lt;string, any&gt;;
  capacityJson: Record&lt;string, any&gt;;
  status: string;
  createdAt: Date;
}

export interface ListPropertiesResponse {
  properties: PropertyInfo[];
}

// Lists properties with role-based filtering
export const list = api&lt;ListPropertiesRequest, ListPropertiesResponse&gt;(
  { auth: true, expose: true, method: "GET", path: "/properties" },
  async (req) =&gt; {
    const authData = getAuthData()!;
    const { regionId, type } = req || {};

    let query = `
      SELECT p.id, p.name, p.type, p.region_id, p.address_json, p.amenities_json, p.capacity_json, p.status, p.created_at
      FROM properties p
      WHERE p.org_id = $1
    `;
    const params: any[] = [authData.orgId];
    let paramIndex = 2;

    // Managers can only see properties they have access to
    if (authData.role === "MANAGER") {
      query += ` AND p.id IN (
        SELECT property_id FROM user_properties WHERE user_id = $${paramIndex}
      )`;
      params.push(parseInt(authData.userID));
      paramIndex++;
    }

    // Apply filters
    if (regionId) {
      query += ` AND p.region_id = $${paramIndex}`;
      params.push(regionId);
      paramIndex++;
    }

    if (type) {
      query += ` AND p.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC`;

    const properties = await propertiesDB.rawQueryAll(query, ...params);

    return {
      properties: properties.map((property) =&gt; ({
        id: property.id,
        name: property.name,
        type: property.type as PropertyType,
        regionId: property.region_id,
        addressJson: property.address_json,
        amenitiesJson: property.amenities_json,
        capacityJson: property.capacity_json,
        status: property.status,
        createdAt: property.created_at,
      })),
    };
  }
);

import { api, APIError, Header } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { propertiesDB } from "./db";
import { requireRole } from "../auth/middleware";
import { v1Path } from "../shared/http";
import { PropertyType } from "./types";
import { 
  trackMetrics,
  generateCollectionETag,
  checkConditionalGet,
  generateCacheHeaders,
  recordETagCheck
} from "../middleware";

interface ListPropertiesRequest {
  regionId?: number;
  type?: PropertyType;
  // Conditional GET headers for cache validation
  ifNoneMatch?: Header<"If-None-Match">;
}

export interface PropertyInfo {
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

export interface ListPropertiesResponse {
  properties: PropertyInfo[];
  // Cache metadata
  _meta?: {
    etag?: string;
    cacheControl?: string;
    count?: number;
    cached?: boolean;  // True if this is a 304-equivalent response
  };
}

// Handler function for listing properties
async function listPropertiesHandler(req: ListPropertiesRequest): Promise<ListPropertiesResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    
    // Wrap with metrics tracking and ETag support
    return trackMetrics('/v1/properties', async (timer) => {
      timer.checkpoint('auth');
      requireRole("ADMIN", "MANAGER")(authData);

      const { regionId, type, ifNoneMatch } = req || {};

      let query = `
        SELECT p.id, p.name, p.type, p.mobile_number, p.region_id, p.address_json, p.amenities_json, p.capacity_json, p.status, p.created_at
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

      timer.checkpoint('db_start');
      const properties = await propertiesDB.rawQueryAll(query, ...params);
      timer.checkpoint('db_complete');

      const propertyList = properties.map((property) => ({
        id: property.id,
        name: property.name,
        type: property.type as PropertyType,
        mobileNumber: property.mobile_number,
        regionId: property.region_id,
        addressJson: typeof property.address_json === 'string' 
          ? JSON.parse(property.address_json) 
          : property.address_json,
        amenitiesJson: typeof property.amenities_json === 'string' 
          ? JSON.parse(property.amenities_json) 
          : property.amenities_json,
        capacityJson: typeof property.capacity_json === 'string' 
          ? JSON.parse(property.capacity_json) 
          : property.capacity_json,
        status: property.status,
        createdAt: property.created_at,
      }));
      
      // Generate ETag for the collection
      const etag = generateCollectionETag(propertyList, propertyList.length);
      
      // Check if client has valid cached version
      if (ifNoneMatch && checkConditionalGet(etag, ifNoneMatch)) {
        recordETagCheck('/v1/properties', true);
        console.log('[Properties] 304 Not Modified - ETag match:', etag);
        // Return minimal response for 304 (empty array signals cache is valid)
        return { 
          properties: [], 
          _meta: { 
            etag, 
            cacheControl: 'public, s-maxage=1800, stale-while-revalidate=86400',
            count: propertyList.length,
            cached: true  // Signal to client that this is a 304-equivalent
          } 
        };
      }
      
      recordETagCheck('/v1/properties', false);
      
      // Generate cache headers (properties rarely change - 30 min CDN cache)
      const cacheHeaders = generateCacheHeaders('metadata', {
        orgId: authData.orgId,
      });
      
      return {
        properties: propertyList,
        _meta: {
          etag,
          cacheControl: cacheHeaders['Cache-Control'],
          count: propertyList.length
        }
      };
    }); // End trackMetrics
}

// Legacy path
export const list = api<ListPropertiesRequest, ListPropertiesResponse>(
  { auth: true, expose: true, method: "GET", path: "/properties" },
  listPropertiesHandler
);

// Versioned path
export const listV1 = api<ListPropertiesRequest, ListPropertiesResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/properties" },
  listPropertiesHandler
);


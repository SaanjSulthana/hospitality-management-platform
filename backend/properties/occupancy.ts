import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { propertiesDB } from "./db";
import { v1Path } from "../shared/http";

export interface GetOccupancyRequest {
  id: number;
}

export interface OccupancyInfo {
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
  outOfOrderUnits: number;
  occupancyRate: number;
  currentBookings: number;
}

export interface GetOccupancyResponse {
  propertyId: number;
  propertyName: string;
  occupancy: OccupancyInfo;
}

// Handler function for getting occupancy information
async function getOccupancyHandler(req: GetOccupancyRequest): Promise<GetOccupancyResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { id } = req;

    // Ensure ID is a number
    const propertyId = parseInt(id.toString(), 10);
    if (isNaN(propertyId)) {
      throw APIError.invalidArgument("Invalid property ID");
    }

    try {
      // Check property access with org scoping
      const propertyRow = await propertiesDB.queryRow`
        SELECT p.id, p.name, p.org_id
        FROM properties p
        WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
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

      // Get occupancy data with org scoping
      const occupancyData = await propertiesDB.queryRow`
        SELECT 
          COUNT(*) as total_units,
          COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied_units,
          COUNT(CASE WHEN status = 'available' THEN 1 END) as available_units,
          COUNT(CASE WHEN status = 'oo' THEN 1 END) as out_of_order_units
        FROM beds_or_units
        WHERE property_id = ${propertyId} AND org_id = ${authData.orgId}
      `;

      // Get current bookings count with org scoping
      const bookingsData = await propertiesDB.queryRow`
        SELECT COUNT(*) as current_bookings
        FROM bookings
        WHERE property_id = ${propertyId} 
          AND org_id = ${authData.orgId}
          AND status IN ('confirmed', 'checked_in')
          AND checkin_date <= CURRENT_DATE
          AND checkout_date > CURRENT_DATE
      `;

      const totalUnits = parseInt(occupancyData?.total_units) || 0;
      const occupiedUnits = parseInt(occupancyData?.occupied_units) || 0;
      const availableUnits = parseInt(occupancyData?.available_units) || 0;
      const outOfOrderUnits = parseInt(occupancyData?.out_of_order_units) || 0;
      const currentBookings = parseInt(bookingsData?.current_bookings) || 0;

      const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

      return {
        propertyId: propertyId,
        propertyName: propertyRow.name,
        occupancy: {
          totalUnits,
          occupiedUnits,
          availableUnits,
          outOfOrderUnits,
          occupancyRate: Math.round(occupancyRate * 100) / 100,
          currentBookings,
        },
      };
    } catch (error) {
      console.error('Get occupancy error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal("Failed to fetch occupancy data");
    }
}

// Legacy path
export const getOccupancy = api<GetOccupancyRequest, GetOccupancyResponse>(
  { auth: true, expose: true, method: "GET", path: "/properties/:id/occupancy" },
  getOccupancyHandler
);

// Versioned path
export const getOccupancyV1 = api<GetOccupancyRequest, GetOccupancyResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/properties/:id/occupancy" },
  getOccupancyHandler
);

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { propertiesDB } from "./db";

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

// Gets occupancy information for a property
export const getOccupancy = api<GetOccupancyRequest, GetOccupancyResponse>(
  { auth: true, expose: true, method: "GET", path: "/properties/:id/occupancy" },
  async (req) => {
    const authData = getAuthData()!;
    const { id } = req;

    // Check property access
    const propertyRow = await propertiesDB.queryRow`
      SELECT p.id, p.name, p.org_id
      FROM properties p
      WHERE p.id = ${id} AND p.org_id = ${authData.orgId}
    `;

    if (!propertyRow) {
      throw APIError.notFound("Property not found");
    }

    // Check role-based access
    if (authData.role === 'REGIONAL_MANAGER' && authData.regionId) {
      const regionCheck = await propertiesDB.queryRow`
        SELECT 1 FROM properties WHERE id = ${id} AND region_id = ${authData.regionId}
      `;
      if (!regionCheck) {
        throw APIError.permissionDenied("No access to this property");
      }
    }

    if (['PROPERTY_MANAGER', 'DEPT_HEAD', 'STAFF'].includes(authData.role)) {
      const accessCheck = await propertiesDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${id}
      `;
      if (!accessCheck) {
        throw APIError.permissionDenied("No access to this property");
      }
    }

    // Get occupancy data
    const occupancyData = await propertiesDB.queryRow`
      SELECT 
        COUNT(*) as total_units,
        COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied_units,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_units,
        COUNT(CASE WHEN status = 'oo' THEN 1 END) as out_of_order_units
      FROM beds_or_units
      WHERE property_id = ${id} AND org_id = ${authData.orgId}
    `;

    // Get current bookings count
    const bookingsData = await propertiesDB.queryRow`
      SELECT COUNT(*) as current_bookings
      FROM bookings
      WHERE property_id = ${id} 
        AND org_id = ${authData.orgId}
        AND status IN ('confirmed', 'checked_in')
        AND checkin_date <= CURRENT_DATE
        AND checkout_date > CURRENT_DATE
    `;

    const totalUnits = parseInt(occupancyData.total_units) || 0;
    const occupiedUnits = parseInt(occupancyData.occupied_units) || 0;
    const availableUnits = parseInt(occupancyData.available_units) || 0;
    const outOfOrderUnits = parseInt(occupancyData.out_of_order_units) || 0;
    const currentBookings = parseInt(bookingsData.current_bookings) || 0;

    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    return {
      propertyId: id,
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
  }
);

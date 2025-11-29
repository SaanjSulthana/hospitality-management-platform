import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import { CheckInStatsRequest, CheckInStatsResponse } from "./types";
import log from "encore.dev/log";

async function getCheckInStatsHandler(req: CheckInStatsRequest): Promise<CheckInStatsResponse> {
    const authData = getAuthData()!;

    log.info("Getting check-in statistics", {
      userId: authData.userID,
      role: authData.role,
      filters: req,
    });

    // Only admin/manager/owner can view stats
    if (!['ADMIN', 'OWNER', 'MANAGER'].includes(authData.role)) {
      throw APIError.permissionDenied("Only admin, manager, or owner can view statistics");
    }

    // Build WHERE clauses
    const conditions: string[] = [];
    conditions.push(`org_id = ${authData.orgId}`);

    if (req.propertyId) {
      conditions.push(`property_id = ${req.propertyId}`);
    }

    if (req.startDate) {
      conditions.push(`check_in_date >= '${req.startDate}'::timestamp`);
    }

    if (req.endDate) {
      conditions.push(`check_in_date <= '${req.endDate}'::timestamp`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      // Get overall stats
      const overallStats = await guestCheckinDB.queryRow`
        SELECT 
          COUNT(*) as total_checkins,
          COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as currently_checked_in,
          COUNT(CASE WHEN status = 'checked_out' THEN 1 END) as checked_out,
          COUNT(CASE WHEN guest_type = 'indian' THEN 1 END) as indian_guests,
          COUNT(CASE WHEN guest_type = 'foreign' THEN 1 END) as foreign_guests
        FROM guest_checkins
        WHERE org_id = ${authData.orgId}
      `;

      // Get stats by property
      const byPropertyStats = await guestCheckinDB.queryAll`
        SELECT 
          gc.property_id,
          'Test Property' as property_name,
          COUNT(*) as count
        FROM guest_checkins gc
        WHERE gc.org_id = ${authData.orgId}
        GROUP BY gc.property_id
        ORDER BY count DESC
      `;

      return {
        totalCheckins: parseInt(overallStats?.total_checkins || '0'),
        currentlyCheckedIn: parseInt(overallStats?.currently_checked_in || '0'),
        checkedOut: parseInt(overallStats?.checked_out || '0'),
        indianGuests: parseInt(overallStats?.indian_guests || '0'),
        foreignGuests: parseInt(overallStats?.foreign_guests || '0'),
        byProperty: byPropertyStats.map((row: any) => ({
          propertyId: row.property_id,
          propertyName: row.property_name,
          count: parseInt(row.count),
        })),
      };
    } catch (error) {
      log.error("Error getting check-in statistics", { error });
      throw APIError.internal("Failed to get statistics");
    }
  }

// Legacy endpoint
export const getCheckInStats = api<CheckInStatsRequest, CheckInStatsResponse>(
  { expose: true, method: "GET", path: "/guest-checkin/stats", auth: true },
  getCheckInStatsHandler
);

// V1 endpoint
export const getCheckInStatsV1 = api<CheckInStatsRequest, CheckInStatsResponse>(
  { expose: true, method: "GET", path: "/v1/guest-checkin/stats", auth: true },
  getCheckInStatsHandler
);

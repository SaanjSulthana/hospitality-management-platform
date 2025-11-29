import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import { propertiesDB } from "../properties/db";
import { ListCheckInsRequest, ListCheckInsResponse, GuestCheckInWithProperty } from "./types";
import log from "encore.dev/log";
import { v1Path } from "../shared/http";

async function listCheckInsHandler(req: ListCheckInsRequest): Promise<ListCheckInsResponse> {
    const authData = getAuthData()!;

    log.info("Listing guest check-ins", {
      userId: authData.userID,
      role: authData.role,
      filters: req,
    });

    const limit = req.limit || 50;
    const offset = req.offset || 0;

    try {
      // Build dynamic WHERE conditions for filtering
      const conditions: string[] = [`gc.org_id = ${authData.orgId}`];
      
      if (req.status && req.status !== 'all') {
        conditions.push(`gc.status = '${req.status}'`);
      }
      
      if (req.guestType && req.guestType !== 'all') {
        conditions.push(`gc.guest_type = '${req.guestType}'`);
      }
      
      if (req.propertyId) {
        conditions.push(`gc.property_id = ${req.propertyId}`);
      }
      
      const whereClause = conditions.join(' AND ');

      // Get total count with filters
      const countQuery = `
        SELECT COUNT(*) as total
        FROM guest_checkins gc
        WHERE ${whereClause}
      `;
      const countResult = await guestCheckinDB.rawQueryRow(countQuery);
      const total = parseInt(countResult?.total || '0');

      // Fetch properties to map property names
      const properties = await propertiesDB.queryAll`
        SELECT id, name FROM properties WHERE org_id = ${authData.orgId}
      `;
      const propertyMap = new Map(properties.map((p: any) => [p.id, p.name]));

      // Get paginated results with filters
      const query = `
        SELECT 
          gc.id,
          gc.org_id,
          gc.property_id,
          gc.guest_type,
          gc.full_name,
          gc.email,
          gc.phone,
          gc.address,
          gc.aadhar_number,
          gc.pan_number,
          gc.driving_license_number,
          gc.election_card_number,
          gc.passport_number,
          gc.country,
          gc.visa_type,
          gc.visa_expiry_date,
          gc.check_in_date,
          gc.expected_checkout_date,
          gc.actual_checkout_date,
          gc.room_number,
          gc.number_of_guests,
          gc.status,
          gc.created_by_user_id,
          gc.created_at,
          gc.updated_at
        FROM guest_checkins gc
        WHERE ${whereClause}
        ORDER BY gc.check_in_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const results = await guestCheckinDB.rawQueryAll(query);

      log.info("Raw query results", { 
        resultCount: results.length, 
        firstRow: results[0] ? JSON.stringify(results[0]).substring(0, 200) : 'none' 
      });

      const checkins: GuestCheckInWithProperty[] = results.map((row: any) => ({
        id: row.id,
        orgId: row.org_id,
        propertyId: row.property_id,
        propertyName: propertyMap.get(row.property_id) || 'Unknown Property',
        guestType: row.guest_type,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        aadharNumber: row.aadhar_number,
        panNumber: row.pan_number,
        drivingLicenseNumber: row.driving_license_number,
        electionCardNumber: row.election_card_number,
        passportNumber: row.passport_number,
        country: row.country,
        visaType: row.visa_type,
        visaExpiryDate: row.visa_expiry_date,
        checkInDate: row.check_in_date,
        expectedCheckoutDate: row.expected_checkout_date,
        actualCheckoutDate: row.actual_checkout_date,
        roomNumber: row.room_number,
        numberOfGuests: row.number_of_guests,
        status: row.status,
        createdByUserId: row.created_by_user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      log.info("Returning checkins", { 
        count: checkins.length, 
        total,
        firstGuest: checkins[0]?.fullName || 'none'
      });

      return {
        checkins,
        total,
        limit,
        offset,
      };
    } catch (error) {
      log.error("Error listing guest check-ins", { error });
      throw APIError.internal("Failed to list check-ins");
    }
}

export const listCheckIns = api<ListCheckInsRequest, ListCheckInsResponse>(
  { expose: true, method: "GET", path: "/guest-checkin/list", auth: true },
  listCheckInsHandler
);

export const listCheckInsV1 = api<ListCheckInsRequest, ListCheckInsResponse>(
  { expose: true, method: "GET", path: "/v1/guest-checkin/list", auth: true },
  listCheckInsHandler
);

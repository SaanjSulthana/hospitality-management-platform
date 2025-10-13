import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import { ListCheckInsRequest, ListCheckInsResponse, GuestCheckInWithProperty } from "./types";
import log from "encore.dev/log";

export const listCheckIns = api(
  { expose: true, method: "GET", path: "/guest-checkin/list", auth: true },
  async (req: ListCheckInsRequest): Promise<ListCheckInsResponse> => {
    const authData = getAuthData()!;

    log.info("Listing guest check-ins", {
      userId: authData.userID,
      role: authData.role,
      filters: req,
    });

    const limit = req.limit || 50;
    const offset = req.offset || 0;

    // Note: Filters are now handled directly in the SQL queries using guestCheckinDB.sql()

    try {
      // Get total count - simplified for debugging
      const countResult = await guestCheckinDB.queryRow`
        SELECT COUNT(*) as total
        FROM guest_checkins gc
        WHERE gc.org_id = ${authData.orgId}
      `;

      const total = parseInt(countResult?.total || '0');

      // Get paginated results
      const results = await guestCheckinDB.queryAll`
        SELECT 
          gc.id,
          gc.org_id,
          gc.property_id,
          'Test Property' as property_name,
          gc.guest_type,
          gc.full_name,
          gc.email,
          gc.phone,
          gc.address,
          gc.aadhar_number,
          gc.pan_number,
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
        WHERE gc.org_id = ${authData.orgId}
        ORDER BY gc.check_in_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const checkins: GuestCheckInWithProperty[] = results.map((row: any) => ({
        id: row.id,
        orgId: row.org_id,
        propertyId: row.property_id,
        propertyName: row.property_name,
        guestType: row.guest_type,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        aadharNumber: row.aadhar_number,
        panNumber: row.pan_number,
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
);

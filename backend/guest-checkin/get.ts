import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import { GuestCheckInWithProperty } from "./types";
import { createAuditLog } from "./audit-middleware";
import log from "encore.dev/log";

interface GetCheckInRequest {
  id: number;
}

export const getCheckIn = api(
  { expose: true, method: "GET", path: "/guest-checkin/:id", auth: true },
  async ({ id }: GetCheckInRequest): Promise<GuestCheckInWithProperty> => {
    const authData = getAuthData()!;

    log.info("Getting guest check-in", {
      checkInId: id,
      userId: authData.userID,
      role: authData.role,
    });

    try {
      const result = await guestCheckinDB.queryRow`
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
        WHERE gc.id = ${id} AND gc.org_id = ${authData.orgId}
      `;

      if (!result) {
        throw APIError.notFound("Check-in not found");
      }

      // Non-admin users can only see their own check-ins
      if (!['ADMIN', 'OWNER', 'MANAGER'].includes(authData.role) && 
          result.created_by_user_id !== parseInt(authData.userID)) {
        throw APIError.permissionDenied("You don't have permission to view this check-in");
      }

      return {
        id: result.id,
        orgId: result.org_id,
        propertyId: result.property_id,
        propertyName: result.property_name,
        guestType: result.guest_type,
        fullName: result.full_name,
        email: result.email,
        phone: result.phone,
        address: result.address,
        aadharNumber: result.aadhar_number,
        panNumber: result.pan_number,
        passportNumber: result.passport_number,
        country: result.country,
        visaType: result.visa_type,
        visaExpiryDate: result.visa_expiry_date,
        checkInDate: result.check_in_date,
        expectedCheckoutDate: result.expected_checkout_date,
        actualCheckoutDate: result.actual_checkout_date,
        roomNumber: result.room_number,
        numberOfGuests: result.number_of_guests,
        status: result.status,
        createdByUserId: result.created_by_user_id,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };

        // Log view action (temporarily disabled for testing)
        // await createAuditLog({
        //   actionType: "view_guest_details",
        //   resourceType: "guest_checkin",
        //   resourceId: id,
        //   guestCheckInId: id,
        //   guestName: result.full_name,
        // });

      return {
        id: result!.id,
        orgId: result!.org_id,
        propertyId: result!.property_id,
        propertyName: result!.property_name || 'Unknown Property',
        guestType: result!.guest_type,
        fullName: result!.full_name,
        email: result!.email,
        phone: result!.phone,
        address: result!.address,
        aadharNumber: result!.aadhar_number,
        panNumber: result!.pan_number,
        passportNumber: result!.passport_number,
        country: result!.country,
        visaType: result!.visa_type,
        visaExpiryDate: result!.visa_expiry_date,
        checkInDate: result!.check_in_date,
        expectedCheckoutDate: result!.expected_checkout_date,
        actualCheckoutDate: result!.actual_checkout_date,
        roomNumber: result!.room_number,
        numberOfGuests: result!.number_of_guests,
        status: result!.status,
        createdByUserId: result!.created_by_user_id,
        createdAt: result!.created_at,
        updatedAt: result!.updated_at,
      };
    } catch (error) {
      log.error("Error getting guest check-in", { error, checkInId: id });
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to get check-in");
    }
  }
);

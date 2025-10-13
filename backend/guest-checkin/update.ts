import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import { UpdateCheckInRequest, UpdateCheckInResponse } from "./types";
import { createAuditLog } from "./audit-middleware";
import log from "encore.dev/log";

interface UpdateCheckInParams {
  id: number;
  req: UpdateCheckInRequest;
}

export const updateCheckIn = api(
  { expose: true, method: "PUT", path: "/guest-checkin/:id/update", auth: true },
  async ({ id, req }: UpdateCheckInParams): Promise<UpdateCheckInResponse> => {
    const authData = getAuthData()!;
    const startTime = Date.now();

    log.info("Updating guest check-in", {
      checkInId: id,
      userId: authData.userID,
      role: authData.role,
    });

    // Get current check-in data for before/after tracking
    const checkIn = await guestCheckinDB.queryRow`
      SELECT *
      FROM guest_checkins
      WHERE id = ${id} AND org_id = ${authData.orgId}
    `;

    if (!checkIn) {
      throw APIError.notFound("Check-in not found");
    }

    // Check permissions - admin/manager/owner can update all, others only their own
    if (!['ADMIN', 'OWNER', 'MANAGER'].includes(authData.role) && 
        checkIn.created_by_user_id !== parseInt(authData.userID)) {
      throw APIError.permissionDenied("You don't have permission to update this check-in");
    }

    // Validate email format if provided
    if (req.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(req.email)) {
        throw APIError.invalidArgument("Invalid email format");
      }
    }

    // Validate phone format if provided
    if (req.phone) {
      const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
      if (!phoneRegex.test(req.phone)) {
        throw APIError.invalidArgument("Invalid phone number format");
      }
    }

    try {
      // Check if any fields are provided for update
      const hasUpdates = req.fullName !== undefined || 
                        req.email !== undefined || 
                        req.phone !== undefined || 
                        req.address !== undefined || 
                        req.roomNumber !== undefined || 
                        req.numberOfGuests !== undefined || 
                        req.expectedCheckoutDate !== undefined;

      if (!hasUpdates) {
        throw APIError.invalidArgument("No fields to update");
      }

      // Execute individual updates for each field
      if (req.fullName !== undefined) {
        await guestCheckinDB.exec`
          UPDATE guest_checkins SET full_name = ${req.fullName}, updated_at = NOW() WHERE id = ${id}
        `;
      }
      if (req.email !== undefined) {
        await guestCheckinDB.exec`
          UPDATE guest_checkins SET email = ${req.email}, updated_at = NOW() WHERE id = ${id}
        `;
      }
      if (req.phone !== undefined) {
        await guestCheckinDB.exec`
          UPDATE guest_checkins SET phone = ${req.phone}, updated_at = NOW() WHERE id = ${id}
        `;
      }
      if (req.address !== undefined) {
        await guestCheckinDB.exec`
          UPDATE guest_checkins SET address = ${req.address}, updated_at = NOW() WHERE id = ${id}
        `;
      }
      if (req.roomNumber !== undefined) {
        await guestCheckinDB.exec`
          UPDATE guest_checkins SET room_number = ${req.roomNumber}, updated_at = NOW() WHERE id = ${id}
        `;
      }
      if (req.numberOfGuests !== undefined) {
        await guestCheckinDB.exec`
          UPDATE guest_checkins SET number_of_guests = ${req.numberOfGuests}, updated_at = NOW() WHERE id = ${id}
        `;
      }
      if (req.expectedCheckoutDate !== undefined) {
        await guestCheckinDB.exec`
          UPDATE guest_checkins SET expected_checkout_date = ${req.expectedCheckoutDate}::timestamp, updated_at = NOW() WHERE id = ${id}
        `;
      }

      // Get the updated timestamp
      const result = await guestCheckinDB.queryRow`
        SELECT updated_at FROM guest_checkins WHERE id = ${id}
      `;

      log.info("Guest check-in updated successfully", {
        checkInId: id,
        userId: authData.userID,
      });

      // Log update action with before/after values
      const changedFields: Record<string, { before: any; after: any }> = {};
      if (req.fullName !== undefined) changedFields.fullName = { before: checkIn.full_name, after: req.fullName };
      if (req.email !== undefined) changedFields.email = { before: checkIn.email, after: req.email };
      if (req.phone !== undefined) changedFields.phone = { before: checkIn.phone, after: req.phone };
      if (req.address !== undefined) changedFields.address = { before: checkIn.address, after: req.address };
      if (req.roomNumber !== undefined) changedFields.roomNumber = { before: checkIn.room_number, after: req.roomNumber };
      if (req.numberOfGuests !== undefined) changedFields.numberOfGuests = { before: checkIn.number_of_guests, after: req.numberOfGuests };

      await createAuditLog({
        actionType: "update_checkin",
        resourceType: "guest_checkin",
        resourceId: id,
        guestCheckInId: id,
        guestName: checkIn.full_name,
        actionDetails: { changedFields },
        durationMs: Date.now() - startTime,
      });

      return {
        message: "Check-in updated successfully",
        updatedAt: result!.updated_at,
      };
    } catch (error) {
      log.error("Error updating guest check-in", { error, checkInId: id });
      
      // Log failed update attempt
      await createAuditLog({
        actionType: "update_checkin",
        resourceType: "guest_checkin",
        resourceId: id,
        guestCheckInId: id,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        durationMs: Date.now() - startTime,
      });

      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to update check-in");
    }
  }
);

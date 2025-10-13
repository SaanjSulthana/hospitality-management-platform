import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { guestCheckinDB } from "./db";
import { CheckOutRequest, CheckOutResponse } from "./types";
import { createAuditLog } from "./audit-middleware";
import log from "encore.dev/log";

interface CheckOutParams {
  id: number;
  req: CheckOutRequest;
}

export const checkOutGuest = api(
  { expose: true, method: "POST", path: "/guest-checkin/:id/checkout", auth: true },
  async ({ id, req }: CheckOutParams): Promise<CheckOutResponse> => {
    const authData = getAuthData()!;

    log.info("Checking out guest", {
      checkInId: id,
      userId: authData.userID,
      role: authData.role,
    });

    // Only admin/manager/owner can check out guests
    if (!['admin', 'owner', 'manager'].includes(authData.role)) {
      throw APIError.permissionDenied("Only admin, manager, or owner can check out guests");
    }

    // Verify check-in exists
    const checkIn = await guestCheckinDB.queryRow`
      SELECT id, status
      FROM guest_checkins
      WHERE id = ${id} AND org_id = ${authData.orgId}
    `;

    if (!checkIn) {
      throw APIError.notFound("Check-in not found");
    }

    if (checkIn.status === 'checked_out') {
      throw APIError.invalidArgument("Guest is already checked out");
    }

    if (checkIn.status === 'cancelled') {
      throw APIError.invalidArgument("Cannot check out a cancelled check-in");
    }

    try {
      const checkoutDate = req.actualCheckoutDate || new Date().toISOString();

      const result = await guestCheckinDB.queryRow`
        UPDATE guest_checkins
        SET 
          status = 'checked_out',
          actual_checkout_date = ${checkoutDate}::timestamp,
          checked_out_by_user_id = ${authData.userID},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING actual_checkout_date
      `;

      log.info("Guest checked out successfully", {
        checkInId: id,
        userId: authData.userID,
        checkoutDate: result!.actual_checkout_date,
      });

      // Get guest name for audit log
      const guest = await guestCheckinDB.queryRow`
        SELECT full_name FROM guest_checkins WHERE id = ${id}
      `;

      // Log checkout action
      await createAuditLog({
        actionType: "checkout_guest",
        resourceType: "guest_checkin",
        resourceId: id,
        guestCheckInId: id,
        guestName: guest?.full_name || null,
        actionDetails: { checkoutDate: result!.actual_checkout_date },
      });

      return {
        message: "Guest checked out successfully",
        actualCheckoutDate: result!.actual_checkout_date,
      };
    } catch (error) {
      log.error("Error checking out guest", { error, checkInId: id });
      
      // Log failed checkout
      await createAuditLog({
        actionType: "checkout_guest",
        resourceType: "guest_checkin",
        resourceId: id,
        guestCheckInId: id,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to check out guest");
    }
  }
);

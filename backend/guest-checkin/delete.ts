import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import { DeleteCheckInResponse } from "./types";
import log from "encore.dev/log";

interface DeleteCheckInRequest {
  id: number;
}

export const deleteCheckIn = api(
  { expose: true, method: "DELETE", path: "/guest-checkin/:id", auth: true },
  async ({ id }: DeleteCheckInRequest): Promise<DeleteCheckInResponse> => {
    const authData = getAuthData()!;

    log.info("Deleting guest check-in", {
      checkInId: id,
      userId: authData.userID,
      role: authData.role,
    });

    // Only admin/owner can delete check-ins
    if (!['admin', 'owner'].includes(authData.role)) {
      throw APIError.permissionDenied("Only admin or owner can delete check-ins");
    }

    // Verify check-in exists
    const checkIn = await guestCheckinDB.queryRow`
      SELECT id
      FROM guest_checkins
      WHERE id = ${id} AND org_id = ${authData.orgId}
    `;

    if (!checkIn) {
      throw APIError.notFound("Check-in not found");
    }

    try {
      // Instead of hard delete, we mark as cancelled
      await guestCheckinDB.exec`
        UPDATE guest_checkins
        SET 
          status = 'cancelled',
          updated_at = NOW()
        WHERE id = ${id}
      `;

      log.info("Guest check-in cancelled successfully", {
        checkInId: id,
        userId: authData.userID,
      });

      return {
        message: "Check-in cancelled successfully",
      };
    } catch (error) {
      log.error("Error deleting guest check-in", { error, checkInId: id });
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to delete check-in");
    }
  }
);

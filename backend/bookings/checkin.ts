import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { bookingsDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface CheckinRequest {
  id: number;
}

export interface CheckinResponse {
  success: boolean;
  bookingId: number;
  status: string;
}

// Checks in a guest for their booking
export const checkin = api<CheckinRequest, CheckinResponse>(
  { auth: true, expose: true, method: "POST", path: "/bookings/:id/checkin" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    const { id } = req;

    // Get booking and check access
    const bookingRow = await bookingsDB.queryRow`
      SELECT b.id, b.org_id, b.property_id, b.status, b.checkin_date
      FROM bookings b
      WHERE b.id = ${id} AND b.org_id = ${authData.orgId}
    `;

    if (!bookingRow) {
      throw APIError.notFound("Booking not found");
    }

    // Managers must have access to the property
    if (authData.role === "MANAGER") {
      const accessCheck = await bookingsDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${bookingRow.property_id}
      `;
      if (!accessCheck) {
        throw APIError.permissionDenied("No access to this booking");
      }
    }

    // Validate booking status
    if (bookingRow.status !== "confirmed") {
      throw APIError.failedPrecondition(`Cannot check in booking with status: ${bookingRow.status}`);
    }

    // Check if check-in date is valid (today or past)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkinDate = new Date(bookingRow.checkin_date);
    checkinDate.setHours(0, 0, 0, 0);

    if (checkinDate > today) {
      throw APIError.failedPrecondition("Cannot check in before the check-in date");
    }

    // Update booking status
    await bookingsDB.exec`
      UPDATE bookings 
      SET status = 'checked_in'
      WHERE id = ${id}
    `;

    return {
      success: true,
      bookingId: id,
      status: "checked_in",
    };
  }
);

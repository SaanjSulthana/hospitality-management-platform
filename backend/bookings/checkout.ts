import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { bookingsDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface CheckoutRequest {
  id: number;
}

export interface CheckoutResponse {
  success: boolean;
  bookingId: number;
  status: string;
}

// Checks out a guest from their booking
export const checkout = api<CheckoutRequest, CheckoutResponse>(
  { auth: true, expose: true, method: "POST", path: "/bookings/:id/checkout" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    const { id } = req;

    // Get booking and check access
    const bookingRow = await bookingsDB.queryRow`
      SELECT b.id, b.org_id, b.property_id, b.status, b.checkout_date
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
    if (bookingRow.status !== "checked_in") {
      throw APIError.failedPrecondition(`Cannot check out booking with status: ${bookingRow.status}`);
    }

    // Update booking status
    await bookingsDB.exec`
      UPDATE bookings 
      SET status = 'checked_out'
      WHERE id = ${id}
    `;

    return {
      success: true,
      bookingId: id,
      status: "checked_out",
    };
  }
);

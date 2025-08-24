import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { bookingsDB } from "./db";
import { requireRole } from "../auth/middleware";
import { BookingChannel } from "./types";

export interface CreateBookingRequest {
  propertyId: number;
  guestContact: {
    name: string;
    email?: string;
    phone?: string;
  };
  checkinDate: Date;
  checkoutDate: Date;
  priceCents: number;
  currency?: string;
  channel?: BookingChannel;
  notes?: string;
}

export interface CreateBookingResponse {
  bookingId: number;
  guestId: number;
  propertyId: number;
  checkinDate: Date;
  checkoutDate: Date;
  status: string;
  priceCents: number;
  currency: string;
  channel: BookingChannel;
}

// Creates a new booking and guest
export const create = api<CreateBookingRequest, CreateBookingResponse>(
  { auth: true, expose: true, method: "POST", path: "/bookings" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole('CORP_ADMIN', 'REGIONAL_MANAGER', 'PROPERTY_MANAGER', 'DEPT_HEAD', 'STAFF')(authData);

    const { propertyId, guestContact, checkinDate, checkoutDate, priceCents, currency = 'USD', channel = 'direct', notes } = req;

    // Validate dates
    if (new Date(checkinDate) >= new Date(checkoutDate)) {
      throw APIError.invalidArgument("Check-out date must be after check-in date");
    }

    // Check property access
    const propertyRow = await bookingsDB.queryRow`
      SELECT p.id, p.org_id, p.region_id
      FROM properties p
      WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
    `;

    if (!propertyRow) {
      throw APIError.notFound("Property not found");
    }

    // Check role-based access
    if (authData.role === 'REGIONAL_MANAGER' && authData.regionId && propertyRow.region_id !== authData.regionId) {
      throw APIError.permissionDenied("No access to this property");
    }

    if (['PROPERTY_MANAGER', 'DEPT_HEAD', 'STAFF'].includes(authData.role)) {
      const accessCheck = await bookingsDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
      `;
      if (!accessCheck) {
        throw APIError.permissionDenied("No access to this property");
      }
    }

    // Create guest
    const guestRow = await bookingsDB.queryRow`
      INSERT INTO guests (org_id, primary_contact_json, notes_text)
      VALUES (${authData.orgId}, ${JSON.stringify(guestContact)}, ${notes || null})
      RETURNING id
    `;

    // Create booking
    const bookingRow = await bookingsDB.queryRow`
      INSERT INTO bookings (org_id, guest_id, property_id, checkin_date, checkout_date, price_cents, currency, channel, status)
      VALUES (${authData.orgId}, ${guestRow.id}, ${propertyId}, ${checkinDate}, ${checkoutDate}, ${priceCents}, ${currency}, ${channel}, 'pending')
      RETURNING id, guest_id, property_id, checkin_date, checkout_date, status, price_cents, currency, channel
    `;

    return {
      bookingId: bookingRow.id,
      guestId: bookingRow.guest_id,
      propertyId: bookingRow.property_id,
      checkinDate: bookingRow.checkin_date,
      checkoutDate: bookingRow.checkout_date,
      status: bookingRow.status,
      priceCents: bookingRow.price_cents,
      currency: bookingRow.currency,
      channel: bookingRow.channel as BookingChannel,
    };
  }
);

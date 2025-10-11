import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import { CreateCheckInRequest, CreateCheckInResponse } from "./types";
import { createAuditLog } from "./audit-middleware";
import log from "encore.dev/log";

export const createCheckIn = api(
  { expose: true, method: "POST", path: "/guest-checkin/create", auth: true },
  async (req: CreateCheckInRequest): Promise<CreateCheckInResponse> => {
    const authData = getAuthData()!;

    log.info("Creating guest check-in", {
      userId: authData.userID,
      orgId: authData.orgId,
      propertyId: req.propertyId,
      guestType: req.guestType,
      requestData: {
        fullName: req.fullName,
        email: req.email,
        phone: req.phone,
        address: req.address,
        aadharNumber: req.aadharNumber,
        panNumber: req.panNumber,
        passportNumber: req.passportNumber,
        country: req.country,
        roomNumber: req.roomNumber,
        numberOfGuests: req.numberOfGuests,
      }
    });

    // Validate required fields
    if (!req.fullName || !req.email || !req.phone || !req.address) {
      throw APIError.invalidArgument("Missing required fields: fullName, email, phone, address");
    }

    // Validate guest type specific fields
    if (req.guestType === 'indian' && !req.aadharNumber) {
      throw APIError.invalidArgument("Aadhar number is required for Indian guests");
    }
    if (req.guestType === 'foreign' && !req.passportNumber) {
      throw APIError.invalidArgument("Passport number is required for foreign guests");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.email)) {
      throw APIError.invalidArgument("Invalid email format");
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
    if (!phoneRegex.test(req.phone)) {
      throw APIError.invalidArgument("Invalid phone number format");
    }

    // Validate Aadhar number format (12 digits)
    if (req.aadharNumber) {
      const aadharRegex = /^\d{12}$/;
      if (!aadharRegex.test(req.aadharNumber)) {
        throw APIError.invalidArgument("Aadhar number must be 12 digits");
      }
    }

    // Validate PAN number format (10 alphanumeric)
    if (req.panNumber) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(req.panNumber.toUpperCase())) {
        throw APIError.invalidArgument("Invalid PAN number format");
      }
    }

    const startTime = Date.now();

    try {
      // Note: Property validation removed for microservices architecture
      // Properties are validated at the application level
      // TODO: Implement property validation via properties service API call

      // Insert check-in record
      const result = await guestCheckinDB.queryRow`
        INSERT INTO guest_checkins (
          org_id,
          property_id,
          guest_type,
          full_name,
          email,
          phone,
          address,
          aadhar_number,
          pan_number,
          passport_number,
          country,
          visa_type,
          visa_expiry_date,
          expected_checkout_date,
          room_number,
          number_of_guests,
          created_by_user_id
        ) VALUES (
          ${authData.orgId},
          ${req.propertyId},
          ${req.guestType},
          ${req.fullName},
          ${req.email},
          ${req.phone},
          ${req.address},
          ${req.aadharNumber || null},
          ${req.panNumber || null},
          ${req.passportNumber || null},
          ${req.country || null},
          ${req.visaType || null},
          ${req.visaExpiryDate || null},
          ${req.expectedCheckoutDate || null},
          ${req.roomNumber || null},
          ${req.numberOfGuests || 1},
          ${parseInt(authData.userID)}
        )
        RETURNING id, check_in_date
      `;

      const checkInId = result!.id;
      const checkInDate = result!.check_in_date;

      log.info("Guest check-in created successfully", {
        checkInId,
        userId: authData.userID,
        guestName: req.fullName,
        guestType: req.guestType,
      });

      // Log check-in creation to audit logs
      await createAuditLog({
        actionType: "create_checkin",
        resourceType: "guest_checkin",
        resourceId: checkInId,
        guestCheckInId: checkInId,
        guestName: req.fullName,
        actionDetails: {
          propertyId: req.propertyId,
          guestType: req.guestType,
          numberOfGuests: req.numberOfGuests || 1,
          roomNumber: req.roomNumber || null,
          expectedCheckoutDate: req.expectedCheckoutDate || null,
        },
        durationMs: Date.now() - startTime,
      });

      // Create a personalized success message
      const guestGreeting = req.guestType === 'indian' 
        ? `Welcome ${req.fullName}! Your check-in has been completed successfully.`
        : `Welcome ${req.fullName}! Your check-in has been completed successfully.`;
      
      const roomInfo = req.roomNumber ? ` Room ${req.roomNumber} is ready for you.` : '';
      const successMessage = `${guestGreeting}${roomInfo}`;

      return {
        id: checkInId,
        message: successMessage,
        checkInDate,
      };
    } catch (error: any) {
      log.error("Error creating guest check-in", { 
        error: error.message || error,
        stack: error.stack,
        requestData: {
          propertyId: req.propertyId,
          guestType: req.guestType,
          fullName: req.fullName,
          email: req.email,
          phone: req.phone,
          address: req.address,
        }
      });
      
      // Log failed creation attempt to audit logs
      await createAuditLog({
        actionType: "create_checkin",
        resourceType: "guest_checkin",
        guestName: req.fullName,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        durationMs: Date.now() - startTime,
      });

      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to create check-in");
    }
  }
);

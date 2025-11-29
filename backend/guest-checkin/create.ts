import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import { CreateCheckInRequest, CreateCheckInResponse } from "./types";
import { createAuditLog } from "./audit-middleware";
import log from "encore.dev/log";
import { guestCheckinEvents, type GuestEventPayload } from "./guest-checkin-events";
import { recordGuestEventPublished } from "./event-metrics";
import { v1Path } from "../shared/http";

async function createCheckInHandler(req: CreateCheckInRequest): Promise<CreateCheckInResponse> {
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
        drivingLicenseNumber: req.drivingLicenseNumber,
        electionCardNumber: req.electionCardNumber,
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
    if (req.guestType === 'indian') {
      // Require at least ONE Indian ID
      const hasAnyIndianId = req.aadharNumber || req.panNumber || req.drivingLicenseNumber || req.electionCardNumber;
      if (!hasAnyIndianId) {
        throw APIError.invalidArgument("At least one Indian ID required (Aadhaar, PAN, Driving License, or Election Card)");
      }
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

    // Validate Driving License number format (flexible format)
    if (req.drivingLicenseNumber) {
      const dlRegex = /^[A-Z0-9\-\/]{8,20}$/;
      if (!dlRegex.test(req.drivingLicenseNumber.toUpperCase())) {
        throw APIError.invalidArgument("Invalid driving license number format");
      }
    }

    // Validate Election Card number format (10 alphanumeric)
    if (req.electionCardNumber) {
      const epicRegex = /^[A-Z]{3}[0-9]{7}$/;
      if (!epicRegex.test(req.electionCardNumber.toUpperCase())) {
        throw APIError.invalidArgument("Invalid election card number format (EPIC format: ABC1234567)");
      }
    }

    const startTime = Date.now();

    try {
      // Note: Property validation removed for microservices architecture
      // Properties are validated at the application level
      // TODO: Implement property validation via properties service API call

      // Insert check-in record (only using columns that exist in the database)
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
          driving_license_number,
          election_card_number,
          passport_number,
          country,
          visa_type,
          visa_expiry_date,
          expected_checkout_date,
          room_number,
          number_of_guests,
          created_by_user_id,
          surname,
          sex,
          special_category,
          permanent_city,
          indian_address,
          indian_city_district,
          indian_state,
          indian_pincode,
          arrived_from,
          date_of_arrival_in_india,
          date_of_arrival_at_accommodation,
          time_of_arrival,
          intended_duration,
          employed_in_india,
          purpose_of_visit,
          next_place,
          destination_city_district,
          destination_state,
          mobile_no_india,
          contact_no_permanent,
          mobile_no_permanent,
          remarks
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
          ${req.drivingLicenseNumber || null},
          ${req.electionCardNumber || null},
          ${req.passportNumber || null},
          ${req.country || null},
          ${req.visaType || null},
          ${req.visaExpiryDate || null},
          ${req.expectedCheckoutDate || null},
          ${req.roomNumber || null},
          ${req.numberOfGuests || 1},
          ${parseInt(authData.userID)},
          ${(req as any).surname || null},
          ${(req as any).sex || null},
          ${(req as any).specialCategory || 'Others'},
          ${(req as any).permanentCity || null},
          ${(req as any).indianAddress || null},
          ${(req as any).indianCityDistrict || null},
          ${(req as any).indianState || null},
          ${(req as any).indianPincode || null},
          ${(req as any).arrivedFrom || null},
          ${(req as any).dateOfArrivalInIndia || null},
          ${(req as any).dateOfArrivalAtAccommodation || null},
          ${(req as any).timeOfArrival || null},
          ${(req as any).intendedDuration || 7},
          ${(req as any).employedInIndia || 'N'},
          ${(req as any).purposeOfVisit || 'Tourism'},
          ${(req as any).nextPlace || null},
          ${(req as any).destinationCityDistrict || null},
          ${(req as any).destinationState || null},
          ${(req as any).mobileNoIndia || null},
          ${(req as any).contactNoPermanent || null},
          ${(req as any).mobileNoPermanent || null},
          ${(req as any).remarks || null}
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

      // Publish guest_created event (and buffer locally for instant delivery)
      const event: GuestEventPayload = {
        eventId: `${authData.orgId}-${checkInId}-${Date.now()}`,
        eventVersion: "v1",
        eventType: "guest_created",
        orgId: Number(authData.orgId),
        propertyId: req.propertyId,
        userId: parseInt(authData.userID),
        timestamp: new Date(),
        entityType: "guest_checkin",
        entityId: checkInId,
        metadata: {
          guestName: req.fullName,
        },
      };

      // Publish to topic (subscriber will buffer with waiter pattern)
      recordGuestEventPublished(event);
      guestCheckinEvents.publish(event).catch((e) => {
        log.warn("Failed to publish guest_created event", { error: e });
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

export const createCheckIn = api<CreateCheckInRequest, CreateCheckInResponse>(
  { expose: true, method: "POST", path: "/guest-checkin/create", auth: true },
  createCheckInHandler
);

export const createCheckInV1 = api<CreateCheckInRequest, CreateCheckInResponse>(
  { expose: true, method: "POST", path: "/v1/guest-checkin/create", auth: true },
  createCheckInHandler
);

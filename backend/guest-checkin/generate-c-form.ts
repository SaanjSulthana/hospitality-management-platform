import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { FormCData } from "./form-c-types";
import { generateFormCPDF, formatDateForFormC, calculateIntendedDuration } from "./form-c-generator";
import { guestCheckinDB } from "./db";
import { createAuditLog } from "./audit-middleware";
import log from "encore.dev/log";

interface GenerateCFormRequest {
  id: number;
}

interface GenerateCFormResponse {
  pdfData: string; // Base64 encoded PDF
  filename: string;
}

/**
 * Generate Form C PDF for a foreign guest check-in
 * Maps guest check-in data and property data to Form C format
 * Returns PDF as base64 encoded string for download
 */
async function generateCFormHandler(req: GenerateCFormRequest): Promise<GenerateCFormResponse> {
    const auth = getAuthData()!;
    const guestCheckInId = req.id;

    console.log('Generate C-Form request:', {
      guestCheckInId,
      userId: auth.userID,
      orgId: auth.orgId
    });

    if (!guestCheckInId || isNaN(guestCheckInId)) {
      throw APIError.invalidArgument("Invalid guest check-in ID");
    }

    // Fetch guest check-in data (properties table is in a different microservice)
    const checkIn = await guestCheckinDB.queryRow`
      SELECT *
      FROM guest_checkins
      WHERE id = ${guestCheckInId} 
        AND org_id = ${auth.orgId}
    `;

    console.log('Query result:', {
      found: !!checkIn,
      guestType: checkIn?.guest_type,
      guestName: checkIn?.full_name
    });

    if (!checkIn) {
      throw APIError.notFound(`Guest check-in ${guestCheckInId} not found for organization ${auth.orgId}`);
    }
    
    // TODO: Fetch property details from properties service API if needed
    // For now, we'll use the property fields stored in guest_checkins or defaults

    // Verify this is a foreign guest
    if (checkIn.guest_type !== 'foreign') {
      throw APIError.invalidArgument("C-Form is only available for foreign guests");
    }

    // Map data to FormCData structure
    // Note: Property fields should be fetched from properties service API
    // For now using defaults - property details should be added to check-in form
    const formCData: FormCData = {
        accommodation: {
          name: checkIn.property_name || 'Hotel Name (Add in check-in form)',
          address: checkIn.property_address || checkIn.address || 'Property Address (Add in check-in form)',
          cityDistrict: (checkIn.property_city || checkIn.indian_city_district || 'CITY').toUpperCase(),
          state: (checkIn.property_state || checkIn.indian_state || 'STATE').toUpperCase(),
          starRating: 'Not Rated',
          phoneNo: checkIn.phone || '',
          mobileNo: checkIn.phone || ''
        },

        personal: {
          surname: checkIn.surname || '',
          givenName: checkIn.full_name || '',
          sex: checkIn.sex || 'Other',
          dateOfBirth: checkIn.passport_date_of_birth ? formatDateForFormC(checkIn.passport_date_of_birth) : '',
          specialCategory: checkIn.special_category || 'Others',
          nationality: (checkIn.passport_nationality || checkIn.passport_country || checkIn.country || '').toUpperCase(),
          permanentAddress: {
            address: (checkIn.address || '').toUpperCase(),
            city: (checkIn.permanent_city || checkIn.passport_place_of_birth || '').toUpperCase(),
            country: (checkIn.passport_nationality || checkIn.country || '').toUpperCase()
          }
        },

        indianAddress: {
          address: (checkIn.indian_address || checkIn.address || '').toUpperCase(),
          cityDistrict: (checkIn.indian_city_district || '').toUpperCase(),
          state: (checkIn.indian_state || '').toUpperCase(),
          pincode: checkIn.indian_pincode || ''
        },

        passport: {
          number: (checkIn.passport_number || '').toUpperCase(),
          placeOfIssue: (checkIn.passport_issuing_authority || checkIn.passport_place_of_birth || '').toUpperCase(),
          dateOfIssue: formatDateForFormC(checkIn.passport_issue_date),
          expiryDate: formatDateForFormC(checkIn.passport_expiry_date)
        },

        visa: {
          number: (checkIn.visa_number || '').toUpperCase(),
          dateOfIssue: formatDateForFormC(checkIn.visa_issue_date),
          validTill: formatDateForFormC(checkIn.visa_expiry_date),
          visaType: (checkIn.visa_type || 'TOURIST VISA').toUpperCase(),
          placeOfIssue: (checkIn.visa_place_of_issue || '').toUpperCase(),
          visaSubtype: checkIn.visa_category || ''
        },

        arrival: {
          arrivedFrom: (checkIn.arrived_from || `${checkIn.passport_place_of_birth || ''}, ${checkIn.country || ''}`).toUpperCase(),
          dateOfArrivalInIndia: formatDateForFormC(checkIn.date_of_arrival_in_india || checkIn.check_in_date),
          dateOfArrivalAtAccommodation: formatDateForFormC(checkIn.date_of_arrival_at_accommodation || checkIn.check_in_date),
          timeOfArrival: checkIn.time_of_arrival || '12:00',
          intendedDuration: checkIn.intended_duration || calculateIntendedDuration(checkIn.check_in_date, checkIn.expected_checkout_date),
          employedInIndia: checkIn.employed_in_india || 'N'
        },

        other: {
          purposeOfVisit: (checkIn.visa_purpose_of_visit || checkIn.purpose_of_visit || 'Tourism').toUpperCase(),
          nextPlace: (checkIn.next_place || '').toUpperCase(),
          destinationCityDistrict: (checkIn.destination_city_district || '').toUpperCase(),
          destinationState: (checkIn.destination_state || '').toUpperCase(),
          contactNoIndia: checkIn.phone || '',
          mobileNoIndia: checkIn.mobile_no_india || '',
          contactNoPermanent: checkIn.contact_no_permanent || '',
          mobileNoPermanent: checkIn.mobile_no_permanent || checkIn.phone || '',
          remarks: checkIn.remarks || ''
        }
      };

    // Generate PDF
    let pdfBuffer: Buffer;
    try {
      console.log('Starting PDF generation...');
      pdfBuffer = await generateFormCPDF(formCData);
      console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    } catch (error) {
      console.error('Error generating Form C PDF:', error);
      throw APIError.internal(`Failed to generate Form C PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Generate filename with guest name and date
    const guestName = (checkIn.full_name || 'Guest').replace(/[^a-zA-Z0-9]/g, '_');
    const date = new Date().toISOString().split('T')[0];
    const filename = `Form_C_${guestName}_${date}.pdf`;

    // Convert PDF buffer to base64 for JSON response
    const pdfData = pdfBuffer.toString('base64');

    console.log('Returning PDF response:', {
      filename,
      pdfDataLength: pdfData.length,
      originalBufferSize: pdfBuffer.length
    });

    // Create audit log for C-Form generation
    try {
      await createAuditLog({
        actionType: "generate_c_form",
        resourceType: "guest_checkin",
        guestCheckInId: guestCheckInId,
        guestName: checkIn.full_name,
        actionDetails: {
          filename: filename,
          guestEmail: checkIn.email,
          propertyName: checkIn.property_name,
          pdfSizeBytes: pdfBuffer.length,
          generatedBy: auth.email,
          action: "Form C PDF generated and downloaded",
        },
      });
      
      log.info("C-Form generation logged in audit trail", {
        guestCheckInId,
        guestName: checkIn.full_name,
        filename,
      });
    } catch (auditError) {
      // Don't fail PDF generation if audit logging fails
      log.error("Failed to create audit log for C-Form generation", { error: auditError });
    }

    return {
      pdfData,
      filename
    };
  }

// Legacy endpoint
export const generateCForm = api<GenerateCFormRequest, GenerateCFormResponse>(
  { expose: true, method: "POST", path: "/guest-checkin/:id/generate-c-form", auth: true },
  generateCFormHandler
);

// V1 endpoint
export const generateCFormV1 = api<GenerateCFormRequest, GenerateCFormResponse>(
  { expose: true, method: "POST", path: "/v1/guest-checkin/:id/generate-c-form", auth: true },
  generateCFormHandler
);


/**
 * Unified Check-in with Documents API
 * Creates guest check-in and uploads documents in a single transaction
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import { CreateCheckInRequest, CreateCheckInResponse } from "./types";
import { createAuditLog } from "./audit-middleware";
import { extractFromDocument } from "./llm-service";
import { processImage, saveImageToDisk, validateImage, deleteImageFromDisk } from "./image-processor";
import log from "encore.dev/log";

interface DocumentToUpload {
  documentType: string;
  fileData: string; // Base64
  filename: string;
  mimeType: string;
}

interface CreateCheckInWithDocumentsRequest extends CreateCheckInRequest {
  dataSource?: 'manual' | 'aadhaar_scan' | 'passport_scan' | 'pan_scan' | 'visa_scan' | 'mixed';
  documents?: DocumentToUpload[];
}

interface CreateCheckInWithDocumentsResponse extends CreateCheckInResponse {
  documents: Array<{
    id: number;
    documentType: string;
    extractionStatus: string;
    overallConfidence: number;
    filename: string;
  }>;
}

/**
 * Create check-in with document uploads in a single transaction
 * If document upload fails, entire check-in is rolled back
 */
export const createCheckInWithDocuments = api(
  { expose: true, method: "POST", path: "/guest-checkin/create-with-documents", auth: true },
  async (req: CreateCheckInWithDocumentsRequest): Promise<CreateCheckInWithDocumentsResponse> => {
    const authData = getAuthData()!;
    const startTime = Date.now();

    log.info("Creating guest check-in with documents", {
      userId: authData.userID,
      orgId: authData.orgId,
      propertyId: req.propertyId,
      guestType: req.guestType,
      documentCount: req.documents?.length || 0,
    });

    // Validate documents array
    if (req.documents && req.documents.length > 6) {
      throw APIError.invalidArgument("Maximum 6 documents allowed per guest");
    }

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

    try {
      // Verify property exists and belongs to user's org
      const property = await guestCheckinDB.queryRow`
        SELECT id FROM properties WHERE id = ${req.propertyId} AND org_id = ${authData.orgId}
      `;

      if (!property) {
        throw APIError.notFound("Property not found");
      }

      // Start transaction - create check-in record
      const checkInResult = await guestCheckinDB.queryRow`
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
          data_source,
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
          ${req.dataSource || 'manual'},
          ${authData.userID}
        )
        RETURNING id, check_in_date
      `;

      const checkInId = checkInResult!.id;
      const checkInDate = checkInResult!.check_in_date;

      log.info("Guest check-in created", { checkInId });

      // Upload and process documents
      const uploadedDocuments: Array<{
        id: number;
        documentType: string;
        extractionStatus: string;
        overallConfidence: number;
        filename: string;
      }> = [];

      if (req.documents && req.documents.length > 0) {
        for (const doc of req.documents) {
          try {
            // Decode base64
            const fileBuffer = Buffer.from(doc.fileData, "base64");

            // Validate
            const validation = validateImage(doc.mimeType, fileBuffer.length);
            if (!validation.valid) {
              log.warn("Document validation failed, skipping", {
                documentType: doc.documentType,
                error: validation.error,
              });
              continue; // Skip invalid documents but don't fail entire check-in
            }

            // Process image
            const processed = await processImage(fileBuffer);

            // Save to disk
            const storageInfo = await saveImageToDisk(
              processed.buffer,
              doc.documentType,
              doc.filename,
              authData.orgId,
              checkInId
            );

            // Insert document record
            const documentRecord = await guestCheckinDB.queryRow`
              INSERT INTO guest_documents (
                org_id,
                guest_checkin_id,
                document_type,
                filename,
                original_filename,
                file_path,
                file_size,
                mime_type,
                thumbnail_path,
                image_width,
                image_height,
                extraction_status,
                uploaded_by_user_id
              ) VALUES (
                ${authData.orgId},
                ${checkInId},
                ${doc.documentType},
                ${storageInfo.filename},
                ${doc.filename},
                ${storageInfo.filePath},
                ${storageInfo.fileSize},
                ${doc.mimeType},
                ${storageInfo.thumbnailPath},
                ${storageInfo.width},
                ${storageInfo.height},
                'processing',
                ${parseInt(authData.userID)}
              )
              RETURNING id
            `;

            const documentId = documentRecord!.id;

            // Perform LLM extraction (async, don't block)
            setImmediate(async () => {
              try {
                const extractionResult = await extractFromDocument(
                  doc.fileData,
                  doc.documentType as any,
                  authData.orgId
                );

                await guestCheckinDB.exec`
                  UPDATE guest_documents
                  SET 
                    extracted_data = ${JSON.stringify(extractionResult.fields)}::jsonb,
                    overall_confidence = ${extractionResult.overallConfidence},
                    extraction_status = ${extractionResult.success ? 'completed' : 'failed'},
                    extraction_error = ${extractionResult.error || null},
                    extraction_processed_at = NOW()
                  WHERE id = ${documentId}
                `;
              } catch (extractionError: any) {
                log.error("LLM extraction failed", { documentId, error: extractionError.message });
                
                await guestCheckinDB.exec`
                  UPDATE guest_documents
                  SET extraction_status = 'failed', extraction_error = ${extractionError.message}
                  WHERE id = ${documentId}
                `;
              }
            });

            uploadedDocuments.push({
              id: documentId,
              documentType: doc.documentType,
              extractionStatus: 'processing',
              overallConfidence: 0,
              filename: storageInfo.filename,
            });

            log.info("Document uploaded", { documentId, checkInId, documentType: doc.documentType });
          } catch (docError: any) {
            log.error("Document upload failed", { error: docError.message, documentType: doc.documentType });
            // Continue with other documents, don't fail entire check-in
          }
        }
      }

      // Log check-in creation
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
          documentCount: uploadedDocuments.length,
          dataSource: req.dataSource || 'manual',
        },
        durationMs: Date.now() - startTime,
      });

      log.info("Check-in with documents created successfully", {
        checkInId,
        userId: authData.userID,
        documentCount: uploadedDocuments.length,
      });

      // Create a personalized success message
      const guestGreeting = `Welcome ${req.fullName}! Your check-in has been completed successfully.`;
      const documentInfo = uploadedDocuments.length > 0 
        ? ` We have received ${uploadedDocuments.length} document(s) and they are being processed.`
        : '';
      const roomInfo = req.roomNumber ? ` Room ${req.roomNumber} is ready for you.` : '';
      const successMessage = `${guestGreeting}${documentInfo}${roomInfo}`;

      return {
        id: checkInId,
        message: successMessage,
        checkInDate,
        documents: uploadedDocuments,
      };
    } catch (error: any) {
      log.error("Error creating check-in with documents", { error: error.message });

      // Log failed attempt
      await createAuditLog({
        actionType: "create_checkin",
        resourceType: "guest_checkin",
        guestName: req.fullName,
        success: false,
        errorMessage: error.message,
        durationMs: Date.now() - startTime,
      });

      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to create check-in with documents");
    }
  }
);


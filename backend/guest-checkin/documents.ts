/**
 * Guest Document Management API
 * Endpoints for uploading, viewing, and managing guest ID documents
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { guestCheckinDB } from "./db";
import { guestDocumentsBucket } from "../storage/buckets";
import { extractFromDocument, detectDocumentType } from "./llm-service";
import {
  processImage,
  generateThumbnail,
  validateImage,
  saveImageToDisk,
  deleteImageFromDisk,
  fileExists,
} from "./image-processor";
import {
  enhanceDocumentImage,
  analyzeImageQuality,
} from "./image-enhancer";
import {
  UploadDocumentRequest,
  UploadDocumentResponse,
  ListDocumentsRequest,
  ListDocumentsResponse,
  GetDocumentRequest,
  GetDocumentResponse,
  DeleteDocumentRequest,
  DeleteDocumentResponse,
  VerifyDocumentRequest,
  VerifyDocumentResponse,
  RetryExtractionRequest,
  RetryExtractionResponse,
  GuestDocument,
} from "./document-types";
import log from "encore.dev/log";
import * as path from "path";
import * as fs from "fs";
import { guestCheckinEvents, type GuestEventPayload } from "./guest-checkin-events";
import { recordGuestEventPublished } from "./event-metrics";
import { v1Path } from "../shared/http";

/**
 * Upload a guest document with automatic LLM text extraction
 */
async function uploadDocumentHandler(req: UploadDocumentRequest): Promise<UploadDocumentResponse> {
    const authData = getAuthData()!;
    
    // Only admin and manager can upload documents
    requireRole("ADMIN", "MANAGER")(authData);

    log.info("Uploading guest document", {
      userId: authData.userID,
      documentType: req.documentType,
      guestCheckInId: req.guestCheckInId,
    });

    // Decode base64 file data
    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(req.fileData, "base64");
    } catch (error) {
      throw APIError.invalidArgument("Invalid base64 file data");
    }

    // Validate image
    const validation = validateImage(req.mimeType, fileBuffer.length);
    if (!validation.valid) {
      throw APIError.invalidArgument(validation.error!);
    }

    // Analyze and enhance image for better OCR
    const imageQuality = await analyzeImageQuality(fileBuffer);
    log.info("Image quality analysis", {
      needsEnhancement: imageQuality.needsEnhancement,
      brightness: imageQuality.brightness,
      contrast: imageQuality.contrast,
    });

    // Enhance image if needed
    let enhancedBuffer = fileBuffer;
    let enhancedBase64 = req.fileData;
    
    if (imageQuality.needsEnhancement) {
      log.info("Enhancing image for better OCR");
      enhancedBuffer = await enhanceDocumentImage(fileBuffer);
      enhancedBase64 = enhancedBuffer.toString('base64');
    }

    let guestPropertyId = 0;
    let guestNameForMetadata: string | undefined;

    // If guestCheckInId provided, verify it exists and capture metadata
    if (req.guestCheckInId) {
      const checkIn = await guestCheckinDB.queryRow`
        SELECT id, property_id, full_name FROM guest_checkins 
        WHERE id = ${req.guestCheckInId} AND org_id = ${authData.orgId}
      `;

      if (!checkIn) {
        throw APIError.notFound("Guest check-in not found");
      }
      
      guestPropertyId = checkIn.property_id || 0;
      guestNameForMetadata = checkIn.full_name || undefined;
    }

    try {
      // Generate unique filename
      const guestCheckInId = req.guestCheckInId || 0;
      const filename = `${req.documentType}_${Date.now()}.jpg`;
      
      // Upload to Encore Cloud bucket (private)
      const bucketKey = `${authData.orgId}/${guestCheckInId}/${filename}`;
      
      try {
        await guestDocumentsBucket.upload(bucketKey, fileBuffer, {
          contentType: req.mimeType
        });
      } catch (error) {
        log.error('Failed to upload document to bucket:', error);
        throw APIError.internal("Failed to upload document to cloud storage");
      }
      
      const storageInfo = {
        filename,
        filePath: bucketKey, // Store bucket key instead of file path
        thumbnailPath: bucketKey, // Use same for thumbnail
        width: 100,
        height: 100,
        fileSize: fileBuffer.length,
        thumbnailSize: fileBuffer.length,
      };

      // Insert document record (guestCheckInId can be null for form creation uploads)
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
          uploaded_by_user_id,
          storage_location,
          bucket_key
        ) VALUES (
          ${authData.orgId},
          ${req.guestCheckInId || null},
          ${req.documentType},
          ${storageInfo.filename},
          ${req.filename},
          ${storageInfo.filePath},
          ${storageInfo.fileSize},
          ${req.mimeType},
          ${storageInfo.thumbnailPath},
          ${storageInfo.width},
          ${storageInfo.height},
          ${req.performExtraction !== false ? 'processing' : 'skipped'},
          ${parseInt(authData.userID)},
          'cloud',
          ${bucketKey}
        )
        RETURNING id, created_at
      `;

      const documentId = documentRecord!.id;
      const thumbnailUrl = `/guest-checkin/documents/${documentId}/thumbnail`;

      if (req.guestCheckInId) {
        const uploadEvent: GuestEventPayload = {
          eventId: `${authData.orgId}-${documentId}-doc-upload-${Date.now()}`,
          eventVersion: "v1",
          eventType: "guest_document_uploaded",
          orgId: Number(authData.orgId),
          propertyId: guestPropertyId,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityType: "guest_document",
          entityId: req.guestCheckInId,
          metadata: {
            action: "add",
            guestName: guestNameForMetadata,
            documentId,
            documentType: req.documentType,
            filename: storageInfo.filename,
            thumbnailUrl,
            status: req.performExtraction !== false ? "processing" : "processing",
          },
        };
        recordGuestEventPublished(uploadEvent);
        guestCheckinEvents.publish(uploadEvent).catch(() => {
          log.warn("Failed to publish guest_document_uploaded event");
        });
      }

      // Perform document type detection and LLM extraction if requested
      let extractionResult;
      let detectedDocumentType;
      let documentTypeConfidence;
      
      if (req.performExtraction !== false) {
        try {
          // First detect document type if it's 'other' or auto-detect is enabled
          if (req.documentType === 'other') {
            const detectionResult = await detectDocumentType(enhancedBase64, authData.orgId);
            detectedDocumentType = detectionResult.documentType;
            documentTypeConfidence = detectionResult.confidence;
            
            log.info("Document type auto-detected", {
              detectedType: detectedDocumentType,
              confidence: documentTypeConfidence,
              reasoning: detectionResult.reasoning,
            });
          } else {
            detectedDocumentType = req.documentType;
            documentTypeConfidence = 100; // User-specified type
          }
          
          // Use detected or specified document type for extraction
          const extractionDocumentType = detectedDocumentType || req.documentType;
          
          // Use enhanced image for extraction
          extractionResult = await extractFromDocument(
            enhancedBase64,
            extractionDocumentType,
            authData.orgId
          );

          // Update document with extraction results and detected type
          // Handle null/undefined confidence values - convert to 0 for database
          const confidenceValue = extractionResult.overallConfidence != null 
            ? extractionResult.overallConfidence 
            : 0;
            
          await guestCheckinDB.exec`
            UPDATE guest_documents
            SET 
              extracted_data = ${JSON.stringify(extractionResult.fields)}::jsonb,
              overall_confidence = ${confidenceValue},
              extraction_status = ${extractionResult.success ? 'completed' : 'failed'},
              extraction_error = ${extractionResult.error || null},
              extraction_processed_at = NOW(),
              detected_document_type = ${detectedDocumentType || null},
              document_type_confidence = ${documentTypeConfidence || null}
            WHERE id = ${documentId}
          `;

          log.info("Document extracted successfully", {
            documentId,
            overallConfidence: extractionResult.overallConfidence,
          });
          
          // Emit extracted success event if we have a guest id
          if (req.guestCheckInId) {
            const fieldsExtracted = Object.keys(extractionResult.fields || {}).length;
            const successEvent: GuestEventPayload = {
              eventId: `${authData.orgId}-${req.guestCheckInId}-doc-${Date.now()}`,
              eventVersion: "v1",
              eventType: "guest_document_extracted",
              orgId: Number(authData.orgId),
              propertyId: guestPropertyId,
              userId: parseInt(authData.userID),
              timestamp: new Date(),
              entityType: "guest_document",
              entityId: req.guestCheckInId!,
              metadata: {
                action: "update",
                guestName: guestNameForMetadata,
                documentId,
                documentType: detectedDocumentType || req.documentType,
                filename: storageInfo.filename,
                thumbnailUrl,
                status: "ready",
                overallConfidence: extractionResult.overallConfidence ?? 0,
                fieldsExtracted,
              },
            };
            recordGuestEventPublished(successEvent);
            guestCheckinEvents.publish(successEvent).catch(() => {
              log.warn("Failed to publish guest_document_extracted event");
            });
          }
        } catch (extractionError: any) {
          log.error("LLM extraction failed", { documentId, error: extractionError.message });
          
          // Update status to failed but don't fail the upload
          await guestCheckinDB.exec`
            UPDATE guest_documents
            SET 
              extraction_status = 'failed',
              extraction_error = ${extractionError.message}
            WHERE id = ${documentId}
          `;

          extractionResult = {
            success: false,
            documentType: req.documentType,
            fields: {},
            overallConfidence: 0,
            processingTime: 0,
            error: extractionError.message,
          };
          
          if (req.guestCheckInId) {
            const failureEvent: GuestEventPayload = {
              eventId: `${authData.orgId}-${req.guestCheckInId}-doc-${Date.now()}`,
              eventVersion: "v1",
              eventType: "guest_document_extract_failed",
              orgId: Number(authData.orgId),
              propertyId: guestPropertyId,
              userId: parseInt(authData.userID),
              timestamp: new Date(),
              entityType: "guest_document",
              entityId: req.guestCheckInId!,
              metadata: {
                action: "update",
                guestName: guestNameForMetadata,
                documentId,
                documentType: req.documentType,
                filename: storageInfo.filename,
                thumbnailUrl,
                status: "failed",
                reason: extractionError.message,
              },
            };
            recordGuestEventPublished(failureEvent);
            guestCheckinEvents.publish(failureEvent).catch(() => {
              log.warn("Failed to publish guest_document_extract_failed event");
            });
          }
        }
      } else {
        extractionResult = {
          success: true,
          documentType: req.documentType,
          fields: {},
          overallConfidence: 0,
          processingTime: 0,
        };
      }

      return {
        success: true,
        document: {
          id: documentId,
          documentType: req.documentType,
          filename: storageInfo.filename,
          fileSize: storageInfo.fileSize,
          thumbnailUrl,
          uploadedAt: documentRecord!.created_at,
        },
        extraction: {
          status: extractionResult.success ? "completed" : extractionResult.error ? "failed" : "skipped",
          data: extractionResult.fields,
          overallConfidence: extractionResult.overallConfidence,
          processingTime: extractionResult.processingTime,
        },
        message: "Document uploaded and processed successfully",
      };
    } catch (error: any) {
      log.error("Document upload failed", { error: error.message });
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to upload document");
    }
  }

export const uploadDocument = api<UploadDocumentRequest, UploadDocumentResponse>(
  { expose: true, method: "POST", path: "/guest-checkin/documents/upload", auth: true },
  uploadDocumentHandler
);

export const uploadDocumentV1 = api<UploadDocumentRequest, UploadDocumentResponse>(
  { expose: true, method: "POST", path: "/v1/guest-checkin/documents/upload", auth: true },
  uploadDocumentHandler
);

/**
 * List all documents for a guest check-in
 */
async function listDocumentsHandler({ checkInId, includeDeleted, documentType }: ListDocumentsRequest): Promise<ListDocumentsResponse> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    log.info("Listing guest documents", { 
      checkInId, 
      checkInIdType: typeof checkInId,
      includeDeleted, 
      documentType,
      userId: authData.userID,
      orgId: authData.orgId 
    });

    try {
      // Simplified query without guestCheckinDB.raw() for testing
      const documents = await guestCheckinDB.queryAll`
        SELECT 
          id,
          document_type,
          filename,
          original_filename,
          file_size,
          mime_type,
          thumbnail_path,
          image_width,
          image_height,
          extracted_data,
          overall_confidence,
          extraction_status,
          is_verified,
          verified_by_user_id,
          verified_at,
          uploaded_by_user_id,
          created_at,
          updated_at,
          deleted_at
        FROM guest_documents
        WHERE guest_checkin_id = ${checkInId}
          AND org_id = ${authData.orgId}
          AND deleted_at IS NULL
        ORDER BY created_at ASC
      `;

      const formattedDocuments: GuestDocument[] = documents.map((doc: any) => ({
        id: doc.id,
        documentType: doc.document_type,
        filename: doc.filename,
        originalFilename: doc.original_filename,
        fileSize: doc.file_size,
        mimeType: doc.mime_type,
        thumbnailUrl: `/guest-checkin/documents/${doc.id}/thumbnail`,
        imageWidth: doc.image_width,
        imageHeight: doc.image_height,
        extractedData: doc.extracted_data,
        overallConfidence: doc.overall_confidence,
        extractionStatus: doc.extraction_status,
        isVerified: doc.is_verified,
        verifiedBy: doc.verified_by_user_id ? {
          userId: doc.verified_by_user_id,
          email: "user@example.com",
          verifiedAt: doc.verified_at,
        } : null,
        uploadedBy: {
          userId: doc.uploaded_by_user_id,
          email: "uploader@example.com",
        },
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
        deletedAt: doc.deleted_at,
      }));

      return {
        documents: formattedDocuments,
        total: formattedDocuments.length,
      };
    } catch (error: any) {
      log.error("Failed to list documents", { error: error.message, checkInId });
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to list documents");
    }
  }

export const listDocuments = api<ListDocumentsRequest, ListDocumentsResponse>(
  { expose: true, method: "GET", path: "/guest-checkin/:checkInId/documents", auth: true },
  listDocumentsHandler
);

export const listDocumentsV1 = api<ListDocumentsRequest, ListDocumentsResponse>(
  { expose: true, method: "GET", path: "/v1/guest-checkin/:checkInId/documents", auth: true },
  listDocumentsHandler
);

/**
 * Delete a document (soft delete by default)
 */
async function deleteDocumentHandler({ documentId, reason, hardDelete }: DeleteDocumentRequest): Promise<DeleteDocumentResponse> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    log.info("Deleting guest document", { documentId, userId: authData.userID, hardDelete });

    try {
      // Verify document exists and belongs to org
      const document = await guestCheckinDB.queryRow`
        SELECT id, uploaded_by_user_id, file_path, thumbnail_path, storage_location, bucket_key
        FROM guest_documents
        WHERE id = ${documentId} AND org_id = ${authData.orgId}
      `;

      if (!document) {
        throw APIError.notFound("Document not found");
      }

      // Check permissions - managers can only delete their own uploads
      if (authData.role === "MANAGER" && document.uploaded_by_user_id !== parseInt(authData.userID)) {
        throw APIError.permissionDenied("You can only delete documents you uploaded");
      }

      if (hardDelete && authData.role !== "ADMIN") {
        throw APIError.permissionDenied("Only admins can permanently delete documents");
      }

      let deletedAt: string;

      if (hardDelete) {
        // Hard delete - remove from database and storage
        await guestCheckinDB.exec`
          DELETE FROM guest_documents WHERE id = ${documentId}
        `;

        // Delete files from cloud or local storage
        try {
          if (document.storage_location === 'cloud' && document.bucket_key) {
            // Delete from Encore bucket
            await guestDocumentsBucket.remove(document.bucket_key);
          } else {
            // Delete from local disk
            deleteImageFromDisk(document.file_path, document.thumbnail_path);
          }
        } catch (error) {
          log.error('Failed to delete document files:', error);
          // Continue even if file deletion fails
        }
        
        deletedAt = new Date().toISOString();

        log.info("Document hard deleted", { documentId });
      } else {
        // Soft delete - mark as deleted
        const result = await guestCheckinDB.queryRow`
          UPDATE guest_documents
          SET 
            deleted_at = NOW(),
            deleted_by_user_id = ${parseInt(authData.userID)},
            updated_at = NOW()
          WHERE id = ${documentId}
          RETURNING deleted_at
        `;

        deletedAt = result!.deleted_at;

        log.info("Document soft deleted", { documentId, reason });
      }

      return {
        success: true,
        message: hardDelete ? "Document permanently deleted" : "Document deleted successfully",
        documentId,
        deletedAt,
      };
    } catch (error: any) {
      log.error("Failed to delete document", { error: error.message, documentId });
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to delete document");
    }
  }

export const deleteDocument = api<DeleteDocumentRequest, DeleteDocumentResponse>(
  { expose: true, method: "DELETE", path: "/guest-checkin/documents/:documentId", auth: true },
  deleteDocumentHandler
);

export const deleteDocumentV1 = api<DeleteDocumentRequest, DeleteDocumentResponse>(
  { expose: true, method: "DELETE", path: "/v1/guest-checkin/documents/:documentId", auth: true },
  deleteDocumentHandler
);

/**
 * Verify extracted document data
 */
async function verifyDocumentHandler({ documentId, correctedData, notes }: VerifyDocumentRequest): Promise<VerifyDocumentResponse> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    log.info("Verifying document", { documentId, userId: authData.userID });

    try {
      // Verify document exists
      const document = await guestCheckinDB.queryRow`
        SELECT id, extracted_data 
        FROM guest_documents
        WHERE id = ${documentId} AND org_id = ${authData.orgId} AND deleted_at IS NULL
      `;

      if (!document) {
        throw APIError.notFound("Document not found");
      }

      // If corrections provided, update extracted data
      let updatedExtractedData = document.extracted_data;
      if (correctedData) {
        updatedExtractedData = { ...document.extracted_data };
        for (const [field, value] of Object.entries(correctedData)) {
          if (updatedExtractedData[field]) {
            updatedExtractedData[field].value = value;
            updatedExtractedData[field].needsVerification = false;
          }
        }
      }

      // Mark as verified
      const result = await guestCheckinDB.queryRow`
        UPDATE guest_documents
        SET 
          is_verified = TRUE,
          verified_by_user_id = ${parseInt(authData.userID)},
          verified_at = NOW(),
          extracted_data = ${correctedData ? JSON.stringify(updatedExtractedData) : document.extracted_data}::jsonb,
          updated_at = NOW()
        WHERE id = ${documentId}
        RETURNING verified_at
      `;

      log.info("Document verified", { documentId, userId: authData.userID, hadCorrections: !!correctedData });

      return {
        success: true,
        message: "Document verified successfully",
        documentId,
        verifiedBy: {
          userId: parseInt(authData.userID),
          email: authData.email || "",
        },
        verifiedAt: result!.verified_at,
      };
    } catch (error: any) {
      log.error("Failed to verify document", { error: error.message, documentId });
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to verify document");
    }
  }

export const verifyDocument = api<VerifyDocumentRequest, VerifyDocumentResponse>(
  { expose: true, method: "POST", path: "/guest-checkin/documents/:documentId/verify", auth: true },
  verifyDocumentHandler
);

export const verifyDocumentV1 = api<VerifyDocumentRequest, VerifyDocumentResponse>(
  { expose: true, method: "POST", path: "/v1/guest-checkin/documents/:documentId/verify", auth: true },
  verifyDocumentHandler
);

/**
 * Retry failed extraction
 */
async function retryDocumentExtractionHandler({ documentId }: RetryExtractionRequest): Promise<RetryExtractionResponse> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    log.info("Retrying document extraction", { documentId });

    try {
      // Get document
      const document = await guestCheckinDB.queryRow`
        SELECT id, file_path, document_type, extraction_status
        FROM guest_documents
        WHERE id = ${documentId} AND org_id = ${authData.orgId} AND deleted_at IS NULL
      `;

      if (!document) {
        throw APIError.notFound("Document not found");
      }

      // Read file from disk
      if (!fileExists(document.file_path)) {
        throw APIError.notFound("Document file not found on disk");
      }

      const fileBuffer = fs.readFileSync(document.file_path);
      const base64Data = fileBuffer.toString("base64");

      // Update status to processing
      await guestCheckinDB.exec`
        UPDATE guest_documents
        SET extraction_status = 'processing'
        WHERE id = ${documentId}
      `;

      // Retry extraction
      const extractionResult = await extractFromDocument(
        base64Data,
        document.document_type,
        authData.orgId
      );

      // Update with results
      // Handle null/undefined confidence values - convert to 0 for database
      const confidenceValue = extractionResult.overallConfidence != null 
        ? extractionResult.overallConfidence 
        : 0;
        
      await guestCheckinDB.exec`
        UPDATE guest_documents
        SET 
          extracted_data = ${JSON.stringify(extractionResult.fields)}::jsonb,
          overall_confidence = ${confidenceValue},
          extraction_status = ${extractionResult.success ? 'completed' : 'failed'},
          extraction_error = ${extractionResult.error || null},
          extraction_processed_at = NOW()
        WHERE id = ${documentId}
      `;

      return {
        success: true,
        message: extractionResult.success 
          ? "Extraction retry successful" 
          : "Extraction retry failed",
        documentId,
        extractionStatus: extractionResult.success ? "completed" : "failed",
      };
    } catch (error: any) {
      log.error("Failed to retry extraction", { error: error.message, documentId });
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retry extraction");
    }
  }

export const retryDocumentExtraction = api<RetryExtractionRequest, RetryExtractionResponse>(
  { expose: true, method: "POST", path: "/guest-checkin/documents/:documentId/retry-extraction", auth: true },
  retryDocumentExtractionHandler
);

export const retryDocumentExtractionV1 = api<RetryExtractionRequest, RetryExtractionResponse>(
  { expose: true, method: "POST", path: "/v1/guest-checkin/documents/:documentId/retry-extraction", auth: true },
  retryDocumentExtractionHandler
);


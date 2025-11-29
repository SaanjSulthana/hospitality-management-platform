/**
 * Extract-Only Document API
 * Extracts data from documents WITHOUT storing them
 * Used for client-side document storage approach
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { extractFromDocument, detectDocumentType } from "./llm-service";
import { processImage, validateImage } from "./image-processor";
import { enhanceDocumentImage, analyzeImageQuality } from "./image-enhancer";
import log from "encore.dev/log";

export interface ExtractOnlyRequest {
  fileData: string; // Base64 encoded image
  documentType: string; // Document type hint
  filename: string;
  mimeType: string;
}

export interface ExtractOnlyResponse {
  success: boolean;
  extractedData: Record<string, {
    value: string;
    confidence: number;
    needsVerification: boolean;
  }>;
  overallConfidence: number;
  detectedDocumentType?: string;
  documentTypeConfidence?: number;
  processingTime: number;
  message: string;
}

/**
 * Extract data from document without storing it
 * Perfect for client-side storage approach - only extracts data for auto-fill
 */
async function extractDocumentDataOnlyHandler(req: ExtractOnlyRequest): Promise<ExtractOnlyResponse> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    const startTime = Date.now();

    log.info("Extracting document data (no storage)", {
      userId: authData.userID,
      documentType: req.documentType,
      filename: req.filename,
    });

    try {
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
      log.debug("Image quality analysis", {
        needsEnhancement: imageQuality.needsEnhancement,
        brightness: imageQuality.brightness,
        contrast: imageQuality.contrast,
      });

      // Enhance image if needed
      let enhancedBase64 = req.fileData;
      if (imageQuality.needsEnhancement) {
        log.debug("Enhancing image for better OCR");
        const enhancedBuffer = await enhanceDocumentImage(fileBuffer);
        enhancedBase64 = enhancedBuffer.toString('base64');
      }

      // Detect document type if needed
      let detectedDocumentType = req.documentType;
      let documentTypeConfidence = 100;

      if (req.documentType === 'other' || !req.documentType) {
        const detectionResult = await detectDocumentType(enhancedBase64, authData.orgId);
        detectedDocumentType = detectionResult.documentType;
        documentTypeConfidence = detectionResult.confidence;

        log.info("Document type auto-detected", {
          detectedType: detectedDocumentType,
          confidence: documentTypeConfidence,
          reasoning: detectionResult.reasoning,
        });
      }

      // Extract data using LLM
      const extractionResult = await extractFromDocument(
        enhancedBase64,
        detectedDocumentType as any,
        authData.orgId
      );

      const processingTime = Date.now() - startTime;

      // Handle null/undefined confidence values
      const overallConfidence = extractionResult.overallConfidence != null 
        ? extractionResult.overallConfidence 
        : 0;

      log.info("Extraction complete (no storage)", {
        success: extractionResult.success,
        overallConfidence,
        processingTime,
        fieldCount: Object.keys(extractionResult.fields).length,
      });

      return {
        success: extractionResult.success,
        extractedData: extractionResult.fields,
        overallConfidence,
        detectedDocumentType,
        documentTypeConfidence,
        processingTime,
        message: extractionResult.success 
          ? `Successfully extracted ${Object.keys(extractionResult.fields).length} fields`
          : extractionResult.error || "Extraction failed",
      };
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      log.error("Extraction failed (no storage)", { 
        error: error.message,
        processingTime 
      });

      if (error instanceof APIError) {
        throw error;
      }

      throw APIError.internal("Failed to extract document data");
    }
  }

// Legacy endpoint
export const extractDocumentDataOnly = api<ExtractOnlyRequest, ExtractOnlyResponse>(
  { expose: true, method: "POST", path: "/guest-checkin/documents/extract-only", auth: true },
  extractDocumentDataOnlyHandler
);

// V1 endpoint
export const extractDocumentDataOnlyV1 = api<ExtractOnlyRequest, ExtractOnlyResponse>(
  { expose: true, method: "POST", path: "/v1/guest-checkin/documents/extract-only", auth: true },
  extractDocumentDataOnlyHandler
);


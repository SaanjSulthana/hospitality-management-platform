/**
 * Document Statistics API
 * Provides analytics on document uploads and extraction success rates
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { guestCheckinDB } from "./db";
import { DocumentStatsResponse } from "./document-types";
import log from "encore.dev/log";

interface DocumentStatsRequest {
  startDate?: string;
  endDate?: string;
  propertyId?: number;
}

/**
 * Get document statistics
 */
export const getDocumentStats = api(
  { expose: true, method: "GET", path: "/guest-checkin/documents/stats", auth: true },
  async (req: DocumentStatsRequest): Promise<DocumentStatsResponse> => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    log.info("Getting document statistics", { userId: authData.userID, filters: req });

    try {
      // Total documents count
      let totalResult: any;
      
      if (req.propertyId && req.startDate && req.endDate) {
        totalResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND created_at <= ${req.endDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
      } else if (req.propertyId && req.startDate) {
        totalResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
      } else if (req.propertyId && req.endDate) {
        totalResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at <= ${req.endDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
      } else if (req.propertyId) {
        totalResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
      } else if (req.startDate && req.endDate) {
        totalResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND created_at <= ${req.endDate}::timestamptz
        `;
      } else if (req.startDate) {
        totalResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
        `;
      } else if (req.endDate) {
        totalResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at <= ${req.endDate}::timestamptz
        `;
      } else {
        totalResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_documents
          WHERE org_id = ${authData.orgId} AND deleted_at IS NULL
        `;
      }

      const totalDocuments = parseInt(totalResult?.total || '0');

      // Documents by type
      let byTypeResults: any[];
      
      if (req.propertyId && req.startDate && req.endDate) {
        byTypeResults = await guestCheckinDB.queryAll`
          SELECT document_type, COUNT(*) as count
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND created_at <= ${req.endDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
          GROUP BY document_type
        `;
      } else if (req.propertyId && req.startDate) {
        byTypeResults = await guestCheckinDB.queryAll`
          SELECT document_type, COUNT(*) as count
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
          GROUP BY document_type
        `;
      } else if (req.propertyId && req.endDate) {
        byTypeResults = await guestCheckinDB.queryAll`
          SELECT document_type, COUNT(*) as count
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at <= ${req.endDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
          GROUP BY document_type
        `;
      } else if (req.propertyId) {
        byTypeResults = await guestCheckinDB.queryAll`
          SELECT document_type, COUNT(*) as count
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
          GROUP BY document_type
        `;
      } else if (req.startDate && req.endDate) {
        byTypeResults = await guestCheckinDB.queryAll`
          SELECT document_type, COUNT(*) as count
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND created_at <= ${req.endDate}::timestamptz
          GROUP BY document_type
        `;
      } else if (req.startDate) {
        byTypeResults = await guestCheckinDB.queryAll`
          SELECT document_type, COUNT(*) as count
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
          GROUP BY document_type
        `;
      } else if (req.endDate) {
        byTypeResults = await guestCheckinDB.queryAll`
          SELECT document_type, COUNT(*) as count
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at <= ${req.endDate}::timestamptz
          GROUP BY document_type
        `;
      } else {
        byTypeResults = await guestCheckinDB.queryAll`
          SELECT document_type, COUNT(*) as count
          FROM guest_documents
          WHERE org_id = ${authData.orgId} AND deleted_at IS NULL
          GROUP BY document_type
        `;
      }

      const byDocumentType: Record<string, number> = {};
      byTypeResults.forEach((row: any) => {
        byDocumentType[row.document_type] = parseInt(row.count);
      });

      // Extraction statistics
      let extractionResults: any;
      
      if (req.propertyId && req.startDate && req.endDate) {
        extractionResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN extraction_status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN extraction_status = 'processing' THEN 1 END) as processing,
            COUNT(CASE WHEN extraction_status = 'failed' THEN 1 END) as failed,
            COUNT(CASE WHEN extraction_status = 'skipped' THEN 1 END) as skipped,
            AVG(CASE WHEN extraction_status = 'completed' THEN overall_confidence END) as avg_confidence,
            AVG(EXTRACT(EPOCH FROM (extraction_processed_at - created_at)) * 1000) as avg_processing_time
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND created_at <= ${req.endDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
      } else if (req.propertyId && req.startDate) {
        extractionResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN extraction_status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN extraction_status = 'processing' THEN 1 END) as processing,
            COUNT(CASE WHEN extraction_status = 'failed' THEN 1 END) as failed,
            COUNT(CASE WHEN extraction_status = 'skipped' THEN 1 END) as skipped,
            AVG(CASE WHEN extraction_status = 'completed' THEN overall_confidence END) as avg_confidence,
            AVG(EXTRACT(EPOCH FROM (extraction_processed_at - created_at)) * 1000) as avg_processing_time
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
      } else if (req.propertyId && req.endDate) {
        extractionResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN extraction_status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN extraction_status = 'processing' THEN 1 END) as processing,
            COUNT(CASE WHEN extraction_status = 'failed' THEN 1 END) as failed,
            COUNT(CASE WHEN extraction_status = 'skipped' THEN 1 END) as skipped,
            AVG(CASE WHEN extraction_status = 'completed' THEN overall_confidence END) as avg_confidence,
            AVG(EXTRACT(EPOCH FROM (extraction_processed_at - created_at)) * 1000) as avg_processing_time
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at <= ${req.endDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
      } else if (req.propertyId) {
        extractionResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN extraction_status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN extraction_status = 'processing' THEN 1 END) as processing,
            COUNT(CASE WHEN extraction_status = 'failed' THEN 1 END) as failed,
            COUNT(CASE WHEN extraction_status = 'skipped' THEN 1 END) as skipped,
            AVG(CASE WHEN extraction_status = 'completed' THEN overall_confidence END) as avg_confidence,
            AVG(EXTRACT(EPOCH FROM (extraction_processed_at - created_at)) * 1000) as avg_processing_time
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
      } else if (req.startDate && req.endDate) {
        extractionResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN extraction_status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN extraction_status = 'processing' THEN 1 END) as processing,
            COUNT(CASE WHEN extraction_status = 'failed' THEN 1 END) as failed,
            COUNT(CASE WHEN extraction_status = 'skipped' THEN 1 END) as skipped,
            AVG(CASE WHEN extraction_status = 'completed' THEN overall_confidence END) as avg_confidence,
            AVG(EXTRACT(EPOCH FROM (extraction_processed_at - created_at)) * 1000) as avg_processing_time
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND created_at <= ${req.endDate}::timestamptz
        `;
      } else if (req.startDate) {
        extractionResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN extraction_status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN extraction_status = 'processing' THEN 1 END) as processing,
            COUNT(CASE WHEN extraction_status = 'failed' THEN 1 END) as failed,
            COUNT(CASE WHEN extraction_status = 'skipped' THEN 1 END) as skipped,
            AVG(CASE WHEN extraction_status = 'completed' THEN overall_confidence END) as avg_confidence,
            AVG(EXTRACT(EPOCH FROM (extraction_processed_at - created_at)) * 1000) as avg_processing_time
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
        `;
      } else if (req.endDate) {
        extractionResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN extraction_status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN extraction_status = 'processing' THEN 1 END) as processing,
            COUNT(CASE WHEN extraction_status = 'failed' THEN 1 END) as failed,
            COUNT(CASE WHEN extraction_status = 'skipped' THEN 1 END) as skipped,
            AVG(CASE WHEN extraction_status = 'completed' THEN overall_confidence END) as avg_confidence,
            AVG(EXTRACT(EPOCH FROM (extraction_processed_at - created_at)) * 1000) as avg_processing_time
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at <= ${req.endDate}::timestamptz
        `;
      } else {
        extractionResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN extraction_status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN extraction_status = 'processing' THEN 1 END) as processing,
            COUNT(CASE WHEN extraction_status = 'failed' THEN 1 END) as failed,
            COUNT(CASE WHEN extraction_status = 'skipped' THEN 1 END) as skipped,
            AVG(CASE WHEN extraction_status = 'completed' THEN overall_confidence END) as avg_confidence,
            AVG(EXTRACT(EPOCH FROM (extraction_processed_at - created_at)) * 1000) as avg_processing_time
          FROM guest_documents
          WHERE org_id = ${authData.orgId} AND deleted_at IS NULL
        `;
      }

      // Verification statistics
      let verificationResults: any;
      let storageResults: any;
      
      if (req.propertyId && req.startDate && req.endDate) {
        verificationResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified,
            COUNT(CASE WHEN is_verified = FALSE AND extraction_status = 'completed' THEN 1 END) as needs_verification
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND created_at <= ${req.endDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
        storageResults = await guestCheckinDB.queryRow`
          SELECT 
            SUM(file_size) as total_size,
            AVG(file_size) as avg_size
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND created_at <= ${req.endDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
      } else if (req.propertyId && req.startDate) {
        verificationResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified,
            COUNT(CASE WHEN is_verified = FALSE AND extraction_status = 'completed' THEN 1 END) as needs_verification
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
        storageResults = await guestCheckinDB.queryRow`
          SELECT 
            SUM(file_size) as total_size,
            AVG(file_size) as avg_size
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
      } else if (req.propertyId && req.endDate) {
        verificationResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified,
            COUNT(CASE WHEN is_verified = FALSE AND extraction_status = 'completed' THEN 1 END) as needs_verification
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at <= ${req.endDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
        storageResults = await guestCheckinDB.queryRow`
          SELECT 
            SUM(file_size) as total_size,
            AVG(file_size) as avg_size
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at <= ${req.endDate}::timestamptz
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
      } else if (req.propertyId) {
        verificationResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified,
            COUNT(CASE WHEN is_verified = FALSE AND extraction_status = 'completed' THEN 1 END) as needs_verification
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
        storageResults = await guestCheckinDB.queryRow`
          SELECT 
            SUM(file_size) as total_size,
            AVG(file_size) as avg_size
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND guest_checkin_id IN (SELECT id FROM guest_checkins WHERE property_id = ${req.propertyId})
        `;
      } else if (req.startDate && req.endDate) {
        verificationResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified,
            COUNT(CASE WHEN is_verified = FALSE AND extraction_status = 'completed' THEN 1 END) as needs_verification
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND created_at <= ${req.endDate}::timestamptz
        `;
        storageResults = await guestCheckinDB.queryRow`
          SELECT 
            SUM(file_size) as total_size,
            AVG(file_size) as avg_size
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
            AND created_at <= ${req.endDate}::timestamptz
        `;
      } else if (req.startDate) {
        verificationResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified,
            COUNT(CASE WHEN is_verified = FALSE AND extraction_status = 'completed' THEN 1 END) as needs_verification
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
        `;
        storageResults = await guestCheckinDB.queryRow`
          SELECT 
            SUM(file_size) as total_size,
            AVG(file_size) as avg_size
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at >= ${req.startDate}::timestamptz
        `;
      } else if (req.endDate) {
        verificationResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified,
            COUNT(CASE WHEN is_verified = FALSE AND extraction_status = 'completed' THEN 1 END) as needs_verification
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at <= ${req.endDate}::timestamptz
        `;
        storageResults = await guestCheckinDB.queryRow`
          SELECT 
            SUM(file_size) as total_size,
            AVG(file_size) as avg_size
          FROM guest_documents
          WHERE org_id = ${authData.orgId} 
            AND deleted_at IS NULL
            AND created_at <= ${req.endDate}::timestamptz
        `;
      } else {
        verificationResults = await guestCheckinDB.queryRow`
          SELECT 
            COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified,
            COUNT(CASE WHEN is_verified = FALSE AND extraction_status = 'completed' THEN 1 END) as needs_verification
          FROM guest_documents
          WHERE org_id = ${authData.orgId} AND deleted_at IS NULL
        `;
        storageResults = await guestCheckinDB.queryRow`
          SELECT 
            SUM(file_size) as total_size,
            AVG(file_size) as avg_size
          FROM guest_documents
          WHERE org_id = ${authData.orgId} AND deleted_at IS NULL
        `;
      }

      const verified = parseInt(verificationResults?.verified || '0');
      const needsVerification = parseInt(verificationResults?.needs_verification || '0');
      const verificationRate = verified + needsVerification > 0
        ? (verified / (verified + needsVerification)) * 100
        : 0;

      const totalSizeBytes = parseInt(storageResults?.total_size || '0');

      return {
        totalDocuments,
        byDocumentType,
        extractionStats: {
          completed: parseInt(extractionResults?.completed || '0'),
          processing: parseInt(extractionResults?.processing || '0'),
          failed: parseInt(extractionResults?.failed || '0'),
          skipped: parseInt(extractionResults?.skipped || '0'),
          avgConfidence: Math.round(parseFloat(extractionResults?.avg_confidence || '0')),
          avgProcessingTime: Math.round(parseFloat(extractionResults?.avg_processing_time || '0')),
        },
        verificationStats: {
          verified,
          needsVerification,
          verificationRate: Math.round(verificationRate * 10) / 10,
        },
        storageStats: {
          totalSizeBytes,
          totalSizeMB: Math.round(totalSizeBytes / (1024 * 1024)),
          avgFileSizeBytes: Math.round(parseFloat(storageResults?.avg_size || '0')),
        },
      };
    } catch (error: any) {
      log.error("Failed to get document statistics", { error: error.message });
      throw APIError.internal("Failed to get statistics");
    }
  }
);


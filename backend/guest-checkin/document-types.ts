/**
 * TypeScript interfaces for Guest Document Management API
 */

import type { DocumentType, FieldExtraction } from "./llm-types";

// Upload Document Request
export interface UploadDocumentRequest {
  guestCheckInId?: number; // Optional if uploading before check-in created
  documentType: DocumentType;
  fileData: string; // Base64-encoded image
  filename: string; // Original filename
  mimeType: string;
  performExtraction?: boolean; // Default: true
}

// Upload Document Response
export interface UploadDocumentResponse {
  success: boolean;
  document: {
    id: number;
    documentType: string;
    filename: string;
    fileSize: number;
    thumbnailUrl: string;
    uploadedAt: string;
  };
  extraction: {
    status: "completed" | "processing" | "failed" | "skipped";
    data: Record<string, FieldExtraction>;
    overallConfidence: number;
    processingTime: number;
  };
  message: string;
}

// List Documents Response
export interface ListDocumentsResponse {
  documents: GuestDocument[];
  total: number;
}

export interface GuestDocument {
  id: number;
  documentType: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  thumbnailUrl: string;
  imageWidth: number;
  imageHeight: number;
  extractedData: Record<string, FieldExtraction> | null;
  overallConfidence: number | null;
  extractionStatus: "pending" | "processing" | "completed" | "failed" | "skipped";
  isVerified: boolean;
  verifiedBy: {
    userId: number;
    email: string;
    verifiedAt: string;
  } | null;
  uploadedBy: {
    userId: number;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// Get Document Request (path param)
export interface GetDocumentRequest {
  documentId: number;
}

// Get Document Response
export interface GetDocumentResponse {
  document: GuestDocument;
  signedUrl: string; // 1-hour expiring URL
}

// Delete Document Request
export interface DeleteDocumentRequest {
  documentId: number;
  reason?: string;
  hardDelete?: boolean; // Default: false (soft delete)
}

// Delete Document Response
export interface DeleteDocumentResponse {
  success: boolean;
  message: string;
  documentId: number;
  deletedAt: string;
}

// Verify Document Request
export interface VerifyDocumentRequest {
  documentId: number;
  correctedData?: Record<string, string>;
  notes?: string;
}

// Verify Document Response
export interface VerifyDocumentResponse {
  success: boolean;
  message: string;
  documentId: number;
  verifiedBy: {
    userId: number;
    email: string;
  };
  verifiedAt: string;
}

// Retry Extraction Request
export interface RetryExtractionRequest {
  documentId: number;
}

// Retry Extraction Response
export interface RetryExtractionResponse {
  success: boolean;
  message: string;
  documentId: number;
  extractionStatus: string;
}

// Document Statistics Response
export interface DocumentStatsResponse {
  totalDocuments: number;
  byDocumentType: Record<string, number>;
  extractionStats: {
    completed: number;
    processing: number;
    failed: number;
    skipped: number;
    avgConfidence: number;
    avgProcessingTime: number;
  };
  verificationStats: {
    verified: number;
    needsVerification: number;
    verificationRate: number;
  };
  storageStats: {
    totalSizeBytes: number;
    totalSizeMB: number;
    avgFileSizeBytes: number;
  };
}

// List Documents Request (query params)
export interface ListDocumentsRequest {
  checkInId: number;
  includeDeleted?: boolean;
  documentType?: string;
}


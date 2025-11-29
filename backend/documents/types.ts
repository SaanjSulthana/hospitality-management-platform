/**
 * Document Export Types
 * Type definitions for the document export microservice
 */

export type ExportType = 
  | 'daily-report' 
  | 'monthly-report' 
  | 'yearly-report'
  | 'staff-leave' 
  | 'staff-attendance' 
  | 'staff-salary';

export type ExportFormat = 'pdf' | 'xlsx';

export type ExportStatus = 
  | 'queued' 
  | 'processing' 
  | 'ready' 
  | 'failed' 
  | 'expired';

export interface DocumentExport {
  id: number;
  exportId: string;
  orgId: number;
  userId: number;
  exportType: ExportType;
  format: ExportFormat;
  status: ExportStatus;
  bucketKey: string | null;
  storageLocation: 'local' | 'cloud';
  fileSizeBytes: number | null;
  expiresAt: Date | null;
  metadata: Record<string, any>;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface ExportMetadata {
  // Common fields
  orgId: number;
  userId: number;
  generatedAt: Date;
  
  // Report-specific fields
  propertyId?: number;
  date?: string;
  startDate?: string;
  endDate?: string;
  year?: number;
  month?: number;
  
  // Staff export fields
  staffId?: number;
  leaveType?: string;
  status?: string;
  includeBalance?: boolean;
  includePayslips?: boolean;
  includeComponents?: boolean;
}

export interface RenderContext {
  exportType: ExportType;
  format: ExportFormat;
  data: any;
  metadata: ExportMetadata;
  templateName?: string;
}

export interface RenderResult {
  buffer: Buffer;
  fileSizeBytes: number;
  mimeType: string;
}


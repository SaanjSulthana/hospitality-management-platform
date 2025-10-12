/**
 * Audit Logging Types
 * TypeScript interfaces for audit trail functionality
 */

export type AuditActionType =
  | "create_checkin"
  | "update_checkin"
  | "delete_checkin"
  | "checkout_guest"
  | "view_guest_details"
  | "upload_document"
  | "view_documents"
  | "view_document"
  | "download_document"
  | "delete_document"
  | "verify_document"
  | "query_audit_logs"
  | "export_audit_logs"
  | "unauthorized_access_attempt";

export type AuditResourceType = "guest_checkin" | "guest_document" | "audit_log";

export interface AuditLogEntry {
  id: number;
  orgId: number;
  userId: number;
  userEmail: string;
  userRole: string;
  actionType: AuditActionType;
  resourceType: AuditResourceType;
  resourceId: number | null;
  guestCheckInId: number | null;
  guestName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  actionDetails: Record<string, any>;
  success: boolean;
  errorMessage: string | null;
  timestamp: Date;
  durationMs: number | null;
}

export interface CreateAuditLogRequest {
  actionType: AuditActionType;
  resourceType: AuditResourceType;
  resourceId?: number;
  guestCheckInId?: number;
  guestName?: string;
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestPath?: string;
  actionDetails?: Record<string, any>;
  success?: boolean;
  errorMessage?: string;
  durationMs?: number;
}

export interface ListAuditLogsRequest {
  startDate?: string;
  endDate?: string;
  userId?: number;
  guestCheckInId?: number;
  actionType?: string;
  resourceType?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListAuditLogsResponse {
  logs: Array<{
    id: number;
    timestamp: string;
    user: {
      id: number;
      email: string;
      role: string;
    };
    action: {
      type: string;
      resourceType: string;
      resourceId: number | null;
    };
    guest: {
      checkInId: number | null;
      name: string | null;
    };
    context: {
      ipAddress: string;
      userAgent: string;
      requestMethod: string;
      requestPath: string;
    };
    details: Record<string, any>;
    success: boolean;
    errorMessage: string | null;
    durationMs: number | null;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface AuditLogDetailResponse {
  log: {
    id: number;
    timestamp: string;
    user: {
      id: number;
      email: string;
      role: string;
      displayName?: string;
    };
    action: {
      type: string;
      resourceType: string;
      resourceId: number | null;
    };
    guest: {
      checkInId: number | null;
      name: string | null;
      email?: string | null;
      phone?: string | null;
    };
    context: {
      ipAddress: string;
      userAgent: string;
      requestMethod: string;
      requestPath: string;
    };
    details: Record<string, any>;
    success: boolean;
    errorMessage: string | null;
    durationMs: number | null;
  };
}

export interface AuditSummaryResponse {
  totalActions: number;
  byActionType: Record<string, number>;
  byUser: Array<{
    userId: number;
    email: string;
    totalActions: number;
    mostCommonAction: string;
  }>;
  securityAlerts: {
    unauthorizedAttempts: number;
    failedActions: number;
    unusualActivity: Array<{
      userId: number;
      issue: string;
      count: number;
    }>;
  };
}


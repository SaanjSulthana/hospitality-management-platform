/**
 * Lightweight Audit Action Logging Endpoints
 * For frontend-triggered audit events that don't have dedicated backend endpoints
 * These are fire-and-forget async calls that track user monitoring actions
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { createAuditLog } from "./audit-middleware";
import { guestCheckinDB } from "./db";
import log from "encore.dev/log";

interface LogViewDocumentsRequest {
  guestCheckInId: number;
  documentCount?: number;
}

interface LogViewGuestDetailsRequest {
  guestCheckInId: number;
}

interface AuditActionResponse {
  logged: boolean;
  message: string;
}

/**
 * Log when a user views guest documents
 * Called from frontend when document viewer is opened
 */
async function logViewDocumentsHandler(req: LogViewDocumentsRequest): Promise<AuditActionResponse> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER", "STAFF")(authData);

    try {
      // Fetch guest name for audit trail
      const checkIn = await guestCheckinDB.queryRow`
        SELECT full_name FROM guest_checkins 
        WHERE id = ${req.guestCheckInId} AND org_id = ${authData.orgId}
      `;

      if (!checkIn) {
        throw APIError.notFound("Guest check-in not found");
      }

      await createAuditLog({
        actionType: "view_documents",
        resourceType: "guest_checkin",
        guestCheckInId: req.guestCheckInId,
        guestName: checkIn.full_name,
        actionDetails: { 
          documentCount: req.documentCount || 0,
          action: "Viewed guest documents in document viewer"
        },
      });

      log.info("Audit log created: view_documents", {
        userId: authData.userID,
        guestCheckInId: req.guestCheckInId,
        documentCount: req.documentCount,
      });

      return {
        logged: true,
        message: "Document view logged successfully",
      };
    } catch (error: any) {
      log.error("Failed to log view documents action", { error: error.message });
      // Don't fail the main action if audit logging fails
      return {
        logged: false,
        message: "Audit logging failed but action completed",
      };
    }
  }

// Legacy endpoint
export const logViewDocuments = api<LogViewDocumentsRequest, AuditActionResponse>(
  { expose: true, method: "POST", path: "/guest-checkin/audit/view-documents", auth: true },
  logViewDocumentsHandler
);

// V1 endpoint
export const logViewDocumentsV1 = api<LogViewDocumentsRequest, AuditActionResponse>(
  { expose: true, method: "POST", path: "/v1/guest-checkin/audit/view-documents", auth: true },
  logViewDocumentsHandler
);

/**
 * Log when a user views guest details modal
 * Called from frontend when guest details modal is opened
 */
async function logViewGuestDetailsHandler(req: LogViewGuestDetailsRequest): Promise<AuditActionResponse> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER", "STAFF")(authData);

    try {
      // Fetch guest details for audit trail
      const checkIn = await guestCheckinDB.queryRow`
        SELECT full_name, email, phone FROM guest_checkins 
        WHERE id = ${req.guestCheckInId} AND org_id = ${authData.orgId}
      `;

      if (!checkIn) {
        throw APIError.notFound("Guest check-in not found");
      }

      await createAuditLog({
        actionType: "view_guest_details",
        resourceType: "guest_checkin",
        guestCheckInId: req.guestCheckInId,
        guestName: checkIn.full_name,
        actionDetails: {
          guestEmail: checkIn.email,
          guestPhone: checkIn.phone,
          action: "Viewed detailed guest information in modal"
        },
      });

      log.info("Audit log created: view_guest_details", {
        userId: authData.userID,
        guestCheckInId: req.guestCheckInId,
        guestName: checkIn.full_name,
      });

      return {
        logged: true,
        message: "Guest details view logged successfully",
      };
    } catch (error: any) {
      log.error("Failed to log view guest details action", { error: error.message });
      // Don't fail the main action if audit logging fails
      return {
        logged: false,
        message: "Audit logging failed but action completed",
      };
    }
  }

// Legacy endpoint
export const logViewGuestDetails = api<LogViewGuestDetailsRequest, AuditActionResponse>(
  { expose: true, method: "POST", path: "/guest-checkin/audit/view-guest-details", auth: true },
  logViewGuestDetailsHandler
);

// V1 endpoint
export const logViewGuestDetailsV1 = api<LogViewGuestDetailsRequest, AuditActionResponse>(
  { expose: true, method: "POST", path: "/v1/guest-checkin/audit/view-guest-details", auth: true },
  logViewGuestDetailsHandler
);


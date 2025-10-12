/**
 * Audit Logging Middleware
 * Automatically logs all actions performed on guest check-ins and documents
 */

import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import type { AuditActionType, AuditResourceType, CreateAuditLogRequest } from "./audit-types";
import log from "encore.dev/log";

/**
 * Create an audit log entry
 */
export async function createAuditLog(request: CreateAuditLogRequest): Promise<void> {
  try {
    const authData = getAuthData();
    
    if (!authData) {
      log.warn("Attempted to create audit log without auth data");
      return;
    }

    await guestCheckinDB.exec`
      INSERT INTO guest_audit_logs (
        org_id,
        user_id,
        user_email,
        user_role,
        action_type,
        resource_type,
        resource_id,
        guest_checkin_id,
        guest_name,
        ip_address,
        user_agent,
        request_method,
        request_path,
        action_details,
        success,
        error_message,
        duration_ms
      ) VALUES (
        ${authData.orgId},
        ${parseInt(authData.userID)},
        ${authData.email || 'unknown'},
        ${authData.role},
        ${request.actionType},
        ${request.resourceType},
        ${request.resourceId || null},
        ${request.guestCheckInId || null},
        ${request.guestName || null},
        ${request.ipAddress || null},
        ${request.userAgent || null},
        ${request.requestMethod || null},
        ${request.requestPath || null},
        ${request.actionDetails ? JSON.stringify(request.actionDetails) : null}::jsonb,
        ${request.success !== false},
        ${request.errorMessage || null},
        ${request.durationMs || null}
      )
    `;

    log.info("Audit log created", {
      actionType: request.actionType,
      resourceId: request.resourceId,
      userId: authData.userID,
    });
  } catch (error: any) {
    // Don't fail the main operation if audit logging fails
    log.error("Failed to create audit log", { error: error.message, request });
  }
}

/**
 * Audit log wrapper for API endpoints
 * Usage: export const myEndpoint = auditLog('action_type', 'resource_type')(actualHandler);
 */
export function auditLog(
  actionType: AuditActionType,
  resourceType: AuditResourceType,
  getResourceId?: (params: any) => number,
  getGuestCheckInId?: (params: any) => number | Promise<number>,
  getAdditionalDetails?: (params: any, result: any) => Record<string, any>
) {
  return function <TRequest, TResponse>(
    handler: (req: TRequest) => Promise<TResponse>
  ): (req: TRequest) => Promise<TResponse> {
    return async (req: TRequest): Promise<TResponse> => {
      const startTime = Date.now();
      let success = true;
      let errorMessage: string | null = null;
      let result: TResponse | null = null;
      let guestName: string | null = null;

      try {
        // Execute the actual handler
        result = await handler(req);
        success = true;

        // Try to get guest name if guestCheckInId is available
        if (getGuestCheckInId) {
          const guestCheckInId = await Promise.resolve(getGuestCheckInId(req));
          if (guestCheckInId) {
            const guest = await guestCheckinDB.queryRow`
              SELECT full_name FROM guest_checkins WHERE id = ${guestCheckInId}
            `;
            guestName = guest?.full_name || null;
          }
        }

        return result;
      } catch (error: any) {
        success = false;
        errorMessage = error.message || "Unknown error";
        throw error; // Re-throw to maintain original behavior
      } finally {
        const durationMs = Date.now() - startTime;

        // Create audit log (async, non-blocking)
        setImmediate(async () => {
          await createAuditLog({
            actionType,
            resourceType,
            resourceId: getResourceId ? getResourceId(req) : undefined,
            guestCheckInId: getGuestCheckInId ? await Promise.resolve(getGuestCheckInId(req)) : undefined,
            guestName: guestName || undefined,
            actionDetails: getAdditionalDetails && result 
              ? getAdditionalDetails(req, result) 
              : undefined,
            success,
            errorMessage: errorMessage || undefined,
            durationMs,
          });
        });
      }
    };
  };
}

/**
 * Log document view action
 */
export async function logDocumentView(
  documentId: number,
  guestCheckInId: number,
  viewDuration?: number
): Promise<void> {
  const authData = getAuthData();
  if (!authData) return;

  await createAuditLog({
    actionType: "view_document",
    resourceType: "guest_document",
    resourceId: documentId,
    guestCheckInId,
    actionDetails: { documentId, viewDuration },
  });
}

/**
 * Log document download action
 */
export async function logDocumentDownload(
  documentId: number,
  guestCheckInId: number,
  filename: string
): Promise<void> {
  const authData = getAuthData();
  if (!authData) return;

  await createAuditLog({
    actionType: "download_document",
    resourceType: "guest_document",
    resourceId: documentId,
    guestCheckInId,
    actionDetails: { documentId, filename },
  });
}

/**
 * Log unauthorized access attempt
 */
export async function logUnauthorizedAccess(
  attemptedAction: string,
  resourceId?: number,
  guestCheckInId?: number
): Promise<void> {
  const authData = getAuthData();
  if (!authData) return;

  await createAuditLog({
    actionType: "unauthorized_access_attempt",
    resourceType: "guest_checkin",
    resourceId,
    guestCheckInId,
    actionDetails: { attemptedAction, deniedReason: "insufficient_permissions" },
    success: false,
    errorMessage: "Access denied",
  });
}


/**
 * Audit Log Management API
 * Endpoints for querying, viewing, and exporting audit logs
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { guestCheckinDB } from "./db";
import { createAuditLog } from "./audit-middleware";
import type {
  ListAuditLogsRequest,
  ListAuditLogsResponse,
  AuditLogDetailResponse,
  AuditSummaryResponse,
} from "./audit-types";
import log from "encore.dev/log";

const normalizeAuditDate = (value?: string): Date | undefined => {
  if (!value) return undefined;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const normalized = value.replace(/\//g, "-");
  const segments = normalized.split("-");
  if (segments.length === 3) {
    const [a, b, c] = segments;
    const candidate =
      a.length === 4
        ? `${a}-${b}-${c}`
        : `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;

    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  log.warn("Unable to parse audit log date filter", { value });
  return undefined;
};

/**
 * List audit logs with filtering
 */
async function listAuditLogsHandler(req: ListAuditLogsRequest): Promise<ListAuditLogsResponse> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER", "OWNER")(authData);

    log.info("Listing audit logs", { userId: authData.userID, filters: req });

    const startDate = normalizeAuditDate(req.startDate);
    const endDate = normalizeAuditDate(req.endDate);

    // Note: We don't log "query_audit_logs" to avoid noise in the audit trail
    // Querying audit logs is a read-only operation and doesn't need to be audited

    try {
      const limit = Math.min(req.limit || 50, 200);
      const offset = req.offset || 0;

      // Get total count - simplified to only date filters
      let countResult: any;
      let logs: any[];
      
      if (startDate && endDate) {
        countResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
            AND timestamp <= ${endDate}
        `;
        
        logs = await guestCheckinDB.queryAll`
          SELECT 
            id, timestamp, user_id, user_email, user_role,
            action_type, resource_type, resource_id, guest_checkin_id,
            guest_name, ip_address, user_agent, request_method, request_path,
            action_details, success, error_message, duration_ms
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
            AND timestamp <= ${endDate}
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (startDate) {
        countResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
        `;
        
        logs = await guestCheckinDB.queryAll`
          SELECT 
            id, timestamp, user_id, user_email, user_role,
            action_type, resource_type, resource_id, guest_checkin_id,
            guest_name, ip_address, user_agent, request_method, request_path,
            action_details, success, error_message, duration_ms
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (endDate) {
        countResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp <= ${endDate}
        `;
        
        logs = await guestCheckinDB.queryAll`
          SELECT 
            id, timestamp, user_id, user_email, user_role,
            action_type, resource_type, resource_id, guest_checkin_id,
            guest_name, ip_address, user_agent, request_method, request_path,
            action_details, success, error_message, duration_ms
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp <= ${endDate}
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        countResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
        `;
        
        logs = await guestCheckinDB.queryAll`
          SELECT 
            id, timestamp, user_id, user_email, user_role,
            action_type, resource_type, resource_id, guest_checkin_id,
            guest_name, ip_address, user_agent, request_method, request_path,
            action_details, success, error_message, duration_ms
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
      
      // Apply post-query filters for other parameters (userId, guestCheckInId, actionType, resourceType, success)
      // This is not ideal but necessary due to Encore's static SQL constraints
      let filteredLogs = logs;
      if (req.userId) {
        filteredLogs = filteredLogs.filter((log: any) => log.user_id === req.userId);
      }
      if (req.guestCheckInId) {
        filteredLogs = filteredLogs.filter((log: any) => log.guest_checkin_id === req.guestCheckInId);
      }
      if (req.actionType) {
        filteredLogs = filteredLogs.filter((log: any) => log.action_type === req.actionType);
      }
      if (req.resourceType) {
        filteredLogs = filteredLogs.filter((log: any) => log.resource_type === req.resourceType);
      }
      if (req.success !== undefined) {
        filteredLogs = filteredLogs.filter((log: any) => log.success === req.success);
      }

      const total = parseInt(countResult?.total || '0');

      const formattedLogs = filteredLogs.map((log: any) => ({
        id: log.id,
        timestamp: log.timestamp,
        user: {
          id: log.user_id,
          email: log.user_email,
          role: log.user_role,
        },
        action: {
          type: log.action_type,
          resourceType: log.resource_type,
          resourceId: log.resource_id,
        },
        guest: {
          checkInId: log.guest_checkin_id,
          name: log.guest_name,
        },
        context: {
          ipAddress: log.ip_address || "",
          userAgent: log.user_agent || "",
          requestMethod: log.request_method || "",
          requestPath: log.request_path || "",
        },
        details: log.action_details || {},
        success: log.success,
        errorMessage: log.error_message,
        durationMs: log.duration_ms,
      }));

      return {
        logs: formattedLogs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (error: any) {
      log.error("Failed to list audit logs", { error: error.message });
      throw APIError.internal("Failed to list audit logs");
    }
  }

// Legacy endpoint
export const listAuditLogs = api<ListAuditLogsRequest, ListAuditLogsResponse>(
  { expose: true, method: "GET", path: "/guest-checkin/audit-logs", auth: true },
  listAuditLogsHandler
);

// V1 endpoint
export const listAuditLogsV1 = api<ListAuditLogsRequest, ListAuditLogsResponse>(
  { expose: true, method: "GET", path: "/v1/guest-checkin/audit-logs", auth: true },
  listAuditLogsHandler
);

/**
 * Get detailed audit log entry
 */
async function getAuditLogDetailHandler({ logId }: { logId: number }): Promise<AuditLogDetailResponse> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER", "OWNER")(authData);

    try {
      const logEntry = await guestCheckinDB.queryRow`
        SELECT 
          l.*,
          gc.email as guest_email,
          gc.phone as guest_phone
        FROM guest_audit_logs l
        LEFT JOIN guest_checkins gc ON l.guest_checkin_id = gc.id
        WHERE l.id = ${logId} AND l.org_id = ${authData.orgId}
      `;

      if (!logEntry) {
        throw APIError.notFound("Audit log entry not found");
      }

      return {
        log: {
          id: logEntry.id,
          timestamp: logEntry.timestamp,
          user: {
            id: logEntry.user_id,
            email: logEntry.user_email,
            role: logEntry.user_role,
          },
          action: {
            type: logEntry.action_type,
            resourceType: logEntry.resource_type,
            resourceId: logEntry.resource_id,
          },
          guest: {
            checkInId: logEntry.guest_checkin_id,
            name: logEntry.guest_name,
            email: logEntry.guest_email,
            phone: logEntry.guest_phone,
          },
          context: {
            ipAddress: logEntry.ip_address || "",
            userAgent: logEntry.user_agent || "",
            requestMethod: logEntry.request_method || "",
            requestPath: logEntry.request_path || "",
          },
          details: logEntry.action_details || {},
          success: logEntry.success,
          errorMessage: logEntry.error_message,
          durationMs: logEntry.duration_ms,
        },
      };
    } catch (error: any) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to get audit log details");
    }
  }

// Legacy endpoint
export const getAuditLogDetail = api<{ logId: number }, AuditLogDetailResponse>(
  { expose: true, method: "GET", path: "/guest-checkin/audit-logs/:logId", auth: true },
  getAuditLogDetailHandler
);

// V1 endpoint
export const getAuditLogDetailV1 = api<{ logId: number }, AuditLogDetailResponse>(
  { expose: true, method: "GET", path: "/v1/guest-checkin/audit-logs/:logId", auth: true },
  getAuditLogDetailHandler
);

/**
 * Get audit summary for security monitoring
 */
async function getAuditSummaryHandler(req: { startDate?: string; endDate?: string }): Promise<AuditSummaryResponse> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "OWNER")(authData);

    log.info("Getting audit summary", { userId: authData.userID });

    const startDate = normalizeAuditDate(req.startDate);
    const endDate = normalizeAuditDate(req.endDate);

    try {
      // Queries simplified for Encore's static SQL requirements
      let totalResult: any;
      let byActionResults: any[];
      let byUserResults: any[];
      let unauthorizedResult: any;
      let failedResult: any;
      
      if (startDate && endDate) {
        totalResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
            AND timestamp <= ${endDate}
        `;
        
        byActionResults = await guestCheckinDB.queryAll`
          SELECT action_type, COUNT(*) as count
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
            AND timestamp <= ${endDate}
          GROUP BY action_type
          ORDER BY count DESC
        `;
        
        byUserResults = await guestCheckinDB.queryAll`
          SELECT 
            user_id, user_email,
            COUNT(*) as total_actions,
            MODE() WITHIN GROUP (ORDER BY action_type) as most_common_action
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
            AND timestamp <= ${endDate}
          GROUP BY user_id, user_email
          ORDER BY total_actions DESC
          LIMIT 10
        `;
        
        unauthorizedResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as count
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
            AND timestamp <= ${endDate}
            AND action_type = 'unauthorized_access_attempt'
        `;
        
        failedResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as count
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
            AND timestamp <= ${endDate}
            AND success = FALSE
        `;
      } else if (startDate) {
        totalResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
        `;
        
        byActionResults = await guestCheckinDB.queryAll`
          SELECT action_type, COUNT(*) as count
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
          GROUP BY action_type
          ORDER BY count DESC
        `;
        
        byUserResults = await guestCheckinDB.queryAll`
          SELECT 
            user_id, user_email,
            COUNT(*) as total_actions,
            MODE() WITHIN GROUP (ORDER BY action_type) as most_common_action
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
          GROUP BY user_id, user_email
          ORDER BY total_actions DESC
          LIMIT 10
        `;
        
        unauthorizedResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as count
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
            AND action_type = 'unauthorized_access_attempt'
        `;
        
        failedResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as count
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
            AND success = FALSE
        `;
      } else if (endDate) {
        totalResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp <= ${endDate}
        `;
        
        byActionResults = await guestCheckinDB.queryAll`
          SELECT action_type, COUNT(*) as count
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp <= ${endDate}
          GROUP BY action_type
          ORDER BY count DESC
        `;
        
        byUserResults = await guestCheckinDB.queryAll`
          SELECT 
            user_id, user_email,
            COUNT(*) as total_actions,
            MODE() WITHIN GROUP (ORDER BY action_type) as most_common_action
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp <= ${endDate}
          GROUP BY user_id, user_email
          ORDER BY total_actions DESC
          LIMIT 10
        `;
        
        unauthorizedResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as count
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp <= ${endDate}
            AND action_type = 'unauthorized_access_attempt'
        `;
        
        failedResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as count
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp <= ${endDate}
            AND success = FALSE
        `;
      } else {
        totalResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as total
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
        `;
        
        byActionResults = await guestCheckinDB.queryAll`
          SELECT action_type, COUNT(*) as count
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
          GROUP BY action_type
          ORDER BY count DESC
        `;
        
        byUserResults = await guestCheckinDB.queryAll`
          SELECT 
            user_id, user_email,
            COUNT(*) as total_actions,
            MODE() WITHIN GROUP (ORDER BY action_type) as most_common_action
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
          GROUP BY user_id, user_email
          ORDER BY total_actions DESC
          LIMIT 10
        `;
        
        unauthorizedResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as count
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND action_type = 'unauthorized_access_attempt'
        `;
        
        failedResult = await guestCheckinDB.queryRow`
          SELECT COUNT(*) as count
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND success = FALSE
        `;
      }

      const byActionType: Record<string, number> = {};
      byActionResults.forEach((row: any) => {
        byActionType[row.action_type] = parseInt(row.count);
      });

      const byUser = byUserResults.map((row: any) => ({
        userId: row.user_id,
        email: row.user_email,
        totalActions: parseInt(row.total_actions),
        mostCommonAction: row.most_common_action,
      }));

      return {
        totalActions: parseInt(totalResult?.total || '0'),
        byActionType,
        byUser,
        securityAlerts: {
          unauthorizedAttempts: parseInt(unauthorizedResult?.count || '0'),
          failedActions: parseInt(failedResult?.count || '0'),
          unusualActivity: [],
        },
      };
    } catch (error: any) {
      log.error("Failed to get audit summary", { error: error.message });
      throw APIError.internal("Failed to get audit summary");
    }
  }

// Legacy endpoint
export const getAuditSummary = api<{}, AuditSummaryResponse>(
  { expose: true, method: "GET", path: "/guest-checkin/audit-logs/summary", auth: true },
  getAuditSummaryHandler
);

// V1 endpoint
export const getAuditSummaryV1 = api<{}, AuditSummaryResponse>(
  { expose: true, method: "GET", path: "/v1/guest-checkin/audit-logs/summary", auth: true },
  getAuditSummaryHandler
);

/**
 * Export audit logs to CSV
 */
async function exportAuditLogsHandler(req: ListAuditLogsRequest): Promise<{ csv: string; filename: string }> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "OWNER")(authData);

    log.info("Exporting audit logs", { userId: authData.userID });

    const startDate = normalizeAuditDate(req.startDate);
    const endDate = normalizeAuditDate(req.endDate);

    // Log export action
    await createAuditLog({
      actionType: "export_audit_logs",
      resourceType: "audit_log",
      actionDetails: { filters: req },
    });

    try {
      // Queries simplified for Encore's static SQL requirements
      let logs: any[];
      
      if (startDate && endDate) {
        logs = await guestCheckinDB.queryAll`
          SELECT 
            timestamp, user_email, user_role, action_type, resource_type,
            resource_id, guest_name, ip_address, success, duration_ms
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
            AND timestamp <= ${endDate}
          ORDER BY timestamp DESC
          LIMIT 10000
        `;
      } else if (startDate) {
        logs = await guestCheckinDB.queryAll`
          SELECT 
            timestamp, user_email, user_role, action_type, resource_type,
            resource_id, guest_name, ip_address, success, duration_ms
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp >= ${startDate}
          ORDER BY timestamp DESC
          LIMIT 10000
        `;
      } else if (endDate) {
        logs = await guestCheckinDB.queryAll`
          SELECT 
            timestamp, user_email, user_role, action_type, resource_type,
            resource_id, guest_name, ip_address, success, duration_ms
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
            AND timestamp <= ${endDate}
          ORDER BY timestamp DESC
          LIMIT 10000
        `;
      } else {
        logs = await guestCheckinDB.queryAll`
          SELECT 
            timestamp, user_email, user_role, action_type, resource_type,
            resource_id, guest_name, ip_address, success, duration_ms
          FROM guest_audit_logs
          WHERE org_id = ${authData.orgId}
          ORDER BY timestamp DESC
          LIMIT 10000
        `;
      }

      // Generate CSV
      const headers = [
        "Timestamp",
        "User Email",
        "User Role",
        "Action Type",
        "Resource Type",
        "Resource ID",
        "Guest Name",
        "IP Address",
        "Success",
        "Duration (ms)",
      ];

      const rows = logs.map((log: any) => [
        log.timestamp,
        log.user_email,
        log.user_role,
        log.action_type,
        log.resource_type,
        log.resource_id || "",
        log.guest_name || "",
        log.ip_address || "",
        log.success ? "true" : "false",
        log.duration_ms || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      const filename = `audit_logs_${req.startDate || 'all'}_${req.endDate || 'all'}.csv`;

      return {
        csv: csvContent,
        filename,
      };
    } catch (error: any) {
      log.error("Failed to export audit logs", { error: error.message });
      throw APIError.internal("Failed to export audit logs");
    }
  }

// Legacy endpoint
export const exportAuditLogs = api<ListAuditLogsRequest, { csv: string; filename: string }>(
  { expose: true, method: "GET", path: "/guest-checkin/audit-logs/export", auth: true },
  exportAuditLogsHandler
);

// V1 endpoint
export const exportAuditLogsV1 = api<ListAuditLogsRequest, { csv: string; filename: string }>(
  { expose: true, method: "GET", path: "/v1/guest-checkin/audit-logs/export", auth: true },
  exportAuditLogsHandler
);


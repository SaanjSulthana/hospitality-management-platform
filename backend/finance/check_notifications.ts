import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

interface CheckNotificationsRequest {
  lastChecked?: Date;
  limit?: number;
  types?: string[]; // Filter by notification types
}

export interface NotificationInfo {
  id: number;
  type: string;
  payload: any;
  createdAt: Date;
  readAt?: Date;
}

export interface CheckNotificationsResponse {
  notifications: NotificationInfo[];
  hasNewNotifications: boolean;
  lastChecked: Date;
  summary: {
    total: number;
    unread: number;
    byType: Record<string, number>;
  };
}

// Shared handler for checking notifications
async function checkNotificationsHandler(req: CheckNotificationsRequest): Promise<CheckNotificationsResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

  const { lastChecked, limit = 20, types } = req || {};

  try {
    let lastCheckedFilter = '';
    if (lastChecked) {
      lastCheckedFilter = ` AND n.created_at > $4`;
    }

    let typesFilter = '';
    if (types && types.length > 0) {
      const typePlaceholders = types.map((_, i) => `$${i + 4}`).join(',');
      typesFilter = ` AND n.type IN (${typePlaceholders})`;
    }

    // Get notifications for the user
    const notifications = await financeDB.rawQueryAll(`
      SELECT 
        n.id, n.type, n.payload_json, n.created_at, n.read_at
      FROM notifications n
      WHERE n.org_id = $1 AND n.user_id = $2
        ${lastCheckedFilter}
        ${typesFilter}
      ORDER BY n.created_at DESC
      LIMIT $3
    `, authData.orgId, parseInt(authData.userID), limit);

    // Calculate summary statistics
    const summary = {
      total: notifications.length,
      unread: notifications.filter(n => !n.read_at).length,
      byType: notifications.reduce((acc: Record<string, number>, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {}),
    };

    const hasNewNotifications = summary.unread > 0;

    return {
      notifications: notifications.map((n: any, i: number) => ({
        id: n.id,
        type: n.type,
        payload: n.payload_json,
        createdAt: n.created_at,
        readAt: n.read_at,
      })),
      hasNewNotifications,
      lastChecked: new Date(),
      summary,
    };
  } catch (error) {
    console.error('Check notifications error:', error);
    throw new Error('Failed to check notifications');
  }
}

// LEGACY: Enhanced notification system for all real-time updates (keep for backward compatibility)
export const checkNotifications = api<CheckNotificationsRequest, CheckNotificationsResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/notifications" },
  checkNotificationsHandler
);

// V1: Enhanced notification system for all real-time updates
export const checkNotificationsV1 = api<CheckNotificationsRequest, CheckNotificationsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/notifications" },
  checkNotificationsHandler
);

// Shared handler for marking notifications as read
async function markNotificationsReadHandler(req: { notificationIds: number[] }): Promise<{ success: boolean }> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

  const { notificationIds } = req;

  try {
    if (notificationIds.length === 0) {
      return { success: true };
    }

    const placeholders = notificationIds.map((_, i) => `$${i + 3}`).join(',');
    const query = `
      UPDATE notifications 
      SET read_at = NOW() 
      WHERE org_id = $1 
        AND user_id = $2 
        AND id IN (${placeholders})
    `;

    const params = [authData.orgId, parseInt(authData.userID), ...notificationIds];
    await financeDB.rawExec(query, ...params);

    return { success: true };
  } catch (error) {
    console.error('Mark notifications read error:', error);
    throw new Error('Failed to mark notifications as read');
  }
}

// LEGACY: Mark notifications as read (keep for backward compatibility)
export const markNotificationsRead = api<{ notificationIds: number[] }, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/finance/notifications/mark-read" },
  markNotificationsReadHandler
);

// V1: Mark notifications as read
export const markNotificationsReadV1 = api<{ notificationIds: number[] }, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/v1/finance/notifications/mark-read" },
  markNotificationsReadHandler
);


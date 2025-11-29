/**
 * Guest Check-In Realtime Metrics Endpoint
 * 
 * Exposes buffer health metrics for monitoring and dashboards
 */

import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { getRealtimeBufferMetrics } from './realtime_buffer';

interface MetricsResponse {
  orgs: {
    total: number;
    active_last_5m: number;
  };
  events: {
    published_total: number;
    delivered_total: number;
    dropped_total: number;
  };
  buffers: {
    total_size: number;
    avg_per_org: number;
  };
  subscribers: {
    active_count: number;
  };
}

/**
 * Expose buffer metrics for monitoring/dashboards
 * Requires ADMIN or MANAGER role
 */
export const getGuestCheckinRealtimeMetrics = api(
  { expose: true, method: "GET", path: "/v1/guest-checkin/realtime/metrics", auth: true },
  async (): Promise<MetricsResponse> => {
    const auth = getAuthData();
    
    if (!auth) {
      throw new Error("Authentication required");
    }
    
    // Only admins and managers can view metrics
    if (!["ADMIN", "MANAGER"].includes(auth.role)) {
      throw new Error("Insufficient permissions");
    }
    
    return getRealtimeBufferMetrics();
  }
);


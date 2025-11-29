import { api } from "encore.dev/api";
import { getRealtimeBufferMetrics } from "./realtime_buffer";

export interface FinanceRealtimeMetricsResponse {
  buffers: Array<{ orgId: number; size: number }>;
  totals: { orgs: number; totalDropped: number };
  publishedByType: { [eventType: string]: number };
  deliveredByType: { [eventType: string]: number };
  maxBufferSize: number;
  eventTtlMs: number;
}

// Shared handler for getting finance realtime metrics
async function getFinanceRealtimeMetricsHandler(): Promise<FinanceRealtimeMetricsResponse> {
  return getRealtimeBufferMetrics();
}

// LEGACY: Expose internal realtime buffer metrics for observability (keep for backward compatibility)
export const getFinanceRealtimeMetrics = api<void, FinanceRealtimeMetricsResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/realtime/metrics" },
  getFinanceRealtimeMetricsHandler
);

// V1: Expose internal realtime buffer metrics for observability
export const getFinanceRealtimeMetricsV1 = api<void, FinanceRealtimeMetricsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/realtime/metrics" },
  getFinanceRealtimeMetricsHandler
);



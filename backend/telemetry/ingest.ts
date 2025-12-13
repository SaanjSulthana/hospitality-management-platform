import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { v1Path } from "../shared/http";

// RUM metric types from frontend - all fields explicit (no index signatures)
interface RUMNavigationMetric {
  type: "navigation";
  url: string;
  ttfbMs: number;
  domContentLoadedMs?: number;
  loadMs?: number;
  transferSizeBytes?: number;
  encodedBodySizeBytes?: number;
  decodedBodySizeBytes?: number;
  timestamp: string;
}

interface RUMFetchMetric {
  type: "fetch";
  url: string;
  method: string;
  ttfbMs: number;
  durationMs: number;
  transferSizeBytes?: number;
  statusCode: number;
  cached?: boolean;
  compressed?: boolean;
  was304?: boolean;
  timestamp: string;
}

interface RUMFetchErrorMetric {
  type: "fetch_error";
  url: string;
  method: string;
  errorType: string;
  durationMs: number;
  timestamp: string;
}

interface RUMWebVitalMetric {
  type: "web_vital";
  name: string;
  value: number;
  rating?: string;
  url?: string;
  timestamp: string;
}

type RUMMetricData = RUMNavigationMetric | RUMFetchMetric | RUMFetchErrorMetric | RUMWebVitalMetric;

type ClientTelemetryEvent =
  | {
      type: "fast_empty";
      elapsedMs: number;
      backoffMs: number;
      isLeader: boolean;
      ts: string;
    }
  | {
      type: "leader_acquired" | "leader_lost" | "leader_takeover";
      ts: string;
    }
  | {
      type: "subscribe_error";
      errorKind: "401" | "403" | "network" | "unknown";
      elapsedMs?: number;
      ts: string;
    }
  | {
      type: "derived_debounce_fired";
      coalescedCount: number;
      ts: string;
    }
  | {
      type: "rum_metric";
      data: RUMMetricData;
      ts: string;
    };

export interface TelemetryIngestRequest {
  events: ClientTelemetryEvent[];
  sampleRate?: number;
}

export interface TelemetryIngestResponse {
  accepted: number;
}

// Lightweight client telemetry ingestion. Auth required to prevent noise.
// Events are sampled on the client (e.g., 2%), we simply log them here.
async function ingestClientTelemetryHandler(req: TelemetryIngestRequest): Promise<TelemetryIngestResponse> {
    const auth = getAuthData();
    if (!auth) {
      throw new Error("Authentication required");
    }

    const accepted = Array.isArray(req.events) ? req.events.length : 0;
    if (accepted > 0) {
      // Separate RUM metrics from other telemetry for clearer logging
      const rumMetrics = req.events.filter((e: ClientTelemetryEvent) => e.type === "rum_metric");
      const otherEvents = req.events.filter((e: ClientTelemetryEvent) => e.type !== "rum_metric");
      
      // Log RUM metrics separately for easier parsing
      if (rumMetrics.length > 0) {
        console.log("[RUM][metrics]", {
          orgId: (auth as any).orgId,
          userId: (auth as any).userID,
          sampleRate: req.sampleRate ?? 0.05,
          count: rumMetrics.length,
          metrics: rumMetrics.slice(0, 20).map((m: any) => ({
            type: m.data?.type,
            url: m.data?.url,
            ttfbMs: m.data?.ttfbMs,
            statusCode: m.data?.statusCode,
            compressed: m.data?.compressed,
            was304: m.data?.was304,
          })),
        });
      }
      
      // Log other telemetry events
      if (otherEvents.length > 0) {
        console.log("[ClientTelemetry]", {
          orgId: (auth as any).orgId,
          userId: (auth as any).userID,
          sampleRate: req.sampleRate ?? 0.02,
          count: otherEvents.length,
          events: otherEvents.slice(0, 50),
        });
      }
    }

    return { accepted };
  }

export const ingestClientTelemetry = api<TelemetryIngestRequest, TelemetryIngestResponse>(
  { auth: true, expose: true, method: "POST", path: "/telemetry/client" },
  ingestClientTelemetryHandler
);

export const ingestClientTelemetryV1 = api<TelemetryIngestRequest, TelemetryIngestResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/system/telemetry/client" },
  ingestClientTelemetryHandler
);



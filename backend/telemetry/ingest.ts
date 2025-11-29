import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { v1Path } from "../shared/http";

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
      // Basic structured log; forward to your metrics system if desired
      console.log("[ClientTelemetry]", {
        orgId: (auth as any).orgId,
        userId: (auth as any).userID,
        sampleRate: req.sampleRate ?? 0.02,
        count: accepted,
        events: req.events.slice(0, 50), // cap to keep logs readable
      });
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



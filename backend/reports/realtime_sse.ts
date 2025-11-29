import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { v1Path } from "../shared/http";

export interface RealtimeUpdatesRequest {
  lastUpdateTime?: string;
}

export interface RealtimeUpdatesResponse {
  updates: any[];
  nextPollTime: string;
}

// Polling endpoint (frontend polls every 3-5s)
async function pollRealtimeUpdatesHandler(req: RealtimeUpdatesRequest): Promise<RealtimeUpdatesResponse> {
    const authData = getAuthData();
    if (!authData) throw new Error("Authentication required");

    // Cache invalidation happens immediately via subscriptions
    // This endpoint tells frontend to refetch reports
    
    return {
      updates: [],
      nextPollTime: new Date(Date.now() + 3000).toISOString()
    };
}

export const pollRealtimeUpdates = api<RealtimeUpdatesRequest, RealtimeUpdatesResponse>(
  { auth: true, expose: true, method: "GET", path: "/reports/realtime/poll" },
  pollRealtimeUpdatesHandler
);

export const pollRealtimeUpdatesV1 = api<RealtimeUpdatesRequest, RealtimeUpdatesResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/reports/realtime/poll" },
  pollRealtimeUpdatesHandler
);


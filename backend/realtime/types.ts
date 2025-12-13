/**
 * Streaming API Types for Encore WebSocket-based Realtime
 * 
 * This file defines the unified streaming types that replace the 10+ long-polling endpoints.
 * All services (finance, staff, guest-checkin, etc.) are multiplexed over a single WebSocket connection.
 */

import type { FinanceEventPayload } from "../finance/events";
import type { GuestEventPayload } from "../guest-checkin/guest-checkin-events";
import type { StaffEventPayload } from "../staff/events";
import type { TaskEventPayload } from "../tasks/events";
import type { PropertyEventPayload } from "../properties/events";
import type { UsersEventPayload } from "../users/events";
import type { DashboardEventPayload } from "../dashboard/events";
import type { BrandingEventPayload } from "../branding/events";
import type { AnalyticsEventPayload } from "../analytics/events";

/**
 * Services that can be subscribed to via the streaming API
 */
export type ServiceName =
  | "finance"
  | "guest"
  | "staff"
  | "tasks"
  | "properties"
  | "users"
  | "dashboard"
  | "branding"
  | "analytics"
  | "reports";

/**
 * Handshake sent by client when establishing WebSocket connection
 */
export interface StreamHandshake {
  /**
   * List of services to subscribe to (e.g., ['finance', 'staff', 'guest'])
   * Only subscribed services will send events to this connection
   */
  services: ServiceName[];

  /**
   * Protocol version for compatibility management
   */
  version: number;

  /**
   * Optional bearer token for manual authentication when WS auth is disabled
   * (used as a fallback when browser/proxy prevents header subprotocols)
   */
  token?: string;

  /**
   * Optional property filter to reduce bandwidth (null = all properties)
   */
  propertyId?: number | null;

  /**
   * Last sequence number received (for reconnection resume)
   * If provided, server will attempt to replay missed events
   */
  lastSeq?: number;
}

/**
 * Message types sent over the stream
 */
export type StreamMessageType = "event" | "ping" | "ack" | "error" | "batch" | "invalidate";

/**
 * Unified message format sent from server to client
 */
export interface StreamMessage {
  /**
   * Service that generated this message
   */
  service: ServiceName;

  /**
   * Events payload (typed per service)
   */
  events: Array<
    | FinanceEventPayload
    | GuestEventPayload
    | StaffEventPayload
    | TaskEventPayload
    | PropertyEventPayload
    | UsersEventPayload
    | DashboardEventPayload
    | BrandingEventPayload
    | AnalyticsEventPayload
  >;

  /**
   * ISO 8601 timestamp when message was sent
   */
  timestamp: string;

  /**
   * Monotonic sequence number for ordering and gap detection
   * Guaranteed to increment by 1 for each message on this connection
   */
  seq: number;

  /**
   * Message type
   */
  type: StreamMessageType;

  /**
   * Optional invalidation payload for cache keys (when type=\"invalidate\")
   */
  invalidate?: {
    keys: string[];
  };

  /**
   * Optional error details (when type="error")
   */
  error?: {
    message: string;
    code?: string;
    service?: ServiceName;
  };
}

/**
 * Batch message format (optimized for high-throughput)
 */
export interface StreamBatchMessage {
  type: "batch";
  messages: StreamMessage[];
  timestamp: string;
  seq: number;
  compressed?: boolean;
  data?: string; // Base64 gzipped JSON (if compressed=true)
}

/**
 * Ping message for keep-alive
 */
export interface StreamPingMessage {
  type: "ping";
  timestamp: string;
  seq: number;
}

/**
 * Acknowledgement message
 */
export interface StreamAckMessage {
  type: "ack";
  seq: number;
  timestamp: string;
}

/**
 * Error message
 */
export interface StreamErrorMessage {
  type: "error";
  service?: ServiceName;
  message: string;
  code?: string;
  timestamp: string;
  seq: number;
}

/**
 * Unified output message type for Encore streaming API
 * (Encore requires a single named interface, not a union type)
 */
export interface StreamOutMessage {
  /**
   * Message type discriminator
   */
  type: "event" | "batch" | "ping" | "ack" | "error" | "invalidate";
  
  /**
   * Service name (for event/error messages)
   */
  service?: ServiceName;
  
  /**
   * Events payload (for event messages)
   */
  events?: Array<
    | FinanceEventPayload
    | GuestEventPayload
    | StaffEventPayload
    | TaskEventPayload
    | PropertyEventPayload
    | UsersEventPayload
    | DashboardEventPayload
    | BrandingEventPayload
    | AnalyticsEventPayload
  >;

  /**
   * Invalidation payload (for invalidate messages)
   */
  invalidate?: {
    keys: string[];
  };
  
  /**
   * Batch of messages (for batch messages)
   */
  messages?: StreamMessage[];
  
  /**
   * Timestamp (all message types)
   */
  timestamp: string;
  
  /**
   * Sequence number (all message types)
   */
  seq: number;
  
  /**
   * Error details (for error messages)
   */
  error?: {
    message: string;
    code?: string;
    service?: ServiceName;
  };
  
  /**
   * Compression flag (for batch messages)
   */
  compressed?: boolean;
  
  /**
   * Compressed data (for batch messages with compression)
   */
  data?: string;
}

/**
 * Internal state for tracking subscriptions per connection
 */
export interface ConnectionState {
  orgId: number;
  userId: number;
  services: Set<ServiceName>;
  propertyFilter: number | null;
  lastSeq: number;
  connectedAt: number;
  lastActivityAt: number;
  subscriptions: Array<() => Promise<void>>; // Cleanup functions
}

/**
 * Metrics for monitoring
 */
export interface StreamingMetrics {
  activeConnections: number;
  totalConnections: number;
  eventsDelivered: number;
  eventsByService: Record<ServiceName, number>;
  errorCount: number;
  avgLatencyMs: number;
}

/**
 * Event buffer entry (for batching and deduplication)
 */
export interface BufferedEvent {
  service: ServiceName;
  event:
    | FinanceEventPayload
    | GuestEventPayload
    | StaffEventPayload
    | TaskEventPayload
    | PropertyEventPayload
    | UsersEventPayload
    | DashboardEventPayload
    | BrandingEventPayload
    | AnalyticsEventPayload;
  receivedAt: number;
}


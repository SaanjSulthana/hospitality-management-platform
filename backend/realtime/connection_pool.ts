/**
 * Connection Pool for Unified Streaming
 * 
 * ARCHITECTURE FIX: Instead of 1 Pub/Sub subscription per user,
 * we maintain 1 subscription per org per service and fan-out to connected users.
 * 
 * Before: 1000 users × 10 services = 10,000 subscriptions ❌
 * After:  1 org × 10 services = 10 subscriptions + fan-out ✅
 * 
 * This is a 1000x reduction in backend load!
 */

import type { ServiceName, StreamMessage } from "./types";

/**
 * Connection information for a single WebSocket (Enhanced with backpressure)
 */
interface Connection {
  userId: number;
  userName: string;
  services: Set<ServiceName>;
  propertyFilter: number | null;
  send: (message: StreamMessage) => Promise<void>;
  connectedAt: number;
  lastActivityAt: number;
  // Backpressure handling
  queueSize: number;
  maxQueueSize: number;
  slowConsumerWarnings: number;
  // Quarantine state
  quarantined?: boolean;
  quarantineUntil?: number;
}

/**
 * Global connection pool
 * Maps orgId → Set of active connections
 */
class ConnectionPool {
  private orgConnections = new Map<number, Set<Connection>>();
  private activeSubscriptions = new Map<string, number>(); // "orgId-service" → refCount

  /**
   * Register a new WebSocket connection
   */
  register(
    orgId: number,
    userId: number,
    userName: string,
    services: Set<ServiceName>,
    propertyFilter: number | null,
    sendFn: (message: StreamMessage) => Promise<void>
  ): Connection {
    // Create connection object with backpressure limits
    const connection: Connection = {
      userId,
      userName,
      services,
      propertyFilter,
      send: sendFn,
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
      queueSize: 0,
      maxQueueSize: 500, // Max 500 pending messages
      slowConsumerWarnings: 0,
    };

    // Add to org's connection set
    if (!this.orgConnections.has(orgId)) {
      this.orgConnections.set(orgId, new Set());
    }
    this.orgConnections.get(orgId)!.add(connection);

    // Track subscription refs
    for (const service of services) {
      const key = `${orgId}-${service}`;
      this.activeSubscriptions.set(key, (this.activeSubscriptions.get(key) || 0) + 1);
    }

    console.log("[ConnectionPool][registered]", {
      orgId,
      userId,
      services: Array.from(services),
      totalConnections: this.orgConnections.get(orgId)!.size,
    });

    return connection;
  }

  /**
   * Update all active connections for a user to a new service set and property filter.
   * This supports dynamic subscription updates without reconnects.
   */
  updateUserConnections(
    orgId: number,
    userId: number,
    services: Set<ServiceName>,
    propertyFilter: number | null
  ): number {
    const connections = this.orgConnections.get(orgId);
    if (!connections || connections.size === 0) return 0;
    let updated = 0;
    for (const conn of connections) {
      if (conn.userId !== userId) continue;

      // Update subscription refCounts
      // Decrement old
      for (const old of conn.services) {
        const key = `${orgId}-${old}`;
        const refCount = (this.activeSubscriptions.get(key) || 1) - 1;
        if (refCount <= 0) this.activeSubscriptions.delete(key);
        else this.activeSubscriptions.set(key, refCount);
      }
      // Assign new set
      conn.services = new Set(services);
      // Increment new
      for (const s of conn.services) {
        const key = `${orgId}-${s}`;
        this.activeSubscriptions.set(key, (this.activeSubscriptions.get(key) || 0) + 1);
      }

      // Update property filter
      conn.propertyFilter = propertyFilter;
      updated++;
    }
    return updated;
  }

  /**
   * Unregister a WebSocket connection
   */
  unregister(orgId: number, connection: Connection): void {
    const connections = this.orgConnections.get(orgId);
    if (connections) {
      connections.delete(connection);

      // Clean up empty sets
      if (connections.size === 0) {
        this.orgConnections.delete(orgId);
      }

      // Decrement subscription refs
      for (const service of connection.services) {
        const key = `${orgId}-${service}`;
        const refCount = (this.activeSubscriptions.get(key) || 1) - 1;
        if (refCount <= 0) {
          this.activeSubscriptions.delete(key);
        } else {
          this.activeSubscriptions.set(key, refCount);
        }
      }
    }

    console.log("[ConnectionPool][unregistered]", {
      orgId,
      userId: connection.userId,
      remainingConnections: connections?.size || 0,
    });
  }

  /**
   * Broadcast event to all connections in an org that subscribed to this service
   * (Enhanced with backpressure handling)
   */
  async broadcast(
    orgId: number,
    service: ServiceName,
    message: StreamMessage
  ): Promise<void> {
    const connections = this.orgConnections.get(orgId);
    if (!connections || connections.size === 0) {
      return;
    }

    // Filter connections that:
    // 1. Subscribed to this service
    // 2. Match property filter (if any)
    const relevantConnections = Array.from(connections).filter((conn) => {
      if (!conn.services.has(service)) return false;
      
      // If connection has property filter, check if event matches
      if (conn.propertyFilter !== null) {
        // Extract propertyId from first event (they should all be same property)
        const propertyId = (message.events[0] as any)?.propertyId;
        if (propertyId && propertyId !== conn.propertyFilter) {
          return false;
        }
      }

      // Quarantine: shed low-priority services for unhealthy connections
      if (conn.quarantined) {
        const lowTier: Set<ServiceName> = new Set(["analytics", "dashboard"] as ServiceName[]);
        if (lowTier.has(service)) {
          return false;
        }
        // Auto expire quarantine
        if (conn.quarantineUntil && Date.now() > conn.quarantineUntil) {
          conn.quarantined = false;
          conn.quarantineUntil = undefined;
        }
      }

      return true;
    });

    if (relevantConnections.length === 0) {
      return;
    }

    let droppedCount = 0;
    let sentCount = 0;

    // Send to all relevant connections with backpressure check
    const promises = relevantConnections.map(async (conn) => {
      // Check backpressure (FIX: Memory leak prevention)
      if (conn.queueSize >= conn.maxQueueSize) {
        conn.slowConsumerWarnings++;
        droppedCount++;
        
        console.warn("[ConnectionPool][backpressure-drop]", {
          orgId,
          userId: conn.userId,
          service,
          queueSize: conn.queueSize,
          maxQueueSize: conn.maxQueueSize,
          warnings: conn.slowConsumerWarnings,
          action: "dropping-event",
        });
        
        // If too many warnings, consider disconnecting
        if (conn.slowConsumerWarnings > 10) {
          // Enter quarantine for 30s; shed low-tier services
          conn.quarantined = true;
          conn.quarantineUntil = Date.now() + 30_000;
          console.error("[ConnectionPool][slow-consumer-disconnect]", {
            orgId,
            userId: conn.userId,
            warnings: conn.slowConsumerWarnings,
          });
          // Connection will be cleaned up on next send failure
        }
        
        return;
      }

      // Track queue size
      conn.queueSize++;
      
      try {
        await conn.send(message);
        sentCount++;
        conn.queueSize = Math.max(0, conn.queueSize - 1);
        conn.slowConsumerWarnings = Math.max(0, conn.slowConsumerWarnings - 1);
        // If recovering, clear quarantine early
        if (conn.quarantined && conn.slowConsumerWarnings === 0 && conn.queueSize < conn.maxQueueSize / 4) {
          conn.quarantined = false;
          conn.quarantineUntil = undefined;
        }
      } catch (err) {
        conn.queueSize = Math.max(0, conn.queueSize - 1);
        console.error("[ConnectionPool][send-error]", {
          orgId,
          userId: conn.userId,
          service,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    await Promise.allSettled(promises);

    console.log("[ConnectionPool][broadcasted]", {
      orgId,
      service,
      recipients: relevantConnections.length,
      sent: sentCount,
      dropped: droppedCount,
      eventCount: message.events.length,
    });
  }

  /**
   * Check if org needs subscription for this service
   */
  needsSubscription(orgId: number, service: ServiceName): boolean {
    const key = `${orgId}-${service}`;
    return (this.activeSubscriptions.get(key) || 0) > 0;
  }

  /**
   * Get connection count for org
   */
  getConnectionCount(orgId: number): number {
    return this.orgConnections.get(orgId)?.size || 0;
  }

  /**
   * Get total connection count
   */
  getTotalConnections(): number {
    let total = 0;
    for (const connections of this.orgConnections.values()) {
      total += connections.size;
    }
    return total;
  }

  /**
   * Get stats for monitoring
   */
  getStats() {
    return {
      totalConnections: this.getTotalConnections(),
      totalOrgs: this.orgConnections.size,
      totalSubscriptions: this.activeSubscriptions.size,
      connectionsByOrg: Array.from(this.orgConnections.entries()).map(([orgId, conns]) => ({
        orgId,
        connections: conns.size,
      })),
    };
  }

  /**
   * Update connection activity timestamp
   */
  updateActivity(connection: Connection): void {
    connection.lastActivityAt = Date.now();
  }

  /**
   * Get all connections for an org
   */
  getConnections(orgId: number): Connection[] {
    const connections = this.orgConnections.get(orgId);
    return connections ? Array.from(connections) : [];
  }
}

/**
 * Global singleton instance
 */
export const connectionPool = new ConnectionPool();


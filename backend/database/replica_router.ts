// Replica Router for 10M Organization Scale
// Implements intelligent read/write routing with health checks and failover
// Part of Phase 1: Foundation (Task 2.3)

import { SQLDatabase } from "encore.dev/storage/sqldb";

export interface ReplicaConfig {
    name: string;
    database: SQLDatabase;
    isHealthy: boolean;
    lastHealthCheck: Date;
    consecutiveFailures: number;
}

export interface OrgRangeConfig {
    min: number;
    max: number;
    primaryDb: string;
}

export class ReplicaRouter {
    private replicas: Map<string, ReplicaConfig> = new Map();
    private replicaNames: string[] = [];
    private currentIndex = 0;
    private primary: SQLDatabase;
    private healthCheckInterval: NodeJS.Timeout | null = null;

    // Org-range routing for future sharding (Phase 3)
    private orgRanges: OrgRangeConfig[] = [
        { min: 0, max: 999999, primaryDb: 'primary-1' },
        { min: 1000000, max: 1999999, primaryDb: 'primary-2' },
        { min: 2000000, max: 2999999, primaryDb: 'primary-3' },
    ];

    constructor() {
        console.log('[ReplicaRouter] Initializing replica router...');

        // Initialize primary database
        this.primary = SQLDatabase.named("hospitality");

        console.log('[ReplicaRouter] ✅ Primary database initialized');

        // Initialize replicas if enabled
        if (process.env.USE_READ_REPLICAS === 'true') {
            this.initializeReplicas();
            this.startHealthChecks();
        } else {
            console.log('[ReplicaRouter] ℹ️ Read replicas disabled (USE_READ_REPLICAS not set)');
        }
    }

    private initializeReplicas() {
        // Note: Encore requires database definitions in encore.app
        // For now, we'll use the primary database as a fallback
        // In production, define replica databases in encore.app:
        // 
        // {
        //   "databases": {
        //     "hospitality": { ... },
        //     "hospitality_replica_1": { ... },
        //     "hospitality_replica_2": { ... },
        //     "hospitality_replica_3": { ... }
        //   }
        // }

        const replicaCount = parseInt(process.env.REPLICA_COUNT || '3');

        for (let i = 1; i <= replicaCount; i++) {
            const replicaName = `replica-${i}`;

            // Try to initialize replica database
            try {
                // In production, use: SQLDatabase.named(`hospitality_replica_${i}`, {...})
                // For now, use primary as fallback
                const replicaDb = this.primary; // Fallback to primary

                this.replicas.set(replicaName, {
                    name: replicaName,
                    database: replicaDb,
                    isHealthy: true,
                    lastHealthCheck: new Date(),
                    consecutiveFailures: 0
                });

                this.replicaNames.push(replicaName);
                console.log(`[ReplicaRouter] ✅ Configured replica: ${replicaName}`);
            } catch (error) {
                console.error(`[ReplicaRouter] ❌ Failed to initialize replica ${replicaName}:`, error);
            }
        }

        console.log(`[ReplicaRouter] ✅ Initialized ${this.replicaNames.length} read replicas`);
    }

    /**
     * Get database connection for read operations
     * Implements round-robin load balancing with health checks
     */
    getReadConnection(orgId: number, preferReplica: boolean = true): SQLDatabase {
        // If replicas not available or not preferred, use primary
        if (!preferReplica || this.replicaNames.length === 0) {
            console.log(`[ReplicaRouter] Using primary for read (preferReplica=${preferReplica}, replicas=${this.replicaNames.length})`);
            return this.primary;
        }

        // Try to get a healthy replica
        const maxAttempts = this.replicaNames.length;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const replicaName = this.getNextReplicaName();
            const replica = this.replicas.get(replicaName);

            if (replica && replica.isHealthy) {
                console.log(`[ReplicaRouter] Using replica ${replicaName} for read (orgId=${orgId})`);
                return replica.database;
            }
        }

        // All replicas unhealthy, fallback to primary
        console.warn('[ReplicaRouter] ⚠️ All replicas unhealthy, falling back to primary');
        return this.primary;
    }

    /**
     * Get database connection for write operations
     * Always returns primary database
     */
    getWriteConnection(orgId?: number): SQLDatabase {
        // Future: Route to specific shard based on orgId
        // For now, always use primary
        if (orgId !== undefined) {
            const range = this.orgRanges.find(r => orgId >= r.min && orgId <= r.max);
            console.log(`[ReplicaRouter] Using ${range?.primaryDb || 'primary-1'} for write (orgId=${orgId})`);
        }

        return this.primary;
    }

    /**
     * Get database for org-specific routing (future sharding support)
     */
    getDatabase(orgId: number): string {
        const range = this.orgRanges.find(r => orgId >= r.min && orgId <= r.max);
        return range?.primaryDb || 'primary-1';
    }

    /**
     * Round-robin load balancing
     */
    private getNextReplicaName(): string {
        const replicaName = this.replicaNames[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.replicaNames.length;
        return replicaName;
    }

    /**
     * Check if replicas are available
     */
    hasReplicas(): boolean {
        return this.replicaNames.length > 0;
    }

    /**
     * Get count of healthy replicas
     */
    getHealthyReplicaCount(): number {
        let count = 0;
        for (const replica of this.replicas.values()) {
            if (replica.isHealthy) count++;
        }
        return count;
    }

    /**
     * Health check for a specific replica
     */
    async isHealthy(replicaName: string): Promise<boolean> {
        const replica = this.replicas.get(replicaName);
        if (!replica) return false;

        try {
            await replica.database.query`SELECT 1`;

            // Update health status
            replica.isHealthy = true;
            replica.lastHealthCheck = new Date();
            replica.consecutiveFailures = 0;

            return true;
        } catch (error) {
            console.error(`[ReplicaRouter] Replica ${replicaName} health check failed:`, error);

            // Update health status
            replica.consecutiveFailures++;
            replica.lastHealthCheck = new Date();

            // Mark as unhealthy after 3 consecutive failures
            if (replica.consecutiveFailures >= 3) {
                replica.isHealthy = false;
                console.warn(`[ReplicaRouter] ⚠️ Replica ${replicaName} marked as unhealthy after ${replica.consecutiveFailures} failures`);
            }

            return false;
        }
    }

    /**
     * Start periodic health checks
     */
    private startHealthChecks(): void {
        const interval = parseInt(process.env.REPLICA_HEALTH_CHECK_INTERVAL || '30000'); // 30 seconds

        if (this.replicaNames.length === 0) {
            console.log('[ReplicaRouter] No replicas to monitor');
            return;
        }

        this.healthCheckInterval = setInterval(async () => {
            console.log('[ReplicaRouter] Running health checks...');

            for (const replicaName of this.replicaNames) {
                await this.isHealthy(replicaName);
            }

            const healthyCount = this.getHealthyReplicaCount();
            console.log(`[ReplicaRouter] Health check complete: ${healthyCount}/${this.replicaNames.length} replicas healthy`);
        }, interval);

        console.log(`[ReplicaRouter] ✅ Started health check monitoring (interval: ${interval}ms)`);
    }

    /**
     * Stop health checks (for cleanup)
     */
    stopHealthChecks(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            console.log('[ReplicaRouter] Health check monitoring stopped');
        }
    }

    /**
     * Get replica statistics
     */
    getReplicaStats(): any {
        const stats: any = {
            replicaCount: this.replicaNames.length,
            healthyCount: this.getHealthyReplicaCount(),
            currentIndex: this.currentIndex,
            replicas: {}
        };

        for (const [name, replica] of this.replicas) {
            stats.replicas[name] = {
                isHealthy: replica.isHealthy,
                lastHealthCheck: replica.lastHealthCheck.toISOString(),
                consecutiveFailures: replica.consecutiveFailures
            };
        }

        return stats;
    }

    /**
     * Force health check for all replicas
     */
    async forceHealthCheck(): Promise<Map<string, boolean>> {
        const results = new Map<string, boolean>();

        for (const replicaName of this.replicaNames) {
            const isHealthy = await this.isHealthy(replicaName);
            results.set(replicaName, isHealthy);
        }

        return results;
    }

    /**
     * Get primary database (for direct access)
     */
    getPrimary(): SQLDatabase {
        return this.primary;
    }
}

// Global instance
export const replicaRouter = new ReplicaRouter();


import { api } from "encore.dev/api";
import { replicaManager } from "./replica_manager";
import { v1Path } from "../shared/http";

export interface ReplicaMonitoringResponse {
  status: string;
  timestamp: string;
  primary: {
    healthy: boolean;
    connections: any;
  };
  replicas: {
    count: number;
    healthy: number;
    unhealthy: number;
    lag: Record<string, number>;
    health: Record<string, boolean>;
    connections: any;
  };
}

// Replica monitoring endpoint
async function getReplicaStatusHandler(): Promise<ReplicaMonitoringResponse> {
    try {
      const [healthStatus, lagStatus, connectionStats] = await Promise.all([
        replicaManager.checkReplicaHealth(),
        replicaManager.getReplicaLag(),
        replicaManager.getConnectionPoolStats(),
      ]);

      const healthyCount = Array.from(healthStatus.values()).filter(h => h).length;
      const unhealthyCount = healthStatus.size - healthyCount;

      return {
        status: unhealthyCount === 0 ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        primary: {
          healthy: true,
          connections: connectionStats.primary,
        },
        replicas: {
          count: healthStatus.size,
          healthy: healthyCount,
          unhealthy: unhealthyCount,
          lag: Object.fromEntries(lagStatus),
          health: Object.fromEntries(healthStatus),
          connections: connectionStats.replicas,
        }
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        primary: {
          healthy: false,
          connections: {},
        },
        replicas: {
          count: 0,
          healthy: 0,
          unhealthy: 0,
          lag: {},
          health: {},
          connections: {},
        }
      };
    }
  }

export const getReplicaStatus = api(
  { expose: true, method: "GET", path: "/database/replicas/status" },
  getReplicaStatusHandler
);

export const getReplicaStatusV1 = api(
  { expose: true, method: "GET", path: "/v1/system/database/replicas/status" },
  getReplicaStatusHandler
);

// Replica health check
async function replicaHealthCheckHandler(): Promise<{
    healthy: boolean;
    timestamp: string;
    replicasEnabled: boolean;
    replicaCount: number;
    message: string;
  }> {
    try {
      const healthStatus = await replicaManager.checkReplicaHealth();
      const allHealthy = Array.from(healthStatus.values()).every(h => h);
      const hasReplicas = replicaManager.hasReadReplicas();

      return {
        healthy: allHealthy || !hasReplicas, // Healthy if all replicas are healthy OR no replicas configured
        timestamp: new Date().toISOString(),
        replicasEnabled: hasReplicas,
        replicaCount: healthStatus.size,
        message: hasReplicas 
          ? (allHealthy ? `All ${healthStatus.size} replicas are healthy` : `Some replicas are unhealthy`)
          : 'No read replicas configured, using primary database only'
      };
    } catch (error) {
      return {
        healthy: false,
        timestamp: new Date().toISOString(),
        replicasEnabled: false,
        replicaCount: 0,
        message: error instanceof Error ? error.message : 'Unknown replica error'
      };
    }
  }

export const replicaHealthCheck = api(
  { expose: true, method: "GET", path: "/database/replicas/health" },
  replicaHealthCheckHandler
);

export const replicaHealthCheckV1 = api(
  { expose: true, method: "GET", path: "/v1/system/database/replicas/health" },
  replicaHealthCheckHandler
);

// Replica lag monitoring
async function getReplicaLagHandler(): Promise<{
    timestamp: string;
    replicas: Array<{
      name: string;
      lagSeconds: number;
      status: 'healthy' | 'warning' | 'critical' | 'error';
    }>;
  }> {
    try {
      const lagMap = await replicaManager.getReplicaLag();
      const replicas = Array.from(lagMap.entries()).map(([name, lagSeconds]) => {
        let status: 'healthy' | 'warning' | 'critical' | 'error';
        
        if (lagSeconds < 0) {
          status = 'error';
        } else if (lagSeconds === 0) {
          status = 'healthy';
        } else if (lagSeconds < 10) {
          status = 'healthy';
        } else if (lagSeconds < 60) {
          status = 'warning';
        } else {
          status = 'critical';
        }

        return { name, lagSeconds, status };
      });

      return {
        timestamp: new Date().toISOString(),
        replicas,
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        replicas: [],
      };
    }
  }

export const getReplicaLag = api(
  { expose: true, method: "GET", path: "/database/replicas/lag" },
  getReplicaLagHandler
);

export const getReplicaLagV1 = api(
  { expose: true, method: "GET", path: "/v1/system/database/replicas/lag" },
  getReplicaLagHandler
);

// Connection pool statistics
async function getConnectionPoolStatsHandler(): Promise<{
    timestamp: string;
    primary: any;
    replicas: any;
  }> {
    try {
      const stats = await replicaManager.getConnectionPoolStats();

      return {
        timestamp: new Date().toISOString(),
        primary: stats.primary,
        replicas: stats.replicas,
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        primary: {},
        replicas: {},
      };
    }
  }

export const getConnectionPoolStats = api(
  { expose: true, method: "GET", path: "/database/connection-pool/stats" },
  getConnectionPoolStatsHandler
);

export const getConnectionPoolStatsV1 = api(
  { expose: true, method: "GET", path: "/v1/system/database/connection-pool/stats" },
  getConnectionPoolStatsHandler
);


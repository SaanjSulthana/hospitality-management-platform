// Monitoring-local replica monitoring helpers
// Re-exports lightweight health/lag info backed by the global replicaRouter

import { replicaRouter } from "../../database/replica_router";

export interface ReplicaLagInfo {
    name: string;
    lagSeconds: number;
    status: 'healthy' | 'unhealthy';
}

export async function replicaHealthCheck(): Promise<{
    replicasEnabled: boolean;
    replicaCount: number;
}> {
    const stats = replicaRouter.getReplicaStats();
    return {
        replicasEnabled: replicaRouter.hasReplicas(),
        replicaCount: stats.replicaCount ?? 0,
    };
}

export async function getReplicaLag(): Promise<{
    replicas: ReplicaLagInfo[];
}> {
    const stats = replicaRouter.getReplicaStats();
    const replicas: ReplicaLagInfo[] = [];
    const raw = (stats as any).replicas || {};
    for (const name of Object.keys(raw)) {
        const r = raw[name];
        replicas.push({
            name,
            lagSeconds: 0,
            status: r?.isHealthy ? 'healthy' : 'unhealthy',
        });
    }
    return { replicas };
}


/**
 * Baseline Metrics Endpoint
 * 
 * Exposes aggregated networking metrics for dashboard visualization
 * and baseline capture during Week 0 of the optimization plan.
 */

import { api } from "encore.dev/api";
import { getMetricsSummary, type MetricsSummary, type AggregatedMetrics } from "./metrics_aggregator";

/**
 * Response type for baseline metrics endpoint
 */
export interface BaselineMetricsResponse {
  success: boolean;
  data: MetricsSummary;
  sloStatus: SLOStatus;
}

/**
 * SLO status compared to targets
 */
export interface SLOStatus {
  targets: {
    edgeTtfbP95Ms: number;
    dynamicTtfbP95Ms: number;
    writeTtfbP95Ms: number;
    cdnHitRatioStatic: number;
    cdnHitRatioGet: number;
    ratio304Target: number;
    medianPayloadKb: number;
  };
  current: {
    ttfbP95Ms: number;
    ttfbP99Ms: number;
    ratio304: number;
    medianPayloadKb: number;
    compressionRatio: number;
  };
  status: {
    ttfbP95: 'met' | 'warning' | 'not_met' | 'no_data';
    ratio304: 'met' | 'warning' | 'not_met' | 'no_data';
    payloadSize: 'met' | 'warning' | 'not_met' | 'no_data';
    overall: 'healthy' | 'degraded' | 'critical' | 'no_data';
  };
}

// SLO targets from the networking plan
const SLO_TARGETS = {
  edgeTtfbP95Ms: 100,      // ≤100ms for cached reads
  dynamicTtfbP95Ms: 250,   // ≤250ms for dynamic reads
  writeTtfbP95Ms: 350,     // ≤350ms for writes
  cdnHitRatioStatic: 0.95, // ≥95% for static content
  cdnHitRatioGet: 0.80,    // ≥80% for eligible GETs
  ratio304Target: 0.50,    // ≥50% 304 ratio on revisits
  medianPayloadKb: 40,     // ≤40KB median payload
} as const;

/**
 * Calculate SLO status from metrics summary
 */
function calculateSLOStatus(summary: MetricsSummary): SLOStatus {
  const noData = summary.totalRequests === 0;
  
  const current = {
    ttfbP95Ms: summary.overall.ttfb.p95,
    ttfbP99Ms: summary.overall.ttfb.p99,
    ratio304: summary.overall.ratio304,
    medianPayloadKb: summary.overall.payloadBytes.p50 / 1024,
    compressionRatio: summary.overall.compressionRatio,
  };
  
  // Determine status for each metric
  const ttfbP95Status = noData ? 'no_data' as const :
    current.ttfbP95Ms <= SLO_TARGETS.dynamicTtfbP95Ms ? 'met' as const :
    current.ttfbP95Ms <= SLO_TARGETS.dynamicTtfbP95Ms * 1.5 ? 'warning' as const :
    'not_met' as const;
  
  const ratio304Status = noData ? 'no_data' as const :
    current.ratio304 >= SLO_TARGETS.ratio304Target ? 'met' as const :
    current.ratio304 >= SLO_TARGETS.ratio304Target * 0.5 ? 'warning' as const :
    'not_met' as const;
  
  const payloadStatus = noData ? 'no_data' as const :
    current.medianPayloadKb <= SLO_TARGETS.medianPayloadKb ? 'met' as const :
    current.medianPayloadKb <= SLO_TARGETS.medianPayloadKb * 1.5 ? 'warning' as const :
    'not_met' as const;
  
  // Calculate overall status
  const statuses = [ttfbP95Status, ratio304Status, payloadStatus];
  const overallStatus = noData ? 'no_data' as const :
    statuses.every(s => s === 'met') ? 'healthy' as const :
    statuses.some(s => s === 'not_met') ? 'critical' as const :
    'degraded' as const;
  
  return {
    targets: SLO_TARGETS,
    current,
    status: {
      ttfbP95: ttfbP95Status,
      ratio304: ratio304Status,
      payloadSize: payloadStatus,
      overall: overallStatus,
    },
  };
}

/**
 * GET /v1/monitoring/baseline-metrics
 * 
 * Returns aggregated networking metrics for dashboard visualization.
 * Use this endpoint during Week 0 to capture baseline performance data.
 */
export const getBaselineMetrics = api(
  {
    expose: true,
    method: "GET",
    path: "/v1/monitoring/baseline-metrics",
  },
  async (): Promise<BaselineMetricsResponse> => {
    const summary = getMetricsSummary();
    const sloStatus = calculateSLOStatus(summary);
    
    return {
      success: true,
      data: summary,
      sloStatus,
    };
  }
);

/**
 * Response type for family-specific metrics
 */
export interface FamilyMetricsResponse {
  success: boolean;
  family: string;
  data: AggregatedMetrics | null;
  message?: string;
}

/**
 * GET /v1/monitoring/baseline-metrics/:family
 * 
 * Returns metrics for a specific endpoint family.
 */
export const getFamilyMetrics = api(
  {
    expose: true,
    method: "GET",
    path: "/v1/monitoring/baseline-metrics/:family",
  },
  async ({ family }: { family: string }): Promise<FamilyMetricsResponse> => {
    const summary = getMetricsSummary();
    const familyData = summary.byFamily.find(f => f.family === family);
    
    if (!familyData) {
      return {
        success: true,
        family,
        data: null,
        message: `No metrics recorded for family: ${family}`,
      };
    }
    
    return {
      success: true,
      family,
      data: familyData,
    };
  }
);

/**
 * Response type for SLO status endpoint
 */
export interface SLOStatusResponse {
  success: boolean;
  sloStatus: SLOStatus;
  recommendations: string[];
}

/**
 * GET /v1/monitoring/slo-status
 * 
 * Returns current SLO status with recommendations.
 */
export const getSLOStatus = api(
  {
    expose: true,
    method: "GET",
    path: "/v1/monitoring/slo-status",
  },
  async (): Promise<SLOStatusResponse> => {
    const summary = getMetricsSummary();
    const sloStatus = calculateSLOStatus(summary);
    
    const recommendations: string[] = [];
    
    if (sloStatus.status.overall === 'no_data') {
      recommendations.push('Insufficient data to evaluate SLOs. Allow more traffic to accumulate.');
    } else {
      if (sloStatus.status.ttfbP95 === 'not_met') {
        recommendations.push(`TTFB p95 (${sloStatus.current.ttfbP95Ms.toFixed(0)}ms) exceeds target (${SLO_TARGETS.dynamicTtfbP95Ms}ms). Consider enabling CDN caching or optimizing database queries.`);
      } else if (sloStatus.status.ttfbP95 === 'warning') {
        recommendations.push(`TTFB p95 (${sloStatus.current.ttfbP95Ms.toFixed(0)}ms) approaching target (${SLO_TARGETS.dynamicTtfbP95Ms}ms). Monitor for degradation.`);
      }
      
      if (sloStatus.status.ratio304 === 'not_met') {
        recommendations.push(`304 ratio (${(sloStatus.current.ratio304 * 100).toFixed(1)}%) below target (${SLO_TARGETS.ratio304Target * 100}%). Ensure clients send If-None-Match headers and ETags are properly configured.`);
      }
      
      if (sloStatus.status.payloadSize === 'not_met') {
        recommendations.push(`Median payload (${sloStatus.current.medianPayloadKb.toFixed(1)}KB) exceeds target (${SLO_TARGETS.medianPayloadKb}KB). Consider enabling compression or implementing field selection.`);
      }
      
      if (sloStatus.current.compressionRatio < 0.3 && sloStatus.current.medianPayloadKb > 10) {
        recommendations.push('Low compression ratio detected. Ensure Brotli/gzip compression is enabled for text responses.');
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All SLOs are being met. Continue monitoring.');
    }
    
    return {
      success: true,
      sloStatus,
      recommendations,
    };
  }
);


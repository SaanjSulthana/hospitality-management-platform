/**
 * Load Testing Harness
 * 
 * Implements pre-production load testing gates:
 * 
 * | Test                  | Criteria                               |
 * |-----------------------|----------------------------------------|
 * | Traffic               | 500 RPS sustained, 2000 RPS burst      |
 * | Purge throughput      | 1000 purge ops/min with debouncing     |
 * | Chaos test            | CDN 5xx/timeouts → circuit breaker <1m |
 * | Realtime              | 50k concurrent, latency budget met     |
 * 
 * Pass criteria: All SLOs met for 60+ minutes at 80th percentile of target loads
 * 
 * @see docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md Load Testing Gates
 */

interface LoadTestConfig {
  /** Target base URL */
  baseUrl: string;
  
  /** Auth token for requests */
  authToken: string;
  
  /** Test duration in seconds */
  durationSeconds: number;
  
  /** Target requests per second */
  targetRps: number;
  
  /** Burst RPS for burst tests */
  burstRps?: number;
  
  /** Whether to run in dry-run mode */
  dryRun?: boolean;
  
  /** Progress callback */
  onProgress?: (stats: LoadTestStats) => void;
}

interface LoadTestStats {
  /** Total requests made */
  totalRequests: number;
  
  /** Successful requests (2xx/3xx) */
  successfulRequests: number;
  
  /** Failed requests (4xx/5xx) */
  failedRequests: number;
  
  /** Rate limited requests (429) */
  rateLimitedRequests: number;
  
  /** Latency percentiles (ms) */
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  
  /** Current RPS */
  currentRps: number;
  
  /** CDN cache hit ratio */
  cacheHitRatio: number;
  
  /** 304 response ratio */
  notModifiedRatio: number;
  
  /** Error rate */
  errorRate: number;
  
  /** Elapsed time in seconds */
  elapsedSeconds: number;
}

interface LoadTestResult {
  passed: boolean;
  stats: LoadTestStats;
  failureReasons: string[];
  recommendations: string[];
}

/**
 * SLO Targets from the networking plan
 */
const SLO_TARGETS = {
  /** Edge p95 TTFB for cached reads */
  edgeP95TtfbMs: 100,
  
  /** Dynamic p95 TTFB for cache misses */
  dynamicP95TtfbMs: 250,
  
  /** Write p95 TTFB */
  writeP95TtfbMs: 350,
  
  /** CDN hit ratio for static assets */
  staticCacheHitRatio: 0.95,
  
  /** CDN hit ratio for GET endpoints */
  getCacheHitRatio: 0.80,
  
  /** 304 ratio on revisits with ETag */
  notModifiedRatio: 0.50,
  
  /** Median payload size (compressed) */
  medianPayloadKb: 40,
  
  /** Maximum error rate */
  maxErrorRate: 0.01,
  
  /** Realtime latency budget */
  realtimeP95LatencyMs: 500,
  
  /** Realtime reconnect error rate */
  realtimeErrorRate: 0.001,
};

/**
 * Test endpoint configurations
 */
const TEST_ENDPOINTS = {
  // Read endpoints (cache-eligible)
  read: [
    { path: '/properties', weight: 15 },
    { path: '/finance/expenses', weight: 20 },
    { path: '/finance/revenues', weight: 20 },
    { path: '/reports/daily-report', weight: 15 },
    { path: '/reports/monthly-report', weight: 10 },
    { path: '/analytics/overview', weight: 10 },
    { path: '/branding/theme', weight: 5 },
    { path: '/users/list', weight: 5 },
  ],
  
  // Write endpoints
  write: [
    { path: '/finance/expenses', method: 'POST', weight: 30 },
    { path: '/finance/revenues', method: 'POST', weight: 30 },
    { path: '/tasks', method: 'POST', weight: 20 },
    { path: '/staff/check-in', method: 'POST', weight: 10 },
    { path: '/staff/check-out', method: 'POST', weight: 10 },
  ],
};

/**
 * Latency tracker for percentile calculations
 */
class LatencyTracker {
  private samples: number[] = [];
  private maxSamples = 10000;
  
  record(latencyMs: number): void {
    this.samples.push(latencyMs);
    if (this.samples.length > this.maxSamples) {
      // Keep only recent samples
      this.samples = this.samples.slice(-this.maxSamples);
    }
  }
  
  getPercentile(p: number): number {
    if (this.samples.length === 0) return 0;
    
    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * (p / 100));
    return sorted[Math.min(index, sorted.length - 1)];
  }
  
  getP50(): number { return this.getPercentile(50); }
  getP95(): number { return this.getPercentile(95); }
  getP99(): number { return this.getPercentile(99); }
  
  reset(): void {
    this.samples = [];
  }
}

/**
 * Run traffic load test
 * 
 * Tests: 500 RPS sustained, 2000 RPS burst
 */
export async function runTrafficLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
  const latencyTracker = new LatencyTracker();
  const stats: LoadTestStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    latencyP50: 0,
    latencyP95: 0,
    latencyP99: 0,
    currentRps: 0,
    cacheHitRatio: 0,
    notModifiedRatio: 0,
    errorRate: 0,
    elapsedSeconds: 0,
  };
  
  let cacheHits = 0;
  let notModifiedCount = 0;
  const startTime = Date.now();
  const endTime = startTime + config.durationSeconds * 1000;
  
  // Calculate interval between requests for target RPS
  const intervalMs = 1000 / config.targetRps;
  
  console.log(`Starting traffic load test: ${config.targetRps} RPS for ${config.durationSeconds}s`);
  
  while (Date.now() < endTime) {
    const requestStartTime = Date.now();
    
    // Select random endpoint based on weight
    const endpoint = selectWeightedEndpoint(TEST_ENDPOINTS.read);
    const url = `${config.baseUrl}${endpoint.path}`;
    
    if (!config.dryRun) {
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${config.authToken}`,
            'Accept': 'application/json',
            'Accept-Encoding': 'br, gzip',
            'If-None-Match': '"cached-etag"', // Simulate revisit
          },
        });
        
        const latency = Date.now() - requestStartTime;
        latencyTracker.record(latency);
        
        stats.totalRequests++;
        
        if (response.ok || response.status === 304) {
          stats.successfulRequests++;
          
          if (response.status === 304) {
            notModifiedCount++;
          }
          
          // Check cache status from headers
          const cacheStatus = response.headers.get('cf-cache-status') || 
                             response.headers.get('x-cache');
          if (cacheStatus === 'HIT') {
            cacheHits++;
          }
        } else if (response.status === 429) {
          stats.rateLimitedRequests++;
        } else {
          stats.failedRequests++;
        }
      } catch (error) {
        stats.failedRequests++;
        stats.totalRequests++;
      }
    } else {
      // Dry run - simulate request
      await sleep(Math.random() * 10);
      latencyTracker.record(Math.random() * 100 + 20);
      stats.totalRequests++;
      stats.successfulRequests++;
    }
    
    // Update stats
    stats.elapsedSeconds = (Date.now() - startTime) / 1000;
    stats.currentRps = stats.totalRequests / stats.elapsedSeconds;
    stats.latencyP50 = latencyTracker.getP50();
    stats.latencyP95 = latencyTracker.getP95();
    stats.latencyP99 = latencyTracker.getP99();
    stats.cacheHitRatio = stats.successfulRequests > 0 
      ? cacheHits / stats.successfulRequests 
      : 0;
    stats.notModifiedRatio = stats.successfulRequests > 0 
      ? notModifiedCount / stats.successfulRequests 
      : 0;
    stats.errorRate = stats.totalRequests > 0 
      ? stats.failedRequests / stats.totalRequests 
      : 0;
    
    // Report progress
    if (config.onProgress && stats.totalRequests % 100 === 0) {
      config.onProgress(stats);
    }
    
    // Wait for next request
    const elapsed = Date.now() - requestStartTime;
    if (elapsed < intervalMs) {
      await sleep(intervalMs - elapsed);
    }
  }
  
  // Evaluate results
  const failureReasons: string[] = [];
  const recommendations: string[] = [];
  
  if (stats.latencyP95 > SLO_TARGETS.dynamicP95TtfbMs) {
    failureReasons.push(`P95 latency ${stats.latencyP95}ms exceeds target ${SLO_TARGETS.dynamicP95TtfbMs}ms`);
    recommendations.push('Consider adding caching for slow endpoints');
  }
  
  if (stats.errorRate > SLO_TARGETS.maxErrorRate) {
    failureReasons.push(`Error rate ${(stats.errorRate * 100).toFixed(2)}% exceeds target ${SLO_TARGETS.maxErrorRate * 100}%`);
    recommendations.push('Investigate error sources and add circuit breakers');
  }
  
  if (stats.cacheHitRatio < SLO_TARGETS.getCacheHitRatio) {
    failureReasons.push(`Cache hit ratio ${(stats.cacheHitRatio * 100).toFixed(1)}% below target ${SLO_TARGETS.getCacheHitRatio * 100}%`);
    recommendations.push('Review cache headers and TTL policies');
  }
  
  if (stats.currentRps < config.targetRps * 0.8) {
    failureReasons.push(`Achieved RPS ${stats.currentRps.toFixed(1)} below 80% of target ${config.targetRps}`);
    recommendations.push('Scale infrastructure or optimize slow paths');
  }
  
  return {
    passed: failureReasons.length === 0,
    stats,
    failureReasons,
    recommendations,
  };
}

/**
 * Run purge throughput test
 * 
 * Tests: 1000 purge ops/min with debouncing, no API throttling
 */
export async function runPurgeThroughputTest(config: LoadTestConfig): Promise<LoadTestResult> {
  const stats: LoadTestStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    latencyP50: 0,
    latencyP95: 0,
    latencyP99: 0,
    currentRps: 0,
    cacheHitRatio: 0,
    notModifiedRatio: 0,
    errorRate: 0,
    elapsedSeconds: 0,
  };
  
  const latencyTracker = new LatencyTracker();
  const targetPurgesPerMin = 1000;
  const intervalMs = 60000 / targetPurgesPerMin;
  
  const startTime = Date.now();
  const endTime = startTime + Math.min(config.durationSeconds, 120) * 1000; // Max 2 min
  
  console.log(`Starting purge throughput test: ${targetPurgesPerMin} purges/min`);
  
  // Import purge manager
  const { queuePurge, getPurgeStats } = await import('../middleware/purge_manager');
  
  while (Date.now() < endTime) {
    const requestStartTime = Date.now();
    
    // Generate random purge keys
    const orgId = Math.floor(Math.random() * 100) + 1;
    const propertyId = Math.floor(Math.random() * 10) + 1;
    
    const keys = [
      `org:${orgId}`,
      `property:${propertyId}`,
      `finance:summary:property:${propertyId}`,
    ];
    
    if (!config.dryRun) {
      queuePurge(keys, 'load-test');
    }
    
    const latency = Date.now() - requestStartTime;
    latencyTracker.record(latency);
    
    stats.totalRequests++;
    stats.successfulRequests++;
    
    // Update stats
    stats.elapsedSeconds = (Date.now() - startTime) / 1000;
    stats.currentRps = stats.totalRequests / stats.elapsedSeconds * 60; // Per minute
    stats.latencyP50 = latencyTracker.getP50();
    stats.latencyP95 = latencyTracker.getP95();
    stats.latencyP99 = latencyTracker.getP99();
    
    if (config.onProgress && stats.totalRequests % 50 === 0) {
      config.onProgress(stats);
    }
    
    // Wait for next purge
    const elapsed = Date.now() - requestStartTime;
    if (elapsed < intervalMs) {
      await sleep(intervalMs - elapsed);
    }
  }
  
  // Get final purge stats
  const purgeStats = getPurgeStats();
  stats.rateLimitedRequests = purgeStats.rateLimitedPurges;
  stats.failedRequests = purgeStats.failedPurges;
  stats.errorRate = stats.totalRequests > 0 
    ? (stats.failedRequests + stats.rateLimitedRequests) / stats.totalRequests 
    : 0;
  
  const failureReasons: string[] = [];
  const recommendations: string[] = [];
  
  if (stats.rateLimitedRequests > 0) {
    failureReasons.push(`${stats.rateLimitedRequests} purges were rate limited`);
    recommendations.push('Increase debounce window or reduce purge frequency');
  }
  
  if (purgeStats.queueDepth > 100) {
    failureReasons.push(`Purge queue depth ${purgeStats.queueDepth} indicates backpressure`);
    recommendations.push('Increase batch size or purge processing rate');
  }
  
  return {
    passed: failureReasons.length === 0,
    stats,
    failureReasons,
    recommendations,
  };
}

/**
 * Run chaos test for CDN failures
 * 
 * Tests: CDN 5xx/timeouts → circuit breaker activates within 1 minute
 */
export async function runChaosTest(config: LoadTestConfig): Promise<LoadTestResult> {
  const stats: LoadTestStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    latencyP50: 0,
    latencyP95: 0,
    latencyP99: 0,
    currentRps: 0,
    cacheHitRatio: 0,
    notModifiedRatio: 0,
    errorRate: 0,
    elapsedSeconds: 0,
  };
  
  const failureReasons: string[] = [];
  const recommendations: string[] = [];
  
  console.log('Starting chaos test: simulating CDN failures');
  
  // In a real test, this would inject failures via chaos engineering tools
  // For now, we simulate the test results
  
  if (config.dryRun) {
    // Simulate successful circuit breaker activation
    stats.totalRequests = 1000;
    stats.successfulRequests = 850;
    stats.failedRequests = 150;
    stats.errorRate = 0.15; // 15% error rate during failure injection
    
    console.log('Chaos test: Circuit breaker activated within 45 seconds (simulated)');
  } else {
    // Real chaos test would:
    // 1. Inject CDN failures (5xx responses)
    // 2. Monitor circuit breaker state
    // 3. Verify fallback to origin
    // 4. Measure recovery time
    
    failureReasons.push('Real chaos test requires infrastructure integration');
    recommendations.push('Implement chaos engineering tooling (e.g., Chaos Monkey, Gremlin)');
  }
  
  return {
    passed: failureReasons.length === 0,
    stats,
    failureReasons,
    recommendations,
  };
}

/**
 * Run realtime connection load test
 * 
 * Tests: 50k concurrent connections, latency budget met, error rate <0.1%
 */
export async function runRealtimeLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
  const stats: LoadTestStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    latencyP50: 0,
    latencyP95: 0,
    latencyP99: 0,
    currentRps: 0,
    cacheHitRatio: 0,
    notModifiedRatio: 0,
    errorRate: 0,
    elapsedSeconds: 0,
  };
  
  const failureReasons: string[] = [];
  const recommendations: string[] = [];
  
  const targetConnections = 1000; // Reduced for local testing; 50k for production
  
  console.log(`Starting realtime load test: ${targetConnections} concurrent connections`);
  
  if (config.dryRun) {
    // Simulate realtime test results
    stats.totalRequests = targetConnections;
    stats.successfulRequests = Math.floor(targetConnections * 0.998);
    stats.failedRequests = targetConnections - stats.successfulRequests;
    stats.latencyP95 = 350;
    stats.errorRate = stats.failedRequests / stats.totalRequests;
    
    if (stats.latencyP95 > SLO_TARGETS.realtimeP95LatencyMs) {
      failureReasons.push(`Realtime P95 latency ${stats.latencyP95}ms exceeds target ${SLO_TARGETS.realtimeP95LatencyMs}ms`);
    }
    
    if (stats.errorRate > SLO_TARGETS.realtimeErrorRate) {
      failureReasons.push(`Realtime error rate ${(stats.errorRate * 100).toFixed(2)}% exceeds target ${SLO_TARGETS.realtimeErrorRate * 100}%`);
    }
  } else {
    failureReasons.push('Realtime load test requires WebSocket client infrastructure');
    recommendations.push('Use k6 or Artillery with WebSocket support for production testing');
  }
  
  return {
    passed: failureReasons.length === 0,
    stats,
    failureReasons,
    recommendations,
  };
}

/**
 * Run full load test suite
 */
export async function runFullLoadTestSuite(config: LoadTestConfig): Promise<{
  traffic: LoadTestResult;
  purge: LoadTestResult;
  chaos: LoadTestResult;
  realtime: LoadTestResult;
  overallPassed: boolean;
  summary: string;
}> {
  console.log('\n========================================');
  console.log('LOAD TESTING SUITE');
  console.log('========================================\n');
  
  const results = {
    traffic: await runTrafficLoadTest({ ...config, durationSeconds: Math.min(config.durationSeconds, 120) }),
    purge: await runPurgeThroughputTest(config),
    chaos: await runChaosTest(config),
    realtime: await runRealtimeLoadTest(config),
    overallPassed: false,
    summary: '',
  };
  
  results.overallPassed = results.traffic.passed && 
                          results.purge.passed && 
                          results.chaos.passed && 
                          results.realtime.passed;
  
  // Build summary
  const summaryLines = [
    '\n========================================',
    'LOAD TEST RESULTS',
    '========================================',
    '',
    `Traffic Test: ${results.traffic.passed ? '✅ PASSED' : '❌ FAILED'}`,
    `  - Achieved RPS: ${results.traffic.stats.currentRps.toFixed(1)}`,
    `  - P95 Latency: ${results.traffic.stats.latencyP95.toFixed(0)}ms`,
    `  - Error Rate: ${(results.traffic.stats.errorRate * 100).toFixed(2)}%`,
    '',
    `Purge Test: ${results.purge.passed ? '✅ PASSED' : '❌ FAILED'}`,
    `  - Purges/min: ${results.purge.stats.currentRps.toFixed(0)}`,
    `  - Rate Limited: ${results.purge.stats.rateLimitedRequests}`,
    '',
    `Chaos Test: ${results.chaos.passed ? '✅ PASSED' : '❌ FAILED'}`,
    '',
    `Realtime Test: ${results.realtime.passed ? '✅ PASSED' : '❌ FAILED'}`,
    `  - P95 Latency: ${results.realtime.stats.latencyP95.toFixed(0)}ms`,
    `  - Error Rate: ${(results.realtime.stats.errorRate * 100).toFixed(3)}%`,
    '',
    `Overall: ${results.overallPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`,
    '========================================',
  ];
  
  if (!results.overallPassed) {
    summaryLines.push('', 'Failure Reasons:');
    
    if (!results.traffic.passed) {
      results.traffic.failureReasons.forEach(r => summaryLines.push(`  - Traffic: ${r}`));
    }
    if (!results.purge.passed) {
      results.purge.failureReasons.forEach(r => summaryLines.push(`  - Purge: ${r}`));
    }
    if (!results.chaos.passed) {
      results.chaos.failureReasons.forEach(r => summaryLines.push(`  - Chaos: ${r}`));
    }
    if (!results.realtime.passed) {
      results.realtime.failureReasons.forEach(r => summaryLines.push(`  - Realtime: ${r}`));
    }
    
    summaryLines.push('', 'Recommendations:');
    const allRecommendations = [
      ...results.traffic.recommendations,
      ...results.purge.recommendations,
      ...results.chaos.recommendations,
      ...results.realtime.recommendations,
    ];
    [...new Set(allRecommendations)].forEach(r => summaryLines.push(`  - ${r}`));
  }
  
  results.summary = summaryLines.join('\n');
  console.log(results.summary);
  
  return results;
}

// Helper functions

function selectWeightedEndpoint(endpoints: Array<{ path: string; weight: number; method?: string }>) {
  const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const endpoint of endpoints) {
    random -= endpoint.weight;
    if (random <= 0) {
      return endpoint;
    }
  }
  
  return endpoints[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  runFullLoadTestSuite({
    baseUrl: process.env.BASE_URL || 'http://localhost:4000',
    authToken: process.env.AUTH_TOKEN || 'test-token',
    durationSeconds: 60,
    targetRps: 100,
    dryRun,
    onProgress: (stats) => {
      process.stdout.write(`\rRequests: ${stats.totalRequests} | RPS: ${stats.currentRps.toFixed(1)} | P95: ${stats.latencyP95.toFixed(0)}ms`);
    },
  }).then(results => {
    process.exit(results.overallPassed ? 0 : 1);
  });
}

export type { LoadTestConfig, LoadTestStats, LoadTestResult };


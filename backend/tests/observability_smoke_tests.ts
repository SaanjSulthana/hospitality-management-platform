/**
 * Observability Smoke Tests
 * 
 * These tests verify that all monitoring, metrics, and alerting endpoints
 * are working correctly after deployment.
 * 
 * Run with: npm test backend/tests/observability_smoke_tests.ts
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4000';
const TIMEOUT = 10000; // 10 seconds

describe('Observability Smoke Tests', () => {
  describe('Health Check Endpoints', () => {
    it('should return healthy status from /health', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(['ok', 'degraded']).toContain(data.status);
      expect(data).toHaveProperty('timestamp');
    }, TIMEOUT);

    it('should return alive status from /live', async () => {
      const response = await fetch(`${BASE_URL}/live`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.alive).toBe(true);
      expect(data).toHaveProperty('timestamp');
    }, TIMEOUT);

    it('should return readiness status from /ready', async () => {
      const response = await fetch(`${BASE_URL}/ready`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('ready');
      expect(data).toHaveProperty('checks');
      expect(data.checks).toHaveProperty('cache');
      expect(data.checks).toHaveProperty('database');
      expect(data.checks).toHaveProperty('metrics');
    }, TIMEOUT);
  });

  describe('System Monitoring Endpoints', () => {
    it('should return system health dashboard', async () => {
      const response = await fetch(`${BASE_URL}/monitoring/dashboard`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('overallStatus');
      expect(['healthy', 'degraded', 'critical']).toContain(data.overallStatus);
      expect(data).toHaveProperty('components');
      expect(data.components).toHaveProperty('cache');
      expect(data.components).toHaveProperty('database');
      expect(data.components).toHaveProperty('partitions');
      expect(data.components).toHaveProperty('invalidation');
      expect(data).toHaveProperty('alerts');
      expect(data).toHaveProperty('metrics');
    }, TIMEOUT);
  });

  describe('Cache Monitoring Endpoints', () => {
    it('should return cache status', async () => {
      const response = await fetch(`${BASE_URL}/cache/status`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('caches');
      expect(data.caches).toHaveProperty('reports');
      expect(data.caches).toHaveProperty('balance');
      expect(data.caches).toHaveProperty('summary');
      
      // Verify cache structure
      expect(data.caches.reports).toHaveProperty('type');
      expect(['redis', 'memory']).toContain(data.caches.reports.type);
      expect(data.caches.reports).toHaveProperty('available');
    }, TIMEOUT);

    it('should return cache health', async () => {
      const response = await fetch(`${BASE_URL}/cache/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('healthy');
      expect(data).toHaveProperty('backend');
      expect(['redis', 'memory']).toContain(data.backend);
      expect(data).toHaveProperty('message');
    }, TIMEOUT);
  });

  describe('Database Monitoring Endpoints', () => {
    it('should return replica status', async () => {
      const response = await fetch(`${BASE_URL}/database/replicas/status`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('primary');
      expect(data).toHaveProperty('replicas');
      expect(data.replicas).toHaveProperty('count');
      expect(data.replicas).toHaveProperty('healthy');
      expect(data.replicas).toHaveProperty('unhealthy');
    }, TIMEOUT);

    it('should return replica health', async () => {
      const response = await fetch(`${BASE_URL}/database/replicas/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('healthy');
      expect(data).toHaveProperty('replicasEnabled');
      expect(data).toHaveProperty('replicaCount');
      expect(data).toHaveProperty('message');
    }, TIMEOUT);

    it('should return replica lag', async () => {
      const response = await fetch(`${BASE_URL}/database/replicas/lag`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('replicas');
      expect(Array.isArray(data.replicas)).toBe(true);
      
      // If replicas exist, verify structure
      if (data.replicas.length > 0) {
        const replica = data.replicas[0];
        expect(replica).toHaveProperty('name');
        expect(replica).toHaveProperty('lagSeconds');
        expect(replica).toHaveProperty('status');
        expect(['healthy', 'warning', 'critical', 'error']).toContain(replica.status);
      }
    }, TIMEOUT);

    it('should return connection pool stats', async () => {
      const response = await fetch(`${BASE_URL}/database/connection-pool/stats`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('primary');
      expect(data).toHaveProperty('replicas');
    }, TIMEOUT);
  });

  describe('Metrics Endpoints', () => {
    it('should return all metrics', async () => {
      const response = await fetch(`${BASE_URL}/metrics/all`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('metrics');
      expect(typeof data.metrics).toBe('object');
    }, TIMEOUT);

    it('should return aggregated metrics', async () => {
      const response = await fetch(`${BASE_URL}/metrics/aggregated`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('cache');
      expect(data).toHaveProperty('database');
      expect(data).toHaveProperty('partitions');
      
      // Verify cache metrics structure
      expect(data.cache).toHaveProperty('available');
      expect(data.cache).toHaveProperty('backend');
      expect(data.cache).toHaveProperty('totalEntries');
      expect(data.cache).toHaveProperty('invalidationQueue');
      
      // Verify database metrics structure
      expect(data.database).toHaveProperty('replicasEnabled');
      expect(data.database).toHaveProperty('replicaCount');
      expect(data.database).toHaveProperty('healthyReplicas');
      expect(data.database).toHaveProperty('maxReplicaLag');
      expect(data.database).toHaveProperty('primaryConnections');
      
      // Verify partition metrics structure
      expect(data.partitions).toHaveProperty('enabled');
      expect(data.partitions).toHaveProperty('count');
    }, TIMEOUT);
  });

  describe('Alert Endpoints', () => {
    it('should return active alerts', async () => {
      const response = await fetch(`${BASE_URL}/alerts/active`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('stats');
      expect(data).toHaveProperty('alerts');
      
      // Verify stats structure
      expect(data.stats).toHaveProperty('active');
      expect(data.stats).toHaveProperty('critical');
      expect(data.stats).toHaveProperty('warning');
      expect(data.stats).toHaveProperty('info');
      expect(data.stats).toHaveProperty('acknowledged');
      
      // Verify alerts is an array
      expect(Array.isArray(data.alerts)).toBe(true);
    }, TIMEOUT);

    it('should return alert stats', async () => {
      const response = await fetch(`${BASE_URL}/alerts/stats`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('stats');
      expect(data.stats).toHaveProperty('active');
      expect(data.stats).toHaveProperty('critical');
      expect(data.stats).toHaveProperty('warning');
    }, TIMEOUT);

    it('should return alert history', async () => {
      const response = await fetch(`${BASE_URL}/alerts/history?limit=10`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('count');
      expect(data).toHaveProperty('alerts');
      expect(Array.isArray(data.alerts)).toBe(true);
    }, TIMEOUT);
  });

  describe('Response Time Performance', () => {
    it('should respond to /health in < 200ms', async () => {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}/health`);
      const duration = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200);
    }, TIMEOUT);

    it('should respond to /cache/status in < 500ms', async () => {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}/cache/status`);
      const duration = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
    }, TIMEOUT);

    it('should respond to /monitoring/dashboard in < 2000ms', async () => {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}/monitoring/dashboard`);
      const duration = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000);
    }, TIMEOUT);
  });

  describe('Data Integrity Checks', () => {
    it('should have consistent replica counts across endpoints', async () => {
      const [statusResponse, healthResponse] = await Promise.all([
        fetch(`${BASE_URL}/database/replicas/status`),
        fetch(`${BASE_URL}/database/replicas/health`),
      ]);
      
      const statusData = await statusResponse.json();
      const healthData = await healthResponse.json();
      
      expect(statusData.replicas.count).toBe(healthData.replicaCount);
    }, TIMEOUT);

    it('should have consistent cache backend across endpoints', async () => {
      const [statusResponse, healthResponse] = await Promise.all([
        fetch(`${BASE_URL}/cache/status`),
        fetch(`${BASE_URL}/cache/health`),
      ]);
      
      const statusData = await statusResponse.json();
      const healthData = await healthResponse.json();
      
      expect(statusData.caches.reports.type).toBe(healthData.backend);
    }, TIMEOUT);

    it('should have consistent alert counts', async () => {
      const [activeResponse, statsResponse] = await Promise.all([
        fetch(`${BASE_URL}/alerts/active`),
        fetch(`${BASE_URL}/alerts/stats`),
      ]);
      
      const activeData = await activeResponse.json();
      const statsData = await statsResponse.json();
      
      expect(activeData.stats.active).toBe(statsData.stats.active);
      expect(activeData.stats.critical).toBe(statsData.stats.critical);
      expect(activeData.stats.warning).toBe(statsData.stats.warning);
    }, TIMEOUT);
  });

  describe('Error Handling', () => {
    it('should handle invalid metric name gracefully', async () => {
      const response = await fetch(`${BASE_URL}/metrics/invalid-metric-name`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('name');
      expect(data.name).toBe('invalid-metric-name');
      expect(data).toHaveProperty('data');
    }, TIMEOUT);
  });
});

// Export test runner for CI/CD
export async function runObservabilitySmokeTests(): Promise<{
  passed: number;
  failed: number;
  total: number;
  success: boolean;
}> {
  console.log('🧪 Running Observability Smoke Tests...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    success: false,
  };

  try {
    // Run all tests (this would normally use Jest runner)
    // For now, we'll run a quick check of critical endpoints
    
    const criticalEndpoints = [
      '/health',
      '/cache/status',
      '/database/replicas/status',
      '/alerts/active',
      '/metrics/aggregated',
      '/monitoring/dashboard',
    ];

    for (const endpoint of criticalEndpoints) {
      results.total++;
      try {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        if (response.status === 200) {
          results.passed++;
          console.log(`✅ ${endpoint}`);
        } else {
          results.failed++;
          console.error(`❌ ${endpoint} - Status: ${response.status}`);
        }
      } catch (error) {
        results.failed++;
        console.error(`❌ ${endpoint} - Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    results.success = results.failed === 0;

    console.log(`\n📊 Results: ${results.passed}/${results.total} passed`);
    if (results.success) {
      console.log('✅ All observability smoke tests passed!');
    } else {
      console.error(`❌ ${results.failed} test(s) failed`);
    }

    return results;
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    return { ...results, success: false };
  }
}

// If running directly
if (require.main === module) {
  runObservabilitySmokeTests()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}


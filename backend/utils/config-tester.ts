import { SQLDatabase } from "encore.dev/storage/sqldb";
import log from "encore.dev/log";
import { getEnvironmentConfig, validateEnvironmentConfig } from "../config/environment";
import { errorHandler, ErrorType } from "./error-handler";

// Database connection for testing
const testDB = SQLDatabase.named("hospitality");

/**
 * Configuration test result
 */
export interface ConfigTestResult {
  testName: string;
  passed: boolean;
  message: string;
  duration: number;
  details?: Record<string, any>;
}

/**
 * Configuration test suite result
 */
export interface ConfigTestSuiteResult {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  results: ConfigTestResult[];
  overallPassed: boolean;
}

/**
 * Configuration tester class
 */
export class ConfigTester {
  private results: ConfigTestResult[] = [];

  /**
   * Run all configuration tests
   */
  public async runAllTests(): Promise<ConfigTestSuiteResult> {
    const startTime = Date.now();
    this.results = [];

    log.info('Starting configuration test suite');

    // Run all test categories
    await this.testEnvironmentConfiguration();
    await this.testDatabaseConfiguration();
    await this.testSecurityConfiguration();
    await this.testPerformanceConfiguration();
    await this.testFeatureConfiguration();
    await this.testServiceConfiguration();

    const duration = Date.now() - startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.filter(r => !r.passed).length;

    const result: ConfigTestSuiteResult = {
      suiteName: 'Configuration Test Suite',
      totalTests: this.results.length,
      passedTests,
      failedTests,
      duration,
      results: this.results,
      overallPassed: failedTests === 0,
    };

    log.info('Configuration test suite completed', {
      totalTests: result.totalTests,
      passedTests: result.passedTests,
      failedTests: result.failedTests,
      duration: result.duration,
      overallPassed: result.overallPassed,
    });

    return result;
  }

  /**
   * Test environment configuration
   */
  private async testEnvironmentConfiguration(): Promise<void> {
    await this.runTest('Environment Configuration Validation', async () => {
      const validation = validateEnvironmentConfig();
      
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      const config = getEnvironmentConfig();
      
      // Test environment-specific settings
      if (config.name === 'production') {
        if (config.features.enableDevTools) {
          throw new Error('Development tools should not be enabled in production');
        }
        
        if (config.features.enableMockData) {
          throw new Error('Mock data should not be enabled in production');
        }
        
        if (!config.security.requireHttps) {
          throw new Error('HTTPS should be required in production');
        }
      }

      return {
        environment: config.name,
        debug: config.debug,
        features: config.features,
      };
    });
  }

  /**
   * Test database configuration
   */
  private async testDatabaseConfiguration(): Promise<void> {
    await this.runTest('Database Connection Test', async () => {
      try {
        const result = await testDB.query('SELECT 1 as test');
        
        if (!result.rows || result.rows.length === 0) {
          throw new Error('Database query returned no results');
        }

        if (result.rows[0].test !== 1) {
          throw new Error('Database query returned unexpected result');
        }

        return {
          connected: true,
          responseTime: Date.now(),
        };
      } catch (error) {
        throw new Error(`Database connection failed: ${error.message}`);
      }
    });

    await this.runTest('Database Schema Validation', async () => {
      try {
        // Check if essential tables exist
        const tablesResult = await testDB.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('tasks', 'users', 'organizations', 'properties')
          ORDER BY table_name
        `);

        const existingTables = tablesResult.rows.map(row => row.table_name);
        const requiredTables = ['tasks', 'users', 'organizations', 'properties'];
        const missingTables = requiredTables.filter(table => !existingTables.includes(table));

        if (missingTables.length > 0) {
          throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
        }

        return {
          existingTables,
          requiredTables,
          allTablesPresent: true,
        };
      } catch (error) {
        throw new Error(`Database schema validation failed: ${error.message}`);
      }
    });
  }

  /**
   * Test security configuration
   */
  private async testSecurityConfiguration(): Promise<void> {
    await this.runTest('Security Configuration Validation', async () => {
      const config = getEnvironmentConfig();
      
      // Validate JWT expiry times
      if (config.security.jwtExpiry <= 0) {
        throw new Error('JWT expiry must be greater than 0');
      }

      if (config.security.refreshExpiry <= 0) {
        throw new Error('Refresh token expiry must be greater than 0');
      }

      if (config.security.jwtExpiry >= config.security.refreshExpiry) {
        throw new Error('JWT expiry should be less than refresh token expiry');
      }

      // Validate production security settings
      if (config.name === 'production') {
        if (config.security.jwtExpiry > 4 * 60 * 60 * 1000) { // 4 hours
          throw new Error('JWT expiry is too long for production (>4 hours)');
        }
      }

      return {
        jwtExpiry: config.security.jwtExpiry,
        refreshExpiry: config.security.refreshExpiry,
        enableCors: config.security.enableCors,
        requireHttps: config.security.requireHttps,
      };
    });
  }

  /**
   * Test performance configuration
   */
  private async testPerformanceConfiguration(): Promise<void> {
    await this.runTest('Performance Configuration Validation', async () => {
      const config = getEnvironmentConfig();
      
      // Validate file size limits
      if (config.performance.maxFileSize <= 0) {
        throw new Error('Max file size must be greater than 0');
      }

      if (config.performance.maxFileSize > 50 * 1024 * 1024) { // 50MB
        throw new Error('Max file size is too large (>50MB)');
      }

      // Validate cache settings
      if (config.performance.cacheTimeout < 0) {
        throw new Error('Cache timeout cannot be negative');
      }

      if (config.performance.enableCaching && config.performance.cacheTimeout === 0) {
        throw new Error('Caching is enabled but cache timeout is 0');
      }

      return {
        maxFileSize: config.performance.maxFileSize,
        enableCaching: config.performance.enableCaching,
        cacheTimeout: config.performance.cacheTimeout,
        enableCompression: config.performance.enableCompression,
      };
    });
  }

  /**
   * Test feature configuration
   */
  private async testFeatureConfiguration(): Promise<void> {
    await this.runTest('Feature Configuration Validation', async () => {
      const config = getEnvironmentConfig();
      
      // Validate feature combinations
      if (config.name === 'production') {
        if (config.features.enableDevTools) {
          throw new Error('Development tools should not be enabled in production');
        }
        
        if (config.features.enableMockData) {
          throw new Error('Mock data should not be enabled in production');
        }
      }

      if (config.name === 'development') {
        if (!config.features.enableDevTools) {
          throw new Error('Development tools should be enabled in development');
        }
      }

      return {
        enableDevTools: config.features.enableDevTools,
        enableMockData: config.features.enableMockData,
        enableAnalytics: config.features.enableAnalytics,
        enableErrorReporting: config.features.enableErrorReporting,
      };
    });
  }

  /**
   * Test service configuration
   */
  private async testServiceConfiguration(): Promise<void> {
    await this.runTest('Service Configuration Validation', async () => {
      const config = getEnvironmentConfig();
      
      // Test database connection limits
      if (config.database.maxConnections <= 0) {
        throw new Error('Database max connections must be greater than 0');
      }

      if (config.database.maxConnections > 100) {
        throw new Error('Database max connections is too high (>100)');
      }

      // Test timeout settings
      if (config.database.connectionTimeout <= 0) {
        throw new Error('Database connection timeout must be greater than 0');
      }

      if (config.database.queryTimeout <= 0) {
        throw new Error('Database query timeout must be greater than 0');
      }

      return {
        maxConnections: config.database.maxConnections,
        connectionTimeout: config.database.connectionTimeout,
        queryTimeout: config.database.queryTimeout,
      };
    });
  }

  /**
   * Run a single test
   */
  private async runTest(testName: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        testName,
        passed: true,
        message: 'Test passed successfully',
        duration,
        details: result,
      });
      
      log.debug(`Test passed: ${testName}`, { duration, result });
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        testName,
        passed: false,
        message: error.message,
        duration,
        details: { error: error.message },
      });
      
      log.error(`Test failed: ${testName}`, { 
        duration, 
        error: error.message,
        stack: error.stack 
      });
    }
  }

  /**
   * Get test results summary
   */
  public getResultsSummary(): string {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    return `
Configuration Test Results:
- Total Tests: ${total}
- Passed: ${passed}
- Failed: ${failed}
- Success Rate: ${total > 0 ? Math.round((passed / total) * 100) : 0}%

${failed > 0 ? 'Failed Tests:' : 'All tests passed!'}
${this.results.filter(r => !r.passed).map(r => `- ${r.testName}: ${r.message}`).join('\n')}
    `.trim();
  }
}

/**
 * Utility function to run configuration tests
 */
export async function runConfigurationTests(): Promise<ConfigTestSuiteResult> {
  const tester = new ConfigTester();
  return await tester.runAllTests();
}

/**
 * Quick configuration health check
 */
export async function quickConfigHealthCheck(): Promise<boolean> {
  try {
    // Test basic configuration validation
    const validation = validateEnvironmentConfig();
    if (!validation.isValid) {
      return false;
    }

    // Test database connectivity
    await testDB.query('SELECT 1');
    
    return true;
  } catch (error) {
    log.error('Quick configuration health check failed', { error: error.message });
    return false;
  }
}

/**
 * Configuration testing utilities
 */

import { EnvironmentConfig } from '../config/environment-loader';
import { EnvironmentInfo } from './environment-detector';
import { ValidationResult } from './config-validator-simple';

export interface TestConfig {
  name: string;
  description: string;
  config: EnvironmentConfig;
  envInfo: EnvironmentInfo;
  expectedValidation: {
    isValid: boolean;
    minScore: number;
    expectedErrors: string[];
    expectedWarnings: string[];
  };
}

export interface TestResult {
  testName: string;
  passed: boolean;
  actualValidation: ValidationResult;
  expectedValidation: any;
  errors: string[];
  warnings: string[];
  performance: {
    loadTime: number;
    validationTime: number;
  };
}

/**
 * Configuration testing utilities
 */
export class ConfigTestingUtils {
  private static instance: ConfigTestingUtils;

  private constructor() {}

  public static getInstance(): ConfigTestingUtils {
    if (!ConfigTestingUtils.instance) {
      ConfigTestingUtils.instance = new ConfigTestingUtils();
    }
    return ConfigTestingUtils.instance;
  }

  /**
   * Create test configuration for development environment
   */
  public createDevelopmentTestConfig(): TestConfig {
    return {
      name: 'Development Environment Test',
      description: 'Test configuration for development environment',
      config: {
        name: 'development',
        debug: true,
        api: {
          baseUrl: 'http://localhost:4000',
          timeout: 60000,
          retryAttempts: 1,
          retryDelay: 500,
        },
        logging: {
          level: 'debug',
          enableConsole: true,
          enableRemote: false,
        },
        database: {
          name: 'hospitality',
          maxConnections: 10,
          connectionTimeout: 30000,
          queryTimeout: 60000,
        },
        security: {
          jwtExpiry: 24 * 60 * 60 * 1000,
          refreshExpiry: 7 * 24 * 60 * 60 * 1000,
          enableCors: true,
          requireHttps: false,
          allowedOrigins: ['*'],
        },
        performance: {
          enableCaching: false,
          cacheTimeout: 0,
          enableCompression: false,
          maxFileSize: 50 * 1024 * 1024,
          enableServiceWorker: false,
        },
        features: {
          enableDevTools: true,
          enableMockData: true,
          enableAnalytics: false,
          enableErrorReporting: false,
          enablePwa: false,
          enableOfflineMode: false,
        },
        ui: {
          theme: 'light',
          enableAnimations: true,
          enableTransitions: true,
          enableSoundEffects: true,
        },
        monitoring: {
          enablePerformanceMonitoring: true,
          enableErrorTracking: true,
          enableUserAnalytics: false,
          sampleRate: 1.0,
        },
      },
      envInfo: {
        name: 'development',
        isDevelopment: true,
        isProduction: false,
        isStaging: false,
        isTest: false,
        isLocal: true,
        isServer: false,
        isClient: true,
        nodeEnv: 'development',
        viteEnv: 'development',
        hostname: 'localhost',
        protocol: 'http:',
        port: 3000,
        userAgent: 'test',
        timestamp: new Date().toISOString(),
      },
      expectedValidation: {
        isValid: true,
        minScore: 80,
        expectedErrors: [],
        expectedWarnings: [],
      },
    };
  }

  /**
   * Create test configuration for production environment
   */
  public createProductionTestConfig(): TestConfig {
    return {
      name: 'Production Environment Test',
      description: 'Test configuration for production environment',
      config: {
        name: 'production',
        debug: false,
        api: {
          baseUrl: 'https://api.hospitality.com',
          timeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
        },
        logging: {
          level: 'error',
          enableConsole: false,
          enableRemote: true,
          remoteEndpoint: 'https://api.hospitality.com/logs',
        },
        database: {
          name: 'hospitality',
          maxConnections: 50,
          connectionTimeout: 30000,
          queryTimeout: 60000,
        },
        security: {
          jwtExpiry: 2 * 60 * 60 * 1000,
          refreshExpiry: 7 * 24 * 60 * 60 * 1000,
          enableCors: false,
          requireHttps: true,
          allowedOrigins: ['https://hospitality.com'],
        },
        performance: {
          enableCaching: true,
          cacheTimeout: 5 * 60 * 1000,
          enableCompression: true,
          maxFileSize: 5 * 1024 * 1024,
          enableServiceWorker: true,
        },
        features: {
          enableDevTools: false,
          enableMockData: false,
          enableAnalytics: true,
          enableErrorReporting: true,
          enablePwa: true,
          enableOfflineMode: true,
        },
        ui: {
          theme: 'light',
          enableAnimations: true,
          enableTransitions: true,
          enableSoundEffects: false,
        },
        monitoring: {
          enablePerformanceMonitoring: true,
          enableErrorTracking: true,
          enableUserAnalytics: true,
          sampleRate: 0.1,
        },
      },
      envInfo: {
        name: 'production',
        isDevelopment: false,
        isProduction: true,
        isStaging: false,
        isTest: false,
        isLocal: false,
        isServer: false,
        isClient: true,
        nodeEnv: 'production',
        viteEnv: 'production',
        hostname: 'hospitality.com',
        protocol: 'https:',
        port: null,
        userAgent: 'test',
        timestamp: new Date().toISOString(),
      },
      expectedValidation: {
        isValid: true,
        minScore: 90,
        expectedErrors: [],
        expectedWarnings: [],
      },
    };
  }

  /**
   * Create test configuration for staging environment
   */
  public createStagingTestConfig(): TestConfig {
    return {
      name: 'Staging Environment Test',
      description: 'Test configuration for staging environment',
      config: {
        name: 'staging',
        debug: true,
        api: {
          baseUrl: 'https://staging-api.hospitality.com',
          timeout: 45000,
          retryAttempts: 3,
          retryDelay: 1000,
        },
        logging: {
          level: 'info',
          enableConsole: true,
          enableRemote: true,
          remoteEndpoint: 'https://staging-api.hospitality.com/logs',
        },
        database: {
          name: 'hospitality_staging',
          maxConnections: 20,
          connectionTimeout: 30000,
          queryTimeout: 60000,
        },
        security: {
          jwtExpiry: 4 * 60 * 60 * 1000,
          refreshExpiry: 7 * 24 * 60 * 60 * 1000,
          enableCors: true,
          requireHttps: true,
          allowedOrigins: ['https://staging.hospitality.com'],
        },
        performance: {
          enableCaching: true,
          cacheTimeout: 2 * 60 * 1000,
          enableCompression: true,
          maxFileSize: 8 * 1024 * 1024,
          enableServiceWorker: true,
        },
        features: {
          enableDevTools: true,
          enableMockData: false,
          enableAnalytics: true,
          enableErrorReporting: true,
          enablePwa: true,
          enableOfflineMode: true,
        },
        ui: {
          theme: 'light',
          enableAnimations: true,
          enableTransitions: true,
          enableSoundEffects: false,
        },
        monitoring: {
          enablePerformanceMonitoring: true,
          enableErrorTracking: true,
          enableUserAnalytics: true,
          sampleRate: 0.5,
        },
      },
      envInfo: {
        name: 'staging',
        isDevelopment: false,
        isProduction: false,
        isStaging: true,
        isTest: false,
        isLocal: false,
        isServer: false,
        isClient: true,
        nodeEnv: 'staging',
        viteEnv: 'staging',
        hostname: 'staging.hospitality.com',
        protocol: 'https:',
        port: null,
        userAgent: 'test',
        timestamp: new Date().toISOString(),
      },
      expectedValidation: {
        isValid: true,
        minScore: 85,
        expectedErrors: [],
        expectedWarnings: [],
      },
    };
  }

  /**
   * Create test configuration for test environment
   */
  public createTestEnvironmentTestConfig(): TestConfig {
    return {
      name: 'Test Environment Test',
      description: 'Test configuration for test environment',
      config: {
        name: 'test',
        debug: true,
        api: {
          baseUrl: 'http://localhost:4000',
          timeout: 10000,
          retryAttempts: 1,
          retryDelay: 100,
        },
        logging: {
          level: 'error',
          enableConsole: false,
          enableRemote: false,
        },
        database: {
          name: 'hospitality_test',
          maxConnections: 5,
          connectionTimeout: 10000,
          queryTimeout: 30000,
        },
        security: {
          jwtExpiry: 60 * 60 * 1000,
          refreshExpiry: 24 * 60 * 60 * 1000,
          enableCors: true,
          requireHttps: false,
          allowedOrigins: ['*'],
        },
        performance: {
          enableCaching: false,
          cacheTimeout: 0,
          enableCompression: false,
          maxFileSize: 1024 * 1024,
          enableServiceWorker: false,
        },
        features: {
          enableDevTools: false,
          enableMockData: true,
          enableAnalytics: false,
          enableErrorReporting: false,
          enablePwa: false,
          enableOfflineMode: false,
        },
        ui: {
          theme: 'light',
          enableAnimations: false,
          enableTransitions: false,
          enableSoundEffects: false,
        },
        monitoring: {
          enablePerformanceMonitoring: false,
          enableErrorTracking: false,
          enableUserAnalytics: false,
          sampleRate: 0,
        },
      },
      envInfo: {
        name: 'test',
        isDevelopment: false,
        isProduction: false,
        isStaging: false,
        isTest: true,
        isLocal: true,
        isServer: false,
        isClient: true,
        nodeEnv: 'test',
        viteEnv: 'test',
        hostname: 'localhost',
        protocol: 'http:',
        port: 3000,
        userAgent: 'test',
        timestamp: new Date().toISOString(),
      },
      expectedValidation: {
        isValid: true,
        minScore: 80,
        expectedErrors: [],
        expectedWarnings: [],
      },
    };
  }

  /**
   * Create invalid test configuration
   */
  public createInvalidTestConfig(): TestConfig {
    return {
      name: 'Invalid Configuration Test',
      description: 'Test configuration with invalid values',
      config: {
        name: 'invalid',
        debug: true,
        api: {
          baseUrl: '', // Invalid: empty URL
          timeout: -1000, // Invalid: negative timeout
          retryAttempts: -1, // Invalid: negative retry attempts
          retryDelay: 0, // Invalid: zero retry delay
        },
        logging: {
          level: 'invalid' as any, // Invalid: invalid log level
          enableConsole: true,
          enableRemote: false,
        },
        database: {
          name: '', // Invalid: empty database name
          maxConnections: 0, // Invalid: zero max connections
          connectionTimeout: -1000, // Invalid: negative timeout
          queryTimeout: 0, // Invalid: zero timeout
        },
        security: {
          jwtExpiry: 0, // Invalid: zero expiry
          refreshExpiry: 0, // Invalid: zero expiry
          enableCors: true,
          requireHttps: false,
          allowedOrigins: [],
        },
        performance: {
          enableCaching: false,
          cacheTimeout: -1000, // Invalid: negative cache timeout
          enableCompression: false,
          maxFileSize: 0, // Invalid: zero file size
          enableServiceWorker: false,
        },
        features: {
          enableDevTools: true,
          enableMockData: true,
          enableAnalytics: false,
          enableErrorReporting: false,
          enablePwa: false,
          enableOfflineMode: false,
        },
        ui: {
          theme: 'invalid' as any, // Invalid: invalid theme
          enableAnimations: true,
          enableTransitions: true,
          enableSoundEffects: false,
        },
        monitoring: {
          enablePerformanceMonitoring: true,
          enableErrorTracking: true,
          enableUserAnalytics: false,
          sampleRate: 1.5, // Invalid: sample rate > 1
        },
      },
      envInfo: {
        name: 'development',
        isDevelopment: false,
        isProduction: false,
        isStaging: false,
        isTest: false,
        isLocal: false,
        isServer: false,
        isClient: true,
        nodeEnv: 'invalid',
        viteEnv: 'invalid',
        hostname: 'invalid',
        protocol: 'invalid:',
        port: null,
        userAgent: 'test',
        timestamp: new Date().toISOString(),
      },
      expectedValidation: {
        isValid: false,
        minScore: 0,
        expectedErrors: [
          'API base URL is required',
          'API timeout must be greater than 0',
          'API retry attempts cannot be negative',
          'API retry delay must be greater than 0',
          'Logging level must be one of: debug, info, warn, error',
          'Database name is required',
          'Database max connections must be greater than 0',
          'Database connection timeout must be greater than 0',
          'Database query timeout must be greater than 0',
          'JWT expiry must be greater than 0',
          'Refresh token expiry must be greater than 0',
          'Max file size must be greater than 0',
          'UI theme must be one of: light, dark, auto',
          'Monitoring sample rate must be between 0 and 1',
        ],
        expectedWarnings: [],
      },
    };
  }

  /**
   * Run configuration test
   */
  public async runConfigTest(testConfig: TestConfig, validator: any): Promise<TestResult> {
    const startTime = Date.now();
    
    // Load configuration
    const configLoadTime = Date.now();
    const config = testConfig.config;
    const envInfo = testConfig.envInfo;
    
    // Validate configuration
    const validationStartTime = Date.now();
    const actualValidation = validator.validate(config, envInfo);
    const validationEndTime = Date.now();
    
    const endTime = Date.now();
    
    // Check if test passed
    const passed = this.checkTestResult(testConfig, actualValidation);
    
    // Collect errors and warnings
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!passed) {
      if (actualValidation.score < testConfig.expectedValidation.minScore) {
        errors.push(`Score ${actualValidation.score} is below minimum ${testConfig.expectedValidation.minScore}`);
      }
      
      if (actualValidation.isValid !== testConfig.expectedValidation.isValid) {
        errors.push(`Validation result ${actualValidation.isValid} does not match expected ${testConfig.expectedValidation.isValid}`);
      }
      
      // Check for unexpected errors
      const unexpectedErrors = actualValidation.errors.filter((error: string) => 
        !testConfig.expectedValidation.expectedErrors.some(expected => 
          error.includes(expected) || expected.includes(error)
        )
      );
      errors.push(...unexpectedErrors);
      
      // Check for missing expected errors
      const missingErrors = testConfig.expectedValidation.expectedErrors.filter(expected => 
        !actualValidation.errors.some((error: string) => 
          error.includes(expected) || expected.includes(error)
        )
      );
      if (missingErrors.length > 0) {
        warnings.push(`Missing expected errors: ${missingErrors.join(', ')}`);
      }
    }
    
    return {
      testName: testConfig.name,
      passed,
      actualValidation,
      expectedValidation: testConfig.expectedValidation,
      errors,
      warnings,
      performance: {
        loadTime: configLoadTime - startTime,
        validationTime: validationEndTime - validationStartTime,
      },
    };
  }

  /**
   * Check if test result matches expectations
   */
  private checkTestResult(testConfig: TestConfig, actualValidation: ValidationResult): boolean {
    // Check if validation result matches expected
    if (actualValidation.isValid !== testConfig.expectedValidation.isValid) {
      return false;
    }
    
    // Check if score meets minimum requirement
    if (actualValidation.score < testConfig.expectedValidation.minScore) {
      return false;
    }
    
    // Check if expected errors are present
    for (const expectedError of testConfig.expectedValidation.expectedErrors) {
      const hasError = actualValidation.errors.some(error => 
        error.includes(expectedError) || expectedError.includes(error)
      );
      if (!hasError) {
        return false;
      }
    }
    
    // Check if unexpected errors are present
    for (const actualError of actualValidation.errors) {
      const isExpected = testConfig.expectedValidation.expectedErrors.some(expected => 
        actualError.includes(expected) || expected.includes(actualError)
      );
      if (!isExpected) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Run all configuration tests
   */
  public async runAllConfigTests(validator: any): Promise<TestResult[]> {
    const testConfigs = [
      this.createDevelopmentTestConfig(),
      this.createProductionTestConfig(),
      this.createStagingTestConfig(),
      this.createTestEnvironmentTestConfig(),
      this.createInvalidTestConfig(),
    ];
    
    const results: TestResult[] = [];
    
    for (const testConfig of testConfigs) {
      try {
        const result = await this.runConfigTest(testConfig, validator);
        results.push(result);
      } catch (error) {
        results.push({
          testName: testConfig.name,
          passed: false,
          actualValidation: { isValid: false, errors: [], warnings: [], score: 0 },
          expectedValidation: testConfig.expectedValidation,
          errors: [`Test execution failed: ${error}`],
          warnings: [],
          performance: { loadTime: 0, validationTime: 0 },
        });
      }
    }
    
    return results;
  }

  /**
   * Generate test report
   */
  public generateTestReport(results: TestResult[]): string {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    let report = `# Configuration Test Report\n\n`;
    report += `## Summary\n`;
    report += `- Total Tests: ${totalTests}\n`;
    report += `- Passed: ${passedTests}\n`;
    report += `- Failed: ${failedTests}\n`;
    report += `- Success Rate: ${Math.round((passedTests / totalTests) * 100)}%\n\n`;
    
    report += `## Test Results\n\n`;
    
    for (const result of results) {
      report += `### ${result.testName}\n`;
      report += `- **Status**: ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `- **Score**: ${result.actualValidation.score}/100\n`;
      report += `- **Valid**: ${result.actualValidation.isValid}\n`;
      report += `- **Errors**: ${result.actualValidation.errors.length}\n`;
      report += `- **Warnings**: ${result.actualValidation.warnings.length}\n`;
      report += `- **Load Time**: ${result.performance.loadTime}ms\n`;
      report += `- **Validation Time**: ${result.performance.validationTime}ms\n`;
      
      if (result.errors.length > 0) {
        report += `\n**Errors:**\n`;
        result.errors.forEach(error => report += `- ${error}\n`);
      }
      
      if (result.warnings.length > 0) {
        report += `\n**Warnings:**\n`;
        result.warnings.forEach(warning => report += `- ${warning}\n`);
      }
      
      report += `\n`;
    }
    
    return report;
  }

  /**
   * Create performance benchmark
   */
  public async createPerformanceBenchmark(validator: any, iterations: number = 100): Promise<{
    averageLoadTime: number;
    averageValidationTime: number;
    minLoadTime: number;
    maxLoadTime: number;
    minValidationTime: number;
    maxValidationTime: number;
  }> {
    const testConfig = this.createDevelopmentTestConfig();
    const loadTimes: number[] = [];
    const validationTimes: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      // Load configuration
      const configLoadTime = Date.now();
      const config = testConfig.config;
      const envInfo = testConfig.envInfo;
      
      // Validate configuration
      const validationStartTime = Date.now();
      validator.validate(config, envInfo);
      const validationEndTime = Date.now();
      
      loadTimes.push(configLoadTime - startTime);
      validationTimes.push(validationEndTime - validationStartTime);
    }
    
    return {
      averageLoadTime: loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length,
      averageValidationTime: validationTimes.reduce((a, b) => a + b, 0) / validationTimes.length,
      minLoadTime: Math.min(...loadTimes),
      maxLoadTime: Math.max(...loadTimes),
      minValidationTime: Math.min(...validationTimes),
      maxValidationTime: Math.max(...validationTimes),
    };
  }
}

/**
 * Global configuration testing utilities instance
 */
export const configTestingUtils = ConfigTestingUtils.getInstance();

/**
 * Utility functions for configuration testing
 */
export const testingUtils = {
  /**
   * Create development test config
   */
  createDevelopmentTest: () => configTestingUtils.createDevelopmentTestConfig(),

  /**
   * Create production test config
   */
  createProductionTest: () => configTestingUtils.createProductionTestConfig(),

  /**
   * Create staging test config
   */
  createStagingTest: () => configTestingUtils.createStagingTestConfig(),

  /**
   * Create test environment test config
   */
  createTestEnvironmentTest: () => configTestingUtils.createTestEnvironmentTestConfig(),

  /**
   * Create invalid test config
   */
  createInvalidTest: () => configTestingUtils.createInvalidTestConfig(),

  /**
   * Run configuration test
   */
  runTest: (testConfig: TestConfig, validator: any) => configTestingUtils.runConfigTest(testConfig, validator),

  /**
   * Run all configuration tests
   */
  runAllTests: (validator: any) => configTestingUtils.runAllConfigTests(validator),

  /**
   * Generate test report
   */
  generateReport: (results: TestResult[]) => configTestingUtils.generateTestReport(results),

  /**
   * Create performance benchmark
   */
  createBenchmark: (validator: any, iterations?: number) => configTestingUtils.createPerformanceBenchmark(validator, iterations),
};

// Export default instance
export default configTestingUtils;

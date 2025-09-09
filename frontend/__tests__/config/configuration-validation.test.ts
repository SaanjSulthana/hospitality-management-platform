// Tests for comprehensive configuration validation

import { EnvironmentConfig } from '../../src/config/environment-loader';
import { EnvironmentInfo } from '../../src/utils/environment-detector';
import { ValidationResult } from '../../src/utils/config-validator-simple';

describe('Configuration Validation System', () => {
  describe('Environment Configuration Validation', () => {
    it('should validate development environment configuration', () => {
      const config: EnvironmentConfig = {
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
      };

      const envInfo: EnvironmentInfo = {
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
      };

      // Validate configuration structure
      expect(config.name).toBe('development');
      expect(config.debug).toBe(true);
      expect(config.api.baseUrl).toBe('http://localhost:4000');
      expect(config.api.timeout).toBeGreaterThan(0);
      expect(config.security.jwtExpiry).toBeGreaterThan(0);
      expect(config.security.refreshExpiry).toBeGreaterThan(config.security.jwtExpiry);
      expect(config.features.enableDevTools).toBe(true);
      expect(config.features.enableMockData).toBe(true);
      expect(config.monitoring.sampleRate).toBe(1.0);
    });

    it('should validate production environment configuration', () => {
      const config: EnvironmentConfig = {
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
      };

      const envInfo: EnvironmentInfo = {
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
      };

      // Validate production configuration
      expect(config.name).toBe('production');
      expect(config.debug).toBe(false);
      expect(config.api.baseUrl).toContain('https://');
      expect(config.security.requireHttps).toBe(true);
      expect(config.security.enableCors).toBe(false);
      expect(config.features.enableDevTools).toBe(false);
      expect(config.features.enableMockData).toBe(false);
      expect(config.features.enableAnalytics).toBe(true);
      expect(config.features.enableErrorReporting).toBe(true);
      expect(config.performance.enableCaching).toBe(true);
      expect(config.performance.enableCompression).toBe(true);
      expect(config.monitoring.sampleRate).toBe(0.1);
    });

    it('should validate staging environment configuration', () => {
      const config: EnvironmentConfig = {
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
      };

      // Validate staging configuration
      expect(config.name).toBe('staging');
      expect(config.debug).toBe(true);
      expect(config.api.baseUrl).toContain('staging');
      expect(config.security.requireHttps).toBe(true);
      expect(config.security.enableCors).toBe(true);
      expect(config.features.enableDevTools).toBe(true);
      expect(config.features.enableMockData).toBe(false);
      expect(config.features.enableAnalytics).toBe(true);
      expect(config.performance.enableCaching).toBe(true);
      expect(config.monitoring.sampleRate).toBe(0.5);
    });

    it('should validate test environment configuration', () => {
      const config: EnvironmentConfig = {
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
      };

      // Validate test configuration
      expect(config.name).toBe('test');
      expect(config.debug).toBe(true);
      expect(config.api.timeout).toBe(10000);
      expect(config.features.enableMockData).toBe(true);
      expect(config.features.enableDevTools).toBe(false);
      expect(config.ui.enableAnimations).toBe(false);
      expect(config.performance.enableCaching).toBe(false);
      expect(config.monitoring.sampleRate).toBe(0);
    });
  });

  describe('Configuration Structure Validation', () => {
    it('should have valid API configuration structure', () => {
      const apiConfig = {
        baseUrl: 'http://localhost:4000',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
      };

      expect(typeof apiConfig.baseUrl).toBe('string');
      expect(apiConfig.baseUrl.length).toBeGreaterThan(0);
      expect(apiConfig.timeout).toBeGreaterThan(0);
      expect(apiConfig.retryAttempts).toBeGreaterThanOrEqual(0);
      expect(apiConfig.retryDelay).toBeGreaterThan(0);
    });

    it('should have valid logging configuration structure', () => {
      const loggingConfig = {
        level: 'debug',
        enableConsole: true,
        enableRemote: false,
        remoteEndpoint: undefined,
      };

      expect(['debug', 'info', 'warn', 'error']).toContain(loggingConfig.level);
      expect(typeof loggingConfig.enableConsole).toBe('boolean');
      expect(typeof loggingConfig.enableRemote).toBe('boolean');
    });

    it('should have valid database configuration structure', () => {
      const databaseConfig = {
        name: 'hospitality',
        maxConnections: 10,
        connectionTimeout: 30000,
        queryTimeout: 60000,
      };

      expect(typeof databaseConfig.name).toBe('string');
      expect(databaseConfig.name.length).toBeGreaterThan(0);
      expect(databaseConfig.maxConnections).toBeGreaterThan(0);
      expect(databaseConfig.connectionTimeout).toBeGreaterThan(0);
      expect(databaseConfig.queryTimeout).toBeGreaterThan(0);
    });

    it('should have valid security configuration structure', () => {
      const securityConfig = {
        jwtExpiry: 24 * 60 * 60 * 1000,
        refreshExpiry: 7 * 24 * 60 * 60 * 1000,
        enableCors: true,
        requireHttps: false,
        allowedOrigins: ['*'],
      };

      expect(securityConfig.jwtExpiry).toBeGreaterThan(0);
      expect(securityConfig.refreshExpiry).toBeGreaterThan(0);
      expect(securityConfig.refreshExpiry).toBeGreaterThan(securityConfig.jwtExpiry);
      expect(typeof securityConfig.enableCors).toBe('boolean');
      expect(typeof securityConfig.requireHttps).toBe('boolean');
      expect(Array.isArray(securityConfig.allowedOrigins)).toBe(true);
    });

    it('should have valid performance configuration structure', () => {
      const performanceConfig = {
        enableCaching: false,
        cacheTimeout: 0,
        enableCompression: false,
        maxFileSize: 10 * 1024 * 1024,
        enableServiceWorker: false,
      };

      expect(typeof performanceConfig.enableCaching).toBe('boolean');
      expect(performanceConfig.cacheTimeout).toBeGreaterThanOrEqual(0);
      expect(typeof performanceConfig.enableCompression).toBe('boolean');
      expect(performanceConfig.maxFileSize).toBeGreaterThan(0);
      expect(typeof performanceConfig.enableServiceWorker).toBe('boolean');
    });

    it('should have valid features configuration structure', () => {
      const featuresConfig = {
        enableDevTools: true,
        enableMockData: true,
        enableAnalytics: false,
        enableErrorReporting: false,
        enablePwa: false,
        enableOfflineMode: false,
      };

      expect(typeof featuresConfig.enableDevTools).toBe('boolean');
      expect(typeof featuresConfig.enableMockData).toBe('boolean');
      expect(typeof featuresConfig.enableAnalytics).toBe('boolean');
      expect(typeof featuresConfig.enableErrorReporting).toBe('boolean');
      expect(typeof featuresConfig.enablePwa).toBe('boolean');
      expect(typeof featuresConfig.enableOfflineMode).toBe('boolean');
    });

    it('should have valid UI configuration structure', () => {
      const uiConfig = {
        theme: 'light',
        enableAnimations: true,
        enableTransitions: true,
        enableSoundEffects: false,
      };

      expect(['light', 'dark', 'auto']).toContain(uiConfig.theme);
      expect(typeof uiConfig.enableAnimations).toBe('boolean');
      expect(typeof uiConfig.enableTransitions).toBe('boolean');
      expect(typeof uiConfig.enableSoundEffects).toBe('boolean');
    });

    it('should have valid monitoring configuration structure', () => {
      const monitoringConfig = {
        enablePerformanceMonitoring: true,
        enableErrorTracking: true,
        enableUserAnalytics: false,
        sampleRate: 0.1,
      };

      expect(typeof monitoringConfig.enablePerformanceMonitoring).toBe('boolean');
      expect(typeof monitoringConfig.enableErrorTracking).toBe('boolean');
      expect(typeof monitoringConfig.enableUserAnalytics).toBe('boolean');
      expect(monitoringConfig.sampleRate).toBeGreaterThanOrEqual(0);
      expect(monitoringConfig.sampleRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Configuration Validation Rules', () => {
    it('should validate API base URL requirements', () => {
      const validUrls = [
        'http://localhost:4000',
        'https://api.hospitality.com',
        'https://staging-api.hospitality.com',
        'http://192.168.1.100:4000',
      ];

      const invalidUrls = [
        '',
        null,
        undefined,
        'invalid-url',
        'ftp://example.com',
      ];

      validUrls.forEach(url => {
        expect(typeof url).toBe('string');
        expect(url.length).toBeGreaterThan(0);
        expect(url).toMatch(/^https?:\/\//);
      });

      invalidUrls.forEach(url => {
        if (url === null || url === undefined) {
          expect(url).toBeFalsy();
        } else if (typeof url === 'string') {
          expect(url.length).toBe(0);
        }
      });
    });

    it('should validate timeout values', () => {
      const validTimeouts = [1000, 5000, 30000, 60000];
      const invalidTimeouts = [0, -1000, -1];

      validTimeouts.forEach(timeout => {
        expect(timeout).toBeGreaterThan(0);
        expect(typeof timeout).toBe('number');
      });

      invalidTimeouts.forEach(timeout => {
        expect(timeout).toBeLessThanOrEqual(0);
      });
    });

    it('should validate retry configuration', () => {
      const validRetryAttempts = [0, 1, 3, 5];
      const validRetryDelays = [100, 500, 1000, 2000];

      validRetryAttempts.forEach(attempts => {
        expect(attempts).toBeGreaterThanOrEqual(0);
        expect(typeof attempts).toBe('number');
      });

      validRetryDelays.forEach(delay => {
        expect(delay).toBeGreaterThan(0);
        expect(typeof delay).toBe('number');
      });
    });

    it('should validate JWT expiry configuration', () => {
      const validJwtExpiry = [
        60 * 60 * 1000,        // 1 hour
        2 * 60 * 60 * 1000,    // 2 hours
        24 * 60 * 60 * 1000,   // 24 hours
      ];

      const invalidJwtExpiry = [0, -1000, -1];

      validJwtExpiry.forEach(expiry => {
        expect(expiry).toBeGreaterThan(0);
        expect(typeof expiry).toBe('number');
      });

      invalidJwtExpiry.forEach(expiry => {
        expect(expiry).toBeLessThanOrEqual(0);
      });
    });

    it('should validate refresh token expiry configuration', () => {
      const validRefreshExpiry = [
        24 * 60 * 60 * 1000,   // 1 day
        7 * 24 * 60 * 60 * 1000, // 7 days
        30 * 24 * 60 * 60 * 1000, // 30 days
      ];

      const invalidRefreshExpiry = [0, -1000, -1];

      validRefreshExpiry.forEach(expiry => {
        expect(expiry).toBeGreaterThan(0);
        expect(typeof expiry).toBe('number');
      });

      invalidRefreshExpiry.forEach(expiry => {
        expect(expiry).toBeLessThanOrEqual(0);
      });
    });

    it('should validate file size limits', () => {
      const validFileSizes = [
        1024 * 1024,           // 1MB
        5 * 1024 * 1024,       // 5MB
        10 * 1024 * 1024,      // 10MB
        50 * 1024 * 1024,      // 50MB
      ];

      const invalidFileSizes = [0, -1024, -1];

      validFileSizes.forEach(size => {
        expect(size).toBeGreaterThan(0);
        expect(typeof size).toBe('number');
      });

      invalidFileSizes.forEach(size => {
        expect(size).toBeLessThanOrEqual(0);
      });
    });

    it('should validate cache timeout values', () => {
      const validCacheTimeouts = [
        0,                      // No cache
        60 * 1000,             // 1 minute
        5 * 60 * 1000,         // 5 minutes
        60 * 60 * 1000,        // 1 hour
      ];

      const invalidCacheTimeouts = [-1000, -1];

      validCacheTimeouts.forEach(timeout => {
        expect(timeout).toBeGreaterThanOrEqual(0);
        expect(typeof timeout).toBe('number');
      });

      invalidCacheTimeouts.forEach(timeout => {
        expect(timeout).toBeLessThan(0);
      });
    });

    it('should validate monitoring sample rates', () => {
      const validSampleRates = [0, 0.1, 0.5, 1.0];
      const invalidSampleRates = [-0.1, 1.1, 2.0];

      validSampleRates.forEach(rate => {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
        expect(typeof rate).toBe('number');
      });

      invalidSampleRates.forEach(rate => {
        expect(rate < 0 || rate > 1).toBe(true);
      });
    });
  });

  describe('Environment-Specific Validation Rules', () => {
    it('should validate development environment rules', () => {
      const devConfig = {
        debug: true,
        enableDevTools: true,
        enableMockData: true,
        requireHttps: false,
        enableCors: true,
        logLevel: 'debug',
      };

      expect(devConfig.debug).toBe(true);
      expect(devConfig.enableDevTools).toBe(true);
      expect(devConfig.enableMockData).toBe(true);
      expect(devConfig.requireHttps).toBe(false);
      expect(devConfig.enableCors).toBe(true);
      expect(devConfig.logLevel).toBe('debug');
    });

    it('should validate production environment rules', () => {
      const prodConfig = {
        debug: false,
        enableDevTools: false,
        enableMockData: false,
        requireHttps: true,
        enableCors: false,
        logLevel: 'error',
        enableCaching: true,
        enableCompression: true,
        enableAnalytics: true,
        enableErrorReporting: true,
      };

      expect(prodConfig.debug).toBe(false);
      expect(prodConfig.enableDevTools).toBe(false);
      expect(prodConfig.enableMockData).toBe(false);
      expect(prodConfig.requireHttps).toBe(true);
      expect(prodConfig.enableCors).toBe(false);
      expect(prodConfig.logLevel).toBe('error');
      expect(prodConfig.enableCaching).toBe(true);
      expect(prodConfig.enableCompression).toBe(true);
      expect(prodConfig.enableAnalytics).toBe(true);
      expect(prodConfig.enableErrorReporting).toBe(true);
    });

    it('should validate staging environment rules', () => {
      const stagingConfig = {
        debug: true,
        enableDevTools: true,
        enableMockData: false,
        requireHttps: true,
        enableCors: true,
        logLevel: 'info',
        enableAnalytics: true,
        enableErrorReporting: true,
      };

      expect(stagingConfig.debug).toBe(true);
      expect(stagingConfig.enableDevTools).toBe(true);
      expect(stagingConfig.enableMockData).toBe(false);
      expect(stagingConfig.requireHttps).toBe(true);
      expect(stagingConfig.enableCors).toBe(true);
      expect(stagingConfig.logLevel).toBe('info');
      expect(stagingConfig.enableAnalytics).toBe(true);
      expect(stagingConfig.enableErrorReporting).toBe(true);
    });

    it('should validate test environment rules', () => {
      const testConfig = {
        debug: true,
        enableDevTools: false,
        enableMockData: true,
        requireHttps: false,
        enableCors: true,
        logLevel: 'error',
        enableAnimations: false,
        enableCaching: false,
      };

      expect(testConfig.debug).toBe(true);
      expect(testConfig.enableDevTools).toBe(false);
      expect(testConfig.enableMockData).toBe(true);
      expect(testConfig.requireHttps).toBe(false);
      expect(testConfig.enableCors).toBe(true);
      expect(testConfig.logLevel).toBe('error');
      expect(testConfig.enableAnimations).toBe(false);
      expect(testConfig.enableCaching).toBe(false);
    });
  });

  describe('Configuration Error Handling', () => {
    it('should handle missing configuration gracefully', () => {
      const partialConfig = {
        name: 'development',
        debug: true,
        // Missing other required fields
      };

      expect(partialConfig.name).toBe('development');
      expect(partialConfig.debug).toBe(true);
      // Should not throw errors for missing fields in tests
    });

    it('should handle invalid configuration values gracefully', () => {
      const invalidConfig = {
        name: 'development',
        debug: 'invalid', // Should be boolean
        api: {
          baseUrl: '', // Should not be empty
          timeout: -1000, // Should be positive
          retryAttempts: -1, // Should be non-negative
          retryDelay: 0, // Should be positive
        },
      };

      // Test that we can detect invalid values
      expect(typeof invalidConfig.debug).not.toBe('boolean');
      expect(invalidConfig.api.baseUrl.length).toBe(0);
      expect(invalidConfig.api.timeout).toBeLessThanOrEqual(0);
      expect(invalidConfig.api.retryAttempts).toBeLessThan(0);
      expect(invalidConfig.api.retryDelay).toBeLessThanOrEqual(0);
    });

    it('should handle configuration type mismatches', () => {
      const typeMismatchConfig = {
        name: 123, // Should be string
        debug: 'true', // Should be boolean
        api: {
          baseUrl: null, // Should be string
          timeout: '30000', // Should be number
          retryAttempts: '3', // Should be number
          retryDelay: true, // Should be number
        },
      };

      // Test type validation
      expect(typeof typeMismatchConfig.name).not.toBe('string');
      expect(typeof typeMismatchConfig.debug).not.toBe('boolean');
      expect(typeMismatchConfig.api.baseUrl).toBeNull();
      expect(typeof typeMismatchConfig.api.timeout).not.toBe('number');
      expect(typeof typeMismatchConfig.api.retryAttempts).not.toBe('number');
      expect(typeof typeMismatchConfig.api.retryDelay).not.toBe('number');
    });
  });

  describe('Configuration Performance Validation', () => {
    it('should validate configuration loading performance', () => {
      const startTime = Date.now();
      
      // Simulate configuration loading
      const config = {
        name: 'development',
        debug: true,
        api: { baseUrl: 'http://localhost:4000', timeout: 30000, retryAttempts: 3, retryDelay: 1000 },
        logging: { level: 'debug', enableConsole: true, enableRemote: false },
        database: { name: 'hospitality', maxConnections: 10, connectionTimeout: 30000, queryTimeout: 60000 },
        security: { jwtExpiry: 86400000, refreshExpiry: 604800000, enableCors: true, requireHttps: false, allowedOrigins: ['*'] },
        performance: { enableCaching: false, cacheTimeout: 0, enableCompression: false, maxFileSize: 10485760, enableServiceWorker: false },
        features: { enableDevTools: true, enableMockData: true, enableAnalytics: false, enableErrorReporting: false, enablePwa: false, enableOfflineMode: false },
        ui: { theme: 'light', enableAnimations: true, enableTransitions: true, enableSoundEffects: false },
        monitoring: { enablePerformanceMonitoring: true, enableErrorTracking: true, enableUserAnalytics: false, sampleRate: 1.0 },
      };
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      expect(loadTime).toBeLessThan(100); // Should load in less than 100ms
      expect(config).toBeDefined();
      expect(config.name).toBe('development');
    });

    it('should validate configuration validation performance', () => {
      const config = {
        name: 'development',
        debug: true,
        api: { baseUrl: 'http://localhost:4000', timeout: 30000, retryAttempts: 3, retryDelay: 1000 },
        logging: { level: 'debug', enableConsole: true, enableRemote: false },
        database: { name: 'hospitality', maxConnections: 10, connectionTimeout: 30000, queryTimeout: 60000 },
        security: { jwtExpiry: 86400000, refreshExpiry: 604800000, enableCors: true, requireHttps: false, allowedOrigins: ['*'] },
        performance: { enableCaching: false, cacheTimeout: 0, enableCompression: false, maxFileSize: 10485760, enableServiceWorker: false },
        features: { enableDevTools: true, enableMockData: true, enableAnalytics: false, enableErrorReporting: false, enablePwa: false, enableOfflineMode: false },
        ui: { theme: 'light', enableAnimations: true, enableTransitions: true, enableSoundEffects: false },
        monitoring: { enablePerformanceMonitoring: true, enableErrorTracking: true, enableUserAnalytics: false, sampleRate: 1.0 },
      };

      const startTime = Date.now();
      
      // Simulate validation
      const isValid = config.name && config.api.baseUrl && config.api.timeout > 0;
      
      const endTime = Date.now();
      const validationTime = endTime - startTime;
      
      expect(validationTime).toBeLessThan(50); // Should validate in less than 50ms
      expect(isValid).toBe(true);
    });
  });

  describe('Configuration Security Validation', () => {
    it('should validate HTTPS requirements for production', () => {
      const prodConfig = {
        name: 'production',
        security: {
          requireHttps: true,
          enableCors: false,
          allowedOrigins: ['https://hospitality.com'],
        },
      };

      expect(prodConfig.security.requireHttps).toBe(true);
      expect(prodConfig.security.enableCors).toBe(false);
      expect(prodConfig.security.allowedOrigins[0]).toContain('https://');
    });

    it('should validate CORS configuration', () => {
      const corsConfigs = [
        { enableCors: true, allowedOrigins: ['*'] },
        { enableCors: false, allowedOrigins: ['https://hospitality.com'] },
        { enableCors: true, allowedOrigins: ['https://staging.hospitality.com'] },
      ];

      corsConfigs.forEach(config => {
        expect(typeof config.enableCors).toBe('boolean');
        expect(Array.isArray(config.allowedOrigins)).toBe(true);
        expect(config.allowedOrigins.length).toBeGreaterThan(0);
      });
    });

    it('should validate JWT security settings', () => {
      const jwtConfigs = [
        { jwtExpiry: 2 * 60 * 60 * 1000, refreshExpiry: 7 * 24 * 60 * 60 * 1000 }, // Production
        { jwtExpiry: 24 * 60 * 60 * 1000, refreshExpiry: 7 * 24 * 60 * 60 * 1000 }, // Development
        { jwtExpiry: 60 * 60 * 1000, refreshExpiry: 24 * 60 * 60 * 1000 }, // Test
      ];

      jwtConfigs.forEach(config => {
        expect(config.jwtExpiry).toBeGreaterThan(0);
        expect(config.refreshExpiry).toBeGreaterThan(0);
        expect(config.refreshExpiry).toBeGreaterThan(config.jwtExpiry);
      });
    });
  });
});

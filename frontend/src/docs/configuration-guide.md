# Configuration Management Guide

## Overview

The hospitality management platform uses a comprehensive configuration management system that provides environment-specific settings, validation, health checks, and performance monitoring. This guide covers all aspects of the configuration system.

## Table of Contents

1. [Environment Detection](#environment-detection)
2. [Configuration Loading](#configuration-loading)
3. [Configuration Validation](#configuration-validation)
4. [Health Checks](#health-checks)
5. [Performance Monitoring](#performance-monitoring)
6. [Testing Utilities](#testing-utilities)
7. [API Reference](#api-reference)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Environment Detection

The system automatically detects the current environment using multiple indicators:

### Supported Environments

- **Development**: Local development environment
- **Staging**: Pre-production testing environment
- **Production**: Live production environment
- **Test**: Automated testing environment

### Detection Methods

1. **Node.js Environment**: `process.env.NODE_ENV`
2. **Vite Environment**: `import.meta.env.MODE`
3. **Hostname Analysis**: Domain and IP address patterns
4. **Protocol Detection**: HTTP vs HTTPS usage

### Usage

```typescript
import { environmentDetector } from '../utils/environment-detector';

// Get comprehensive environment information
const envInfo = environmentDetector.getEnvironmentInfo();

// Check specific environment
if (envInfo.isDevelopment) {
  console.log('Running in development mode');
}

// Get environment-specific configuration
const config = environmentDetector.getEnvironmentConfig();
```

### React Hook

```typescript
import { useEnvironment } from '../utils/environment-detector';

function MyComponent() {
  const envInfo = useEnvironment();
  
  return (
    <div>
      <p>Environment: {envInfo.name}</p>
      <p>Local: {envInfo.isLocal ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

## Configuration Loading

The configuration loader provides environment-specific settings with automatic caching and validation.

### Configuration Structure

```typescript
interface EnvironmentConfig {
  name: string;
  debug: boolean;
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableRemote: boolean;
    remoteEndpoint?: string;
  };
  database: {
    name: string;
    maxConnections: number;
    connectionTimeout: number;
    queryTimeout: number;
  };
  security: {
    jwtExpiry: number;
    refreshExpiry: number;
    enableCors: boolean;
    requireHttps: boolean;
    allowedOrigins: string[];
  };
  performance: {
    enableCaching: boolean;
    cacheTimeout: number;
    enableCompression: boolean;
    maxFileSize: number;
    enableServiceWorker: boolean;
  };
  features: {
    enableDevTools: boolean;
    enableMockData: boolean;
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
    enablePwa: boolean;
    enableOfflineMode: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    enableAnimations: boolean;
    enableTransitions: boolean;
    enableSoundEffects: boolean;
  };
  monitoring: {
    enablePerformanceMonitoring: boolean;
    enableErrorTracking: boolean;
    enableUserAnalytics: boolean;
    sampleRate: number;
  };
}
```

### Usage

```typescript
import { configLoader } from '../config/environment-loader';

// Load current environment configuration
const config = configLoader.loadConfig();

// Get configuration for specific environment
const prodConfig = configLoader.getConfigForEnvironment('production');

// Reload configuration (clears cache)
const freshConfig = configLoader.reload();
```

### React Hook

```typescript
import { useEnvironmentConfig } from '../config/environment-loader';

function MyComponent() {
  const config = useEnvironmentConfig();
  
  return (
    <div>
      <p>API Base URL: {config.api.baseUrl}</p>
      <p>Debug Mode: {config.debug ? 'Enabled' : 'Disabled'}</p>
    </div>
  );
}
```

## Configuration Validation

The validation system ensures configuration correctness and provides detailed feedback.

### Validation Rules

#### API Configuration
- Base URL must be provided and valid
- Timeout must be positive
- Retry attempts must be non-negative
- Retry delay must be positive

#### Security Configuration
- JWT expiry must be positive
- Refresh token expiry must be positive
- Refresh token expiry must be greater than JWT expiry
- Production must require HTTPS
- Production should disable CORS or use specific origins

#### Performance Configuration
- Max file size must be positive
- Cache timeout must be non-negative
- Production should enable caching and compression

#### Feature Configuration
- Production should disable development tools and mock data
- Debug mode should be disabled in production

### Usage

```typescript
import { configValidator } from '../utils/config-validator-simple';

// Validate configuration
const result = configValidator.validate(config, envInfo);

if (result.isValid) {
  console.log(`Configuration is valid (score: ${result.score}/100)`);
} else {
  console.error('Configuration validation failed:');
  result.errors.forEach(error => console.error(`- ${error}`));
}
```

### React Hook

```typescript
import { useSimpleConfigValidation } from '../utils/config-validator-simple';

function MyComponent() {
  const validation = useSimpleConfigValidation(config, envInfo);
  
  return (
    <div>
      <p>Status: {validation.isValid ? 'Valid' : 'Invalid'}</p>
      <p>Score: {validation.score}/100</p>
      {validation.errors.length > 0 && (
        <ul>
          {validation.errors.map(error => <li key={error}>{error}</li>)}
        </ul>
      )}
    </div>
  );
}
```

## Health Checks

The health check system provides comprehensive monitoring of configuration health.

### Health Check Categories

1. **Security**: HTTPS, CORS, JWT configuration
2. **Performance**: Caching, compression, file size limits
3. **Functionality**: Feature flags, database, logging
4. **Compliance**: Environment-specific rules

### Health Status Levels

- **Healthy**: Score ≥ 85%
- **Warning**: Score 70-84%
- **Critical**: Score < 70%
- **Unknown**: No data available

### Usage

```typescript
import { configHealthChecker } from '../utils/config-health-checker';

// Perform health check
const healthCheck = await configHealthChecker.performHealthCheck(
  config, 
  envInfo, 
  validation
);

console.log(`Health Status: ${healthCheck.status} (${healthCheck.score}/100)`);
console.log(healthCheck.summary);

// Get recommendations
healthCheck.recommendations.forEach(rec => console.log(`- ${rec}`));
```

### Health Check Results

```typescript
interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  score: number; // 0-100
  checks: HealthCheck[];
  summary: string;
  timestamp: string;
  recommendations: string[];
}
```

## Performance Monitoring

The performance monitoring system tracks configuration operations and provides detailed metrics.

### Monitored Operations

- Configuration loading
- Configuration validation
- Environment detection
- API calls
- Database operations
- File uploads
- Cache operations

### Performance Metrics

```typescript
interface PerformanceMetrics {
  timestamp: string;
  operation: string;
  duration: number;
  memoryUsage?: number;
  success: boolean;
  error?: string;
  metadata?: any;
}
```

### Usage

```typescript
import { configPerformanceMonitor } from '../utils/config-performance-monitor';

// Monitor an operation
const endOperation = configPerformanceMonitor.startOperation('config_loading');
// ... perform operation ...
endOperation();

// Record a failure
configPerformanceMonitor.recordFailure(
  'api_call', 
  'Network timeout', 
  5000
);

// Generate performance report
const report = configPerformanceMonitor.generateReport(
  'last_hour',
  new Date(Date.now() - 60 * 60 * 1000),
  new Date()
);

console.log(report.summary);
```

### Performance Alerts

The system automatically creates alerts for:
- Operations exceeding duration thresholds
- Memory usage exceeding limits
- Error rates above acceptable levels
- Success rates below minimum thresholds

## Testing Utilities

The testing utilities provide comprehensive test configurations and validation.

### Test Configurations

```typescript
import { configTestingUtils } from '../utils/config-testing-utils';

// Create test configurations
const devTest = configTestingUtils.createDevelopmentTestConfig();
const prodTest = configTestingUtils.createProductionTestConfig();
const invalidTest = configTestingUtils.createInvalidTestConfig();

// Run all tests
const results = await configTestingUtils.runAllConfigTests(validator);

// Generate test report
const report = configTestingUtils.generateTestReport(results);
console.log(report);
```

### Performance Benchmarking

```typescript
// Create performance benchmark
const benchmark = await configTestingUtils.createPerformanceBenchmark(
  validator, 
  100 // iterations
);

console.log(`Average load time: ${benchmark.averageLoadTime}ms`);
console.log(`Average validation time: ${benchmark.averageValidationTime}ms`);
```

## API Reference

### Environment Detector

```typescript
class EnvironmentDetector {
  getEnvironmentInfo(): EnvironmentInfo;
  getEnvironmentConfig(): any;
  validateEnvironment(): { isValid: boolean; errors: string[]; warnings: string[] };
  getErrorMessages(): any;
  clearCache(): void;
  refresh(): EnvironmentInfo;
}
```

### Configuration Loader

```typescript
class EnvironmentConfigLoader {
  loadConfig(): EnvironmentConfig;
  getConfigForEnvironment(environment: string): EnvironmentConfig;
  reload(): EnvironmentConfig;
  validateConfig(config: EnvironmentConfig): ValidationResult;
  clearCache(): void;
}
```

### Configuration Validator

```typescript
class SimpleConfigValidator {
  validate(config: EnvironmentConfig, envInfo: EnvironmentInfo): ValidationResult;
  getValidationSummary(result: ValidationResult): string;
}
```

### Health Checker

```typescript
class ConfigHealthChecker {
  performHealthCheck(config: EnvironmentConfig, envInfo: EnvironmentInfo, validation: ValidationResult): Promise<HealthCheckResult>;
  getHealthCheckConfig(): HealthCheckConfig;
  updateHealthCheckConfig(config: Partial<HealthCheckConfig>): void;
}
```

### Performance Monitor

```typescript
class ConfigPerformanceMonitor {
  startOperation(operation: string, metadata?: any): () => void;
  recordMetric(metric: PerformanceMetrics): void;
  recordFailure(operation: string, error: string, duration: number, metadata?: any): void;
  generateReport(period: string, startTime: Date, endTime: Date): PerformanceReport;
  getAlerts(limit?: number): PerformanceAlert[];
  getPerformanceStats(): any;
}
```

## Best Practices

### Configuration Management

1. **Environment-Specific Settings**: Always use environment-specific configurations
2. **Validation**: Validate configurations before use
3. **Health Checks**: Regular health checks in production
4. **Performance Monitoring**: Monitor configuration operations
5. **Caching**: Use configuration caching for performance
6. **Security**: Follow security best practices for each environment

### Development

1. **Local Development**: Use development configuration with debug tools
2. **Testing**: Use test configuration with minimal features
3. **Staging**: Use staging configuration similar to production
4. **Production**: Use production configuration with security and performance optimizations

### Security

1. **HTTPS**: Always require HTTPS in production
2. **CORS**: Restrict CORS origins in production
3. **JWT**: Use appropriate JWT expiry times
4. **Debug Mode**: Disable debug mode in production
5. **Development Tools**: Disable development tools in production

### Performance

1. **Caching**: Enable caching in production
2. **Compression**: Enable compression in production
3. **File Limits**: Set appropriate file size limits
4. **Timeouts**: Use appropriate timeout values
5. **Monitoring**: Monitor performance metrics

## Troubleshooting

### Common Issues

#### Configuration Loading Errors

**Problem**: Configuration fails to load
**Solution**: Check environment variables and file permissions

```typescript
// Debug configuration loading
const config = configLoader.loadConfig();
console.log('Loaded config:', config);
```

#### Validation Failures

**Problem**: Configuration validation fails
**Solution**: Check validation errors and fix configuration

```typescript
// Debug validation
const result = configValidator.validate(config, envInfo);
if (!result.isValid) {
  console.error('Validation errors:', result.errors);
}
```

#### Health Check Warnings

**Problem**: Health check shows warnings
**Solution**: Review recommendations and update configuration

```typescript
// Check health status
const health = await configHealthChecker.performHealthCheck(config, envInfo, validation);
if (health.status !== 'healthy') {
  console.warn('Health issues:', health.recommendations);
}
```

#### Performance Issues

**Problem**: Configuration operations are slow
**Solution**: Check performance metrics and optimize

```typescript
// Check performance
const stats = configPerformanceMonitor.getPerformanceStats();
if (stats.averageDuration > 1000) {
  console.warn('Slow operations detected');
}
```

### Debug Mode

Enable debug mode for detailed logging:

```typescript
// Enable debug logging
const config = configLoader.loadConfig();
if (config.debug) {
  console.log('Debug mode enabled');
  // Additional debug information
}
```

### Error Handling

Always handle configuration errors gracefully:

```typescript
try {
  const config = configLoader.loadConfig();
  // Use configuration
} catch (error) {
  console.error('Configuration error:', error);
  // Fallback to default configuration
}
```

## Conclusion

The configuration management system provides a robust, scalable, and maintainable way to manage application settings across different environments. By following the guidelines in this document, you can ensure your application is properly configured, validated, and monitored.

For additional support or questions, please refer to the API documentation or contact the development team.

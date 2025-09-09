import { getEnvironmentConfig, validateEnvironmentConfig } from '../config/environment';
import { API_CONFIG } from '../config/api';

/**
 * Configuration validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration validator class
 */
export class ConfigValidator {
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Validate all configuration
   */
  validateAll(): ValidationResult {
    this.errors = [];
    this.warnings = [];

    this.validateApiConfig();
    this.validateEnvironmentConfig();
    this.validateSecurityConfig();
    this.validatePerformanceConfig();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Validate API configuration
   */
  private validateApiConfig(): void {
    // Validate base URL
    if (!API_CONFIG.BASE_URL) {
      this.errors.push('API base URL is not configured');
    } else if (!this.isValidUrl(API_CONFIG.BASE_URL)) {
      this.errors.push('API base URL is not a valid URL');
    }

    // Validate timeout
    if (API_CONFIG.TIMEOUT <= 0) {
      this.errors.push('API timeout must be greater than 0');
    } else if (API_CONFIG.TIMEOUT > 300000) {
      this.warnings.push('API timeout is very high (>5 minutes)');
    }

    // Validate retry attempts
    if (API_CONFIG.RETRY_ATTEMPTS < 0) {
      this.errors.push('Retry attempts cannot be negative');
    } else if (API_CONFIG.RETRY_ATTEMPTS > 10) {
      this.warnings.push('Retry attempts is very high (>10)');
    }

    // Validate retry delay
    if (API_CONFIG.RETRY_DELAY < 0) {
      this.errors.push('Retry delay cannot be negative');
    } else if (API_CONFIG.RETRY_DELAY > 10000) {
      this.warnings.push('Retry delay is very high (>10 seconds)');
    }
  }

  /**
   * Validate environment configuration
   */
  private validateEnvironmentConfig(): void {
    const envValidation = validateEnvironmentConfig();
    
    if (!envValidation.isValid) {
      this.errors.push(...envValidation.errors);
    }

    const config = getEnvironmentConfig();

    // Validate environment-specific settings
    if (config.name === 'production' && !config.apiUrl.startsWith('https://')) {
      this.warnings.push('Production environment should use HTTPS');
    }

    if (config.name === 'development' && config.apiUrl.startsWith('https://')) {
      this.warnings.push('Development environment using HTTPS (may cause issues)');
    }

    // Validate feature flags
    if (config.name === 'production' && config.features.enableDevTools) {
      this.warnings.push('Development tools enabled in production');
    }

    if (config.name === 'production' && config.features.enableMockData) {
      this.warnings.push('Mock data enabled in production');
    }
  }

  /**
   * Validate security configuration
   */
  private validateSecurityConfig(): void {
    const config = getEnvironmentConfig();

    // Validate token expiry
    if (config.security.tokenExpiry <= 0) {
      this.errors.push('Token expiry must be greater than 0');
    } else if (config.security.tokenExpiry > 7 * 24 * 60 * 60 * 1000) {
      this.warnings.push('Token expiry is very long (>7 days)');
    }

    // Validate HTTPS usage
    if (config.name === 'production' && !config.security.enableHttps) {
      this.errors.push('HTTPS must be enabled in production');
    }

    // Validate CORS settings
    if (config.name === 'production' && config.security.enableCors) {
      this.warnings.push('CORS enabled in production (security consideration)');
    }
  }

  /**
   * Validate performance configuration
   */
  private validatePerformanceConfig(): void {
    const config = getEnvironmentConfig();

    // Validate cache timeout
    if (config.performance.cacheTimeout < 0) {
      this.errors.push('Cache timeout cannot be negative');
    } else if (config.performance.cacheTimeout > 60 * 60 * 1000) {
      this.warnings.push('Cache timeout is very long (>1 hour)');
    }

    // Validate compression settings
    if (config.name === 'production' && !config.performance.enableCompression) {
      this.warnings.push('Compression disabled in production (performance impact)');
    }
  }

  /**
   * Check if URL is valid
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration summary
   */
  getConfigSummary(): {
    environment: string;
    apiUrl: string;
    debug: boolean;
    features: string[];
    warnings: string[];
  } {
    const config = getEnvironmentConfig();
    
    return {
      environment: config.name,
      apiUrl: config.apiUrl,
      debug: config.debug,
      features: Object.entries(config.features)
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature),
      warnings: this.warnings,
    };
  }
}

/**
 * Validate configuration and log results
 */
export function validateAndLogConfig(): ValidationResult {
  const validator = new ConfigValidator();
  const result = validator.validateAll();

  if (result.isValid) {
    console.log('✅ Configuration validation passed');
    if (result.warnings.length > 0) {
      console.warn('⚠️ Configuration warnings:', result.warnings);
    }
  } else {
    console.error('❌ Configuration validation failed:', result.errors);
    if (result.warnings.length > 0) {
      console.warn('⚠️ Configuration warnings:', result.warnings);
    }
  }

  return result;
}

/**
 * Get configuration summary for debugging
 */
export function getConfigSummary(): string {
  const validator = new ConfigValidator();
  const summary = validator.getConfigSummary();
  
  return `
Configuration Summary:
- Environment: ${summary.environment}
- API URL: ${summary.apiUrl}
- Debug Mode: ${summary.debug}
- Enabled Features: ${summary.features.join(', ') || 'None'}
- Warnings: ${summary.warnings.length > 0 ? summary.warnings.join(', ') : 'None'}
  `.trim();
}

/**
 * Check if configuration is ready for production
 */
export function isProductionReady(): boolean {
  const validator = new ConfigValidator();
  const result = validator.validateAll();
  
  // Must have no errors and no critical warnings
  const criticalWarnings = result.warnings.filter(warning => 
    warning.includes('production') && 
    (warning.includes('HTTPS') || warning.includes('DevTools') || warning.includes('MockData'))
  );
  
  return result.isValid && criticalWarnings.length === 0;
}

// Export default validator instance
export const configValidator = new ConfigValidator();

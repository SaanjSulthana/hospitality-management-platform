/**
 * Simple configuration validation system
 */

import React from 'react';
import { EnvironmentConfig } from '../config/environment-loader';
import { EnvironmentInfo } from './environment-detector';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}

/**
 * Simple configuration validator
 */
export class SimpleConfigValidator {
  private static instance: SimpleConfigValidator;

  private constructor() {}

  public static getInstance(): SimpleConfigValidator {
    if (!SimpleConfigValidator.instance) {
      SimpleConfigValidator.instance = new SimpleConfigValidator();
    }
    return SimpleConfigValidator.instance;
  }

  /**
   * Validate configuration
   */
  public validate(config: EnvironmentConfig, envInfo: EnvironmentInfo): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalChecks = 0;
    let passedChecks = 0;

    // API validation
    totalChecks++;
    if (!config.api.baseUrl) {
      errors.push('API base URL is required');
    } else {
      passedChecks++;
    }

    totalChecks++;
    if (config.api.timeout <= 0) {
      errors.push('API timeout must be greater than 0');
    } else {
      passedChecks++;
    }

    // Security validation
    totalChecks++;
    if (config.security.jwtExpiry <= 0) {
      errors.push('JWT expiry must be greater than 0');
    } else {
      passedChecks++;
    }

    totalChecks++;
    if (config.security.refreshExpiry <= config.security.jwtExpiry) {
      errors.push('Refresh token expiry must be greater than JWT expiry');
    } else {
      passedChecks++;
    }

    // Production-specific validations
    if (envInfo.isProduction) {
      totalChecks++;
      if (!config.security.requireHttps) {
        warnings.push('Production environment should require HTTPS');
      } else {
        passedChecks++;
      }

      totalChecks++;
      if (config.features.enableDevTools) {
        warnings.push('Development tools should not be enabled in production');
      } else {
        passedChecks++;
      }
    }

    // Calculate score
    const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score,
    };
  }

  /**
   * Get validation summary
   */
  public getValidationSummary(result: ValidationResult): string {
    const { isValid, errors, warnings, score } = result;
    
    let summary = `Configuration validation ${isValid ? 'PASSED' : 'FAILED'} (Score: ${score}/100)\n`;
    
    if (errors.length > 0) {
      summary += `\nErrors (${errors.length}):\n`;
      errors.forEach(error => summary += `  ❌ ${error}\n`);
    }
    
    if (warnings.length > 0) {
      summary += `\nWarnings (${warnings.length}):\n`;
      warnings.forEach(warning => summary += `  ⚠️  ${warning}\n`);
    }
    
    if (errors.length === 0 && warnings.length === 0) {
      summary += '\n✅ All validations passed!';
    }
    
    return summary;
  }
}

/**
 * Global configuration validator instance
 */
export const simpleConfigValidator = SimpleConfigValidator.getInstance();

/**
 * Utility functions for configuration validation
 */
export const simpleValidationUtils = {
  /**
   * Validate configuration
   */
  validate: (config: EnvironmentConfig, envInfo: EnvironmentInfo): ValidationResult => {
    return simpleConfigValidator.validate(config, envInfo);
  },

  /**
   * Get validation summary
   */
  getSummary: (result: ValidationResult): string => {
    return simpleConfigValidator.getValidationSummary(result);
  },

  /**
   * Check if configuration is production-ready
   */
  isProductionReady: (config: EnvironmentConfig): boolean => {
    const envInfo = {
      name: 'production' as any,
      isDevelopment: false,
      isProduction: true,
      isStaging: false,
      isTest: false,
      isLocal: false,
      isServer: false,
      isClient: true,
      nodeEnv: 'production',
      viteEnv: 'production',
      hostname: 'localhost',
      protocol: 'https:',
      port: null,
      userAgent: 'test',
      timestamp: new Date().toISOString(),
    };
    
    const result = simpleConfigValidator.validate(config, envInfo);
    return result.isValid && result.warnings.length === 0;
  },
};

/**
 * Configuration validation hook for React components
 */
export function useSimpleConfigValidation(config: EnvironmentConfig, envInfo: EnvironmentInfo) {
  const [validationResult, setValidationResult] = React.useState<ValidationResult>(() => 
    simpleConfigValidator.validate(config, envInfo)
  );

  React.useEffect(() => {
    const result = simpleConfigValidator.validate(config, envInfo);
    setValidationResult(result);
  }, [config, envInfo]);

  return {
    ...validationResult,
    summary: simpleConfigValidator.getValidationSummary(validationResult),
  };
}

// Export default instance
export default simpleConfigValidator;

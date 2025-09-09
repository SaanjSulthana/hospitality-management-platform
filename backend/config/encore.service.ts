import { Service } from "encore.dev/service";

export default new Service("config");

// Export configuration endpoints
export { healthCheck, validateConfig, getEnvironmentInfo, testDatabaseConnection } from "./health";

// Export configuration utilities
export { 
  getEnvironmentConfig, 
  getEnvironmentName, 
  isDevelopment, 
  isProduction, 
  isStaging, 
  isTest,
  getDatabaseConfig,
  getSecurityConfig,
  getPerformanceConfig,
  getFeatureFlags,
  isFeatureEnabled,
  getLoggingConfig,
  logEnvironmentInfo,
  validateEnvironmentConfig,
  getEnvironmentErrorMessages,
  ENVIRONMENT_CONFIG
} from "./environment";

// Export error handling utilities
export { 
  ErrorHandler, 
  AppError, 
  ErrorType, 
  ErrorSeverity, 
  errorHandler, 
  errorUtils, 
  withErrorHandling 
} from "../utils/error-handler";

// Export configuration testing utilities
export { 
  ConfigTester, 
  runConfigurationTests, 
  quickConfigHealthCheck,
  ConfigTestResult,
  ConfigTestSuiteResult
} from "../utils/config-tester";

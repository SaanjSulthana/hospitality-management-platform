# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-01-27-centralized-api-config/spec.md

## Endpoints

### GET /config/health

**Purpose:** Health check endpoint for configuration system (Encore.js compatible)
**Parameters:** None
**Response:** 
```json
{
  "status": "healthy",
  "environment": "development",
  "encore": {
    "version": "1.49.1",
    "database": "connected"
  },
  "config": "valid"
}
```
**Errors:** 500 if configuration is invalid

### GET /config/environment

**Purpose:** Get current environment configuration (Encore.js compatible)
**Parameters:** None
**Response:**
```json
{
  "environment": "development",
  "encore": {
    "appId": "hospitality-management-platform-cr8i",
    "database": "hospitality"
  },
  "api": {
    "baseUrl": "http://localhost:4000",
    "timeout": 30000
  }
}
```
**Errors:** 401 if not authenticated, 500 if configuration error

### POST /config/validate

**Purpose:** Validate current configuration (Encore.js compatible)
**Parameters:** None
**Response:**
```json
{
  "valid": true,
  "encore": {
    "services": ["auth", "finance", "tasks", "uploads", "staff", "properties"],
    "database": "connected"
  },
  "errors": [],
  "warnings": []
}
```
**Errors:** 500 if validation fails

## Configuration Management

### Backend Configuration Structure (Encore.js Compatible)
```typescript
interface BackendConfig {
  environment: 'development' | 'staging' | 'production';
  encore: {
    appId: string;
    version: string;
    database: string;
    services: string[];
  };
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
  };
}
```

### Frontend Configuration Structure
```typescript
interface FrontendConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  upload: {
    maxFileSize: number;
    allowedTypes: string[];
    maxImagesPerTask: number;
  };
  debug: boolean;
}
```

## Configuration Loading

### Environment Detection
- Automatic environment detection based on NODE_ENV
- Fallback to hostname-based detection
- Support for custom environment variables

### Configuration Sources
1. Environment variables (highest priority)
2. Configuration files
3. Default values (lowest priority)

### Validation Rules
- Required fields validation
- Type validation
- Range validation for numeric values
- Format validation for URLs and paths

# Microservice Development Guide
## Hospitality Management Platform

This guide provides a complete pattern for adding new microservices to the hospitality management platform, covering backend development with Encore.ts and frontend development with React.

## Table of Contents
1. [Project Architecture Overview](#project-architecture-overview)
2. [Centralized API System](#centralized-api-system)
3. [Backend Development Pattern](#backend-development-pattern)
4. [Frontend Development Pattern](#frontend-development-pattern)
5. [Database Design Pattern](#database-design-pattern)
6. [API Design Standards](#api-design-standards)
7. [State Management Pattern](#state-management-pattern)
8. [UI/UX Implementation Standards](#uiux-implementation-standards)
9. [Production Readiness Patterns](#production-readiness-patterns)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Checklist](#deployment-checklist)
12. [Example: Complete Microservice Implementation](#example-complete-microservice-implementation)

---

## Project Architecture Overview

### Technology Stack
- **Backend**: Encore.ts (v1.49.1), TypeScript, PostgreSQL
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui
- **Package Manager**: Bun (v1.2.21)
- **Database**: PostgreSQL with Encore's `sqldb`
- **Authentication**: JWT (Access + Refresh tokens)
- **State Management**: React Query (TanStack Query)
- **Real-time Updates**: Polling mechanism

### Microservice Structure
```
backend/
├── {service_name}/
│   ├── db.ts                 # Database connection
│   ├── encore.service.ts     # Service configuration
│   ├── create.ts            # Create operations
│   ├── list.ts              # List operations
│   ├── update.ts            # Update operations
│   ├── delete.ts            # Delete operations
│   ├── types.ts             # TypeScript interfaces
│   └── migrations/          # Database migrations
│       └── {version}_{description}.up.sql
```

---

## Centralized API System

### 1. API Client Architecture

The platform uses a centralized API client system that provides:
- **Consistent Error Handling**: Standardized error responses across all microservices
- **Automatic Retry Logic**: Smart retry with exponential backoff
- **Authentication Management**: Automatic token handling and refresh
- **Environment Detection**: Automatic API URL detection based on deployment environment
- **Request/Response Interceptors**: Centralized logging and monitoring

#### Core API Client (`frontend/src/utils/api-client.ts`)
```typescript
export class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultRetryAttempts: number;
  private defaultRetryDelay: number;

  constructor(
    baseUrl: string = API_CONFIG.BASE_URL,
    defaultTimeout: number = API_CONFIG.TIMEOUT,
    defaultRetryAttempts: number = API_CONFIG.RETRY_ATTEMPTS,
    defaultRetryDelay: number = API_CONFIG.RETRY_DELAY
  ) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
    this.defaultRetryAttempts = defaultRetryAttempts;
    this.defaultRetryDelay = defaultRetryDelay;
  }

  async request<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    // Automatic retry logic with exponential backoff
    // Authentication header injection
    // Error handling and parsing
    // Request/response logging
  }
}
```

### 2. Environment Configuration

#### Multi-Environment Support (`frontend/src/config/environment.ts`)
```typescript
export interface EnvironmentConfig {
  name: 'development' | 'staging' | 'production' | 'test';
  apiUrl: string;
  debug: boolean;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableRemote: boolean;
  };
  features: {
    enableDevTools: boolean;
    enableMockData: boolean;
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
  };
  performance: {
    enableCaching: boolean;
    cacheTimeout: number;
    enableCompression: boolean;
  };
  security: {
    enableHttps: boolean;
    enableCors: boolean;
    tokenExpiry: number;
  };
}

// Environment-specific configurations
const developmentConfig: EnvironmentConfig = {
  name: 'development',
  apiUrl: 'http://localhost:4000',
  debug: true,
  // ... other config
};

const productionConfig: EnvironmentConfig = {
  name: 'production',
  apiUrl: 'https://api.hospitality-platform.com',
  debug: false,
  // ... other config
};
```

#### Automatic Environment Detection (`frontend/src/utils/env.ts`)
```typescript
export function getApiUrl(): string {
  // Check for explicit environment variables first
  const viteApiUrl = getEnvVar('VITE_API_URL');
  const reactApiUrl = getEnvVar('REACT_APP_API_URL');
  
  if (viteApiUrl) return viteApiUrl;
  if (reactApiUrl) return reactApiUrl;
  
  // Auto-detect based on current hostname for Encore Cloud
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Staging environment
    if (hostname.includes('staging-')) {
      return 'https://staging-api.hospitality-platform.com';
    }
    
    // Production environment
    if (hostname.includes('hospitality-management-platform')) {
      return 'https://api.hospitality-platform.com';
    }
  }
  
  // Default to localhost for development
  return 'http://localhost:4000';
}
```

### 3. Authentication Management

#### Token-Based Authentication
```typescript
// Automatic token injection in API client
async request<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
  // ... request setup
  
  // Add authorization header if token exists
  const token = localStorage.getItem('accessToken');
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  // ... rest of request logic
}
```

#### Token Refresh Strategy
```typescript
// Automatic token refresh on 401 errors
private async handleUnauthorized(): Promise<boolean> {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      // Redirect to login
      window.location.href = '/login';
      return false;
    }

    const response = await this.request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken }
    });

    if (response.data.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
      return true;
    }
  } catch (error) {
    // Refresh failed, redirect to login
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }
  
  return false;
}
```

### 4. Error Handling System

#### Standardized Error Types (`frontend/src/utils/api-client.ts`)
```typescript
export class ApiError extends Error {
  status: number;
  statusText: string;
  response?: Response;
  data?: any;

  constructor(message: string, status: number, statusText: string, response?: Response, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.response = response;
    this.data = data;
  }
}
```

#### Error Handler Configuration (`frontend/src/utils/api-standardizer.ts`)
```typescript
export const ERROR_HANDLERS = {
  NETWORK_ERROR: (error: any) => ({
    type: 'NETWORK_ERROR',
    message: ERROR_MESSAGES.NETWORK_ERROR,
    retryable: true,
  }),
  UPLOAD_ERROR: (error: any) => ({
    type: 'UPLOAD_FAILED',
    message: ERROR_MESSAGES.UPLOAD_FAILED,
    retryable: true,
  }),
  VALIDATION_ERROR: (error: any) => ({
    type: 'VALIDATION_ERROR',
    message: 'Invalid input. Please check your data and try again.',
    retryable: false,
  }),
  SERVER_ERROR: (error: any) => ({
    type: 'SERVER_ERROR',
    message: ERROR_MESSAGES.SERVER_ERROR,
    retryable: true,
  }),
  UNAUTHORIZED: (error: any) => ({
    type: 'UNAUTHORIZED',
    message: ERROR_MESSAGES.UNAUTHORIZED,
    retryable: false,
  }),
} as const;
```

### 5. Retry Logic and Circuit Breaker

#### Smart Retry Strategy
```typescript
// Exponential backoff with jitter
private async retryRequest<T>(
  url: string,
  requestOptions: RequestInit,
  attempt: number,
  maxAttempts: number
): Promise<Response> {
  if (attempt >= maxAttempts) {
    throw new Error(`Max retry attempts (${maxAttempts}) exceeded`);
  }

  // Calculate delay with exponential backoff and jitter
  const baseDelay = this.defaultRetryDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
  const delay = baseDelay + jitter;

  await new Promise(resolve => setTimeout(resolve, delay));

  return this.makeRequest(url, requestOptions, this.defaultTimeout);
}
```

#### Circuit Breaker Pattern
```typescript
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold = 5;
  private readonly timeout = 60000; // 1 minute

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

### 6. Request/Response Interceptors

#### Logging Interceptor
```typescript
private async logRequest(endpoint: string, options: ApiRequestOptions): Promise<void> {
  if (API_CONFIG.DEBUG) {
    console.group(`🚀 API Request: ${options.method || 'GET'} ${endpoint}`);
    console.log('URL:', `${this.baseUrl}${endpoint}`);
    console.log('Headers:', options.headers);
    console.log('Body:', options.body);
    console.groupEnd();
  }
}

private async logResponse<T>(response: ApiResponse<T>): Promise<void> {
  if (API_CONFIG.DEBUG) {
    console.group(`✅ API Response: ${response.status} ${response.statusText}`);
    console.log('Data:', response.data);
    console.log('Headers:', response.headers);
    console.groupEnd();
  }
}
```

#### Performance Monitoring
```typescript
private async measurePerformance<T>(
  operation: () => Promise<T>,
  endpoint: string
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Log slow requests
    if (duration > 5000) { // 5 seconds
      console.warn(`Slow API request detected: ${endpoint} took ${duration}ms`);
    }
    
    // Send metrics to monitoring service in production
    if (isProduction()) {
      this.sendMetrics(endpoint, duration, 'success');
    }
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (isProduction()) {
      this.sendMetrics(endpoint, duration, 'error');
    }
    
    throw error;
  }
}
```

### 7. Caching Strategy

#### Request Caching
```typescript
class RequestCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

### 8. Production Monitoring

#### Health Checks
```typescript
class HealthChecker {
  private healthStatus = {
    api: 'unknown',
    database: 'unknown',
    cache: 'unknown',
    lastCheck: 0
  };

  async checkHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkApi(),
      this.checkDatabase(),
      this.checkCache()
    ]);

    this.healthStatus = {
      api: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      database: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      cache: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      lastCheck: Date.now()
    };

    return this.healthStatus;
  }

  private async checkApi(): Promise<boolean> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 9. Security Patterns

#### Request Sanitization
```typescript
private sanitizeRequest(options: ApiRequestOptions): ApiRequestOptions {
  const sanitized = { ...options };

  // Remove sensitive headers
  if (sanitized.headers) {
    delete sanitized.headers['X-API-Key'];
    delete sanitized.headers['Authorization']; // Will be added separately
  }

  // Sanitize request body
  if (sanitized.body && typeof sanitized.body === 'object') {
    sanitized.body = this.sanitizeObject(sanitized.body);
  }

  return sanitized;
}

private sanitizeObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => this.sanitizeObject(item));
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Remove sensitive fields
      if (['password', 'token', 'secret'].includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.sanitizeObject(value);
      }
    }
    return sanitized;
  }

  return obj;
}
```

#### Rate Limiting
```typescript
class RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly windowMs = 60000; // 1 minute
  private readonly maxRequests = 100; // 100 requests per minute

  canMakeRequest(identifier: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    return true;
  }
}
```

---

## Backend Development Pattern

### 1. Service Setup

#### Create Service Directory
```bash
mkdir backend/{service_name}
cd backend/{service_name}
```

#### Create Database Connection (`db.ts`)
```typescript
import { SQLDatabase } from "encore.dev/storage/sqldb";

// Use the shared database for all services
export const {service_name}DB = SQLDatabase.named("hospitality");
```

#### Create Service Configuration (`encore.service.ts`)
```typescript
import { Service } from "encore.dev/service";

export default new Service("{service_name}");

// Export all service endpoints
export { create } from "./create";
export { list } from "./list";
export { update } from "./update";
export { delete } from "./delete";
```

### 2. Database Migrations

#### Create Migration File
```sql
-- migrations/1_create_{table_name}.up.sql
CREATE TABLE {table_name} (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Service-specific fields
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    
    -- Indexes
    CONSTRAINT {table_name}_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id),
    CONSTRAINT {table_name}_created_by_fkey FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- Create indexes
CREATE INDEX idx_{table_name}_org_id ON {table_name}(org_id);
CREATE INDEX idx_{table_name}_status ON {table_name}(status);
CREATE INDEX idx_{table_name}_created_at ON {table_name}(created_at);

-- Add RLS policies
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table_name}_org_policy" ON {table_name}
    FOR ALL TO authenticated
    USING (org_id = current_setting('app.current_org_id')::integer);
```

### 3. Encore.ts Framework Patterns

#### Service Structure
```typescript
// backend/{service_name}/encore.service.ts
import { Service } from "encore.dev/service";

export default new Service("{service_name}");

// Export all service endpoints
export { create } from "./create";
export { list } from "./list";
export { update } from "./update";
export { delete } from "./delete";
```

#### API Definition Pattern
```typescript
// backend/{service_name}/create.ts
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import log from "encore.dev/log";
import { {service_name}DB } from "./db";

// Define request/response interfaces
export interface Create{EntityName}Request {
  name: string;
  description?: string;
  status?: string;
}

export interface {EntityName}Info {
  id: number;
  orgId: number;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  status: string;
}

// Define API endpoint with proper Encore.ts syntax
export const create{EntityName} = api(
  { auth: true, expose: true, method: "POST", path: "/{service_name}" },
  async (req: Create{EntityName}Request): Promise<{EntityName}Info> => {
    // Implementation
  }
);
```

#### Authentication Pattern
```typescript
// Use Encore's built-in auth system
import { getAuthData } from "~encore/auth";

const authData = getAuthData();
if (!authData) {
  throw APIError.unauthenticated("Authentication required");
}

const { orgId, userId, role } = authData;
```

#### Error Handling Pattern
```typescript
// Use Encore's APIError class
import { APIError } from "encore.dev/api";

// Different error types
throw APIError.unauthenticated("Authentication required");
throw APIError.invalidArgument("Invalid input data");
throw APIError.notFound("Resource not found");
throw APIError.permissionDenied("Access denied");
throw APIError.internal("Internal server error", { error: error.message });
```

#### Database Query Pattern
```typescript
// Use Encore's template literals for SQL queries
import { {service_name}DB } from "./db";

// Single row query
const result = await {service_name}DB.queryRow`
  SELECT * FROM {table_name} 
  WHERE id = ${id} AND org_id = ${orgId}
`;

// Multiple rows query
const results = await {service_name}DB.query`
  SELECT * FROM {table_name} 
  WHERE org_id = ${orgId}
  ORDER BY created_at DESC
`;

// Execute query (no return)
await {service_name}DB.exec`
  DELETE FROM {table_name} 
  WHERE id = ${id} AND org_id = ${orgId}
`;
```

#### Logging Pattern
```typescript
// Use Encore's structured logging
import log from "encore.dev/log";

log.info("Operation completed", { 
  operation: "create_{entity_name}", 
  id: result.id,
  orgId: authData.orgId 
});

log.error("Operation failed", { 
  operation: "create_{entity_name}", 
  error: error.message,
  orgId: authData.orgId 
});
```

### 3. TypeScript Interfaces (`types.ts`)

```typescript
export interface {EntityName} {
  id: number;
  orgId: number;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
  
  // Service-specific fields
  name: string;
  description?: string;
  status: string;
}

export interface Create{EntityName}Request {
  name: string;
  description?: string;
  status?: string;
}

export interface Update{EntityName}Request {
  name?: string;
  description?: string;
  status?: string;
}

export interface List{EntityName}Request {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface List{EntityName}Response {
  items: {EntityName}[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### 4. API Endpoints

#### Create Operation (`create.ts`)
```typescript
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import log from "encore.dev/log";
import { {service_name}DB } from "./db";

// Request/Response interfaces
export interface Create{EntityName}Request {
  name: string;
  description?: string;
  status?: string;
}

export interface {EntityName}Info {
  id: number;
  orgId: number;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  status: string;
}

export const create{EntityName} = api(
  { auth: true, expose: true, method: "POST", path: "/{service_name}" },
  async (req: Create{EntityName}Request): Promise<{EntityName}Info> => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const { orgId, userId } = authData;

    try {
      const result = await {service_name}DB.queryRow`
        INSERT INTO {table_name} (org_id, created_by_user_id, name, description, status)
        VALUES (${orgId}, ${userId}, ${req.name}, ${req.description || null}, ${req.status || 'active'})
        RETURNING id, org_id, created_by_user_id, created_at, updated_at, name, description, status
      `;

      log.info(`Created {entity_name} with ID: ${result.id}`);

      return {
        id: result.id,
        orgId: result.org_id,
        createdByUserId: result.created_by_user_id,
        createdAt: result.created_at.toISOString(),
        updatedAt: result.updated_at.toISOString(),
        name: result.name,
        description: result.description,
        status: result.status,
      };
    } catch (error) {
      log.error("Failed to create {entity_name}", { error: error.message });
      throw APIError.internal("Failed to create {entity_name}", { error: error.message });
    }
  }
);
```

#### List Operation (`list.ts`)
```typescript
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import log from "encore.dev/log";
import { {service_name}DB } from "./db";

// Request/Response interfaces
export interface List{EntityName}Request {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface List{EntityName}Response {
  items: {EntityName}Info[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface {EntityName}Info {
  id: number;
  orgId: number;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  status: string;
}

export const list{EntityName}s = api(
  { auth: true, expose: true, method: "GET", path: "/{service_name}" },
  async (req: List{EntityName}Request = {}): Promise<List{EntityName}Response> => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const { orgId } = authData;
    const { page = 1, limit = 10, status, search } = req;
    const offset = (page - 1) * limit;

    try {
      // Build dynamic WHERE clause using Encore's template literals
      let whereConditions = [];
      let params: any[] = [orgId];
      let paramIndex = 2;

      whereConditions.push("org_id = $1");

      if (status) {
        whereConditions.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await {service_name}DB.queryRow`
        SELECT COUNT(*) as total FROM {table_name} ${whereClause}
      `;
      const total = parseInt(countResult.total);

      // Get items
      const items = await {service_name}DB.query`
        SELECT id, org_id, created_by_user_id, created_at, updated_at, name, description, status
        FROM {table_name}
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const {EntityName}s: {EntityName}Info[] = items.map(row => ({
        id: row.id,
        orgId: row.org_id,
        createdByUserId: row.created_by_user_id,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        name: row.name,
        description: row.description,
        status: row.status,
      }));

      return {
        items: {EntityName}s,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      log.error("Failed to list {entity_name}s", { error: error.message });
      throw APIError.internal("Failed to list {entity_name}s", { error: error.message });
    }
  }
);
```

#### Update Operation (`update.ts`)
```typescript
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import log from "encore.dev/log";
import { {service_name}DB } from "./db";

// Request/Response interfaces
export interface Update{EntityName}Request {
  name?: string;
  description?: string;
  status?: string;
}

export interface {EntityName}Info {
  id: number;
  orgId: number;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  status: string;
}

export const update{EntityName} = api(
  { auth: true, expose: true, method: "PATCH", path: "/{service_name}/:id" },
  async (id: number, req: Update{EntityName}Request): Promise<{EntityName}Info> => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const { orgId } = authData;

    try {
      // Build dynamic UPDATE clause using Encore's template literals
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (req.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(req.name);
        paramIndex++;
      }

      if (req.description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        params.push(req.description);
        paramIndex++;
      }

      if (req.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        params.push(req.status);
        paramIndex++;
      }

      if (updates.length === 0) {
        throw APIError.invalidArgument("No fields to update");
      }

      updates.push(`updated_at = NOW()`);
      params.push(orgId, id);

      const result = await {service_name}DB.queryRow`
        UPDATE {table_name}
        SET ${updates.join(", ")}
        WHERE org_id = $${paramIndex} AND id = $${paramIndex + 1}
        RETURNING id, org_id, created_by_user_id, created_at, updated_at, name, description, status
      `;

      if (!result) {
        throw APIError.notFound("{EntityName} not found or access denied");
      }

      log.info(`Updated {entity_name} with ID: ${id}`);

      return {
        id: result.id,
        orgId: result.org_id,
        createdByUserId: result.created_by_user_id,
        createdAt: result.created_at.toISOString(),
        updatedAt: result.updated_at.toISOString(),
        name: result.name,
        description: result.description,
        status: result.status,
      };
    } catch (error) {
      log.error("Failed to update {entity_name}", { error: error.message, id });
      throw APIError.internal("Failed to update {entity_name}", { error: error.message });
    }
  }
);
```

#### Delete Operation (`delete.ts`)
```typescript
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import log from "encore.dev/log";
import { {service_name}DB } from "./db";

// Response interface
export interface Delete{EntityName}Response {
  success: boolean;
}

export const delete{EntityName} = api(
  { auth: true, expose: true, method: "DELETE", path: "/{service_name}/:id" },
  async (id: number): Promise<Delete{EntityName}Response> => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const { orgId } = authData;

    try {
      await {service_name}DB.exec`
        DELETE FROM {table_name}
        WHERE org_id = ${orgId} AND id = ${id}
      `;

      log.info(`Deleted {entity_name} with ID: ${id}`);

      return { success: true };
    } catch (error) {
      log.error("Failed to delete {entity_name}", { error: error.message, id });
      throw APIError.internal("Failed to delete {entity_name}", { error: error.message });
    }
  }
);
```

---

## Frontend Development Pattern

### 1. Encore.ts Client Integration

#### Generated Client Setup (`frontend/services/backend.ts`)
```typescript
import Client from '../client';
import { Local, Environment } from '../client';

// Create base client instance
const clientInstance = new Client(Local);

// Get authenticated backend with token
export function getAuthenticatedBackend() {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;

  return clientInstance.with({
    auth: async () => ({
      authorization: `Bearer ${token}`
    })
  });
}

// Export services for direct use
export const backend = {
  auth: clientInstance.auth,
  properties: clientInstance.properties,
  tasks: clientInstance.tasks,
  finance: clientInstance.finance,
  staff: clientInstance.staff,
  users: clientInstance.users,
  analytics: clientInstance.analytics,
  branding: clientInstance.branding,
  uploads: clientInstance.uploads,
  reports: clientInstance.reports,
};
```

#### API Service with Encore.ts Client (`frontend/services/{service_name}.ts`)
```typescript
import { backend } from './backend';

// Use generated types from Encore.ts client
export type {EntityName} = backend.{service_name}.{EntityName}Info;
export type Create{EntityName}Request = backend.{service_name}.Create{EntityName}Request;
export type Update{EntityName}Request = backend.{service_name}.Update{EntityName}Request;
export type List{EntityName}Request = backend.{service_name}.List{EntityName}Request;
export type List{EntityName}Response = backend.{service_name}.List{EntityName}Response;

export const {service_name}Api = {
  // Create
  create: async (data: Create{EntityName}Request): Promise<{EntityName}> => {
    const response = await backend.{service_name}.create(data);
    return response;
  },

  // List
  list: async (params: List{EntityName}Request = {}): Promise<List{EntityName}Response> => {
    const response = await backend.{service_name}.list(params);
    return response;
  },

  // Update
  update: async (id: number, data: Update{EntityName}Request): Promise<{EntityName}> => {
    const response = await backend.{service_name}.update(id, data);
    return response;
  },

  // Delete
  delete: async (id: number): Promise<{ success: boolean }> => {
    const response = await backend.{service_name}.delete(id);
    return response;
  },
};
```

### 2. React Query Hooks

#### Create Custom Hooks (`frontend/hooks/use{ServiceName}.ts`)
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { {service_name}Api, Create{EntityName}Request, Update{EntityName}Request, List{EntityName}Request } from '../services/{service_name}';

// Query Keys
export const {SERVICE_NAME}_QUERY_KEYS = {
  all: ['{service_name}'] as const,
  lists: () => [...{SERVICE_NAME}_QUERY_KEYS.all, 'list'] as const,
  list: (params: List{EntityName}Request) => [...{SERVICE_NAME}_QUERY_KEYS.lists(), params] as const,
  details: () => [...{SERVICE_NAME}_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...{SERVICE_NAME}_QUERY_KEYS.details(), id] as const,
};

// List Hook
export const use{EntityName}s = (params: List{EntityName}Request = {}) => {
  return useQuery({
    queryKey: {SERVICE_NAME}_QUERY_KEYS.list(params),
    queryFn: () => {service_name}Api.list(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Create Hook
export const useCreate{EntityName} = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: {service_name}Api.create,
    onMutate: async (new{EntityName}) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() });

      // Snapshot previous value
      const previous{EntityName}s = queryClient.getQueriesData({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() });

      // Optimistically update cache
      queryClient.setQueriesData({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: [new{EntityName}, ...old.items],
          total: old.total + 1,
        };
      });

      return { previous{EntityName}s };
    },
    onError: (err, new{EntityName}, context) => {
      // Rollback on error
      if (context?.previous{EntityName}s) {
        context.previous{EntityName}s.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() });
      queryClient.refetchQueries({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() });
    },
  });
};

// Update Hook
export const useUpdate{EntityName} = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Update{EntityName}Request }) => 
      {service_name}Api.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() });

      const previous{EntityName}s = queryClient.getQueriesData({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() });

      // Optimistically update cache
      queryClient.setQueriesData({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((item: any) => 
            item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
          ),
        };
      });

      return { previous{EntityName}s };
    },
    onError: (err, variables, context) => {
      if (context?.previous{EntityName}s) {
        context.previous{EntityName}s.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() });
      queryClient.refetchQueries({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() });
    },
  });
};

// Delete Hook
export const useDelete{EntityName} = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: {service_name}Api.delete,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() });

      const previous{EntityName}s = queryClient.getQueriesData({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() });

      // Optimistically update cache
      queryClient.setQueriesData({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((item: any) => item.id !== id),
          total: old.total - 1,
        };
      });

      return { previous{EntityName}s };
    },
    onError: (err, id, context) => {
      if (context?.previous{EntityName}s) {
        context.previous{EntityName}s.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() });
      queryClient.refetchQueries({ queryKey: {SERVICE_NAME}_QUERY_KEYS.lists() });
    },
  });
};
```

### 3. Page Component

#### Create Page Component (`frontend/pages/{ServiceName}Page.tsx`)
```typescript
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Filter, Edit, Trash2, Eye } from 'lucide-react';
import { use{EntityName}s, useCreate{EntityName}, useUpdate{EntityName}, useDelete{EntityName} } from '../hooks/use{ServiceName}';
import { useApiError } from '../hooks/useApiError';
import { toast } from 'sonner';

export default function {ServiceName}Page() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editing{EntityName}, setEditing{EntityName}] = useState<any>(null);

  const { data: {entity_name}sData, isLoading, error } = use{EntityName}s({
    search: searchTerm || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const create{EntityName}Mutation = useCreate{EntityName}();
  const update{EntityName}Mutation = useUpdate{EntityName}();
  const delete{EntityName}Mutation = useDelete{EntityName}();

  const { handleApiError } = useApiError();

  const handleCreate{EntityName} = async (data: any) => {
    try {
      await create{EntityName}Mutation.mutateAsync(data);
      toast.success('{EntityName} created successfully');
      setIsCreateModalOpen(false);
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleUpdate{EntityName} = async (id: number, data: any) => {
    try {
      await update{EntityName}Mutation.mutateAsync({ id, data });
      toast.success('{EntityName} updated successfully');
      setEditing{EntityName}(null);
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleDelete{EntityName} = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this {entity_name}?')) {
      try {
        await delete{EntityName}Mutation.mutateAsync(id);
        toast.success('{EntityName} deleted successfully');
      } catch (error) {
        handleApiError(error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-6 py-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="w-8 h-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-lg font-medium text-gray-900">Loading {entity_name}s...</p>
                <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your data</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-6 py-6">
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-600 text-xl">!</span>
                </div>
                <p className="text-lg font-medium text-red-900 mb-2">Error loading {entity_name}s</p>
                <p className="text-sm text-gray-600 mb-4">{error.message}</p>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Tabs defaultValue="all" className="space-y-0">
        {/* Enhanced Sticky Tabs */}
        <div className="sticky top-20 z-30 bg-white border-b border-gray-200 -mx-6 px-4 sm:px-6 py-3 shadow-sm">
          <div className="overflow-x-auto">
            <TabsList className="grid w-full grid-cols-3 min-w-max bg-gray-100">
              <TabsTrigger 
                value="all" 
                className="text-xs sm:text-sm px-3 sm:px-6 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
              >
                All {EntityName}s
              </TabsTrigger>
              <TabsTrigger 
                value="active" 
                className="text-xs sm:text-sm px-3 sm:px-6 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
              >
                Active
              </TabsTrigger>
              <TabsTrigger 
                value="inactive" 
                className="text-xs sm:text-sm px-3 sm:px-6 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
              >
                Inactive
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Content Container */}
        <div className="px-6 py-6">
          <TabsContent value="all" className="space-y-6 mt-0">
            {/* Search and Filter Section */}
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search" className="text-sm font-medium text-gray-700">
                      Search {EntityName}s
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="search"
                        placeholder="Search by name or description..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-11 pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
                      Status Filter
                    </Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button 
                      onClick={() => setIsCreateModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 h-11 px-6"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add {EntityName}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* {EntityName}s Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {entity_name}sData?.items?.map(({entity_name}) => (
                <Card 
                  key={entity_name.id} 
                  className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-bold text-gray-900 truncate">
                          {entity_name.name}
                        </CardTitle>
                        <CardDescription className="text-sm text-gray-600 line-clamp-2">
                          {entity_name.description || 'No description'}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={entity_name.status === 'active' ? 'default' : 'secondary'}
                        className="flex-shrink-0"
                      >
                        {entity_name.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-gray-500">
                      Created: {new Date(entity_name.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditing{EntityName}(entity_name)}
                        className="flex-shrink-0"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDelete{EntityName}(entity_name.id)}
                        className="flex-shrink-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Empty State */}
            {entity_name}sData?.items?.length === 0 && (
              <Card className="border-l-4 border-l-gray-500">
                <CardContent className="flex items-center justify-center p-12">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-gray-400 text-xl">📋</span>
                    </div>
                    <p className="text-lg font-medium text-gray-900 mb-2">No {entity_name}s found</p>
                    <p className="text-sm text-gray-600 mb-4">
                      {searchTerm || statusFilter !== 'all' 
                        ? 'Try adjusting your search or filter criteria'
                        : `Get started by creating your first ${entity_name.toLowerCase()}.`
                      }
                    </p>
                    <Button 
                      onClick={() => setIsCreateModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add {EntityName}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
```

---

## Database Design Pattern

### 1. Table Naming Convention
- Use snake_case for table names
- Use descriptive, plural names: `{entity_name}s`
- Prefix with service name if needed: `{service_name}_{entity_name}s`

### 2. Standard Columns
Every table should include:
```sql
id SERIAL PRIMARY KEY,
org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 3. Indexing Strategy
```sql
-- Primary indexes
CREATE INDEX idx_{table_name}_org_id ON {table_name}(org_id);
CREATE INDEX idx_{table_name}_created_at ON {table_name}(created_at);

-- Status indexes for filtering
CREATE INDEX idx_{table_name}_status ON {table_name}(status);

-- Search indexes for text fields
CREATE INDEX idx_{table_name}_name ON {table_name}(name);
CREATE INDEX idx_{table_name}_name_trgm ON {table_name} USING gin (name gin_trgm_ops);
```

### 4. Row Level Security (RLS)
```sql
-- Enable RLS
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- Organization-based policy
CREATE POLICY "{table_name}_org_policy" ON {table_name}
    FOR ALL TO authenticated
    USING (org_id = current_setting('app.current_org_id')::integer);
```

---

## API Design Standards

### 1. RESTful Endpoints
```
GET    /{service_name}           # List entities
POST   /{service_name}           # Create entity
GET    /{service_name}/:id       # Get entity by ID
PATCH  /{service_name}/:id       # Update entity
DELETE /{service_name}/:id       # Delete entity
```

### 2. Request/Response Format
```typescript
// Request
interface ListRequest {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Response
interface ListResponse {
  items: Entity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### 3. Error Handling
```typescript
// Standard error response
interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
}
```

---

## State Management Pattern

### 1. React Query Configuration
```typescript
// Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### 2. Optimistic Updates Pattern
```typescript
// Standard optimistic update pattern
onMutate: async (newData) => {
  // Cancel outgoing refetches
  await queryClient.cancelQueries({ queryKey: QUERY_KEYS.lists() });

  // Snapshot previous value
  const previousData = queryClient.getQueriesData({ queryKey: QUERY_KEYS.lists() });

  // Optimistically update cache
  queryClient.setQueriesData({ queryKey: QUERY_KEYS.lists() }, (old) => {
    // Update logic here
  });

  return { previousData };
},
onError: (err, newData, context) => {
  // Rollback on error
  if (context?.previousData) {
    context.previousData.forEach(([queryKey, data]) => {
      queryClient.setQueryData(queryKey, data);
    });
  }
},
onSuccess: () => {
  // Invalidate and refetch
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists() });
  queryClient.refetchQueries({ queryKey: QUERY_KEYS.lists() });
},
```

---

## UI/UX Implementation Standards

### 1. Page Structure
```tsx
<div className="min-h-screen bg-gray-50">
  <Tabs defaultValue="default" className="space-y-0">
    {/* Enhanced Sticky Tabs */}
    <div className="sticky top-20 z-30 bg-white border-b border-gray-200 -mx-6 px-4 sm:px-6 py-3 shadow-sm">
      {/* Tab navigation */}
    </div>

    {/* Content Container */}
    <div className="px-6 py-6">
      <TabsContent value="content" className="space-y-6 mt-0">
        {/* Page content */}
      </TabsContent>
    </div>
  </Tabs>
</div>
```

### 2. Card Design Standards
```tsx
<Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
  <CardHeader className="pb-4">
    <CardTitle className="text-lg flex items-center gap-2">
      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
      Card Title
      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live</span>
    </CardTitle>
    <CardDescription className="text-sm text-gray-600">
      Card description
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-3">
    {/* Content */}
  </CardContent>
</Card>
```

### 3. Loading States
```tsx
{isLoading ? (
  <Card className="border-l-4 border-l-blue-500">
    <CardContent className="flex items-center justify-center p-12">
      <div className="text-center">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
        <p className="text-lg font-medium text-gray-900">Loading data...</p>
        <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your data</p>
      </div>
    </CardContent>
  </Card>
) : (
  // Content
)}
```

### 4. Error States
```tsx
{error ? (
  <Card className="border-l-4 border-l-red-500">
    <CardContent className="flex items-center justify-center p-12">
      <div className="text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-red-600 text-xl">!</span>
        </div>
        <p className="text-lg font-medium text-red-900 mb-2">Error loading data</p>
        <p className="text-sm text-gray-600 mb-4">{error.message}</p>
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
          className="border-red-300 text-red-700 hover:bg-red-50"
        >
          Try Again
        </Button>
      </div>
    </CardContent>
  </Card>
) : (
  // Content
)}
```

---

## Production Readiness Patterns

### 1. Environment-Specific Configuration

#### Environment Detection and Configuration
```typescript
// frontend/src/config/environment.ts
export class EnvironmentManager {
  private static instance: EnvironmentManager;
  private config: EnvironmentConfig;

  private constructor() {
    this.config = this.detectEnvironment();
  }

  static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager();
    }
    return EnvironmentManager.instance;
  }

  private detectEnvironment(): EnvironmentConfig {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const env = getEnvVar('NODE_ENV', 'development');

    // Production detection
    if (hostname.includes('hospitality-management-platform') || env === 'production') {
      return productionConfig;
    }

    // Staging detection
    if (hostname.includes('staging-') || env === 'staging') {
      return stagingConfig;
    }

    // Test detection
    if (env === 'test') {
      return testConfig;
    }

    // Default to development
    return developmentConfig;
  }

  getConfig(): EnvironmentConfig {
    return this.config;
  }

  isProduction(): boolean {
    return this.config.name === 'production';
  }

  isDevelopment(): boolean {
    return this.config.name === 'development';
  }
}
```

#### Feature Flags
```typescript
// frontend/src/config/feature-flags.ts
export interface FeatureFlags {
  enableAnalytics: boolean;
  enableErrorReporting: boolean;
  enablePerformanceMonitoring: boolean;
  enableRealTimeUpdates: boolean;
  enableAdvancedSearch: boolean;
  enableBulkOperations: boolean;
  enableOfflineMode: boolean;
  enablePushNotifications: boolean;
}

export class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private flags: FeatureFlags;

  private constructor() {
    this.flags = this.loadFeatureFlags();
  }

  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }

  private loadFeatureFlags(): FeatureFlags {
    const env = EnvironmentManager.getInstance().getConfig();
    
    return {
      enableAnalytics: env.features.enableAnalytics,
      enableErrorReporting: env.features.enableErrorReporting,
      enablePerformanceMonitoring: env.isProduction(),
      enableRealTimeUpdates: true,
      enableAdvancedSearch: env.isProduction(),
      enableBulkOperations: env.isProduction(),
      enableOfflineMode: false, // Future feature
      enablePushNotifications: env.isProduction(),
    };
  }

  isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag];
  }

  getFlags(): FeatureFlags {
    return { ...this.flags };
  }
}
```

### 2. Error Reporting and Monitoring

#### Error Reporting Service
```typescript
// frontend/src/services/error-reporting.ts
export interface ErrorReport {
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: number;
  userId?: string;
  sessionId: string;
  context: Record<string, any>;
}

export class ErrorReportingService {
  private static instance: ErrorReportingService;
  private isEnabled: boolean;

  private constructor() {
    this.isEnabled = FeatureFlagManager.getInstance().isEnabled('enableErrorReporting');
  }

  static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService();
    }
    return ErrorReportingService.instance;
  }

  reportError(error: Error, context: Record<string, any> = {}): void {
    if (!this.isEnabled) return;

    const report: ErrorReport = {
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId(),
      context: {
        ...context,
        environment: EnvironmentManager.getInstance().getConfig().name,
        version: process.env.REACT_APP_VERSION || 'unknown',
      },
    };

    this.sendErrorReport(report);
  }

  private async sendErrorReport(report: ErrorReport): Promise<void> {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(report),
      });
    } catch (error) {
      console.error('Failed to send error report:', error);
    }
  }

  private getCurrentUserId(): string | undefined {
    // Extract from JWT token or user context
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.sub;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }
}
```

#### Performance Monitoring
```typescript
// frontend/src/services/performance-monitoring.ts
export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  url: string;
  userId?: string;
  sessionId: string;
}

export class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private isEnabled: boolean;
  private metrics: PerformanceMetric[] = [];

  private constructor() {
    this.isEnabled = FeatureFlagManager.getInstance().isEnabled('enablePerformanceMonitoring');
    this.initializeMonitoring();
  }

  static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  private initializeMonitoring(): void {
    if (!this.isEnabled) return;

    // Monitor Core Web Vitals
    this.observeWebVitals();
    
    // Monitor API performance
    this.observeApiPerformance();
    
    // Monitor memory usage
    this.observeMemoryUsage();
  }

  private observeWebVitals(): void {
    // Largest Contentful Paint (LCP)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.recordMetric('lcp', lastEntry.startTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        this.recordMetric('fid', entry.processingStart - entry.startTime);
      });
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      this.recordMetric('cls', clsValue);
    }).observe({ entryTypes: ['layout-shift'] });
  }

  private observeApiPerformance(): void {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        this.recordMetric('api_response_time', endTime - startTime, {
          url: args[0] as string,
          status: response.status,
        });
        return response;
      } catch (error) {
        const endTime = performance.now();
        this.recordMetric('api_error_time', endTime - startTime, {
          url: args[0] as string,
          error: error.message,
        });
        throw error;
      }
    };
  }

  private observeMemoryUsage(): void {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.recordMetric('memory_used', memory.usedJSHeapSize);
        this.recordMetric('memory_total', memory.totalJSHeapSize);
      }, 30000); // Every 30 seconds
    }
  }

  recordMetric(name: string, value: number, context: Record<string, any> = {}): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      url: window.location.href,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId(),
      ...context,
    };

    this.metrics.push(metric);

    // Send metrics in batches
    if (this.metrics.length >= 10) {
      this.flushMetrics();
    }
  }

  private async flushMetrics(): Promise<void> {
    if (this.metrics.length === 0) return;

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(metricsToSend),
      });
    } catch (error) {
      console.error('Failed to send performance metrics:', error);
      // Re-add metrics to queue for retry
      this.metrics.unshift(...metricsToSend);
    }
  }

  private getCurrentUserId(): string | undefined {
    // Same implementation as ErrorReportingService
    return undefined;
  }

  private getSessionId(): string {
    // Same implementation as ErrorReportingService
    return 'session-id';
  }
}
```

### 3. Security Patterns

#### Content Security Policy
```typescript
// frontend/src/utils/security.ts
export class SecurityManager {
  private static instance: SecurityManager;

  private constructor() {
    this.initializeSecurity();
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  private initializeSecurity(): void {
    this.setupCSP();
    this.setupXSSProtection();
    this.setupCSRFProtection();
  }

  private setupCSP(): void {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.hospitality-platform.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = csp;
    document.head.appendChild(meta);
  }

  private setupXSSProtection(): void {
    // XSS Protection headers are set by the server
    // This is just for client-side validation
  }

  private setupCSRFProtection(): void {
    // CSRF token handling
    const token = this.getCSRFToken();
    if (token) {
      // Add token to all API requests
      this.interceptApiRequests(token);
    }
  }

  private getCSRFToken(): string | null {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || null;
  }

  private interceptApiRequests(token: string): void {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url, options = {}] = args;
      const headers = new Headers(options.headers);
      
      if (options.method && options.method !== 'GET') {
        headers.set('X-CSRF-Token', token);
      }
      
      return originalFetch(url, { ...options, headers });
    };
  }

  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  validateInput(input: string, type: 'email' | 'phone' | 'text'): boolean {
    switch (type) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
      case 'phone':
        return /^\+?[\d\s\-\(\)]+$/.test(input);
      case 'text':
        return input.length > 0 && input.length <= 1000;
      default:
        return false;
    }
  }
}
```

### 4. Caching and Performance

#### Advanced Caching Strategy
```typescript
// frontend/src/services/cache-manager.ts
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version: string;
}

export class CacheManager {
  private static instance: CacheManager;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes
  private readonly maxSize = 1000; // Maximum cache entries

  private constructor() {
    this.initializeCleanup();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  set<T>(key: string, data: T, ttl: number = this.defaultTTL, version: string = '1.0'): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      version,
    });
  }

  get<T>(key: string, version: string = '1.0'): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Check version compatibility
    if (entry.version !== version) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private initializeCleanup(): void {
    // Clean up expired entries every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }
}
```

#### Service Worker for Offline Support
```typescript
// public/sw.js
const CACHE_NAME = 'hospitality-platform-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});
```

### 5. Database Optimization

#### Database Connection (Encore.ts Pattern)
```typescript
// backend/{service_name}/db.ts
import { SQLDatabase } from "encore.dev/storage/sqldb";

// Use the shared database for all services
export const {service_name}DB = SQLDatabase.named("hospitality");

// Note: Encore.ts handles connection pooling automatically
// No need to configure connection settings manually
```

#### Query Optimization (Encore.ts Pattern)
```typescript
// backend/{service_name}/optimized-queries.ts
import { {service_name}DB } from "./db";

export class QueryOptimizer {
  static async getOptimizedList(
    filters: Record<string, any>,
    pagination: { page: number; limit: number }
  ) {
    // Use Encore's template literals for type-safe queries
    const { orgId, status, search } = filters;
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    // Build dynamic WHERE conditions
    let whereConditions = ["org_id = $1"];
    let params: any[] = [orgId];
    let paramIndex = 2;

    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Use Encore's template literals for type safety
    return {service_name}DB.query`
      SELECT * FROM {table_name}
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
}
```

### 6. Monitoring and Alerting

#### Health Check Endpoints (Encore.ts Pattern)
```typescript
// backend/health/check.ts
import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

// Use the shared database
const healthDB = SQLDatabase.named("hospitality");

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    database: 'healthy' | 'unhealthy';
    api: 'healthy' | 'unhealthy';
  };
}

export const healthCheck = api(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<HealthStatus> => {
    const checks = await Promise.allSettled([
      checkDatabase(),
      checkApi(),
    ]);

    return {
      status: checks.every(check => check.status === 'fulfilled') ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        api: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      },
    };
  }
);

async function checkDatabase(): Promise<boolean> {
  try {
    await healthDB.queryRow`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkApi(): Promise<boolean> {
  // Basic API health check
  return true;
}
```

#### Metrics Collection
```typescript
// backend/metrics/collector.ts
export class MetricsCollector {
  private static metrics = new Map<string, number>();

  static incrementCounter(name: string, value: number = 1): void {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
  }

  static setGauge(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  static getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  static reset(): void {
    this.metrics.clear();
  }
}
```

### 7. Encore.ts Deployment Patterns

#### Encore Cloud Deployment
```bash
# Deploy to Encore Cloud
encore app deploy

# Deploy specific environment
encore app deploy --env production

# Deploy with secrets
encore secret set JWTSecret "your-jwt-secret"
encore secret set RefreshSecret "your-refresh-secret"
```

#### Encore.ts Configuration (`encore.app`)
```json
{
  "id": "hospitality-management-platform-cr8i",
  "lang": "typescript",
  "secrets": {
    "JWTSecret": {
      "description": "Secret key for JWT access tokens"
    },
    "RefreshSecret": {
      "description": "Secret key for JWT refresh tokens"
    }
  },
  "global_cors": {
    "allow_origins_without_credentials": [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://staging-hospitality-management-platform-cr8i.frontend.encr.app",
      "https://hospitality-management-platform-cr8i.frontend.encr.app"
    ],
    "allow_origins_with_credentials": [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://staging-hospitality-management-platform-cr8i.frontend.encr.app",
      "https://hospitality-management-platform-cr8i.frontend.encr.app"
    ],
    "allow_headers": [
      "Content-Type",
      "Authorization",
      "X-Requested-With"
    ],
    "expose_headers": [
      "Content-Length"
    ]
  }
}
```

#### Local Development
```bash
# Start Encore development server
encore run

# Run with database seeding
encore run --seed

# Generate TypeScript client
encore gen client --lang typescript

# Database operations
encore db migrate
encore db reset
encore db shell
```

#### Production Deployment
```bash
# Build for production
encore build

# Deploy to production
encore app deploy --env production

# Monitor deployment
encore app logs --env production
```

#### Environment Variables
```bash
# .env.production
NODE_ENV=production
API_URL=https://api.hospitality-platform.com
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
```

#### Kubernetes Deployment
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hospitality-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hospitality-platform
  template:
    metadata:
      labels:
        app: hospitality-platform
    spec:
      containers:
      - name: app
        image: hospitality-platform:latest
        ports:
        - containerPort: 80
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
```

---

## Testing Strategy

### 1. Backend Testing (Encore.ts Pattern)
```typescript
// backend/{service_name}/__tests__/create.test.ts
import { create{EntityName} } from "../create";
import { {service_name}DB } from "../db";

describe('{ServiceName} API', () => {
  beforeEach(async () => {
    // Clean up test data
    await {service_name}DB.exec`DELETE FROM {table_name} WHERE name LIKE 'Test%'`;
  });

  it('should create {entity_name}', async () => {
    const {entity_name}Data = {
      name: 'Test {EntityName}',
      description: 'Test description',
    };

    const response = await create{EntityName}(entity_nameData);
    
    expect(response).toMatchObject({
      id: expect.any(Number),
      name: entity_nameData.name,
      description: entity_nameData.description,
      status: 'active',
    });
  });

  it('should handle authentication errors', async () => {
    // Mock unauthenticated state
    jest.spyOn(require('~encore/auth'), 'getAuthData').mockReturnValue(null);

    await expect(create{EntityName}({ name: 'Test' }))
      .rejects.toThrow('Authentication required');
  });
});
```

#### Encore.ts Test Configuration
```typescript
// backend/jest.config.cjs
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
};
```

#### Test Setup
```typescript
// backend/__tests__/setup.ts
import { SQLDatabase } from "encore.dev/storage/sqldb";

// Setup test database
const testDB = new SQLDatabase("test", {
  migrations: "./migrations",
});

beforeAll(async () => {
  // Run migrations for test database
  await testDB.migrate();
});

afterAll(async () => {
  // Cleanup test database
  await testDB.close();
});
```

### 2. Frontend Testing
```typescript
// Component tests
describe('{ServiceName}Page', () => {
  it('should render {entity_name}s list', () => {
    render(<{ServiceName}Page />);
    
    expect(screen.getByText('All {EntityName}s')).toBeInTheDocument();
    expect(screen.getByText('Add {EntityName}')).toBeInTheDocument();
  });
});
```

---

## Deployment Checklist

### 1. Backend Deployment
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] API endpoints tested
- [ ] Authentication working
- [ ] Error handling implemented

### 2. Frontend Deployment
- [ ] API integration working
- [ ] Optimistic updates implemented
- [ ] Loading states handled
- [ ] Error states handled
- [ ] Mobile responsive
- [ ] Accessibility compliant

### 3. Integration Testing
- [ ] End-to-end user flows tested
- [ ] Cross-service communication working
- [ ] Real-time updates functioning
- [ ] Performance acceptable

---

## Example: Complete Microservice Implementation

### Service: "Bookings"

#### Backend Structure
```
backend/bookings/
├── db.ts
├── encore.service.ts
├── create.ts
├── list.ts
├── update.ts
├── delete.ts
├── types.ts
└── migrations/
    └── 1_create_bookings.up.sql
```

#### Frontend Structure
```
frontend/
├── services/
│   └── bookings.ts
├── hooks/
│   └── useBookings.ts
└── pages/
    └── BookingsPage.tsx
```

#### Database Schema
```sql
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Booking-specific fields
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    total_amount DECIMAL(10,2) NOT NULL,
    notes TEXT
);
```

#### API Endpoints
```
GET    /bookings           # List bookings
POST   /bookings           # Create booking
GET    /bookings/:id       # Get booking by ID
PATCH  /bookings/:id       # Update booking
DELETE /bookings/:id       # Cancel booking
```

This guide provides a complete pattern for implementing microservices in your hospitality management platform. Follow these patterns consistently to ensure maintainable, scalable, and user-friendly features.

---

## Encore.ts Framework Best Practices

### 1. Service Organization
```typescript
// ✅ CORRECT: Proper service structure
backend/
├── {service_name}/
│   ├── encore.service.ts     # Service definition and exports
│   ├── db.ts                 # Database connection
│   ├── create.ts            # Create endpoint
│   ├── list.ts              # List endpoint
│   ├── update.ts            # Update endpoint
│   ├── delete.ts            # Delete endpoint
│   ├── types.ts             # TypeScript interfaces
│   └── migrations/          # Database migrations
│       └── 1_create_{table}.up.sql
```

### 2. API Endpoint Patterns
```typescript
// ✅ CORRECT: Proper API definition
export const create{EntityName} = api(
  { auth: true, expose: true, method: "POST", path: "/{service_name}" },
  async (req: Create{EntityName}Request): Promise<{EntityName}Info> => {
    // Implementation
  }
);

// ❌ AVOID: Missing auth or incorrect path
export const create{EntityName} = api(
  { expose: true, method: "POST", path: "/create" }, // Missing auth, wrong path
  async (req) => { // No types
    // Implementation
  }
);
```

### 3. Database Patterns
```typescript
// ✅ CORRECT: Use shared database
export const {service_name}DB = SQLDatabase.named("hospitality");

// ✅ CORRECT: Use template literals for queries
const result = await {service_name}DB.queryRow`
  SELECT * FROM {table_name} 
  WHERE id = ${id} AND org_id = ${orgId}
`;

// ❌ AVOID: String concatenation
const result = await db.query(`SELECT * FROM ${tableName} WHERE id = ${id}`);
```

### 4. Error Handling Patterns
```typescript
// ✅ CORRECT: Use APIError class
import { APIError } from "encore.dev/api";

throw APIError.unauthenticated("Authentication required");
throw APIError.invalidArgument("Invalid input data");
throw APIError.notFound("Resource not found");
throw APIError.internal("Internal server error", { error: error.message });

// ❌ AVOID: Generic Error
throw new Error("Something went wrong");
```

### 5. Authentication Patterns
```typescript
// ✅ CORRECT: Use Encore's auth system
import { getAuthData } from "~encore/auth";

const authData = getAuthData();
if (!authData) {
  throw APIError.unauthenticated("Authentication required");
}

const { orgId, userId, role } = authData;

// ❌ AVOID: Manual token parsing
const token = req.headers.authorization?.replace('Bearer ', '');
```

### 6. Logging Patterns
```typescript
// ✅ CORRECT: Use structured logging
import log from "encore.dev/log";

log.info("Operation completed", { 
  operation: "create_{entity_name}", 
  id: result.id,
  orgId: authData.orgId 
});

log.error("Operation failed", { 
  operation: "create_{entity_name}", 
  error: error.message,
  orgId: authData.orgId 
});

// ❌ AVOID: Console logging
console.log("Operation completed");
```

### 7. TypeScript Patterns
```typescript
// ✅ CORRECT: Define interfaces for requests/responses
export interface Create{EntityName}Request {
  name: string;
  description?: string;
  status?: string;
}

export interface {EntityName}Info {
  id: number;
  orgId: number;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  status: string;
}

// ❌ AVOID: Using any types
export const create{EntityName} = api(
  { auth: true, expose: true, method: "POST", path: "/{service_name}" },
  async (req: any): Promise<any> => {
    // Implementation
  }
);
```

### 8. Migration Patterns
```sql
-- ✅ CORRECT: Proper migration structure
CREATE TABLE {table_name} (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Service-specific fields
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active'
);

-- Create indexes
CREATE INDEX idx_{table_name}_org_id ON {table_name}(org_id);
CREATE INDEX idx_{table_name}_status ON {table_name}(status);
CREATE INDEX idx_{table_name}_created_at ON {table_name}(created_at);

-- Add RLS policies
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table_name}_org_policy" ON {table_name}
    FOR ALL TO authenticated
    USING (org_id = current_setting('app.current_org_id')::integer);
```

### 9. Service Export Patterns
```typescript
// ✅ CORRECT: Export all endpoints
export default new Service("{service_name}");

export { create } from "./create";
export { list } from "./list";
export { update } from "./update";
export { delete } from "./delete";

// ❌ AVOID: Missing exports
export default new Service("{service_name}");
// Missing endpoint exports
```

### 10. Development Commands
```bash
# ✅ CORRECT: Use Encore commands
encore run                    # Start development server
encore run --seed            # Start with database seeding
encore db migrate            # Run database migrations
encore db reset              # Reset database
encore gen client --lang typescript  # Generate TypeScript client
encore app deploy            # Deploy to Encore Cloud
encore app logs              # View application logs

# ❌ AVOID: Manual database operations
psql -d database -f migration.sql
```

---

## Quick Reference

### Backend Checklist
- [ ] Create service directory
- [ ] Set up database connection
- [ ] Create migration files
- [ ] Define TypeScript interfaces
- [ ] Implement CRUD operations
- [ ] Add authentication checks
- [ ] Implement error handling
- [ ] Add logging

### Frontend Checklist
- [ ] Create API service
- [ ] Implement React Query hooks
- [ ] Add optimistic updates
- [ ] Create page component
- [ ] Implement loading states
- [ ] Add error handling
- [ ] Ensure mobile responsiveness
- [ ] Add accessibility features

### Testing Checklist
- [ ] Backend unit tests
- [ ] Frontend component tests
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Performance tests

This comprehensive guide ensures consistent, high-quality microservice development across your hospitality management platform.

---

## Frontend-Backend Integration Patterns

### 1. Encore.ts Client Generation

#### Generate TypeScript Client
```bash
# Generate TypeScript client from Encore.ts backend
encore gen client --lang typescript

# This creates frontend/client.ts with all service types and methods
```

#### Client Configuration
```typescript
// frontend/services/backend.ts
import Client from '../client';
import { Local, Environment } from '../client';

// Environment-specific configuration
const getBaseURL = () => {
  if (process.env.NODE_ENV === 'production') {
    return Environment('production');
  }
  if (process.env.NODE_ENV === 'staging') {
    return Environment('staging');
  }
  return Local; // http://localhost:4000
};

// Create base client instance
const clientInstance = new Client(getBaseURL());

// Authentication wrapper
export function getAuthenticatedBackend() {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;

  return clientInstance.with({
    auth: async () => ({
      authorization: `Bearer ${token}`
    })
  });
}

// Export services for direct use
export const backend = {
  auth: clientInstance.auth,
  properties: clientInstance.properties,
  tasks: clientInstance.tasks,
  finance: clientInstance.finance,
  staff: clientInstance.staff,
  users: clientInstance.users,
  analytics: clientInstance.analytics,
  branding: clientInstance.branding,
  uploads: clientInstance.uploads,
  reports: clientInstance.reports,
};
```

### 2. Type Safety with Generated Types

#### Using Generated Types
```typescript
// frontend/services/{service_name}.ts
import { backend } from './backend';

// Use generated types from Encore.ts client
export type {EntityName} = backend.{service_name}.{EntityName}Info;
export type Create{EntityName}Request = backend.{service_name}.Create{EntityName}Request;
export type Update{EntityName}Request = backend.{service_name}.Update{EntityName}Request;
export type List{EntityName}Request = backend.{service_name}.List{EntityName}Request;
export type List{EntityName}Response = backend.{service_name}.List{EntityName}Response;

// API service using generated client
export const {service_name}Api = {
  create: async (data: Create{EntityName}Request): Promise<{EntityName}> => {
    return await backend.{service_name}.create(data);
  },
  
  list: async (params: List{EntityName}Request = {}): Promise<List{EntityName}Response> => {
    return await backend.{service_name}.list(params);
  },
  
  update: async (id: number, data: Update{EntityName}Request): Promise<{EntityName}> => {
    return await backend.{service_name}.update(id, data);
  },
  
  delete: async (id: number): Promise<{ success: boolean }> => {
    return await backend.{service_name}.delete(id);
  },
};
```

### 3. Authentication Integration

#### Token Management
```typescript
// frontend/contexts/AuthContext.tsx
import { backend } from '../services/backend';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthData | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('accessToken')
  );

  const login = async (email: string, password: string) => {
    try {
      // Use generated client for authentication
      const response = await backend.auth.login({ email, password });
      
      // Store tokens
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      
      setAccessToken(response.accessToken);
      setUser(response.user);
      
      return response;
    } catch (error) {
      throw new Error('Login failed');
    }
  };

  const logout = async () => {
    try {
      // Use generated client for logout
      await backend.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### 4. Error Handling Integration

#### Centralized Error Handling
```typescript
// frontend/utils/error-handler.ts
import { APIError } from '../client';

export function handleApiError(error: any): string {
  if (error instanceof APIError) {
    switch (error.code) {
      case 'unauthenticated':
        return 'Please log in to continue';
      case 'permission_denied':
        return 'You do not have permission to perform this action';
      case 'invalid_argument':
        return 'Invalid input provided';
      case 'not_found':
        return 'Resource not found';
      case 'internal':
        return 'Server error. Please try again later';
      default:
        return error.message || 'An error occurred';
    }
  }
  
  if (error.name === 'NetworkError') {
    return 'Network error. Please check your connection';
  }
  
  return 'An unexpected error occurred';
}
```

### 5. Real-time Updates Integration

#### WebSocket Integration
```typescript
// frontend/hooks/useRealtime.ts
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtime(serviceName: string) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Connect to Encore.ts WebSocket
    const ws = new WebSocket(`ws://localhost:4000/ws/${serviceName}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ 
        queryKey: [serviceName] 
      });
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [serviceName, queryClient]);

  return wsRef.current;
}
```

### 6. File Upload Integration

#### File Upload with Encore.ts
```typescript
// frontend/hooks/useFileUpload.ts
import { useMutation } from '@tanstack/react-query';
import { backend } from '../services/backend';

export function useFileUpload() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mimeType', file.type);
      
      // Use generated client for file upload
      const response = await backend.uploads.upload({
        file: formData,
        mimeType: file.type
      });
      
      return response;
    },
    onSuccess: (data) => {
      console.log('File uploaded:', data.fileId);
    },
    onError: (error) => {
      console.error('Upload failed:', error);
    },
  });
}
```

### 7. Environment Configuration

#### Environment-specific Setup
```typescript
// frontend/src/utils/env.ts
export function getApiUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://hospitality-management-platform-cr8i.api.encr.app';
  }
  if (process.env.NODE_ENV === 'staging') {
    return 'https://staging-hospitality-management-platform-cr8i.api.encr.app';
  }
  return 'http://localhost:4000';
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
```

### 8. Testing Integration

#### Frontend-Backend Integration Tests
```typescript
// frontend/__tests__/integration/{service_name}.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { {ServiceName}Page } from '../pages/{ServiceName}Page';
import { backend } from '../services/backend';

// Mock the backend
jest.mock('../services/backend', () => ({
  backend: {
    {service_name}: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe('{ServiceName}Page Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it('should load and display {entity_name}s', async () => {
    const mockData = {
      items: [
        { id: 1, name: 'Test {EntityName}', description: 'Test description' }
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    (backend.{service_name}.list as jest.Mock).mockResolvedValue(mockData);

    render(
      <QueryClientProvider client={queryClient}>
        <{ServiceName}Page />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test {EntityName}')).toBeInTheDocument();
    });
  });
});
```

### 9. Performance Optimization

#### Query Optimization
```typescript
// frontend/hooks/use{ServiceName}.ts
export function use{EntityName}s(params: List{EntityName}Request = {}) {
  return useQuery({
    queryKey: ['{service_name}', 'list', params],
    queryFn: () => {service_name}Api.list(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
```

### 10. Development Workflow

#### Complete Development Workflow
```bash
# 1. Start Encore.ts backend
cd backend
encore run

# 2. Generate TypeScript client
encore gen client --lang typescript

# 3. Start frontend development server
cd frontend
bun run dev

# 4. Run tests
bun run test

# 5. Build for production
bun run build
```

### 11. Production Deployment

#### Encore Cloud Deployment
```bash
# Deploy backend to Encore Cloud
encore app deploy --env production

# Deploy frontend to Vercel/Netlify
cd frontend
bun run build
# Deploy dist/ folder to your hosting provider
```

#### Environment Variables
```bash
# Production environment
NODE_ENV=production
VITE_API_URL=https://hospitality-management-platform-cr8i.api.encr.app

# Staging environment
NODE_ENV=staging
VITE_API_URL=https://staging-hospitality-management-platform-cr8i.api.encr.app

# Development environment
NODE_ENV=development
VITE_API_URL=http://localhost:4000
```

### 3. Database Schema Issues (500 Internal Server Error)

#### Problem
When adding revenue or expense records, you may encounter:
- `500 Internal Server Error`
- Database column does not exist errors
- Migration issues

#### Root Cause
The database schema may be missing columns that were added in later migrations:
- `status`, `payment_mode`, `bank_reference`, `receipt_file_id` columns
- Foreign key constraints
- Default values

#### Solution

##### Step 1: Add Database Fallback Handling
Update the add functions to handle missing columns gracefully:

```typescript
// In add_revenue.ts and add_expense.ts
try {
  revenueRow = await tx.queryRow`
    INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, receipt_url, receipt_file_id, occurred_at, created_by_user_id, status, payment_mode, bank_reference, created_at)
    VALUES (${authData.orgId}, ${propertyId}, ${source}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${receiptFileId || null}, ${occurredAtDate}, ${parseInt(authData.userID)}, 'pending', ${paymentMode}, ${bankReference || null}, ${currentTimestamp})
    RETURNING id, property_id, source, amount_cents, currency, description, receipt_url, receipt_file_id, occurred_at, status, created_by_user_id, created_at, payment_mode, bank_reference
  `;
} catch (dbError: any) {
  console.error('Database error during creation:', dbError);
  
  // If columns are missing, try without the new columns
  if (dbError.message?.includes('column') && dbError.message?.includes('does not exist')) {
    console.log('Trying fallback insert without new columns...');
    revenueRow = await tx.queryRow`
      INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, created_by_user_id, created_at)
      VALUES (${authData.orgId}, ${propertyId}, ${source}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${occurredAtDate}, ${parseInt(authData.userID)}, ${currentTimestamp})
      RETURNING id, property_id, source, amount_cents, currency, description, receipt_url, occurred_at, created_by_user_id, created_at
    `;
    
    // Set default values for missing columns
    if (revenueRow) {
      revenueRow.status = 'pending';
      revenueRow.payment_mode = paymentMode;
      revenueRow.bank_reference = bankReference;
      revenueRow.receipt_file_id = receiptFileId;
    }
  } else {
    throw dbError;
  }
}
```

##### Step 2: Create Schema Ensure Function
Create a function to ensure all required columns exist:

```typescript
// In ensure_schema.ts
export const ensureSchema = api(
  { auth: true, expose: true, method: "POST", path: "/finance/ensure-schema" },
  async () => {
    // Check and add missing columns to revenues table
    const revenueColumns = [
      { name: 'status', type: 'VARCHAR(20) DEFAULT \'pending\' NOT NULL' },
      { name: 'approved_by_user_id', type: 'INTEGER' },
      { name: 'approved_at', type: 'TIMESTAMP' },
      { name: 'payment_mode', type: 'VARCHAR(10) DEFAULT \'cash\' NOT NULL CHECK (payment_mode IN (\'cash\', \'bank\'))' },
      { name: 'bank_reference', type: 'VARCHAR(255)' },
      { name: 'receipt_file_id', type: 'INTEGER' }
    ];

    for (const column of revenueColumns) {
      const exists = await tx.queryRow`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'revenues' AND column_name = ${column.name}
      `;
      
      if (!exists) {
        await tx.exec`ALTER TABLE revenues ADD COLUMN ${column.name} ${column.type}`;
      }
    }
    
    // Similar for expenses table...
  }
);
```

##### Step 3: Run Schema Update
Call the schema ensure function to update the database:

```bash
# Call the endpoint to ensure schema is up to date
curl -X POST http://localhost:4000/finance/ensure-schema \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Files to Update
- `backend/finance/add_revenue.ts`
- `backend/finance/add_expense.ts`
- `backend/finance/ensure_schema.ts` (new file)
- `backend/finance/encore.service.ts` (export new function)

---

This comprehensive frontend-backend integration guide ensures seamless communication between your React frontend and Encore.ts backend, with proper type safety, error handling, and production-ready patterns.

---

## Common Issues and Solutions

### 1. Missing API Methods in Generated Client

#### Problem
When adding new API endpoints to a microservice, the generated TypeScript client may not include the new methods, resulting in errors like:
- `backend.finance.deleteRevenue is not a function`
- `backend.finance.deleteExpense is not a function`

#### Root Cause
The Encore.ts client generation process may not detect new API endpoints if:
1. The backend service is not running when generating the client
2. The API endpoints are not properly exported in the service file
3. There's a caching issue with the client generation

#### Solution Steps

##### Step 1: Verify Backend Service is Running
```bash
# Ensure backend is running before generating client
cd backend
encore run --watch=false
```

##### Step 2: Regenerate TypeScript Client
```bash
# Generate client with backend running
encore gen client --lang typescript
```

##### Step 3: Verify API Endpoints are Exported
```typescript
// backend/{service_name}/encore.service.ts
import { Service } from "encore.dev/service";

export default new Service("{service_name}");

// ✅ CORRECT: Export all endpoints
export { create } from "./create";
export { list } from "./list";
export { update } from "./update";
export { delete } from "./delete";
export { deleteRevenue } from "./delete_revenue";  // Make sure new endpoints are exported
export { deleteExpense } from "./delete_expense";
```

##### Step 4: Manual Client Fix (If Needed)
If the client generation still doesn't include the methods, manually add them:

```typescript
// frontend/client.ts - Add missing methods to ServiceClient class

// 1. Add method bindings in constructor
constructor(baseClient: any) {
  // ... existing bindings
  this.deleteExpense = this.deleteExpense.bind(this);
  this.deleteRevenue = this.deleteRevenue.bind(this);
}

// 2. Add interface definitions
export interface DeleteExpenseRequest {
  id: number;
}

export interface DeleteExpenseResponse {
  id: number;
  deleted: boolean;
}

export interface DeleteRevenueRequest {
  id: number;
}

export interface DeleteRevenueResponse {
  id: number;
  deleted: boolean;
}

// 3. Add method implementations
/**
 * Deletes an expense record
 */
public async deleteExpense(params: DeleteExpenseRequest): Promise<DeleteExpenseResponse> {
  const resp = await this.baseClient.callTypedAPI("DELETE", `/finance/expenses/${encodeURIComponent(params.id)}`);
  return await resp.json() as DeleteExpenseResponse;
}

/**
 * Deletes a revenue record
 */
public async deleteRevenue(params: DeleteRevenueRequest): Promise<DeleteRevenueResponse> {
  const resp = await this.baseClient.callTypedAPI("DELETE", `/finance/revenues/${encodeURIComponent(params.id)}`);
  return await resp.json() as DeleteRevenueResponse;
}
```

##### Step 5: Fix Frontend Method Calls
Ensure the frontend calls the methods with the correct parameter format:

```typescript
// ❌ INCORRECT: Passing object when method expects direct parameter
const response = await backend.finance.deleteRevenue({ id });

// ✅ CORRECT: Passing ID directly
const response = await backend.finance.deleteRevenue(id);
```

#### Prevention Checklist
- [ ] Always run `encore run` before generating client
- [ ] Verify all API endpoints are exported in `encore.service.ts`
- [ ] Check generated client includes all expected methods
- [ ] Test API calls with correct parameter format
- [ ] Regenerate client after adding new endpoints

### 2. Path Parameter Validation Errors

#### Problem
API calls fail with "path parameter is not a valid number" error when the ID parameter is not passed correctly.

#### Root Cause
Mismatch between frontend method call signature and backend API expectation:
- Frontend calls: `deleteRevenue({ id })` (object)
- Backend expects: `deleteRevenue(id)` (direct parameter)

#### Solution
```typescript
// frontend/pages/FinancePage.tsx
const deleteRevenueMutation = useMutation({
  mutationFn: async (id: number) => {
    const backend = getAuthenticatedBackend();
    if (!backend) {
      throw new Error('Not authenticated');
    }
    
    try {
      // ✅ CORRECT: Pass ID directly, not as object
      const response = await backend.finance.deleteRevenue(id);
      return response;
    } catch (error: any) {
      console.error('Delete revenue error:', error);
      throw new Error(error.message || 'Failed to delete revenue');
    }
  },
  // ... rest of mutation config
});
```

### 3. API Method Signature Mismatch

#### Problem
TypeScript errors or runtime errors due to incorrect method signatures between frontend and backend.

#### Solution Pattern
```typescript
// Backend API definition
export const deleteEntity = api(
  { auth: true, expose: true, method: "DELETE", path: "/{service_name}/:id" },
  async (id: number): Promise<DeleteResponse> => {
    // Implementation
  }
);

// Frontend client method
public async deleteEntity(id: number): Promise<DeleteResponse> {
  const resp = await this.baseClient.callTypedAPI("DELETE", `/{service_name}/${encodeURIComponent(id)}`);
  return await resp.json() as DeleteResponse;
}

// Frontend usage
const response = await backend.service.deleteEntity(id); // ✅ Direct parameter
```

### 4. Circular API Dependency Issues (500 Internal Server Error)

**Problem:** 500 Internal Server Error when adding revenue/expenses due to circular API calls
**Root Cause:** Calling API endpoint from within another API endpoint creates circular dependency
**Solution:** Create internal helper functions to avoid API-to-API calls

#### Solution Steps:

1. **Create Internal Helper Function:**
   ```typescript
   // In check_daily_approval.ts
   export async function checkDailyApprovalInternal(authData: any): Promise<CheckDailyApprovalResponse> {
     // Move the logic here without API wrapper
     if (authData.role === "ADMIN") {
       return {
         canAddTransactions: true,
         requiresApproval: false,
         hasApprovalForToday: false,
         hasUnapprovedTransactions: false,
         message: "Admins can always add transactions.",
       };
     }
     // ... rest of logic for managers
   }
   ```

2. **Update API Endpoint to Call Helper:**
   ```typescript
   export const checkDailyApproval = api<{}, CheckDailyApprovalResponse>(
     { auth: true, expose: true, method: "POST", path: "/finance/check-daily-approval" },
     async (req) => {
       const authData = getAuthData();
       if (!authData) {
         throw APIError.unauthenticated("Authentication required");
       }
       requireRole("ADMIN", "MANAGER")(authData);

       return await checkDailyApprovalInternal(authData);
     }
   );
   ```

3. **Update Add Functions to Use Helper:**
   ```typescript
   // In add_expense.ts and add_revenue.ts
   import { checkDailyApprovalInternal } from "./check_daily_approval";

   // Check if manager can add transactions based on daily approval workflow
   if (authData.role === "MANAGER") {
     const approvalCheck = await checkDailyApprovalInternal(authData);
     if (!approvalCheck.canAddTransactions) {
       throw APIError.permissionDenied(
         approvalCheck.message || "You cannot add transactions at this time. Please wait for admin approval."
       );
     }
   }
   ```

4. **Files to Update:**
   - `backend/finance/check_daily_approval.ts` - Add helper function
   - `backend/finance/add_expense.ts` - Use helper function
   - `backend/finance/add_revenue.ts` - Use helper function

#### Key Principles:
- **Admins don't need approval** - approval logic only applies to managers
- **Avoid API-to-API calls** - use internal helper functions instead
- **Maintain separation of concerns** - keep business logic separate from API wrappers

### 5. Client Generation Troubleshooting

#### Debug Steps
1. **Check Backend Status**
   ```bash
   encore run --help
   encore run --watch=false
   ```

2. **Verify Service Exports**
   ```bash
   # Check if all endpoints are exported
   grep -r "export.*from" backend/{service_name}/encore.service.ts
   ```

3. **Force Client Regeneration**
   ```bash
   # Remove old client and regenerate
   rm frontend/client.ts
   encore gen client --lang typescript
   ```

4. **Check Generated Client**
   ```bash
   # Verify methods exist in generated client
   grep -A 5 "deleteRevenue\|deleteExpense" frontend/client.ts
   ```

#### Common Fixes
- Restart Encore development server
- Clear any cached client files
- Verify all API endpoints are properly defined
- Check for TypeScript compilation errors in backend
- Ensure proper authentication setup

### 5. Testing API Integration

#### Test Pattern
```typescript
// frontend/__tests__/api-integration.test.ts
import { backend } from '../services/backend';

describe('API Integration', () => {
  it('should have all required methods', () => {
    expect(backend.finance.deleteRevenue).toBeDefined();
    expect(backend.finance.deleteExpense).toBeDefined();
    expect(typeof backend.finance.deleteRevenue).toBe('function');
    expect(typeof backend.finance.deleteExpense).toBe('function');
  });

  it('should call delete methods with correct parameters', async () => {
    const mockBackend = {
      finance: {
        deleteRevenue: jest.fn().mockResolvedValue({ id: 1, deleted: true }),
        deleteExpense: jest.fn().mockResolvedValue({ id: 1, deleted: true }),
      }
    };

    // Test correct parameter passing
    await mockBackend.finance.deleteRevenue(1);
    expect(mockBackend.finance.deleteRevenue).toHaveBeenCalledWith(1);

    await mockBackend.finance.deleteExpense(1);
    expect(mockBackend.finance.deleteExpense).toHaveBeenCalledWith(1);
  });
});
```

This troubleshooting guide helps prevent and resolve common API integration issues when developing new microservices.

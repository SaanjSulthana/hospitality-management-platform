// Service Gateway - Phase 3 Advanced Scaling
// Target: Inter-service communication with circuit breakers for 1M+ organizations

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeService } from "../services/finance-service/finance_service";
import { reportsService } from "../services/reports-service/reports_service";
import { cacheService } from "../services/cache-service/cache_service";
import { eventsService } from "../services/events-service/events_service";

// Service Gateway Interfaces
export interface ServiceRequest {
  service: 'finance' | 'reports' | 'cache' | 'events';
  action: string;
  data: any;
  timeout?: number;
  retries?: number;
}

export interface ServiceResponse {
  success: boolean;
  data: any;
  service: string;
  processingTime: number;
  cached: boolean;
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  lastCheck: string;
  dependencies: any[];
}

export interface AllServicesHealthResponse {
  services: ServiceHealth[];
}

// Circuit Breaker Implementation
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 60000; // 1 minute
  private readonly halfOpenMaxCalls = 3;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.failures = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }
}

// Service Gateway Class
export class ServiceGateway {
  private serviceName = 'ServiceGateway';
  private version = '1.0.0';
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private serviceEndpoints: Map<string, any> = new Map();

  constructor() {
    this.initializeCircuitBreakers();
    this.initializeServiceEndpoints();
    console.log(`[${this.serviceName}] Initialized v${this.version}`);
  }

  private initializeCircuitBreakers(): void {
    this.circuitBreakers.set('finance', new CircuitBreaker());
    this.circuitBreakers.set('reports', new CircuitBreaker());
    this.circuitBreakers.set('cache', new CircuitBreaker());
    this.circuitBreakers.set('events', new CircuitBreaker());
  }

  private initializeServiceEndpoints(): void {
    this.serviceEndpoints.set('finance', financeService);
    this.serviceEndpoints.set('reports', reportsService);
    this.serviceEndpoints.set('cache', cacheService);
    this.serviceEndpoints.set('events', eventsService);
  }

  // Route Request to Service
  async routeRequest(request: ServiceRequest): Promise<ServiceResponse> {
    const startTime = Date.now();
    const circuitBreaker = this.circuitBreakers.get(request.service);
    const service = this.serviceEndpoints.get(request.service);

    if (!circuitBreaker || !service) {
      throw APIError.badRequest(`Unknown service: ${request.service}`);
    }

    try {
      const result = await circuitBreaker.execute(async () => {
        return await this.executeServiceAction(service, request.action, request.data);
      });

      const processingTime = Date.now() - startTime;
      console.log(`[${this.serviceName}] Request routed to ${request.service} in ${processingTime}ms`);

      return {
        success: true,
        data: result,
        service: request.service,
        processingTime,
        cached: false
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[${this.serviceName}] Error routing request to ${request.service}:`, error);
      
      throw APIError.internal(`Service ${request.service} error: ${error.message}`);
    }
  }

  // Execute Service Action
  private async executeServiceAction(service: any, action: string, data: any): Promise<any> {
    // Route to appropriate service method based on action
    switch (action) {
      case 'addRevenue':
        return await service.addRevenue(data);
      case 'addExpense':
        return await service.addExpense(data);
      case 'approveTransaction':
        return await service.approveTransaction(data.transactionId, data.entityType);
      case 'getDailyReport':
        return await service.getDailyReport(data);
      case 'getMonthlyReport':
        return await service.getMonthlyReport(data);
      case 'reconcileDailyBalance':
        return await service.reconcileDailyBalance(data.propertyId, data.date);
      case 'getCache':
        return await service.get(data.key);
      case 'setCache':
        return await service.set(data);
      case 'invalidateCache':
        return await service.invalidate(data);
      case 'clearCache':
        return await service.clear(data.orgId, data.propertyId);
      case 'publishEvent':
        return await service.publishEvent(data);
      case 'batchPublishEvents':
        return await service.batchPublishEvents(data.events);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // Get Service Health
  async getServiceHealth(serviceName: string): Promise<ServiceHealth> {
    const service = this.serviceEndpoints.get(serviceName);
    const circuitBreaker = this.circuitBreakers.get(serviceName);

    if (!service || !circuitBreaker) {
      throw APIError.badRequest(`Unknown service: ${serviceName}`);
    }

    const startTime = Date.now();
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    let dependencies: any[] = [];

    try {
      const health = await service.getHealth();
      dependencies = health.dependencies;
      status = health.status === 'healthy' ? 'healthy' : 'unhealthy';
    } catch (error) {
      status = 'unhealthy';
      dependencies = [{ name: 'HealthCheck', status: 'unhealthy', error: error.message }];
    }

    const responseTime = Date.now() - startTime;
    const circuitState = circuitBreaker.getState();

    if (circuitState === 'OPEN') {
      status = 'unhealthy';
    } else if (circuitState === 'HALF_OPEN') {
      status = 'degraded';
    }

    return {
      service: serviceName,
      status,
      responseTime,
      lastCheck: new Date().toISOString(),
      dependencies
    };
  }

  // Get All Services Health
  async getAllServicesHealth(): Promise<ServiceHealth[]> {
    const services = ['finance', 'reports', 'cache', 'events'];
    const healthPromises = services.map(service => this.getServiceHealth(service));
    
    try {
      return await Promise.all(healthPromises);
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting all services health:`, error);
      return [];
    }
  }

  // Get Circuit Breaker Status
  getCircuitBreakerStatus(): { [service: string]: string } {
    const status: { [service: string]: string } = {};
    
    for (const [service, circuitBreaker] of this.circuitBreakers) {
      status[service] = circuitBreaker.getState();
    }
    
    return status;
  }

  // Reset Circuit Breaker
  resetCircuitBreaker(serviceName: string): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker) {
      // Create new circuit breaker instance
      this.circuitBreakers.set(serviceName, new CircuitBreaker());
      console.log(`[${this.serviceName}] Circuit breaker reset for service: ${serviceName}`);
    }
  }

  // Get Gateway Health
  async getGatewayHealth(): Promise<{
    service: string;
    version: string;
    status: 'healthy' | 'unhealthy';
    services: ServiceHealth[];
    circuitBreakers: { [service: string]: string };
    timestamp: string;
  }> {
    const services = await this.getAllServicesHealth();
    const circuitBreakers = this.getCircuitBreakerStatus();
    const healthy = services.every(s => s.status === 'healthy');

    return {
      service: this.serviceName,
      version: this.version,
      status: healthy ? 'healthy' : 'unhealthy',
      services,
      circuitBreakers,
      timestamp: new Date().toISOString()
    };
  }
}

// Global service gateway instance
export const serviceGateway = new ServiceGateway();

// Shared handler for routing requests to services
async function routeRequestHandler(req: ServiceRequest): Promise<ServiceResponse> {
  return await serviceGateway.routeRequest(req);
}

// API Endpoints

// LEGACY: Routes request to appropriate service (keep for backward compatibility)
export const routeRequest = api<ServiceRequest, ServiceResponse>(
  { auth: true, expose: true, method: "POST", path: "/gateway/route" },
  routeRequestHandler
);

// V1: Routes request to appropriate service
export const routeRequestV1 = api<ServiceRequest, ServiceResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/system/gateway/route" },
  routeRequestHandler
);

// Shared handler for getting health status of a specific service
async function getServiceHealthHandler(req: {service: string}): Promise<ServiceHealth> {
  return await serviceGateway.getServiceHealth(req.service);
}

// LEGACY: Gets health status of a specific service (keep for backward compatibility)
export const getServiceHealth = api<{service: string}, ServiceHealth>(
  { auth: true, expose: true, method: "GET", path: "/gateway/health/:service" },
  getServiceHealthHandler
);

// V1: Gets health status of a specific service
export const getServiceHealthV1 = api<{service: string}, ServiceHealth>(
  { auth: true, expose: true, method: "GET", path: "/v1/system/gateway/health/:service" },
  getServiceHealthHandler
);

// Shared handler for getting health status of all services
async function getAllServicesHealthHandler(): Promise<AllServicesHealthResponse> {
  const services = await serviceGateway.getAllServicesHealth();
  return { services };
}

// LEGACY: Gets health status of all services (keep for backward compatibility)
export const getAllServicesHealth = api<{}, AllServicesHealthResponse>(
  { auth: true, expose: true, method: "GET", path: "/gateway/health" },
  getAllServicesHealthHandler
);

// V1: Gets health status of all services
export const getAllServicesHealthV1 = api<{}, AllServicesHealthResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/system/gateway/health" },
  getAllServicesHealthHandler
);

// Shared handler for getting gateway health status
async function getGatewayHealthHandler(): Promise<{
  service: string;
  version: string;
  status: 'healthy' | 'unhealthy';
  services: ServiceHealth[];
  circuitBreakers: { [service: string]: string };
  timestamp: string;
}> {
  return await serviceGateway.getGatewayHealth();
}

// LEGACY: Gets gateway health status (keep for backward compatibility)
export const getGatewayHealth = api<{}, { 
  service: string;
  version: string;
  status: 'healthy' | 'unhealthy';
  services: ServiceHealth[];
  circuitBreakers: { [service: string]: string };
  timestamp: string;
}>(
  { auth: false, expose: true, method: "GET", path: "/gateway/status" },
  getGatewayHealthHandler
);

// V1: Gets gateway health status
export const getGatewayHealthV1 = api<{}, { 
  service: string;
  version: string;
  status: 'healthy' | 'unhealthy';
  services: ServiceHealth[];
  circuitBreakers: { [service: string]: string };
  timestamp: string;
}>(
  { auth: false, expose: true, method: "GET", path: "/v1/system/gateway/status" },
  getGatewayHealthHandler
);

// Shared handler for resetting circuit breaker
async function resetCircuitBreakerHandler(req: {service: string}): Promise<{success: boolean, message: string}> {
  serviceGateway.resetCircuitBreaker(req.service);
  return {
    success: true,
    message: `Circuit breaker reset for service: ${req.service}`
  };
}

// LEGACY: Resets circuit breaker for a service (keep for backward compatibility)
export const resetCircuitBreaker = api<{service: string}, {success: boolean, message: string}>(
  { auth: true, expose: true, method: "POST", path: "/gateway/reset-circuit-breaker" },
  resetCircuitBreakerHandler
);

// V1: Resets circuit breaker for a service
export const resetCircuitBreakerV1 = api<{service: string}, {success: boolean, message: string}>(
  { auth: true, expose: true, method: "POST", path: "/v1/system/gateway/reset-circuit-breaker" },
  resetCircuitBreakerHandler
);

// Finance Service - Phase 3 Advanced Scaling
// Target: Independent finance microservice for 1M+ organizations
// 🔥 CRITICAL: Now uses centralized event validation for type safety
// 🔥 PARTITION-AWARE: Uses repository layer for automatic partition routing

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../../auth/middleware";
import { financeDB } from "../../finance/db";
import { financeEvents } from "../../finance/events";
import { buildValidatedEvent } from "../../finance/event_validator";
import { FinanceRepository } from "../../shared/repositories/finance_repository";
import { DatabaseConfig } from "../../config/runtime";

// Finance Service Interfaces
export interface FinanceServiceRequest {
  propertyId?: number;
  amount: number;
  description: string;
  paymentMode: 'cash' | 'bank';
  occurredAt?: string;
}

export interface FinanceServiceResponse {
  success: boolean;
  transactionId: string;
  message: string;
}

export interface FinanceServiceError {
  code: string;
  message: string;
  details?: any;
}

// Finance Service Class
export class FinanceService {
  private serviceName = 'FinanceService';
  private version = '2.0.0';
  private dependencies: string[] = ['Database', 'EventStore', 'CacheService', 'PartitionRouting'];
  private financeRepo: FinanceRepository;

  constructor() {
    this.financeRepo = new FinanceRepository(financeDB);
    console.log(`[${this.serviceName}] Initialized v${this.version} (Partition-Aware)`);
    console.log(`[${this.serviceName}] Partitioned Tables: ${DatabaseConfig.usePartitionedTables ? 'ENABLED' : 'DISABLED'}`);
  }

  // Add Revenue
  async addRevenue(request: FinanceServiceRequest): Promise<FinanceServiceResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    try {
      const occurredAt = request.occurredAt || new Date().toISOString();

      // 🔥 PARTITION-AWARE: Use repository for automatic partition routing
      const inserted = await this.financeRepo.insertRevenue({
        org_id: authData.orgId,
        property_id: request.propertyId!,
        amount_cents: request.amount * 100,
        description: request.description,
        payment_method: request.paymentMode,
        occurred_at: occurredAt,
        status: 'pending',
        created_by_user_id: authData.userId,
      });

      const transactionId = inserted.id!.toString();

      // 🔥 CRITICAL: Publish event using validated event builder
      const eventPayload = buildValidatedEvent(
        {
          eventType: 'revenue_added',
          orgId: authData.orgId,
          propertyId: request.propertyId!,
          entityId: transactionId,
          entityType: 'revenue',
          metadata: {
            amountCents: request.amount * 100,
            paymentMode: request.paymentMode,
            transactionDate: occurredAt.split('T')[0],
            affectedReportDates: [occurredAt.split('T')[0]]
          }
        },
        parseInt(authData.userID)
      );
      await financeEvents.publish(eventPayload);

      console.log(`[${this.serviceName}] Revenue added: ${transactionId} (Partitioned: ${DatabaseConfig.usePartitionedTables})`);
      
      return {
        success: true,
        transactionId,
        message: 'Revenue added successfully'
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error adding revenue:`, error);
      throw APIError.internal(`Failed to add revenue: ${error.message}`);
    }
  }

  // Add Expense
  async addExpense(request: FinanceServiceRequest): Promise<FinanceServiceResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    try {
      const occurredAt = request.occurredAt || new Date().toISOString();

      // 🔥 PARTITION-AWARE: Use repository for automatic partition routing
      const inserted = await this.financeRepo.insertExpense({
        org_id: authData.orgId,
        property_id: request.propertyId!,
        amount_cents: request.amount * 100,
        description: request.description,
        payment_method: request.paymentMode,
        occurred_at: occurredAt,
        status: 'pending',
        created_by_user_id: authData.userId,
      });

      const transactionId = inserted.id!.toString();

      // 🔥 CRITICAL: Publish event using validated event builder
      const eventPayload = buildValidatedEvent(
        {
          eventType: 'expense_added',
          orgId: authData.orgId,
          propertyId: request.propertyId!,
          entityId: transactionId,
          entityType: 'expense',
          metadata: {
            amountCents: request.amount * 100,
            paymentMode: request.paymentMode,
            transactionDate: occurredAt.split('T')[0],
            affectedReportDates: [occurredAt.split('T')[0]]
          }
        },
        parseInt(authData.userID)
      );
      await financeEvents.publish(eventPayload);

      console.log(`[${this.serviceName}] Expense added: ${transactionId} (Partitioned: ${DatabaseConfig.usePartitionedTables})`);
      
      return {
        success: true,
        transactionId,
        message: 'Expense added successfully'
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error adding expense:`, error);
      throw APIError.internal(`Failed to add expense: ${error.message}`);
    }
  }

  // Approve Transaction
  async approveTransaction(transactionId: string, entityType: 'revenue' | 'expense'): Promise<FinanceServiceResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    try {
      // 🔥 PARTITION-AWARE: Use repository for automatic partition routing
      if (entityType === 'revenue') {
        await this.financeRepo.updateRevenueStatus(
          parseInt(transactionId),
          authData.orgId,
          'approved',
          authData.userId
        );
      } else {
        await this.financeRepo.updateExpenseStatus(
          parseInt(transactionId),
          authData.orgId,
          'approved',
          authData.userId
        );
      }

      // 🔥 CRITICAL: Publish approval event using validated event builder
      const eventPayload = buildValidatedEvent(
        {
          eventType: `${entityType}_approved` as any,
          orgId: authData.orgId,
          propertyId: 0, // Will be fetched from transaction if needed
          entityId: transactionId,
          entityType,
          metadata: {
            previousStatus: 'pending',
            newStatus: 'approved'
          }
        },
        parseInt(authData.userID)
      );
      await financeEvents.publish(eventPayload);

      console.log(`[${this.serviceName}] Transaction approved: ${transactionId} (Partitioned: ${DatabaseConfig.usePartitionedTables})`);
      
      return {
        success: true,
        transactionId,
        message: `${entityType} approved successfully`
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error approving transaction:`, error);
      throw APIError.internal(`Failed to approve transaction: ${error.message}`);
    }
  }

  // Get Service Health
  async getHealth(): Promise<{
    service: string;
    version: string;
    status: 'healthy' | 'unhealthy';
    dependencies: any[];
    timestamp: string;
  }> {
    const dependencies = await this.checkDependencies();
    const healthy = dependencies.every(dep => dep.status === 'healthy');

    return {
      service: this.serviceName,
      version: this.version,
      status: healthy ? 'healthy' : 'unhealthy',
      dependencies,
      timestamp: new Date().toISOString()
    };
  }

  // Check Dependencies
  private async checkDependencies(): Promise<any[]> {
    const dependencies = [];

    // Check Database
    try {
      await financeDB.exec('SELECT 1');
      dependencies.push({
        name: 'Database',
        status: 'healthy',
        responseTime: Date.now()
      });
    } catch (error) {
      dependencies.push({
        name: 'Database',
        status: 'unhealthy',
        error: error.message
      });
    }

    // Check Event Store
    try {
      // Simulate event store check
      dependencies.push({
        name: 'EventStore',
        status: 'healthy',
        responseTime: Date.now()
      });
    } catch (error) {
      dependencies.push({
        name: 'EventStore',
        status: 'unhealthy',
        error: error.message
      });
    }

    return dependencies;
  }
}

// Global finance service instance
export const financeService = new FinanceService();

// API Endpoints
export const addRevenue = api<FinanceServiceRequest, FinanceServiceResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/revenue" },
  async (req) => {
    return await financeService.addRevenue(req);
  }
);

export const addExpense = api<FinanceServiceRequest, FinanceServiceResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/expense" },
  async (req) => {
    return await financeService.addExpense(req);
  }
);

export const approveTransaction = api<{transactionId: string, entityType: 'revenue' | 'expense'}, FinanceServiceResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/approve" },
  async (req) => {
    return await financeService.approveTransaction(req.transactionId, req.entityType);
  }
);

export const getFinanceHealth = api<{}, { status: string; timestamp: string; uptime: number }>(
  { auth: false, expose: true, method: "GET", path: "/finance/health" },
  async () => {
    return await financeService.getHealth();
  }
);

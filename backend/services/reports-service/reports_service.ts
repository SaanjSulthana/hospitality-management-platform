// Reports Service - Phase 3 Advanced Scaling
// Target: Independent reports microservice for 1M+ organizations
// 🔥 PARTITION-AWARE: Uses repository layer for automatic partition routing

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../../auth/middleware";
import { reportsDB } from "../../reports/db";
import { distributedCache } from "../../cache/distributed_cache_manager";
import { correctionBatcher } from "../../reports/correction_batcher";
import { replicaManager } from "../../database/replica_manager";
import { ReportsRepository } from "../../shared/repositories/reports_repository";
import { FinanceRepository } from "../../shared/repositories/finance_repository";
import { DatabaseConfig } from "../../config/runtime";

// Reports Service Interfaces
export interface ReportsServiceRequest {
  propertyId?: number;
  date?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReportsServiceResponse {
  success: boolean;
  data: any;
  cached: boolean;
  processingTime: number;
}

export interface DailyReportData {
  date: string;
  propertyId: number;
  openingBalance: number;
  closingBalance: number;
  cashReceived: number;
  bankReceived: number;
  cashExpenses: number;
  bankExpenses: number;
  discrepancy: number;
}

// Reports Service Class
export class ReportsService {
  private serviceName = 'ReportsService';
  private version = '2.0.0';
  private dependencies: string[] = ['Database', 'CacheService', 'CorrectionBatcher', 'ReplicaManager', 'PartitionRouting'];
  private reportsRepo: ReportsRepository;
  private financeRepo: FinanceRepository;

  constructor() {
    this.reportsRepo = new ReportsRepository(reportsDB);
    this.financeRepo = new FinanceRepository(reportsDB);
    console.log(`[${this.serviceName}] Initialized v${this.version} (Partition-Aware)`);
    console.log(`[${this.serviceName}] Partitioned Tables: ${DatabaseConfig.usePartitionedTables ? 'ENABLED' : 'DISABLED'}`);
  }

  // Get Daily Report
  async getDailyReport(request: ReportsServiceRequest): Promise<ReportsServiceResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const startTime = Date.now();
    const date = request.date || new Date().toISOString().split('T')[0];
    const propertyId = request.propertyId;

    try {
      // Check cache first
      const cached = await distributedCache.getDailyReport(authData.orgId, propertyId, date);
      if (cached) {
        console.log(`[${this.serviceName}] Cache hit for daily report`);
        return {
          success: true,
          data: cached,
          cached: true,
          processingTime: Date.now() - startTime
        };
      }

      console.log(`[${this.serviceName}] Cache miss, generating daily report`);
      
      // Generate report using read replica
      const reportData = await this.generateDailyReport(authData.orgId, propertyId, date);
      
      // Cache the result
      await distributedCache.setDailyReport(authData.orgId, propertyId, date, reportData);
      
      const processingTime = Date.now() - startTime;
      console.log(`[${this.serviceName}] Daily report generated in ${processingTime}ms`);
      
      return {
        success: true,
        data: reportData,
        cached: false,
        processingTime
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error generating daily report:`, error);
      throw APIError.internal(`Failed to generate daily report: ${error.message}`);
    }
  }

  // Get Monthly Report
  async getMonthlyReport(request: ReportsServiceRequest): Promise<ReportsServiceResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const startTime = Date.now();
    const month = request.date?.substring(0, 7) || new Date().toISOString().substring(0, 7);
    const propertyId = request.propertyId;

    try {
      // Check cache first
      const cached = await distributedCache.getMonthlyReport(authData.orgId, propertyId, month);
      if (cached) {
        console.log(`[${this.serviceName}] Cache hit for monthly report`);
        return {
          success: true,
          data: cached,
          cached: true,
          processingTime: Date.now() - startTime
        };
      }

      console.log(`[${this.serviceName}] Cache miss, generating monthly report`);
      
      // Generate monthly report
      const reportData = await this.generateMonthlyReport(authData.orgId, propertyId, month);
      
      // Cache the result
      await distributedCache.setMonthlyReport(authData.orgId, propertyId, month, reportData);
      
      const processingTime = Date.now() - startTime;
      console.log(`[${this.serviceName}] Monthly report generated in ${processingTime}ms`);
      
      return {
        success: true,
        data: reportData,
        cached: false,
        processingTime
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error generating monthly report:`, error);
      throw APIError.internal(`Failed to generate monthly report: ${error.message}`);
    }
  }

  // Generate Daily Report
  private async generateDailyReport(orgId: number, propertyId: number | undefined, date: string): Promise<DailyReportData> {
    // 🔥 PARTITION-AWARE: Use repositories for automatic partition routing
    
    // Get daily balance
    const balance = propertyId
      ? await this.reportsRepo.getDailyCashBalance(orgId, propertyId, date)
      : await this.reportsRepo.getDailyCashBalancesByDateRange(orgId, undefined, date, date)
          .then(balances => balances[0] || null);
    
    // Get revenues for the day
    const revenueStartDate = `${date} 00:00:00`;
    const revenueEndDate = `${date} 23:59:59`;
    const revenueSum = await this.financeRepo.getRevenueSumByDateRange(
      orgId,
      propertyId,
      revenueStartDate,
      revenueEndDate
    );
    
    // Get expenses for the day
    const expenseSum = await this.financeRepo.getExpenseSumByDateRange(
      orgId,
      propertyId,
      revenueStartDate,
      revenueEndDate
    );

    console.log(`[${this.serviceName}] Generated daily report for ${date} (Partitioned: ${DatabaseConfig.usePartitionedTables})`);

    return {
      date,
      propertyId: propertyId || 0,
      openingBalance: balance?.opening_balance_cents || 0,
      closingBalance: balance?.closing_balance_cents || 0,
      cashReceived: revenueSum,
      bankReceived: 0, // Simplified for this example
      cashExpenses: expenseSum,
      bankExpenses: 0, // Simplified for this example
      discrepancy: balance?.balance_discrepancy_cents || 0
    };
  }

  // Generate Monthly Report
  private async generateMonthlyReport(orgId: number, propertyId: number | undefined, month: string): Promise<any> {
    // Use read replica for queries
    const readDB = replicaManager.getReadReplica();
    
    const startDate = `${month}-01`;
    const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split('T')[0];
    
    // Get monthly summary
    const summaryQuery = propertyId
      ? `SELECT 
           SUM(CASE WHEN payment_mode = 'cash' THEN amount_cents ELSE 0 END) as cash_received,
           SUM(CASE WHEN payment_mode = 'bank' THEN amount_cents ELSE 0 END) as bank_received,
           COUNT(*) as transaction_count
         FROM revenues 
         WHERE org_id = ${orgId} AND property_id = ${propertyId} 
         AND occurred_at >= '${startDate}' AND occurred_at <= '${endDate}' 
         AND status = 'approved'`
      : `SELECT 
           SUM(CASE WHEN payment_mode = 'cash' THEN amount_cents ELSE 0 END) as cash_received,
           SUM(CASE WHEN payment_mode = 'bank' THEN amount_cents ELSE 0 END) as bank_received,
           COUNT(*) as transaction_count
         FROM revenues 
         WHERE org_id = ${orgId} 
         AND occurred_at >= '${startDate}' AND occurred_at <= '${endDate}' 
         AND status = 'approved'`;
    
    const summary = await readDB.queryRow(summaryQuery);
    
    return {
      month,
      propertyId: propertyId || 0,
      cashReceived: summary?.cash_received || 0,
      bankReceived: summary?.bank_received || 0,
      transactionCount: summary?.transaction_count || 0,
      startDate,
      endDate
    };
  }

  // Reconcile Daily Balance
  async reconcileDailyBalance(propertyId: number, date: string): Promise<ReportsServiceResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const startTime = Date.now();

    try {
      // Use correction batcher for reconciliation
      await correctionBatcher.add({
        orgId: authData.orgId,
        propertyId,
        date,
        corrections: {
          cashReceivedCents: 0, // Will be calculated
          bankReceivedCents: 0,
          cashExpensesCents: 0,
          bankExpensesCents: 0
        },
        timestamp: new Date()
      });

      const processingTime = Date.now() - startTime;
      console.log(`[${this.serviceName}] Daily balance reconciliation queued in ${processingTime}ms`);
      
      return {
        success: true,
        data: { message: 'Reconciliation queued successfully' },
        cached: false,
        processingTime
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error reconciling daily balance:`, error);
      throw APIError.internal(`Failed to reconcile daily balance: ${error.message}`);
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
      await reportsDB.exec('SELECT 1');
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

    // Check Cache Service
    try {
      const cacheStats = await reportsCache.getStats();
      dependencies.push({
        name: 'CacheService',
        status: 'healthy',
        stats: cacheStats
      });
    } catch (error) {
      dependencies.push({
        name: 'CacheService',
        status: 'unhealthy',
        error: error.message
      });
    }

    // Check Replica Manager
    try {
      const replicaHealth = await replicaManager.checkReplicaHealth();
      dependencies.push({
        name: 'ReplicaManager',
        status: replicaHealth.size > 0 ? 'healthy' : 'unhealthy',
        replicas: Array.from(replicaHealth.entries())
      });
    } catch (error) {
      dependencies.push({
        name: 'ReplicaManager',
        status: 'unhealthy',
        error: error.message
      });
    }

    return dependencies;
  }
}

// Global reports service instance
export const reportsService = new ReportsService();

// API Endpoints
export const getDailyReport = api<ReportsServiceRequest, ReportsServiceResponse>(
  { auth: true, expose: true, method: "GET", path: "/reports/daily" },
  async (req) => {
    return await reportsService.getDailyReport(req);
  }
);

export const getMonthlyReport = api<ReportsServiceRequest, ReportsServiceResponse>(
  { auth: true, expose: true, method: "GET", path: "/reports/monthly" },
  async (req) => {
    return await reportsService.getMonthlyReport(req);
  }
);

export const reconcileDailyBalance = api<{propertyId: number, date: string}, ReportsServiceResponse>(
  { auth: true, expose: true, method: "POST", path: "/reports/reconcile" },
  async (req) => {
    return await reportsService.reconcileDailyBalance(req.propertyId, req.date);
  }
);

export const getReportsHealth = api<{}, { status: string; timestamp: string; uptime: number }>(
  { auth: false, expose: true, method: "GET", path: "/reports/health" },
  async () => {
    return await reportsService.getHealth();
  }
);

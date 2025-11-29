// Read Models - Phase 3 Advanced Scaling
// Target: Read model projections for event sourcing (1M+ organizations)

import { readModelsDB } from "./db";
import { snapshotManager } from "./snapshot_manager";

// Read Model Interfaces
export interface ReadModel {
  modelId: string;
  modelType: string;
  orgId: number;
  data: any;
  version: number;
  lastUpdated: Date;
  size: number;
}

export interface ReadModelConfig {
  projectionInterval: number; // milliseconds
  batchSize: number;
  retentionDays: number;
  compressionEnabled: boolean;
}

export interface ReadModelStats {
  totalModels: number;
  modelsPerType: { [key: string]: number };
  averageModelSize: number;
  totalStorageUsed: number;
  lastProjectionTime: Date;
}

// Read Model Projections
export class ReadModelProjections {
  private serviceName = 'ReadModelProjections';
  private version = '1.0.0';
  private config: ReadModelConfig = {
    projectionInterval: 60000, // 1 minute
    batchSize: 1000,
    retentionDays: 365,
    compressionEnabled: true
  };
  private stats = {
    totalModels: 0,
    modelsPerType: {} as { [key: string]: number },
    averageModelSize: 0,
    totalStorageUsed: 0,
    lastProjectionTime: new Date()
  };

  constructor() {
    console.log(`[${this.serviceName}] Initialized v${this.version}`);
    this.startProjectionProcessing();
  }

  // Create Read Model
  async createReadModel(
    modelType: string,
    orgId: number,
    data: any,
    version: number
  ): Promise<ReadModel> {
    try {
      const modelId = `${modelType}_${orgId}_${version}`;
      const size = JSON.stringify(data).length;
      
      const readModel: ReadModel = {
        modelId,
        modelType,
        orgId,
        data,
        version,
        lastUpdated: new Date(),
        size
      };

      // Store read model
      await this.storeReadModel(readModel);

      // Update statistics
      this.updateStats(readModel);

      console.log(`[${this.serviceName}] Read model created: ${modelId}`);
      return readModel;
    } catch (error) {
      console.error(`[${this.serviceName}] Error creating read model:`, error);
      throw error;
    }
  }

  // Get Read Model
  async getReadModel(modelType: string, orgId: number): Promise<ReadModel | null> {
    try {
      const row = await readModelsDB.queryRow`
        SELECT * FROM read_models 
        WHERE model_type = ${modelType} 
        AND org_id = ${orgId}
        ORDER BY version DESC
        LIMIT 1
      `;

      if (!row) return null;

      return {
        modelId: row.model_id,
        modelType: row.model_type,
        orgId: row.org_id,
        data: JSON.parse(row.data),
        version: row.version,
        lastUpdated: new Date(row.last_updated),
        size: row.size
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting read model:`, error);
      throw error;
    }
  }

  // Project Daily Report Model
  async projectDailyReportModel(orgId: number, propertyId: number, date: string): Promise<ReadModel> {
    try {
      // Get events for the day
      const events = await this.getEventsForDate(orgId, propertyId, date);
      
      // Build daily report model
      const dailyReport = await this.buildDailyReportModel(events, orgId, propertyId, date);
      
      // Create read model
      const readModel = await this.createReadModel(
        'daily_report',
        orgId,
        dailyReport,
        events.length
      );

      console.log(`[${this.serviceName}] Daily report model projected for ${orgId}:${propertyId}:${date}`);
      return readModel;
    } catch (error) {
      console.error(`[${this.serviceName}] Error projecting daily report model:`, error);
      throw error;
    }
  }

  // Project Monthly Report Model
  async projectMonthlyReportModel(orgId: number, propertyId: number, month: string): Promise<ReadModel> {
    try {
      // Get events for the month
      const events = await this.getEventsForMonth(orgId, propertyId, month);
      
      // Build monthly report model
      const monthlyReport = await this.buildMonthlyReportModel(events, orgId, propertyId, month);
      
      // Create read model
      const readModel = await this.createReadModel(
        'monthly_report',
        orgId,
        monthlyReport,
        events.length
      );

      console.log(`[${this.serviceName}] Monthly report model projected for ${orgId}:${propertyId}:${month}`);
      return readModel;
    } catch (error) {
      console.error(`[${this.serviceName}] Error projecting monthly report model:`, error);
      throw error;
    }
  }

  // Project Financial Summary Model
  async projectFinancialSummaryModel(orgId: number, propertyId: number): Promise<ReadModel> {
    try {
      // Get all financial events
      const events = await this.getFinancialEvents(orgId, propertyId);
      
      // Build financial summary model
      const financialSummary = await this.buildFinancialSummaryModel(events, orgId, propertyId);
      
      // Create read model
      const readModel = await this.createReadModel(
        'financial_summary',
        orgId,
        financialSummary,
        events.length
      );

      console.log(`[${this.serviceName}] Financial summary model projected for ${orgId}:${propertyId}`);
      return readModel;
    } catch (error) {
      console.error(`[${this.serviceName}] Error projecting financial summary model:`, error);
      throw error;
    }
  }

  // Get Events for Date
  private async getEventsForDate(orgId: number, propertyId: number, date: string): Promise<any[]> {
    try {
      const events = await readModelsDB.queryAll`
        SELECT * FROM events 
        WHERE org_id = ${orgId} 
        AND JSON_EXTRACT(metadata, '$.propertyId') = ${propertyId}
        AND DATE(timestamp) = ${date}
        ORDER BY timestamp ASC
      `;

      return events.map(event => ({
        eventId: event.event_id,
        eventType: event.event_type,
        aggregateType: event.aggregate_type,
        aggregateId: event.aggregate_id,
        orgId: event.org_id,
        timestamp: new Date(event.timestamp),
        payload: JSON.parse(event.payload),
        metadata: JSON.parse(event.metadata),
        version: event.version
      }));
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting events for date:`, error);
      return [];
    }
  }

  // Get Events for Month
  private async getEventsForMonth(orgId: number, propertyId: number, month: string): Promise<any[]> {
    try {
      const startDate = `${month}-01`;
      const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split('T')[0];
      
      const events = await readModelsDB.queryAll`
        SELECT * FROM events 
        WHERE org_id = ${orgId} 
        AND JSON_EXTRACT(metadata, '$.propertyId') = ${propertyId}
        AND DATE(timestamp) >= ${startDate}
        AND DATE(timestamp) <= ${endDate}
        ORDER BY timestamp ASC
      `;

      return events.map(event => ({
        eventId: event.event_id,
        eventType: event.event_type,
        aggregateType: event.aggregate_type,
        aggregateId: event.aggregate_id,
        orgId: event.org_id,
        timestamp: new Date(event.timestamp),
        payload: JSON.parse(event.payload),
        metadata: JSON.parse(event.metadata),
        version: event.version
      }));
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting events for month:`, error);
      return [];
    }
  }

  // Get Financial Events
  private async getFinancialEvents(orgId: number, propertyId: number): Promise<any[]> {
    try {
      const events = await readModelsDB.queryAll`
        SELECT * FROM events 
        WHERE org_id = ${orgId} 
        AND JSON_EXTRACT(metadata, '$.propertyId') = ${propertyId}
        AND event_type IN ('revenue_added', 'expense_added', 'revenue_approved', 'expense_approved')
        ORDER BY timestamp ASC
      `;

      return events.map(event => ({
        eventId: event.event_id,
        eventType: event.event_type,
        aggregateType: event.aggregate_type,
        aggregateId: event.aggregate_id,
        orgId: event.org_id,
        timestamp: new Date(event.timestamp),
        payload: JSON.parse(event.payload),
        metadata: JSON.parse(event.metadata),
        version: event.version
      }));
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting financial events:`, error);
      return [];
    }
  }

  // Build Daily Report Model
  private async buildDailyReportModel(events: any[], orgId: number, propertyId: number, date: string): Promise<any> {
    let totalRevenue = 0;
    let totalExpenses = 0;
    let approvedRevenue = 0;
    let approvedExpenses = 0;
    let transactionCount = 0;

    for (const event of events) {
      switch (event.eventType) {
        case 'revenue_added':
          totalRevenue += event.payload.amount || 0;
          transactionCount++;
          break;
        case 'expense_added':
          totalExpenses += event.payload.amount || 0;
          transactionCount++;
          break;
        case 'revenue_approved':
          approvedRevenue += event.payload.amount || 0;
          break;
        case 'expense_approved':
          approvedExpenses += event.payload.amount || 0;
          break;
      }
    }

    return {
      date,
      orgId,
      propertyId,
      totalRevenue,
      totalExpenses,
      approvedRevenue,
      approvedExpenses,
      transactionCount,
      netIncome: totalRevenue - totalExpenses,
      approvedNetIncome: approvedRevenue - approvedExpenses,
      lastUpdated: new Date()
    };
  }

  // Build Monthly Report Model
  private async buildMonthlyReportModel(events: any[], orgId: number, propertyId: number, month: string): Promise<any> {
    let totalRevenue = 0;
    let totalExpenses = 0;
    let approvedRevenue = 0;
    let approvedExpenses = 0;
    let transactionCount = 0;
    const dailyBreakdown: { [key: string]: any } = {};

    for (const event of events) {
      const eventDate = event.timestamp.toISOString().split('T')[0];
      if (!dailyBreakdown[eventDate]) {
        dailyBreakdown[eventDate] = {
          revenue: 0,
          expenses: 0,
          approvedRevenue: 0,
          approvedExpenses: 0,
          transactionCount: 0
        };
      }

      switch (event.eventType) {
        case 'revenue_added':
          totalRevenue += event.payload.amount || 0;
          dailyBreakdown[eventDate].revenue += event.payload.amount || 0;
          transactionCount++;
          dailyBreakdown[eventDate].transactionCount++;
          break;
        case 'expense_added':
          totalExpenses += event.payload.amount || 0;
          dailyBreakdown[eventDate].expenses += event.payload.amount || 0;
          transactionCount++;
          dailyBreakdown[eventDate].transactionCount++;
          break;
        case 'revenue_approved':
          approvedRevenue += event.payload.amount || 0;
          dailyBreakdown[eventDate].approvedRevenue += event.payload.amount || 0;
          break;
        case 'expense_approved':
          approvedExpenses += event.payload.amount || 0;
          dailyBreakdown[eventDate].approvedExpenses += event.payload.amount || 0;
          break;
      }
    }

    return {
      month,
      orgId,
      propertyId,
      totalRevenue,
      totalExpenses,
      approvedRevenue,
      approvedExpenses,
      transactionCount,
      netIncome: totalRevenue - totalExpenses,
      approvedNetIncome: approvedRevenue - approvedExpenses,
      dailyBreakdown,
      lastUpdated: new Date()
    };
  }

  // Build Financial Summary Model
  private async buildFinancialSummaryModel(events: any[], orgId: number, propertyId: number): Promise<any> {
    let totalRevenue = 0;
    let totalExpenses = 0;
    let approvedRevenue = 0;
    let approvedExpenses = 0;
    let transactionCount = 0;
    const revenueByMonth: { [key: string]: number } = {};
    const expenseByMonth: { [key: string]: number } = {};

    for (const event of events) {
      const month = event.timestamp.toISOString().substring(0, 7);
      
      if (!revenueByMonth[month]) revenueByMonth[month] = 0;
      if (!expenseByMonth[month]) expenseByMonth[month] = 0;

      switch (event.eventType) {
        case 'revenue_added':
          totalRevenue += event.payload.amount || 0;
          revenueByMonth[month] += event.payload.amount || 0;
          transactionCount++;
          break;
        case 'expense_added':
          totalExpenses += event.payload.amount || 0;
          expenseByMonth[month] += event.payload.amount || 0;
          transactionCount++;
          break;
        case 'revenue_approved':
          approvedRevenue += event.payload.amount || 0;
          break;
        case 'expense_approved':
          approvedExpenses += event.payload.amount || 0;
          break;
      }
    }

    return {
      orgId,
      propertyId,
      totalRevenue,
      totalExpenses,
      approvedRevenue,
      approvedExpenses,
      transactionCount,
      netIncome: totalRevenue - totalExpenses,
      approvedNetIncome: approvedRevenue - approvedExpenses,
      revenueByMonth,
      expenseByMonth,
      lastUpdated: new Date()
    };
  }

  // Store Read Model
  private async storeReadModel(readModel: ReadModel): Promise<void> {
    try {
      await readModelsDB.exec`
        INSERT INTO read_models (
          model_id, model_type, org_id, data, version, size, last_updated
        ) VALUES (
          ${readModel.modelId}, ${readModel.modelType}, ${readModel.orgId}, 
          ${JSON.stringify(readModel.data)}, ${readModel.version}, ${readModel.size}, ${readModel.lastUpdated}
        )
        ON CONFLICT (model_type, org_id) 
        DO UPDATE SET
          data = EXCLUDED.data,
          version = EXCLUDED.version,
          size = EXCLUDED.size,
          last_updated = EXCLUDED.last_updated
      `;
    } catch (error) {
      console.error(`[${this.serviceName}] Error storing read model:`, error);
      throw error;
    }
  }

  // Update Statistics
  private updateStats(readModel: ReadModel): void {
    this.stats.totalModels++;
    this.stats.modelsPerType[readModel.modelType] = (this.stats.modelsPerType[readModel.modelType] || 0) + 1;
    this.stats.averageModelSize = (this.stats.averageModelSize + readModel.size) / 2;
    this.stats.totalStorageUsed += readModel.size;
    this.stats.lastProjectionTime = new Date();
  }

  // Start Projection Processing
  private startProjectionProcessing(): void {
    setInterval(async () => {
      try {
        await this.processProjections();
      } catch (error) {
        console.error(`[${this.serviceName}] Error in projection processing:`, error);
      }
    }, this.config.projectionInterval);
  }

  // Process Projections
  private async processProjections(): Promise<void> {
    try {
      // Get organizations that need projections
      const orgs = await readModelsDB.queryAll`
        SELECT DISTINCT org_id, property_id
        FROM events
        WHERE timestamp > NOW() - INTERVAL '1 hour'
        GROUP BY org_id, property_id
        HAVING COUNT(*) > 0
      `;

      for (const org of orgs) {
        // Project daily report for today
        const today = new Date().toISOString().split('T')[0];
        await this.projectDailyReportModel(org.org_id, org.property_id, today);
        
        // Project monthly report for current month
        const currentMonth = new Date().toISOString().substring(0, 7);
        await this.projectMonthlyReportModel(org.org_id, org.property_id, currentMonth);
        
        // Project financial summary
        await this.projectFinancialSummaryModel(org.org_id, org.property_id);
      }

      console.log(`[${this.serviceName}] Processed projections for ${orgs.length} organizations`);
    } catch (error) {
      console.error(`[${this.serviceName}] Error processing projections:`, error);
    }
  }

  // Get Read Model Statistics
  async getStats(): Promise<ReadModelStats> {
    try {
      const result = await readModelsDB.queryRow`
        SELECT 
          COUNT(*) as totalModels,
          AVG(size) as averageModelSize,
          SUM(size) as totalStorageUsed,
          MAX(last_updated) as lastProjectionTime
        FROM read_models
      `;

      const typeStats = await readModelsDB.queryAll`
        SELECT model_type, COUNT(*) as count
        FROM read_models
        GROUP BY model_type
      `;

      const modelsPerType: { [key: string]: number } = {};
      for (const stat of typeStats) {
        modelsPerType[stat.model_type] = stat.count;
      }

      return {
        totalModels: result.totalModels,
        modelsPerType,
        averageModelSize: result.averageModelSize,
        totalStorageUsed: result.totalStorageUsed,
        lastProjectionTime: new Date(result.lastProjectionTime)
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error getting stats:`, error);
      return this.stats;
    }
  }

  // Cleanup Old Read Models
  async cleanupOldReadModels(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      await readModelsDB.exec`
        DELETE FROM read_models 
        WHERE last_updated < ${cutoffDate}
      `;

      console.log(`[${this.serviceName}] Cleaned up read models older than ${this.config.retentionDays} days`);
    } catch (error) {
      console.error(`[${this.serviceName}] Error cleaning up old read models:`, error);
      throw error;
    }
  }

  // Get Service Health
  async getHealth(): Promise<{
    service: string;
    version: string;
    status: 'healthy' | 'unhealthy';
    stats: ReadModelStats;
    timestamp: string;
  }> {
    try {
      const stats = await this.getStats();
      
      return {
        service: this.serviceName,
        version: this.version,
        status: 'healthy',
        stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: this.serviceName,
        version: this.version,
        status: 'unhealthy',
        stats: this.stats,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Global read model projections instance
export const readModelProjections = new ReadModelProjections();

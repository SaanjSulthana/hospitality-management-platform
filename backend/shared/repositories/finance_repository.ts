// Finance Repository - Partition-aware data access for revenues and expenses
// Handles routing to partitioned or legacy tables based on configuration

import { SQLDatabase } from "encore.dev/storage/sqldb";
import { BaseRepository, PartitionAwareQueryBuilder } from "./base_repository";
import { DatabaseConfig } from "../../config/runtime";

export interface RevenueData {
  id?: number;
  org_id: number;
  property_id: number;
  amount_cents: number;
  occurred_at: string;
  description: string;
  category?: string;
  payment_method?: string;
  reference_number?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by_user_id?: number;
  approved_at?: string;
  created_by_user_id: number;
  created_at?: string;
  updated_at?: string;
}

export interface ExpenseData {
  id?: number;
  org_id: number;
  property_id: number;
  amount_cents: number;
  occurred_at: string;
  description: string;
  category?: string;
  payment_method?: string;
  vendor_name?: string;
  reference_number?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by_user_id?: number;
  approved_at?: string;
  created_by_user_id: number;
  created_at?: string;
  updated_at?: string;
}

export class FinanceRepository extends BaseRepository {
  
  constructor(db: SQLDatabase) {
    super(db);
  }

  // ==================== REVENUE METHODS ====================

  /**
   * Insert a new revenue record
   */
  async insertRevenue(data: RevenueData, usePartitioned?: boolean): Promise<RevenueData> {
    const targetTable = this.getTableName({ 
      tableName: 'revenues', 
      usePartitioned 
    });

    this.logPartitionRouting('revenues', targetTable, 'INSERT');

    const result = await this.db.queryRow<RevenueData>`
      INSERT INTO ${this.db.exec(targetTable)} (
        org_id, property_id, amount_cents, occurred_at, description,
        category, payment_method, reference_number, status,
        created_by_user_id, created_at, updated_at
      ) VALUES (
        ${data.org_id}, ${data.property_id}, ${data.amount_cents}, 
        ${data.occurred_at}, ${data.description},
        ${data.category || null}, ${data.payment_method || null}, 
        ${data.reference_number || null}, ${data.status},
        ${data.created_by_user_id}, NOW(), NOW()
      )
      RETURNING *
    `;

    return result!;
  }

  /**
   * Get revenues by organization and optional filters
   */
  async getRevenues(
    orgId: number,
    filters: {
      propertyId?: number;
      startDate?: string;
      endDate?: string;
      status?: string;
    } = {},
    usePartitioned?: boolean
  ): Promise<RevenueData[]> {
    const targetTable = this.getTableName({ 
      tableName: 'revenues', 
      usePartitioned 
    });

    this.logPartitionRouting('revenues', targetTable, 'SELECT');

    // Build query dynamically based on filters
    const conditions = [`org_id = ${orgId}`];
    const params: any[] = [orgId];
    
    if (filters.propertyId) {
      conditions.push(`property_id = $${params.length + 1}`);
      params.push(filters.propertyId);
    }
    
    if (filters.startDate) {
      conditions.push(`occurred_at >= $${params.length + 1}`);
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      conditions.push(`occurred_at <= $${params.length + 1}`);
      params.push(filters.endDate);
    }
    
    if (filters.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(filters.status);
    }
    
    const query = `SELECT * FROM ${targetTable} WHERE ${conditions.join(' AND ')} ORDER BY occurred_at DESC`;
    const results = await this.db.query<RevenueData>(query, params);
    return results;
  }

  /**
   * Get a single revenue by ID
   */
  async getRevenueById(
    id: number,
    orgId: number,
    usePartitioned?: boolean
  ): Promise<RevenueData | null> {
    const targetTable = this.getTableName({ 
      tableName: 'revenues', 
      usePartitioned 
    });

    this.logPartitionRouting('revenues', targetTable, 'SELECT BY ID');

    const result = await this.db.queryRow<RevenueData>`
      SELECT * FROM ${this.db.exec(targetTable)} 
      WHERE id = ${id} AND org_id = ${orgId}
    `;

    return result || null;
  }

  /**
   * Update revenue status (approve/reject)
   */
  async updateRevenueStatus(
    id: number,
    orgId: number,
    status: 'approved' | 'rejected',
    approvedByUserId: number,
    usePartitioned?: boolean
  ): Promise<RevenueData | null> {
    const targetTable = this.getTableName({ 
      tableName: 'revenues', 
      usePartitioned 
    });

    this.logPartitionRouting('revenues', targetTable, 'UPDATE STATUS');

    const result = await this.db.queryRow<RevenueData>`
      UPDATE ${this.db.exec(targetTable)}
      SET 
        status = ${status},
        approved_by_user_id = ${approvedByUserId},
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id} AND org_id = ${orgId}
      RETURNING *
    `;

    return result || null;
  }

  /**
   * Delete a revenue record
   */
  async deleteRevenue(
    id: number,
    orgId: number,
    usePartitioned?: boolean
  ): Promise<boolean> {
    const targetTable = this.getTableName({ 
      tableName: 'revenues', 
      usePartitioned 
    });

    this.logPartitionRouting('revenues', targetTable, 'DELETE');

    await this.db.exec`
      DELETE FROM ${this.db.exec(targetTable)} 
      WHERE id = ${id} AND org_id = ${orgId}
    `;

    return true;
  }

  /**
   * Get revenue sum for a date range
   */
  async getRevenueSumByDateRange(
    orgId: number,
    propertyId: number | undefined,
    startDate: string,
    endDate: string,
    usePartitioned?: boolean
  ): Promise<number> {
    const targetTable = this.getTableName({ 
      tableName: 'revenues', 
      usePartitioned 
    });

    this.logPartitionRouting('revenues', targetTable, 'SUM');

    if (propertyId) {
      const result = await this.db.queryRow<{ total: number }>`
        SELECT COALESCE(SUM(amount_cents), 0) as total
        FROM ${this.db.exec(targetTable)}
        WHERE org_id = ${orgId}
          AND property_id = ${propertyId}
          AND occurred_at >= ${startDate}
          AND occurred_at <= ${endDate}
          AND status = 'approved'
      `;
      return result?.total || 0;
    } else {
      const result = await this.db.queryRow<{ total: number }>`
        SELECT COALESCE(SUM(amount_cents), 0) as total
        FROM ${this.db.exec(targetTable)}
        WHERE org_id = ${orgId}
          AND occurred_at >= ${startDate}
          AND occurred_at <= ${endDate}
          AND status = 'approved'
      `;
      return result?.total || 0;
    }
  }

  // ==================== EXPENSE METHODS ====================

  /**
   * Insert a new expense record
   */
  async insertExpense(data: ExpenseData, usePartitioned?: boolean): Promise<ExpenseData> {
    const targetTable = this.getTableName({ 
      tableName: 'expenses', 
      usePartitioned 
    });

    this.logPartitionRouting('expenses', targetTable, 'INSERT');

    const result = await this.db.queryRow<ExpenseData>`
      INSERT INTO ${this.db.exec(targetTable)} (
        org_id, property_id, amount_cents, occurred_at, description,
        category, payment_method, vendor_name, reference_number, status,
        created_by_user_id, created_at, updated_at
      ) VALUES (
        ${data.org_id}, ${data.property_id}, ${data.amount_cents}, 
        ${data.occurred_at}, ${data.description},
        ${data.category || null}, ${data.payment_method || null},
        ${data.vendor_name || null}, ${data.reference_number || null}, ${data.status},
        ${data.created_by_user_id}, NOW(), NOW()
      )
      RETURNING *
    `;

    return result!;
  }

  /**
   * Get expenses by organization and optional filters
   */
  async getExpenses(
    orgId: number,
    filters: {
      propertyId?: number;
      startDate?: string;
      endDate?: string;
      status?: string;
    } = {},
    usePartitioned?: boolean
  ): Promise<ExpenseData[]> {
    const targetTable = this.getTableName({ 
      tableName: 'expenses', 
      usePartitioned 
    });

    this.logPartitionRouting('expenses', targetTable, 'SELECT');

    // Build query dynamically based on filters
    const conditions = [`org_id = ${orgId}`];
    const params: any[] = [orgId];
    
    if (filters.propertyId) {
      conditions.push(`property_id = $${params.length + 1}`);
      params.push(filters.propertyId);
    }
    
    if (filters.startDate) {
      conditions.push(`occurred_at >= $${params.length + 1}`);
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      conditions.push(`occurred_at <= $${params.length + 1}`);
      params.push(filters.endDate);
    }
    
    if (filters.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(filters.status);
    }
    
    const query = `SELECT * FROM ${targetTable} WHERE ${conditions.join(' AND ')} ORDER BY occurred_at DESC`;
    const results = await this.db.query<ExpenseData>(query, params);
    return results;
  }

  /**
   * Get a single expense by ID
   */
  async getExpenseById(
    id: number,
    orgId: number,
    usePartitioned?: boolean
  ): Promise<ExpenseData | null> {
    const targetTable = this.getTableName({ 
      tableName: 'expenses', 
      usePartitioned 
    });

    this.logPartitionRouting('expenses', targetTable, 'SELECT BY ID');

    const result = await this.db.queryRow<ExpenseData>`
      SELECT * FROM ${this.db.exec(targetTable)} 
      WHERE id = ${id} AND org_id = ${orgId}
    `;

    return result || null;
  }

  /**
   * Update expense status (approve/reject)
   */
  async updateExpenseStatus(
    id: number,
    orgId: number,
    status: 'approved' | 'rejected',
    approvedByUserId: number,
    usePartitioned?: boolean
  ): Promise<ExpenseData | null> {
    const targetTable = this.getTableName({ 
      tableName: 'expenses', 
      usePartitioned 
    });

    this.logPartitionRouting('expenses', targetTable, 'UPDATE STATUS');

    const result = await this.db.queryRow<ExpenseData>`
      UPDATE ${this.db.exec(targetTable)}
      SET 
        status = ${status},
        approved_by_user_id = ${approvedByUserId},
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id} AND org_id = ${orgId}
      RETURNING *
    `;

    return result || null;
  }

  /**
   * Delete an expense record
   */
  async deleteExpense(
    id: number,
    orgId: number,
    usePartitioned?: boolean
  ): Promise<boolean> {
    const targetTable = this.getTableName({ 
      tableName: 'expenses', 
      usePartitioned 
    });

    this.logPartitionRouting('expenses', targetTable, 'DELETE');

    await this.db.exec`
      DELETE FROM ${this.db.exec(targetTable)} 
      WHERE id = ${id} AND org_id = ${orgId}
    `;

    return true;
  }

  /**
   * Get expense sum for a date range
   */
  async getExpenseSumByDateRange(
    orgId: number,
    propertyId: number | undefined,
    startDate: string,
    endDate: string,
    usePartitioned?: boolean
  ): Promise<number> {
    const targetTable = this.getTableName({ 
      tableName: 'expenses', 
      usePartitioned 
    });

    this.logPartitionRouting('expenses', targetTable, 'SUM');

    if (propertyId) {
      const result = await this.db.queryRow<{ total: number }>`
        SELECT COALESCE(SUM(amount_cents), 0) as total
        FROM ${this.db.exec(targetTable)}
        WHERE org_id = ${orgId}
          AND property_id = ${propertyId}
          AND occurred_at >= ${startDate}
          AND occurred_at <= ${endDate}
          AND status = 'approved'
      `;
      return result?.total || 0;
    } else {
      const result = await this.db.queryRow<{ total: number }>`
        SELECT COALESCE(SUM(amount_cents), 0) as total
        FROM ${this.db.exec(targetTable)}
        WHERE org_id = ${orgId}
          AND occurred_at >= ${startDate}
          AND occurred_at <= ${endDate}
          AND status = 'approved'
      `;
      return result?.total || 0;
    }
  }
}


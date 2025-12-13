// Finance Repository - Partition-aware data access for revenues and expenses
// Handles routing to partitioned or legacy tables based on configuration

import { SQLDatabase } from "encore.dev/storage/sqldb";
import { BaseRepository } from "./base_repository";

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

    const row = await this.db.queryRow<RevenueData>`
      INSERT INTO ${(this.db as any).exec(targetTable)} (
        org_id, property_id, amount_cents, occurred_at, description,
        category, payment_method, reference_number, status,
        created_by_user_id, created_at, updated_at
      ) VALUES (
        ${data.org_id}, ${data.property_id}, ${data.amount_cents}, ${data.occurred_at}, ${data.description},
        ${data.category || null}, ${data.payment_method || null}, ${data.reference_number || null}, ${data.status},
        ${data.created_by_user_id}, NOW(), NOW()
      )
      RETURNING *
    `;

    return row!;
  }

  /**
   * Get revenues by organization and optional filters
   * Uses read replica for better performance
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

    // Use read replica for this query
    const db = this.getReadConnection({ preferReplica: true, orgId });

    const rows: RevenueData[] = [];
    const cursor = await db.query<RevenueData>`
      SELECT * FROM ${(db as any).exec(targetTable)}
      WHERE org_id = ${orgId}
        AND (${filters.propertyId ?? null} IS NULL OR property_id = ${filters.propertyId ?? null})
        AND (${filters.startDate ?? null} IS NULL OR occurred_at >= ${filters.startDate ?? null})
        AND (${filters.endDate ?? null} IS NULL OR occurred_at <= ${filters.endDate ?? null})
        AND (${filters.status ?? null} IS NULL OR status = ${filters.status ?? null})
      ORDER BY occurred_at DESC
    `;
    for await (const r of cursor) rows.push(r);
    return rows;
  }

  /**
   * Get a single revenue by ID
   * Uses read replica for better performance
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

    // Use read replica for this query
    const db = this.getReadConnection({ preferReplica: true, orgId });

    const row = await db.queryRow<RevenueData>`
      SELECT * FROM ${(db as any).exec(targetTable)} WHERE id = ${id} AND org_id = ${orgId}
    `;
    return row || null;
  }

  /**
   * Update revenue status (approve/reject)
   * Uses primary database for write operation
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

    // Use primary database for write operation
    const db = this.getWriteConnection(orgId);

    const row = await db.queryRow<RevenueData>`
      UPDATE ${(db as any).exec(targetTable)}
      SET
        status = ${status},
        approved_by_user_id = ${approvedByUserId},
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id} AND org_id = ${orgId}
      RETURNING *
    `;
    return row || null;
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
      DELETE FROM ${(this.db as any).exec(targetTable)} WHERE id = ${id} AND org_id = ${orgId}
    `;

    return true;
  }

  /**
   * Get revenue sum for a date range
   * Uses read replica for better performance
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

    // Use read replica for this query
    const db = this.getReadConnection({ preferReplica: true, orgId });

    const row = await db.queryRow<{ total: number }>`
      SELECT COALESCE(SUM(amount_cents), 0) as total
      FROM ${(db as any).exec(targetTable)}
      WHERE org_id = ${orgId}
        AND (${propertyId ?? null} IS NULL OR property_id = ${propertyId ?? null})
        AND occurred_at >= ${startDate}
        AND occurred_at <= ${endDate}
        AND status = 'approved'
    `;
    return row?.total ?? 0;
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

    const row = await this.db.queryRow<ExpenseData>`
      INSERT INTO ${(this.db as any).exec(targetTable)} (
        org_id, property_id, amount_cents, occurred_at, description,
        category, payment_method, vendor_name, reference_number, status,
        created_by_user_id, created_at, updated_at
      ) VALUES (
        ${data.org_id}, ${data.property_id}, ${data.amount_cents}, ${data.occurred_at}, ${data.description},
        ${data.category || null}, ${data.payment_method || null}, ${data.vendor_name || null}, ${data.reference_number || null}, ${data.status},
        ${data.created_by_user_id}, NOW(), NOW()
      )
      RETURNING *
    `;
    return row!;
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

    const rows: ExpenseData[] = [];
    const cursor = await this.db.query<ExpenseData>`
      SELECT * FROM ${(this.db as any).exec(targetTable)}
      WHERE org_id = ${orgId}
        AND (${filters.propertyId ?? null} IS NULL OR property_id = ${filters.propertyId ?? null})
        AND (${filters.startDate ?? null} IS NULL OR occurred_at >= ${filters.startDate ?? null})
        AND (${filters.endDate ?? null} IS NULL OR occurred_at <= ${filters.endDate ?? null})
        AND (${filters.status ?? null} IS NULL OR status = ${filters.status ?? null})
      ORDER BY occurred_at DESC
    `;
    for await (const r of cursor) rows.push(r);
    return rows;
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

    const row = await this.db.queryRow<ExpenseData>`
      SELECT * FROM ${(this.db as any).exec(targetTable)} WHERE id = ${id} AND org_id = ${orgId}
    `;
    return row || null;
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

    const row = await this.db.queryRow<ExpenseData>`
      UPDATE ${(this.db as any).exec(targetTable)}
      SET 
        status = ${status},
        approved_by_user_id = ${approvedByUserId},
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id} AND org_id = ${orgId}
      RETURNING *
    `;
    return row || null;
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
      DELETE FROM ${(this.db as any).exec(targetTable)} WHERE id = ${id} AND org_id = ${orgId}
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

    const row = await this.db.queryRow<{ total: number }>`
      SELECT COALESCE(SUM(amount_cents), 0) as total
      FROM ${(this.db as any).exec(targetTable)}
      WHERE org_id = ${orgId}
        AND (${propertyId ?? null} IS NULL OR property_id = ${propertyId ?? null})
        AND occurred_at >= ${startDate}
        AND occurred_at <= ${endDate}
        AND status = 'approved'
    `;
    return row?.total ?? 0;
  }
}

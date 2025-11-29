// Reports Repository - Partition-aware data access for daily cash balances
// Handles routing to partitioned or legacy tables based on configuration

import { SQLDatabase } from "encore.dev/storage/sqldb";
import { BaseRepository } from "./base_repository";

export interface DailyCashBalanceData {
  id?: number;
  org_id: number;
  property_id: number;
  balance_date: string;
  opening_balance_cents: number;
  cash_received_cents?: number;
  bank_received_cents?: number;
  cash_expenses_cents?: number;
  bank_expenses_cents?: number;
  closing_balance_cents: number;
  balance_discrepancy_cents?: number;
  notes?: string;
  created_by_user_id: number;
  created_at?: string;
  updated_at?: string;
}

export class ReportsRepository extends BaseRepository {
  
  constructor(db: SQLDatabase) {
    super(db);
  }

  // ==================== DAILY CASH BALANCE METHODS ====================

  /**
   * Insert or update daily cash balance
   */
  async upsertDailyCashBalance(
    data: DailyCashBalanceData,
    usePartitioned?: boolean
  ): Promise<DailyCashBalanceData> {
    const targetTable = this.getTableName({ 
      tableName: 'daily_cash_balances', 
      usePartitioned 
    });

    this.logPartitionRouting('daily_cash_balances', targetTable, 'UPSERT');

    const result = await this.db.queryRow<DailyCashBalanceData>`
      INSERT INTO ${this.db.exec(targetTable)} (
        org_id, property_id, balance_date,
        opening_balance_cents, cash_received_cents, bank_received_cents,
        cash_expenses_cents, bank_expenses_cents, closing_balance_cents,
        balance_discrepancy_cents, notes, created_by_user_id,
        created_at, updated_at
      ) VALUES (
        ${data.org_id}, ${data.property_id}, ${data.balance_date},
        ${data.opening_balance_cents}, ${data.cash_received_cents || 0},
        ${data.bank_received_cents || 0}, ${data.cash_expenses_cents || 0},
        ${data.bank_expenses_cents || 0}, ${data.closing_balance_cents},
        ${data.balance_discrepancy_cents || 0}, ${data.notes || null},
        ${data.created_by_user_id}, NOW(), NOW()
      )
      ON CONFLICT (org_id, property_id, balance_date)
      DO UPDATE SET
        opening_balance_cents = EXCLUDED.opening_balance_cents,
        cash_received_cents = EXCLUDED.cash_received_cents,
        bank_received_cents = EXCLUDED.bank_received_cents,
        cash_expenses_cents = EXCLUDED.cash_expenses_cents,
        bank_expenses_cents = EXCLUDED.bank_expenses_cents,
        closing_balance_cents = EXCLUDED.closing_balance_cents,
        balance_discrepancy_cents = EXCLUDED.balance_discrepancy_cents,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `;

    return result!;
  }

  /**
   * Get daily cash balance by date
   */
  async getDailyCashBalance(
    orgId: number,
    propertyId: number,
    date: string,
    usePartitioned?: boolean
  ): Promise<DailyCashBalanceData | null> {
    const targetTable = this.getTableName({ 
      tableName: 'daily_cash_balances', 
      usePartitioned 
    });

    this.logPartitionRouting('daily_cash_balances', targetTable, 'SELECT BY DATE');

    const result = await this.db.queryRow<DailyCashBalanceData>`
      SELECT * FROM ${this.db.exec(targetTable)} 
       WHERE org_id = ${orgId} 
         AND property_id = ${propertyId} 
         AND balance_date = ${date}
    `;

    return result || null;
  }

  /**
   * Get daily cash balances for a date range
   */
  async getDailyCashBalancesByDateRange(
    orgId: number,
    propertyId: number | undefined,
    startDate: string,
    endDate: string,
    usePartitioned?: boolean
  ): Promise<DailyCashBalanceData[]> {
    const targetTable = this.getTableName({ 
      tableName: 'daily_cash_balances', 
      usePartitioned 
    });

    this.logPartitionRouting('daily_cash_balances', targetTable, 'SELECT DATE RANGE');

    if (propertyId) {
      const results = await this.db.query<DailyCashBalanceData>`
        SELECT * FROM ${this.db.exec(targetTable)}
        WHERE org_id = ${orgId}
          AND property_id = ${propertyId}
          AND balance_date >= ${startDate}
          AND balance_date <= ${endDate}
        ORDER BY balance_date ASC
      `;
      return results;
    } else {
      const results = await this.db.query<DailyCashBalanceData>`
        SELECT * FROM ${this.db.exec(targetTable)}
        WHERE org_id = ${orgId}
          AND balance_date >= ${startDate}
          AND balance_date <= ${endDate}
        ORDER BY balance_date ASC
      `;
      return results;
    }
  }

  /**
   * Get all daily cash balances for an organization
   */
  async getAllDailyCashBalances(
    orgId: number,
    propertyId?: number,
    limit: number = 100,
    offset: number = 0,
    usePartitioned?: boolean
  ): Promise<DailyCashBalanceData[]> {
    const targetTable = this.getTableName({ 
      tableName: 'daily_cash_balances', 
      usePartitioned 
    });

    this.logPartitionRouting('daily_cash_balances', targetTable, 'SELECT ALL');

    if (propertyId) {
      const results = await this.db.query<DailyCashBalanceData>`
        SELECT * FROM ${this.db.exec(targetTable)} 
        WHERE org_id = ${orgId}
          AND property_id = ${propertyId}
        ORDER BY balance_date DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
      return results;
    } else {
      const results = await this.db.query<DailyCashBalanceData>`
        SELECT * FROM ${this.db.exec(targetTable)} 
        WHERE org_id = ${orgId}
        ORDER BY balance_date DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
      return results;
    }
  }

  /**
   * Update daily cash balance
   */
  async updateDailyCashBalance(
    id: number,
    orgId: number,
    updates: Partial<DailyCashBalanceData>,
    usePartitioned?: boolean
  ): Promise<DailyCashBalanceData | null> {
    const targetTable = this.getTableName({ 
      tableName: 'daily_cash_balances', 
      usePartitioned 
    });

    this.logPartitionRouting('daily_cash_balances', targetTable, 'UPDATE');

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updates.opening_balance_cents !== undefined) {
      updateFields.push(`opening_balance_cents = $${paramIndex++}`);
      updateValues.push(updates.opening_balance_cents);
    }
    if (updates.cash_received_cents !== undefined) {
      updateFields.push(`cash_received_cents = $${paramIndex++}`);
      updateValues.push(updates.cash_received_cents);
    }
    if (updates.bank_received_cents !== undefined) {
      updateFields.push(`bank_received_cents = $${paramIndex++}`);
      updateValues.push(updates.bank_received_cents);
    }
    if (updates.cash_expenses_cents !== undefined) {
      updateFields.push(`cash_expenses_cents = $${paramIndex++}`);
      updateValues.push(updates.cash_expenses_cents);
    }
    if (updates.bank_expenses_cents !== undefined) {
      updateFields.push(`bank_expenses_cents = $${paramIndex++}`);
      updateValues.push(updates.bank_expenses_cents);
    }
    if (updates.closing_balance_cents !== undefined) {
      updateFields.push(`closing_balance_cents = $${paramIndex++}`);
      updateValues.push(updates.closing_balance_cents);
    }
    if (updates.balance_discrepancy_cents !== undefined) {
      updateFields.push(`balance_discrepancy_cents = $${paramIndex++}`);
      updateValues.push(updates.balance_discrepancy_cents);
    }
    if (updates.notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`);
      updateValues.push(updates.notes);
    }

    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length === 1) {
      // Only updated_at, no actual changes
      return this.getDailyCashBalanceById(id, orgId, usePartitioned);
    }

    const query = `
      UPDATE ${targetTable}
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
      RETURNING *
    `;

    updateValues.push(id, orgId);

    const result = await this.db.queryRow<DailyCashBalanceData>(query, updateValues);
    return result || null;
  }

  /**
   * Get daily cash balance by ID
   */
  async getDailyCashBalanceById(
    id: number,
    orgId: number,
    usePartitioned?: boolean
  ): Promise<DailyCashBalanceData | null> {
    const targetTable = this.getTableName({ 
      tableName: 'daily_cash_balances', 
      usePartitioned 
    });

    this.logPartitionRouting('daily_cash_balances', targetTable, 'SELECT BY ID');

    const result = await this.db.queryRow<DailyCashBalanceData>`
      SELECT * FROM ${this.db.exec(targetTable)} 
      WHERE id = ${id} AND org_id = ${orgId}
    `;

    return result || null;
  }

  /**
   * Delete daily cash balance
   */
  async deleteDailyCashBalance(
    id: number,
    orgId: number,
    usePartitioned?: boolean
  ): Promise<boolean> {
    const targetTable = this.getTableName({ 
      tableName: 'daily_cash_balances', 
      usePartitioned 
    });

    this.logPartitionRouting('daily_cash_balances', targetTable, 'DELETE');

    await this.db.exec`
      DELETE FROM ${this.db.exec(targetTable)} 
      WHERE id = ${id} AND org_id = ${orgId}
    `;

    return true;
  }

  /**
   * Count daily cash balances for an organization
   */
  async countDailyCashBalances(
    orgId: number,
    propertyId?: number,
    usePartitioned?: boolean
  ): Promise<number> {
    const targetTable = this.getTableName({ 
      tableName: 'daily_cash_balances', 
      usePartitioned 
    });

    this.logPartitionRouting('daily_cash_balances', targetTable, 'COUNT');

    if (propertyId) {
      const result = await this.db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count 
        FROM ${this.db.exec(targetTable)} 
        WHERE org_id = ${orgId} AND property_id = ${propertyId}
      `;
      return result?.count || 0;
    } else {
      const result = await this.db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count 
        FROM ${this.db.exec(targetTable)} 
        WHERE org_id = ${orgId}
      `;
      return result?.count || 0;
    }
  }
}


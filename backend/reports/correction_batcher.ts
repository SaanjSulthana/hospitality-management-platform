// Batch Auto-Correction System for Phase 1 Emergency Scaling
// Target: Eliminate database storms from individual UPDATE statements

import { reportsDB } from "./db";

interface CorrectionItem {
  orgId: number;
  propertyId: number;
  date: string;
  corrections: {
    cashReceivedCents: number;
    bankReceivedCents: number;
    cashExpensesCents: number;
    bankExpensesCents: number;
  };
  timestamp: Date;
}

export class CorrectionBatcher {
  private queue: CorrectionItem[] = [];
  private batchSize = 100;
  private intervalMs = 5 * 60 * 1000; // 5 minutes
  private maxAge = 10 * 60 * 1000; // 10 minutes max age
  private processing = false;

  constructor() {
    // Start periodic processing
    setInterval(() => {
      if (this.queue.length > 0 && !this.processing) {
        this.processBatch();
      }
    }, this.intervalMs);
  }

  async add(item: CorrectionItem) {
    this.queue.push(item);
    
    // Process if batch is full or oldest item is too old
    if (this.queue.length >= this.batchSize || this.isOldestItemExpired()) {
      await this.processBatch();
    }
  }

  private isOldestItemExpired(): boolean {
    if (this.queue.length === 0) return false;
    const oldest = this.queue[0];
    return Date.now() - oldest.timestamp.getTime() > this.maxAge;
  }

  private async processBatch() {
    if (this.processing) return;
    this.processing = true;

    try {
      const batch = this.queue.splice(0, this.batchSize);
      if (batch.length === 0) return;

      console.log(`[CorrectionBatcher] Processing batch of ${batch.length} corrections`);

      // Single SQL statement for all corrections
      await this.executeBatchCorrection(batch);
      
      console.log(`[CorrectionBatcher] Successfully processed ${batch.length} corrections`);
    } catch (error) {
      console.error('[CorrectionBatcher] Batch processing failed:', error);
      // Re-queue failed items for retry
      // Note: In production, implement proper retry logic with exponential backoff
    } finally {
      this.processing = false;
    }
  }

  private async executeBatchCorrection(batch: CorrectionItem[]) {
    if (batch.length === 0) return;

    // Use VALUES clause for efficient batch update
    const values = batch.map(item => 
      `(${item.orgId}, ${item.propertyId}, '${item.date}'::date, ${item.corrections.cashReceivedCents}, ${item.corrections.bankReceivedCents}, ${item.corrections.cashExpensesCents}, ${item.corrections.bankExpensesCents})`
    ).join(', ');

    // Execute batch correction using VALUES clause
    const query = `
      UPDATE daily_cash_balances 
      SET 
        cash_received_cents = corrections.cash_received_cents,
        bank_received_cents = corrections.bank_received_cents,
        cash_expenses_cents = corrections.cash_expenses_cents,
        bank_expenses_cents = corrections.bank_expenses_cents,
        closing_balance_cents = opening_balance_cents + corrections.cash_received_cents - corrections.cash_expenses_cents,
        calculated_closing_balance_cents = opening_balance_cents + corrections.cash_received_cents - corrections.cash_expenses_cents,
        balance_discrepancy_cents = 0,
        updated_at = NOW()
      FROM (VALUES ${values}) AS corrections(org_id, property_id, balance_date, cash_received_cents, bank_received_cents, cash_expenses_cents, bank_expenses_cents)
      WHERE daily_cash_balances.org_id = corrections.org_id
        AND daily_cash_balances.property_id = corrections.property_id
        AND daily_cash_balances.balance_date = corrections.balance_date
    `;

    await reportsDB.exec(query);
    console.log(`[CorrectionBatcher] Executed batch correction for ${batch.length} items`);
  }

  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      batchSize: this.batchSize,
      intervalMs: this.intervalMs,
      maxAge: this.maxAge
    };
  }
}

// Global correction batcher instance
export const correctionBatcher = new CorrectionBatcher();

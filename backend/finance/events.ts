import { Topic } from "encore.dev/pubsub";

export interface FinanceEventPayload {
  eventId: string; // UUID
  eventVersion: 'v1';
  eventType:
  | 'expense_added' | 'expense_updated' | 'expense_deleted'
  | 'expense_approved' | 'expense_rejected'
  | 'revenue_added' | 'revenue_updated' | 'revenue_deleted'
  | 'revenue_approved' | 'revenue_rejected'
  | 'daily_approval_granted' | 'cash_balance_updated';

  orgId: number;
  propertyId: number;
  userId: number;
  timestamp: Date;
  entityId: number;
  entityType: 'expense' | 'revenue' | 'daily_approval' | 'cash_balance';

  metadata: {
    previousStatus?: string;
    newStatus?: string;
    amountCents?: number;
    currency?: string;
    transactionDate?: string;
    paymentMode?: 'cash' | 'bank';
    category?: string;
    source?: string; // For revenue transactions
    affectedReportDates?: string[]; // For cache invalidation
    notes?: string; // For approval notes
    propertyName?: string;
    createdByName?: string; // Creator's display name
    createdByUserId?: number; // Creator's user ID
    description?: string; // Transaction description
  };
}

// Create topic for finance events per organization
export const financeEvents = new Topic<FinanceEventPayload>("finance-events", {
  deliveryGuarantee: "at-least-once",
});

export interface RealtimeUpdatePayload {
  orgId: number;
  propertyId: number;
  updateType: 'transaction' | 'approval' | 'balance' | 'deletion';
  timestamp: Date;
  eventType?: string;
  entityId?: number;
}

export const realtimeUpdates = new Topic<RealtimeUpdatePayload>("realtime-updates", {
  deliveryGuarantee: "at-least-once",
});

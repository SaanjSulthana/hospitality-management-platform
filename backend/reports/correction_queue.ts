import { Topic, Subscription } from "encore.dev/pubsub";
import { reportsDB } from "./db";

interface CorrectionItem {
  orgId: number;
  propertyId: number;
  date: string;
  correctBalance: number;
  priority: 'high' | 'medium' | 'low';
}

// Define a topic for balance corrections
const balanceCorrectionTopic = new Topic<CorrectionItem>("balance-corrections", {
  deliveryGuarantee: "at-least-once",
});

// Background worker to process corrections
export const balanceCorrectionSubscriber = new Subscription(
  balanceCorrectionTopic,
  "balance-correction-processor",
  {
    handler: async (item: CorrectionItem) => {
      try {
        console.log(`[CorrectionQueue] Processing correction for ${item.date}: ${item.correctBalance}`);
        
        await reportsDB.exec`
          UPDATE daily_cash_balances 
          SET 
            closing_balance_cents = ${item.correctBalance},
            calculated_closing_balance_cents = ${item.correctBalance},
            balance_discrepancy_cents = 0,
            updated_at = NOW()
          WHERE org_id = ${item.orgId} 
            AND property_id = ${item.propertyId} 
            AND balance_date = ${item.date}
        `;
        
        console.log(`[CorrectionQueue] ✅ Corrected balance for ${item.date}`);
      } catch (error) {
        console.error(`[CorrectionQueue] ❌ Failed to correct balance:`, error);
        throw error; // Retry
      }
    },
    ackDeadline: "30s",
    maxConcurrency: 100,
  }
);

// Add correction to queue
export async function addCorrection(
  orgId: number,
  propertyId: number,
  date: string,
  correctBalance: number,
  priority: 'high' | 'medium' | 'low' = 'medium'
): Promise<void> {
  const item: CorrectionItem = {
    orgId,
    propertyId,
    date,
    correctBalance,
    priority
  };
  
  await balanceCorrectionTopic.publish(item);
  console.log(`[CorrectionQueue] Added correction to queue: ${date} = ${correctBalance}`);
}

// Get queue statistics
export async function getCorrectionQueueStats(): Promise<{
  queueSize: number;
  processingRate: number;
  errorRate: number;
}> {
  // This would be implemented with actual queue statistics
  // For now, return mock data
  return {
    queueSize: 0,
    processingRate: 0,
    errorRate: 0
  };
}

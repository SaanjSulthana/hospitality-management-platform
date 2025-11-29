import { Subscription } from "encore.dev/pubsub";
import { financeEvents, FinanceEventPayload } from "../../finance/events";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const readModelDB = new SQLDatabase("read_models", {
  migrations: "./read_model_migrations",
});

// Subscribe to events and update read model
export const balanceProjection = new Subscription(
  financeEvents,
  "balance-read-model-projection",
  {
    handler: async (event: FinanceEventPayload) => {
      console.log(`[BalanceProjection] Processing event: ${event.eventType}`);
      
      try {
        const amountCents = normalizeAmountCents(event);

        if (amountCents === null) {
          console.warn(
            `[BalanceProjection] Skipping event ${event.eventType} due to missing amount metadata`,
            {
              eventId: event.eventId,
              metadata: event.metadata,
            }
          );
          return;
        }

        if (event.eventType === 'revenue_approved') {
          await updateBalanceReadModel(
            event.orgId,
            event.propertyId,
            amountCents,
            'credit'
          );
        } else if (event.eventType === 'expense_approved') {
          await updateBalanceReadModel(
            event.orgId,
            event.propertyId,
            amountCents,
            'debit'
          );
        } else if (event.eventType === 'revenue_rejected') {
          await updateBalanceReadModel(
            event.orgId,
            event.propertyId,
            -amountCents, // Reverse the credit
            'credit'
          );
        } else if (event.eventType === 'expense_rejected') {
          await updateBalanceReadModel(
            event.orgId,
            event.propertyId,
            -amountCents, // Reverse the debit
            'debit'
          );
        } else {
          console.debug(
            `[BalanceProjection] Ignoring event ${event.eventType} (not relevant to balance projection)`
          );
        }
        
        console.log(`[BalanceProjection] Successfully processed ${event.eventType}`);
      } catch (error) {
        console.error(`[BalanceProjection] Error processing event:`, error);
        throw error;
      }
    },
    maxConcurrency: 5000,
    ackDeadline: "60s",
  }
);

async function updateBalanceReadModel(
  orgId: number,
  propertyId: number,
  amount: number,
  type: 'credit' | 'debit'
): Promise<void> {
  if (!Number.isFinite(amount)) {
    throw new Error(
      `[BalanceProjection] Invalid amount encountered for org ${orgId}, property ${propertyId}: ${amount}`
    );
  }

  const tx = await readModelDB.begin();
  
  try {
    const balanceChange = type === 'credit' ? amount : -amount;
    
    await tx.exec`
      INSERT INTO account_balance_read_model (
        org_id, property_id, current_balance, last_updated
      ) VALUES (
        ${orgId}, ${propertyId}, ${balanceChange}, NOW()
      )
      ON CONFLICT (org_id, property_id) DO UPDATE SET
        current_balance = account_balance_read_model.current_balance + ${balanceChange},
        last_updated = NOW()
    `;
    
    await tx.commit();
    console.log(`[BalanceProjection] Updated balance for org ${orgId}, property ${propertyId}: ${balanceChange}`);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

/**
 * Normalize amount from event metadata.
 * Finance events emit amount in cents under metadata.amountCents.
 * Fall back to metadata.amount for backward compatibility.
 */
function normalizeAmountCents(event: FinanceEventPayload): number | null {
  const { metadata } = event;

  const rawAmount =
    metadata?.amountCents ??
    // Legacy events might still use `amount`
    (metadata as any)?.amount ??
    null;

  if (rawAmount === null || rawAmount === undefined) {
    return null;
  }

  if (typeof rawAmount !== 'number') {
    const parsed = Number(rawAmount);
    if (!Number.isFinite(parsed)) {
      console.error(
        `[BalanceProjection] Unable to parse amount for event ${event.eventId}`,
        { rawAmount }
      );
      return null;
    }
    return Math.round(parsed);
  }

  return Math.round(rawAmount);
}

// Get current balance from read model
export async function getCurrentBalance(
  orgId: number,
  propertyId: number
): Promise<number> {
  const result = await readModelDB.queryRow`
    SELECT current_balance
    FROM account_balance_read_model
    WHERE org_id = ${orgId} AND property_id = ${propertyId}
  `;
  
  return result?.current_balance || 0;
}

// Get balance history from read model
export async function getBalanceHistory(
  orgId: number,
  propertyId: number,
  fromDate: string,
  toDate: string
): Promise<Array<{
  date: string;
  balance: number;
  lastUpdated: Date;
}>> {
  const results = await readModelDB.queryAll`
    SELECT current_balance, last_updated
    FROM account_balance_read_model
    WHERE org_id = ${orgId} 
      AND property_id = ${propertyId}
      AND last_updated >= ${fromDate}::date
      AND last_updated <= ${toDate}::date
    ORDER BY last_updated ASC
  `;
  
  return results.map(row => ({
    date: row.last_updated.toISOString().split('T')[0],
    balance: row.current_balance,
    lastUpdated: row.last_updated
  }));
}

// Rebuild read model from events (for disaster recovery)
export async function rebuildBalanceReadModel(
  orgId: number,
  propertyId: number
): Promise<void> {
  console.log(`[BalanceProjection] Rebuilding read model for org ${orgId}, property ${propertyId}`);
  
  // Clear existing data
  await readModelDB.exec`
    DELETE FROM account_balance_read_model
    WHERE org_id = ${orgId} AND property_id = ${propertyId}
  `;
  
  // Get all events for this aggregate
  const aggregateId = `balance_${orgId}_${propertyId}`;
  // const events = await eventStore.loadEvents(aggregateId);
  const events: any[] = []; // Temporarily disabled
  
  let currentBalance = 0;
  
  for (const event of events) {
    if (event.eventType === 'revenue_approved') {
      currentBalance += event.eventData.amount;
    } else if (event.eventType === 'expense_approved') {
      currentBalance -= event.eventData.amount;
    } else if (event.eventType === 'revenue_rejected') {
      currentBalance -= event.eventData.amount;
    } else if (event.eventType === 'expense_rejected') {
      currentBalance += event.eventData.amount;
    }
  }
  
  // Insert rebuilt balance
  await readModelDB.exec`
    INSERT INTO account_balance_read_model (
      org_id, property_id, current_balance, last_updated
    ) VALUES (
      ${orgId}, ${propertyId}, ${currentBalance}, NOW()
    )
  `;
  
  console.log(`[BalanceProjection] Rebuilt read model with balance: ${currentBalance}`);
}

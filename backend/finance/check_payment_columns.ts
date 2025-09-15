import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface CheckPaymentColumnsResponse {
  revenuesHasPaymentMode: boolean;
  revenuesHasBankReference: boolean;
  expensesHasPaymentMode: boolean;
  expensesHasBankReference: boolean;
  sampleRevenue: any;
  sampleExpense: any;
}

// Check if payment mode columns exist in the database
export const checkPaymentColumns = api<{}, CheckPaymentColumnsResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/check-payment-columns" },
  async () => {
    console.log('=== CHECK PAYMENT COLUMNS ===');
    
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    try {
      // Check revenues table columns
      const revenuesColumns = await financeDB.queryAll`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'revenues' AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      console.log('Revenues columns:', revenuesColumns);

      const revenuesHasPaymentMode = revenuesColumns.some((col: any) => col.column_name === 'payment_mode');
      const revenuesHasBankReference = revenuesColumns.some((col: any) => col.column_name === 'bank_reference');

      // Check expenses table columns
      const expensesColumns = await financeDB.queryAll`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'expenses' AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      console.log('Expenses columns:', expensesColumns);

      const expensesHasPaymentMode = expensesColumns.some((col: any) => col.column_name === 'payment_mode');
      const expensesHasBankReference = expensesColumns.some((col: any) => col.column_name === 'bank_reference');

      // Get sample data to see what's actually stored
      const sampleRevenue = await financeDB.queryRow`
        SELECT id, payment_mode, bank_reference, amount_cents, source
        FROM revenues 
        WHERE org_id = ${authData.orgId}
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      const sampleExpense = await financeDB.queryRow`
        SELECT id, payment_mode, bank_reference, amount_cents, category
        FROM expenses 
        WHERE org_id = ${authData.orgId}
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      console.log('Sample revenue:', sampleRevenue);
      console.log('Sample expense:', sampleExpense);

      return {
        revenuesHasPaymentMode,
        revenuesHasBankReference,
        expensesHasPaymentMode,
        expensesHasBankReference,
        sampleRevenue,
        sampleExpense
      };
    } catch (error) {
      console.error('Error checking payment columns:', error);
      throw APIError.internal(`Failed to check payment columns: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);


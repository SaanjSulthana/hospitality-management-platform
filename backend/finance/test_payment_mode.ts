import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

export interface TestPaymentModeRequest {
  // No parameters needed
}

export interface TestPaymentModeResponse {
  success: boolean;
  message: string;
  sampleRevenue?: any;
  sampleExpense?: any;
}

// Test endpoint to verify payment mode functionality
export const testPaymentMode = api<TestPaymentModeRequest, TestPaymentModeResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/test-payment-mode" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    try {
      // Get a sample revenue with payment mode
      const sampleRevenue = await financeDB.queryRow`
        SELECT id, source, amount_cents, payment_mode, bank_reference, created_at
        FROM revenues 
        WHERE org_id = ${authData.orgId}
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      // Get a sample expense with payment mode
      const sampleExpense = await financeDB.queryRow`
        SELECT id, category, amount_cents, payment_mode, bank_reference, created_at
        FROM expenses 
        WHERE org_id = ${authData.orgId}
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      return {
        success: true,
        message: "Payment mode test completed successfully",
        sampleRevenue: sampleRevenue || null,
        sampleExpense: sampleExpense || null,
      };
    } catch (error: any) {
      console.error('Test payment mode error:', error);
      return {
        success: false,
        message: `Test failed: ${error.message}`,
      };
    }
  }
);


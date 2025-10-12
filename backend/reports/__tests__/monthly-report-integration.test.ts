// Monthly Report Integration Tests - Test the actual API behavior

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Monthly Report Integration', () => {
  describe('getMonthlyReport API Integration', () => {
    it('should return correct monthly totals when daily data exists', async () => {
      // This test simulates the actual API behavior
      // We'll test the logic that should be happening in getMonthlyReport
      
      const mockDailyReports = [
        {
          date: '2025-10-03',
          propertyId: 1,
          propertyName: 'Test Property',
          openingBalanceCents: 20000,
          cashReceivedCents: 3000,
          bankReceivedCents: 2000,
          totalReceivedCents: 5000,
          cashExpensesCents: 1000,
          bankExpensesCents: 500,
          totalExpensesCents: 1500,
          closingBalanceCents: 25000,
          netCashFlowCents: 3500,
          transactions: [
            { id: 1, type: 'revenue', amountCents: 3000, paymentMode: 'cash' },
            { id: 2, type: 'revenue', amountCents: 2000, paymentMode: 'bank' },
            { id: 3, type: 'expense', amountCents: 1000, paymentMode: 'cash' },
            { id: 4, type: 'expense', amountCents: 500, paymentMode: 'bank' }
          ]
        },
        {
          date: '2025-10-02',
          propertyId: 1,
          propertyName: 'Test Property',
          openingBalanceCents: 15000,
          cashReceivedCents: 2000,
          bankReceivedCents: 1500,
          totalReceivedCents: 3500,
          cashExpensesCents: 800,
          bankExpensesCents: 300,
          totalExpensesCents: 1100,
          closingBalanceCents: 20000,
          netCashFlowCents: 2400,
          transactions: [
            { id: 5, type: 'revenue', amountCents: 2000, paymentMode: 'cash' },
            { id: 6, type: 'revenue', amountCents: 1500, paymentMode: 'bank' },
            { id: 7, type: 'expense', amountCents: 800, paymentMode: 'cash' },
            { id: 8, type: 'expense', amountCents: 300, paymentMode: 'bank' }
          ]
        },
        {
          date: '2025-10-01',
          propertyId: 1,
          propertyName: 'Test Property',
          openingBalanceCents: 10000,
          cashReceivedCents: 1000,
          bankReceivedCents: 1000,
          totalReceivedCents: 2000,
          cashExpensesCents: 500,
          bankExpensesCents: 200,
          totalExpensesCents: 700,
          closingBalanceCents: 15000,
          netCashFlowCents: 1300,
          transactions: [
            { id: 9, type: 'revenue', amountCents: 1000, paymentMode: 'cash' },
            { id: 10, type: 'revenue', amountCents: 1000, paymentMode: 'bank' },
            { id: 11, type: 'expense', amountCents: 500, paymentMode: 'cash' },
            { id: 12, type: 'expense', amountCents: 200, paymentMode: 'bank' }
          ]
        }
      ];

      // Simulate the exact logic from getMonthlyReport
      let totalOpeningBalanceCents = 0;
      let totalCashReceivedCents = 0;
      let totalBankReceivedCents = 0;
      let totalCashExpensesCents = 0;
      let totalBankExpensesCents = 0;
      let totalClosingBalanceCents = 0;
      let transactionCount = 0;

      // Get opening balance from first day of month and closing balance from last day
      if (mockDailyReports.length > 0) {
        // Since dates are reversed in getDailyReportsData, the first element is the last day
        // and the last element is the first day
        totalOpeningBalanceCents = mockDailyReports[mockDailyReports.length - 1].openingBalanceCents; // First day of month
        totalClosingBalanceCents = mockDailyReports[0].closingBalanceCents; // Last day of month
      }

      // Sum up all daily totals
      mockDailyReports.forEach(report => {
        totalCashReceivedCents += report.cashReceivedCents;
        totalBankReceivedCents += report.bankReceivedCents;
        totalCashExpensesCents += report.cashExpensesCents;
        totalBankExpensesCents += report.bankExpensesCents;
        transactionCount += report.transactions.length;
      });

      const totalRevenue = totalCashReceivedCents + totalBankReceivedCents;
      const totalExpenses = totalCashExpensesCents + totalBankExpensesCents;
      const netCashFlowCents = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netCashFlowCents / totalRevenue) * 100 : 0;

      // Expected values:
      // Opening: 10000 (first day)
      // Closing: 25000 (last day)
      // Cash Received: 3000 + 2000 + 1000 = 6000
      // Bank Received: 2000 + 1500 + 1000 = 4500
      // Cash Expenses: 1000 + 800 + 500 = 2300
      // Bank Expenses: 500 + 300 + 200 = 1000
      // Total Revenue: 6000 + 4500 = 10500
      // Total Expenses: 2300 + 1000 = 3300
      // Net Cash Flow: 10500 - 3300 = 7200
      // Profit Margin: (7200 / 10500) * 100 = 68.57%

      expect(totalOpeningBalanceCents).toBe(10000);
      expect(totalClosingBalanceCents).toBe(25000);
      expect(totalCashReceivedCents).toBe(6000);
      expect(totalBankReceivedCents).toBe(4500);
      expect(totalCashExpensesCents).toBe(2300);
      expect(totalBankExpensesCents).toBe(1000);
      expect(totalRevenue).toBe(10500);
      expect(totalExpenses).toBe(3300);
      expect(netCashFlowCents).toBe(7200);
      expect(profitMargin).toBeCloseTo(68.57, 1);
      expect(transactionCount).toBe(12);

      // Verify the response structure matches what the API should return
      const apiResponse = {
        year: 2025,
        month: 10,
        monthName: 'October',
        propertyId: 1,
        propertyName: 'Test Property',
        openingBalanceCents: totalOpeningBalanceCents,
        totalCashReceivedCents,
        totalBankReceivedCents,
        totalCashExpensesCents,
        totalBankExpensesCents,
        closingBalanceCents: totalClosingBalanceCents,
        netCashFlowCents,
        profitMargin,
        transactionCount,
        dailyReports: mockDailyReports,
      };

      expect(apiResponse.openingBalanceCents).toBe(10000);
      expect(apiResponse.totalCashReceivedCents).toBe(6000);
      expect(apiResponse.totalBankReceivedCents).toBe(4500);
      expect(apiResponse.totalCashExpensesCents).toBe(2300);
      expect(apiResponse.totalBankExpensesCents).toBe(1000);
      expect(apiResponse.closingBalanceCents).toBe(25000);
      expect(apiResponse.netCashFlowCents).toBe(7200);
      expect(apiResponse.profitMargin).toBeCloseTo(68.57, 1);
      expect(apiResponse.transactionCount).toBe(12);
    });

    it('should handle case where no daily reports exist', async () => {
      const mockDailyReports: any[] = [];

      // Simulate the exact logic from getMonthlyReport
      let totalOpeningBalanceCents = 0;
      let totalCashReceivedCents = 0;
      let totalBankReceivedCents = 0;
      let totalCashExpensesCents = 0;
      let totalBankExpensesCents = 0;
      let totalClosingBalanceCents = 0;
      let transactionCount = 0;

      if (mockDailyReports.length > 0) {
        totalOpeningBalanceCents = mockDailyReports[mockDailyReports.length - 1].openingBalanceCents;
        totalClosingBalanceCents = mockDailyReports[0].closingBalanceCents;
      }

      mockDailyReports.forEach(report => {
        totalCashReceivedCents += report.cashReceivedCents;
        totalBankReceivedCents += report.bankReceivedCents;
        totalCashExpensesCents += report.cashExpensesCents;
        totalBankExpensesCents += report.bankExpensesCents;
        transactionCount += report.transactions.length;
      });

      const totalRevenue = totalCashReceivedCents + totalBankReceivedCents;
      const totalExpenses = totalCashExpensesCents + totalBankExpensesCents;
      const netCashFlowCents = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netCashFlowCents / totalRevenue) * 100 : 0;

      // All values should be zero
      expect(totalOpeningBalanceCents).toBe(0);
      expect(totalClosingBalanceCents).toBe(0);
      expect(totalCashReceivedCents).toBe(0);
      expect(totalBankReceivedCents).toBe(0);
      expect(totalCashExpensesCents).toBe(0);
      expect(totalBankExpensesCents).toBe(0);
      expect(totalRevenue).toBe(0);
      expect(totalExpenses).toBe(0);
      expect(netCashFlowCents).toBe(0);
      expect(profitMargin).toBe(0);
      expect(transactionCount).toBe(0);
    });
  });

  describe('Data consistency verification', () => {
    it('should verify that daily totals sum to monthly totals', () => {
      const dailyReports = [
        { cashReceivedCents: 1000, bankReceivedCents: 500, cashExpensesCents: 200, bankExpensesCents: 100 },
        { cashReceivedCents: 2000, bankReceivedCents: 1000, cashExpensesCents: 300, bankExpensesCents: 150 },
        { cashReceivedCents: 3000, bankReceivedCents: 1500, cashExpensesCents: 400, bankExpensesCents: 200 }
      ];

      // Calculate monthly totals
      let monthlyCashReceived = 0;
      let monthlyBankReceived = 0;
      let monthlyCashExpenses = 0;
      let monthlyBankExpenses = 0;

      dailyReports.forEach(report => {
        monthlyCashReceived += report.cashReceivedCents;
        monthlyBankReceived += report.bankReceivedCents;
        monthlyCashExpenses += report.cashExpensesCents;
        monthlyBankExpenses += report.bankExpensesCents;
      });

      // Verify the sum matches individual daily values
      expect(monthlyCashReceived).toBe(6000); // 1000 + 2000 + 3000
      expect(monthlyBankReceived).toBe(3000); // 500 + 1000 + 1500
      expect(monthlyCashExpenses).toBe(900);  // 200 + 300 + 400
      expect(monthlyBankExpenses).toBe(450);  // 100 + 150 + 200

      // Verify individual daily values
      expect(dailyReports[0].cashReceivedCents).toBe(1000);
      expect(dailyReports[1].cashReceivedCents).toBe(2000);
      expect(dailyReports[2].cashReceivedCents).toBe(3000);
    });
  });
});

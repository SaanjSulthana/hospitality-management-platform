// Monthly Report Data Flow Tests - Debug the actual issue

import { describe, it, expect } from '@jest/globals';

describe('Monthly Report Data Flow Debug', () => {
  describe('Date ordering and balance calculation', () => {
    it('should understand the date ordering in getDailyReportsData', () => {
      // Simulate the date generation logic from getDailyReportsData
      const startDate = '2025-10-01';
      const endDate = '2025-10-03';
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dates: string[] = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }
      
      // Before reverse: ['2025-10-01', '2025-10-02', '2025-10-03']
      expect(dates).toEqual(['2025-10-01', '2025-10-02', '2025-10-03']);
      
      // After reverse: ['2025-10-03', '2025-10-02', '2025-10-01']
      const reversedDates = [...dates].reverse();
      expect(reversedDates).toEqual(['2025-10-03', '2025-10-02', '2025-10-01']);
      
      // So in the final reports array:
      // reports[0] = 2025-10-03 (last day of month)
      // reports[1] = 2025-10-02 (middle day)
      // reports[2] = 2025-10-01 (first day of month)
    });

    it('should correctly identify first and last day indices', () => {
      const mockDailyReports = [
        { date: '2025-10-03', openingBalanceCents: 20000, closingBalanceCents: 25000 }, // Last day
        { date: '2025-10-02', openingBalanceCents: 15000, closingBalanceCents: 20000 }, // Middle day
        { date: '2025-10-01', openingBalanceCents: 10000, closingBalanceCents: 15000 }  // First day
      ];

      // Current logic in getMonthlyReport:
      const totalOpeningBalanceCents = mockDailyReports[mockDailyReports.length - 1].openingBalanceCents; // First day
      const totalClosingBalanceCents = mockDailyReports[0].closingBalanceCents; // Last day

      expect(totalOpeningBalanceCents).toBe(10000); // Should be first day opening balance
      expect(totalClosingBalanceCents).toBe(25000); // Should be last day closing balance
    });

    it('should verify the aggregation logic works correctly', () => {
      const mockDailyReports = [
        {
          date: '2025-10-03', // Last day
          cashReceivedCents: 3000,
          bankReceivedCents: 2000,
          cashExpensesCents: 1000,
          bankExpensesCents: 500,
          transactions: [{ id: 1 }, { id: 2 }]
        },
        {
          date: '2025-10-02', // Middle day
          cashReceivedCents: 2000,
          bankReceivedCents: 1500,
          cashExpensesCents: 800,
          bankExpensesCents: 300,
          transactions: [{ id: 3 }, { id: 4 }]
        },
        {
          date: '2025-10-01', // First day
          cashReceivedCents: 1000,
          bankReceivedCents: 1000,
          cashExpensesCents: 500,
          bankExpensesCents: 200,
          transactions: [{ id: 5 }]
        }
      ];

      // Simulate the aggregation logic
      let totalCashReceivedCents = 0;
      let totalBankReceivedCents = 0;
      let totalCashExpensesCents = 0;
      let totalBankExpensesCents = 0;
      let transactionCount = 0;

      mockDailyReports.forEach(report => {
        totalCashReceivedCents += report.cashReceivedCents;
        totalBankReceivedCents += report.bankReceivedCents;
        totalCashExpensesCents += report.cashExpensesCents;
        totalBankExpensesCents += report.bankExpensesCents;
        transactionCount += report.transactions.length;
      });

      // Expected totals: 3000+2000+1000 = 6000, 2000+1500+1000 = 4500, etc.
      expect(totalCashReceivedCents).toBe(6000);
      expect(totalBankReceivedCents).toBe(4500);
      expect(totalCashExpensesCents).toBe(2300);
      expect(totalBankExpensesCents).toBe(1000);
      expect(transactionCount).toBe(5);
    });
  });

  describe('Potential issues in monthly report calculation', () => {
    it('should identify if the issue is in data retrieval or aggregation', () => {
      // This test helps us understand if the problem is:
      // 1. Data not being retrieved correctly from database
      // 2. Data not being aggregated correctly
      // 3. Data not being passed correctly to frontend

      const mockDatabaseData = {
        // Simulate what comes from database queries
        cashBalances: [
          { balance_date: '2025-10-03', cash_received_cents: 3000, cash_expenses_cents: 1000 },
          { balance_date: '2025-10-02', cash_received_cents: 2000, cash_expenses_cents: 800 },
          { balance_date: '2025-10-01', cash_received_cents: 1000, cash_expenses_cents: 500 }
        ],
        transactions: [
          { occurred_at: '2025-10-01T10:00:00Z', amount_cents: 1000, payment_mode: 'cash', type: 'revenue' },
          { occurred_at: '2025-10-02T10:00:00Z', amount_cents: 2000, payment_mode: 'cash', type: 'revenue' },
          { occurred_at: '2025-10-03T10:00:00Z', amount_cents: 3000, payment_mode: 'cash', type: 'revenue' }
        ]
      };

      // Simulate the processing logic
      const processedData = mockDatabaseData.cashBalances.map(balance => ({
        date: balance.balance_date,
        cashReceivedCents: parseInt(balance.cash_received_cents),
        cashExpensesCents: parseInt(balance.cash_expenses_cents)
      }));

      // Verify data processing
      expect(processedData).toHaveLength(3);
      expect(processedData[0].cashReceivedCents).toBe(3000);
      expect(processedData[1].cashReceivedCents).toBe(2000);
      expect(processedData[2].cashReceivedCents).toBe(1000);
    });

    it('should verify the monthly totals calculation formula', () => {
      // Test the exact formula used in getMonthlyReport
      const dailyReports = [
        { cashReceivedCents: 1000, bankReceivedCents: 500, cashExpensesCents: 200, bankExpensesCents: 100 },
        { cashReceivedCents: 2000, bankReceivedCents: 1000, cashExpensesCents: 300, bankExpensesCents: 150 },
        { cashReceivedCents: 3000, bankReceivedCents: 1500, cashExpensesCents: 400, bankExpensesCents: 200 }
      ];

      let totalCashReceivedCents = 0;
      let totalBankReceivedCents = 0;
      let totalCashExpensesCents = 0;
      let totalBankExpensesCents = 0;

      dailyReports.forEach(report => {
        totalCashReceivedCents += report.cashReceivedCents;
        totalBankReceivedCents += report.bankReceivedCents;
        totalCashExpensesCents += report.cashExpensesCents;
        totalBankExpensesCents += report.bankExpensesCents;
      });

      const totalRevenue = totalCashReceivedCents + totalBankReceivedCents;
      const totalExpenses = totalCashExpensesCents + totalBankExpensesCents;
      const netCashFlowCents = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netCashFlowCents / totalRevenue) * 100 : 0;

      // Expected: 6000 + 3000 = 9000 revenue, 900 + 450 = 1350 expenses
      expect(totalRevenue).toBe(9000);
      expect(totalExpenses).toBe(1350);
      expect(netCashFlowCents).toBe(7650);
      expect(profitMargin).toBeCloseTo(85.0, 1); // (7650/9000) * 100
    });
  });
});

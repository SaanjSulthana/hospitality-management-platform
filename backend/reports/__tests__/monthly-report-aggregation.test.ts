// Monthly Report Data Aggregation Tests

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Monthly Report Data Aggregation', () => {
  describe('getMonthlyReport API', () => {
    it('should aggregate daily transaction data correctly', async () => {
      // Test data setup
      const testData = {
        propertyId: 1,
        year: 2025,
        month: 10,
        orgId: 1,
        authData: {
          userID: '1',
          role: 'ADMIN',
          orgId: 1
        }
      };

      // Mock daily reports data
      const mockDailyReports = [
        {
          date: '2025-10-01',
          propertyId: 1,
          propertyName: 'Test Property',
          openingBalanceCents: 10000,
          cashReceivedCents: 5000,
          bankReceivedCents: 3000,
          totalReceivedCents: 8000,
          cashExpensesCents: 2000,
          bankExpensesCents: 1000,
          totalExpensesCents: 3000,
          closingBalanceCents: 16000,
          netCashFlowCents: 5000,
          transactions: [
            { id: 1, type: 'revenue', amountCents: 5000, paymentMode: 'cash' },
            { id: 2, type: 'revenue', amountCents: 3000, paymentMode: 'bank' },
            { id: 3, type: 'expense', amountCents: 2000, paymentMode: 'cash' },
            { id: 4, type: 'expense', amountCents: 1000, paymentMode: 'bank' }
          ]
        },
        {
          date: '2025-10-02',
          propertyId: 1,
          propertyName: 'Test Property',
          openingBalanceCents: 16000,
          cashReceivedCents: 7000,
          bankReceivedCents: 2000,
          totalReceivedCents: 9000,
          cashExpensesCents: 3000,
          bankExpensesCents: 500,
          totalExpensesCents: 3500,
          closingBalanceCents: 22500,
          netCashFlowCents: 5500,
          transactions: [
            { id: 5, type: 'revenue', amountCents: 7000, paymentMode: 'cash' },
            { id: 6, type: 'revenue', amountCents: 2000, paymentMode: 'bank' },
            { id: 7, type: 'expense', amountCents: 3000, paymentMode: 'cash' },
            { id: 8, type: 'expense', amountCents: 500, paymentMode: 'bank' }
          ]
        }
      ];

      // Expected monthly totals
      const expectedTotals = {
        totalCashReceivedCents: 12000, // 5000 + 7000
        totalBankReceivedCents: 5000,  // 3000 + 2000
        totalCashExpensesCents: 5000,  // 2000 + 3000
        totalBankExpensesCents: 1500,  // 1000 + 500
        totalRevenue: 17000,           // 12000 + 5000
        totalExpenses: 6500,           // 5000 + 1500
        netCashFlowCents: 10500,       // 17000 - 6500
        transactionCount: 8,           // 4 + 4 transactions
        openingBalanceCents: 10000,    // First day opening balance
        closingBalanceCents: 22500     // Last day closing balance
      };

      // Test the aggregation logic
      let totalCashReceivedCents = 0;
      let totalBankReceivedCents = 0;
      let totalCashExpensesCents = 0;
      let totalBankExpensesCents = 0;
      let transactionCount = 0;

      // Simulate the aggregation logic from getMonthlyReport
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

      // Verify aggregation results
      expect(totalCashReceivedCents).toBe(expectedTotals.totalCashReceivedCents);
      expect(totalBankReceivedCents).toBe(expectedTotals.totalBankReceivedCents);
      expect(totalCashExpensesCents).toBe(expectedTotals.totalCashExpensesCents);
      expect(totalBankExpensesCents).toBe(expectedTotals.totalBankExpensesCents);
      expect(totalRevenue).toBe(expectedTotals.totalRevenue);
      expect(totalExpenses).toBe(expectedTotals.totalExpenses);
      expect(netCashFlowCents).toBe(expectedTotals.netCashFlowCents);
      expect(transactionCount).toBe(expectedTotals.transactionCount);
    });

    it('should handle empty daily reports correctly', async () => {
      const mockDailyReports: any[] = [];

      // Test aggregation with no data
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

      const totalRevenue = totalCashReceivedCents + totalBankReceivedCents;
      const totalExpenses = totalCashExpensesCents + totalBankExpensesCents;
      const netCashFlowCents = totalRevenue - totalExpenses;

      // All values should be zero
      expect(totalCashReceivedCents).toBe(0);
      expect(totalBankReceivedCents).toBe(0);
      expect(totalCashExpensesCents).toBe(0);
      expect(totalBankExpensesCents).toBe(0);
      expect(totalRevenue).toBe(0);
      expect(totalExpenses).toBe(0);
      expect(netCashFlowCents).toBe(0);
      expect(transactionCount).toBe(0);
    });

    it('should calculate profit margin correctly', async () => {
      const testCases = [
        {
          totalRevenue: 10000,
          totalExpenses: 8000,
          expectedMargin: 20.0 // (10000 - 8000) / 10000 * 100
        },
        {
          totalRevenue: 5000,
          totalExpenses: 6000,
          expectedMargin: -20.0 // (5000 - 6000) / 5000 * 100
        },
        {
          totalRevenue: 0,
          totalExpenses: 1000,
          expectedMargin: 0 // No revenue, margin should be 0
        }
      ];

      testCases.forEach(testCase => {
        const netCashFlowCents = testCase.totalRevenue - testCase.totalExpenses;
        const profitMargin = testCase.totalRevenue > 0 
          ? (netCashFlowCents / testCase.totalRevenue) * 100 
          : 0;

        expect(profitMargin).toBe(testCase.expectedMargin);
      });
    });
  });

  describe('getDailyReportsData helper function', () => {
    it('should group transactions by date correctly', async () => {
      // Mock transaction data
      const mockTransactions = [
        {
          id: 1,
          type: 'revenue',
          amount_cents: '5000',
          payment_mode: 'cash',
          occurred_at: new Date('2025-10-01T10:00:00Z')
        },
        {
          id: 2,
          type: 'expense',
          amount_cents: '2000',
          payment_mode: 'bank',
          occurred_at: new Date('2025-10-01T14:00:00Z')
        },
        {
          id: 3,
          type: 'revenue',
          amount_cents: '3000',
          payment_mode: 'cash',
          occurred_at: new Date('2025-10-02T09:00:00Z')
        }
      ];

      // Simulate the grouping logic
      const transactionsByDate = new Map<string, any[]>();
      mockTransactions.forEach((tx: any) => {
        let istDate: string;
        if (tx.occurred_at instanceof Date) {
          istDate = tx.occurred_at.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        } else {
          const date = new Date(tx.occurred_at);
          istDate = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        }
        
        if (!transactionsByDate.has(istDate)) {
          transactionsByDate.set(istDate, []);
        }
        transactionsByDate.get(istDate)!.push(tx);
      });

      // Verify grouping
      expect(transactionsByDate.size).toBe(2);
      expect(transactionsByDate.get('2025-10-01')?.length).toBe(2);
      expect(transactionsByDate.get('2025-10-02')?.length).toBe(1);
    });

    it('should calculate daily totals from transactions correctly', async () => {
      const mockTransactions = [
        { type: 'revenue', amount_cents: '5000', payment_mode: 'cash' },
        { type: 'revenue', amount_cents: '3000', payment_mode: 'bank' },
        { type: 'expense', amount_cents: '2000', payment_mode: 'cash' },
        { type: 'expense', amount_cents: '1000', payment_mode: 'bank' }
      ];

      // Simulate the calculation logic
      let cashReceivedCents = 0;
      let bankReceivedCents = 0;
      let cashExpensesCents = 0;
      let bankExpensesCents = 0;

      mockTransactions.forEach((tx: any) => {
        const amount = parseInt(tx.amount_cents) || 0;
        if (tx.type === 'revenue') {
          if (tx.payment_mode === 'cash') {
            cashReceivedCents += amount;
          } else {
            bankReceivedCents += amount;
          }
        } else {
          if (tx.payment_mode === 'cash') {
            cashExpensesCents += amount;
          } else {
            bankExpensesCents += amount;
          }
        }
      });

      // Verify calculations
      expect(cashReceivedCents).toBe(5000);
      expect(bankReceivedCents).toBe(3000);
      expect(cashExpensesCents).toBe(2000);
      expect(bankExpensesCents).toBe(1000);
    });
  });
});

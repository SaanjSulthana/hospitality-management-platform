/**
 * Renderer Tests
 */

import { render } from '../renderer';
import { RenderContext } from '../types';

describe('Document Renderer', () => {
  describe('PDF Rendering', () => {
    it('should render daily report PDF', async () => {
      const context: RenderContext = {
        exportType: 'daily-report',
        format: 'pdf',
        data: {
          propertyName: 'Test Property',
          date: '2025-01-29',
          openingBalanceCents: 100000,
          totalReceivedCents: 50000,
          totalExpensesCents: 30000,
          closingBalanceCents: 120000,
          transactions: [],
          generatedAt: new Date(),
        },
        metadata: {
          orgId: 1,
          userId: 1,
          generatedAt: new Date(),
        },
      };

      const result = await render(context);

      expect(result.buffer).toBeDefined();
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.fileSizeBytes).toBeGreaterThan(0);
    }, 10000); // 10 second timeout for PDF generation

    it('should complete within performance target', async () => {
      const context: RenderContext = {
        exportType: 'daily-report',
        format: 'pdf',
        data: {
          propertyName: 'Performance Test',
          date: '2025-01-29',
          openingBalanceCents: 100000,
          totalReceivedCents: 50000,
          totalExpensesCents: 30000,
          closingBalanceCents: 120000,
          transactions: Array.from({ length: 100 }, (_, i) => ({
            description: `Transaction ${i}`,
            type: i % 2 === 0 ? 'revenue' : 'expense',
            paymentMode: 'cash',
            amountCents: 1000 + i,
          })),
          generatedAt: new Date(),
        },
        metadata: {
          orgId: 1,
          userId: 1,
          generatedAt: new Date(),
        },
      };

      const startTime = Date.now();
      await render(context);
      const duration = Date.now() - startTime;

      // Should complete within 3 seconds for 100 transactions
      expect(duration).toBeLessThan(3000);
    }, 10000);
  });

  describe('Excel Rendering', () => {
    it('should render daily report Excel', async () => {
      const context: RenderContext = {
        exportType: 'daily-report',
        format: 'xlsx',
        data: {
          propertyName: 'Test Property',
          date: '2025-01-29',
          openingBalanceCents: 100000,
          totalReceivedCents: 50000,
          totalExpensesCents: 30000,
          closingBalanceCents: 120000,
          transactions: [],
          generatedAt: new Date(),
        },
        metadata: {
          orgId: 1,
          userId: 1,
          generatedAt: new Date(),
        },
      };

      const result = await render(context);

      expect(result.buffer).toBeDefined();
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.fileSizeBytes).toBeGreaterThan(0);
    });

    it('should complete within performance target', async () => {
      const context: RenderContext = {
        exportType: 'staff-leave',
        format: 'xlsx',
        data: {
          records: Array.from({ length: 1000 }, (_, i) => ({
            staffName: `Staff ${i}`,
            leaveType: 'annual',
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-01-05'),
            status: 'approved',
          })),
          generatedAt: new Date(),
        },
        metadata: {
          orgId: 1,
          userId: 1,
          generatedAt: new Date(),
        },
      };

      const startTime = Date.now();
      await render(context);
      const duration = Date.now() - startTime;

      // Should complete within 2 seconds for 1000 rows
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported format', async () => {
      const context: any = {
        exportType: 'daily-report',
        format: 'docx', // Unsupported
        data: {},
        metadata: {},
      };

      await expect(render(context)).rejects.toThrow('Unsupported format');
    });

    it('should throw error for missing data', async () => {
      const context: any = {
        exportType: 'daily-report',
        format: 'pdf',
        data: null, // Missing data
        metadata: {},
      };

      await expect(render(context)).rejects.toThrow('Data is required');
    });
  });
});


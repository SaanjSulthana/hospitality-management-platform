/**
 * Integration Tests
 * End-to-end tests for the export workflow
 */

import { createExport } from '../create_export';
import { getExportStatus } from '../get_export_status';
import { processExport } from '../process_export';
import { downloadExport } from '../download_export';
import { deleteExport } from '../delete_export';

describe('Document Export Integration', () => {
  const mockAuthData = {
    userID: '1',
    orgId: 1,
    role: 'ADMIN' as const,
  };

  // Mock getAuthData
  jest.mock('~encore/auth', () => ({
    getAuthData: () => mockAuthData,
  }));

  describe('Full Export Workflow', () => {
    it('should complete create → process → status → download flow', async () => {
      // Step 1: Create export
      const createResponse = await createExport({
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
      });

      expect(createResponse.exportId).toBeDefined();
      expect(createResponse.status).toBe('queued');
      expect(createResponse.estimatedSeconds).toBeGreaterThan(0);

      const exportId = createResponse.exportId;

      // Step 2: Process export
      const processResponse = await processExport({ exportId });

      expect(processResponse.status).toBe('ready');
      expect(processResponse.fileSizeBytes).toBeGreaterThan(0);

      // Step 3: Check status
      const statusResponse = await getExportStatus({ exportId });

      expect(statusResponse.status).toBe('ready');
      expect(statusResponse.downloadUrl).toBeDefined();
      expect(statusResponse.fileSizeBytes).toBeGreaterThan(0);

      // Step 4: Download
      const downloadResponse = await downloadExport({ exportId });

      expect(downloadResponse.signedUrl).toBeDefined();
      expect(downloadResponse.expiresIn).toBeGreaterThan(0);
      expect(downloadResponse.filename).toContain('.pdf');

      // Step 5: Cleanup
      const deleteResponse = await deleteExport({ exportId });

      expect(deleteResponse.message).toContain('deleted successfully');
    }, 30000);

    it('should handle Excel export workflow', async () => {
      const createResponse = await createExport({
        exportType: 'staff-leave',
        format: 'xlsx',
        data: {
          records: [
            {
              staffName: 'John Doe',
              leaveType: 'annual',
              startDate: new Date('2025-01-01'),
              endDate: new Date('2025-01-05'),
              status: 'approved',
            },
          ],
          generatedAt: new Date(),
        },
      });

      const exportId = createResponse.exportId;

      const processResponse = await processExport({ exportId });
      expect(processResponse.status).toBe('ready');

      const downloadResponse = await downloadExport({ exportId });
      expect(downloadResponse.filename).toContain('.xlsx');

      await deleteExport({ exportId });
    }, 30000);
  });

  describe('Error Scenarios', () => {
    it('should handle invalid export type', async () => {
      await expect(
        createExport({
          exportType: 'invalid-type' as any,
          format: 'pdf',
          data: {},
        })
      ).rejects.toThrow();
    });

    it('should handle invalid format', async () => {
      await expect(
        createExport({
          exportType: 'daily-report',
          format: 'docx' as any,
          data: {},
        })
      ).rejects.toThrow();
    });

    it('should handle processing errors gracefully', async () => {
      const createResponse = await createExport({
        exportType: 'daily-report',
        format: 'pdf',
        data: null, // Invalid data
      });

      const processResponse = await processExport({ exportId: createResponse.exportId });

      expect(processResponse.status).toBe('failed');
      expect(processResponse.errorMessage).toBeDefined();
    }, 30000);
  });

  describe('Retry Logic', () => {
    it('should allow retrying failed exports', async () => {
      // Create and fail an export
      const createResponse = await createExport({
        exportType: 'daily-report',
        format: 'pdf',
        data: null,
      });

      await processExport({ exportId: createResponse.exportId });

      // Retry with valid data (would need to update export data in real implementation)
      // This is a placeholder for retry logic
      const statusResponse = await getExportStatus({ exportId: createResponse.exportId });

      expect(statusResponse.status).toBe('failed');
    }, 30000);
  });
});


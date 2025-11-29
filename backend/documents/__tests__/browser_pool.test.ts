/**
 * Browser Pool Tests
 */

import { browserPool } from '../browser_pool';

describe('Browser Pool', () => {
  afterAll(async () => {
    // Cleanup browser after all tests
    await browserPool.close();
  });

  describe('Initialization', () => {
    it('should initialize browser on first render', async () => {
      const result = await browserPool.render(async (page) => {
        await page.setContent('<h1>Test</h1>');
        return await page.content();
      });

      expect(result).toContain('<h1>Test</h1>');
    });

    it('should pass health check when initialized', async () => {
      // Trigger initialization
      await browserPool.render(async (page) => {
        return 'test';
      });

      const isHealthy = await browserPool.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Concurrency Management', () => {
    it('should handle multiple concurrent renders', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        browserPool.render(async (page) => {
          await page.setContent(`<h1>Test ${i}</h1>`);
          return i;
        })
      );

      const results = await Promise.all(promises);
      expect(results).toEqual([0, 1, 2, 3, 4]);
    }, 30000);

    it('should enforce concurrent limit', async () => {
      const stats = browserPool.getStats();
      expect(stats).toBeDefined();
      // Max concurrent should be 5 or less
      expect(stats.active).toBeLessThanOrEqual(5);
    });
  });

  describe('Resource Management', () => {
    it('should close page after render', async () => {
      let pageClosed = false;

      await browserPool.render(async (page) => {
        page.once('close', () => {
          pageClosed = true;
        });
        return 'test';
      });

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(pageClosed).toBe(true);
    });

    it('should handle render errors gracefully', async () => {
      await expect(
        browserPool.render(async (page) => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Browser should still be healthy
      const isHealthy = await browserPool.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Timeout Enforcement', () => {
    it('should timeout long-running renders', async () => {
      await expect(
        browserPool.render(async (page) => {
          // Simulate long-running task
          await new Promise(resolve => setTimeout(resolve, 35000));
        })
      ).rejects.toThrow();
    }, 35000);
  });

  describe('PDF Generation', () => {
    it('should generate valid PDF', async () => {
      const pdfBuffer = await browserPool.render(async (page) => {
        await page.setContent(`
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial; padding: 20px; }
              h1 { color: #333; }
            </style>
          </head>
          <body>
            <h1>Test PDF Document</h1>
            <p>This is a test paragraph.</p>
          </body>
          </html>
        `);

        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
        });

        return Buffer.from(pdf);
      });

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      // PDF files start with %PDF
      expect(pdfBuffer.toString('utf-8', 0, 4)).toBe('%PDF');
    }, 10000);
  });
});


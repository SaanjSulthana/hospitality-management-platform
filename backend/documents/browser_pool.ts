/**
 * Browser Pool for Puppeteer
 * Manages a pool of browser instances for concurrent PDF generation
 * Uses bulkhead pattern to limit concurrent renders and prevent memory leaks
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { Bulkhead } from '../resilience/bulkhead';

interface BrowserPoolConfig {
  maxInstances: number;
  maxConcurrent: number;
  queueSize: number;
  timeout: number;
  launchOptions: puppeteer.PuppeteerLaunchOptions;
}

class BrowserPool {
  private config: BrowserPoolConfig;
  private browser: Browser | null = null;
  private bulkhead: Bulkhead;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(config?: Partial<BrowserPoolConfig>) {
    this.config = {
      maxInstances: 1, // Single browser instance with multiple pages
      maxConcurrent: 5, // Max 5 concurrent page renders
      queueSize: 50,
      timeout: 30000, // 30 seconds
      launchOptions: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Overcome limited resource problems
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--single-process', // More stable in containerized environments
        ],
      },
      ...config,
    };

    // Create bulkhead for managing concurrent renders
    this.bulkhead = new Bulkhead('browser-pool', {
      maxConcurrent: this.config.maxConcurrent,
      queueSize: this.config.queueSize,
      timeout: this.config.timeout,
      priority: true, // Enable priority queuing
    });

    console.log(`[BrowserPool] Initialized with config:`, {
      maxConcurrent: this.config.maxConcurrent,
      timeout: this.config.timeout,
    });
  }

  /**
   * Initialize browser instance (lazy initialization)
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized && this.browser) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        console.log('[BrowserPool] Launching browser...');
        this.browser = await puppeteer.launch(this.config.launchOptions);
        this.isInitialized = true;
        console.log('[BrowserPool] Browser launched successfully');

        // Handle browser disconnection
        this.browser.on('disconnected', () => {
          console.warn('[BrowserPool] Browser disconnected, will reinitialize on next render');
          this.isInitialized = false;
          this.browser = null;
          this.initPromise = null;
        });
      } catch (error) {
        console.error('[BrowserPool] Failed to launch browser:', error);
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Execute a render task with resource management
   */
  async render<T>(renderFn: (page: Page) => Promise<T>, priority: number = 0): Promise<T> {
    // Ensure browser is initialized
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser not available');
    }

    // Use bulkhead to manage concurrency
    return this.bulkhead.execute(async () => {
      let page: Page | null = null;

      try {
        // Create new page
        page = await this.browser!.newPage();

        // Set viewport for consistent rendering
        await page.setViewport({ width: 1200, height: 800 });

        // Set timeout
        page.setDefaultTimeout(this.config.timeout);

        // Execute render function
        const result = await renderFn(page);

        return result;
      } catch (error) {
        console.error('[BrowserPool] Render error:', error);
        throw error;
      } finally {
        // Always close page to prevent memory leaks
        if (page) {
          try {
            await page.close();
          } catch (error) {
            console.error('[BrowserPool] Failed to close page:', error);
          }
        }
      }
    }, priority);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return this.bulkhead.getStats();
  }

  /**
   * Close browser and release resources
   */
  async close(): Promise<void> {
    console.log('[BrowserPool] Closing browser...');
    
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        this.isInitialized = false;
        this.initPromise = null;
        console.log('[BrowserPool] Browser closed successfully');
      } catch (error) {
        console.error('[BrowserPool] Error closing browser:', error);
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.browser || !this.isInitialized) {
        return false;
      }

      // Test by getting browser version
      const version = await this.browser.version();
      return !!version;
    } catch (error) {
      console.error('[BrowserPool] Health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const browserPool = new BrowserPool();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[BrowserPool] SIGTERM received, closing browser...');
  await browserPool.close();
});

process.on('SIGINT', async () => {
  console.log('[BrowserPool] SIGINT received, closing browser...');
  await browserPool.close();
});


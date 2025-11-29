/**
 * PDF Renderer
 * Uses Puppeteer to convert HTML templates to PDF documents
 */

import { browserPool } from './browser_pool';
import { templateLoader } from './template_loader';
import { RenderContext, RenderResult } from './types';

export async function renderPDF(context: RenderContext): Promise<RenderResult> {
  const startTime = Date.now();
  
  try {
    // Determine template name
    const templateName = context.templateName || context.exportType;
    
    console.log(`[PDFRenderer] Starting render for ${templateName}`);
    
    // Render HTML from template
    const html = templateLoader.render(templateName, context.data);
    
    // Generate PDF using browser pool
    const pdfBuffer = await browserPool.render(async (page) => {
      // Set HTML content
      await page.setContent(html, {
        waitUntil: 'networkidle0', // Wait for all network requests to finish
      });
      
      // Generate PDF with options
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        displayHeaderFooter: false,
      });
      
      return Buffer.from(pdf);
    });
    
    const duration = Date.now() - startTime;
    console.log(`[PDFRenderer] Completed in ${duration}ms, size: ${pdfBuffer.length} bytes`);
    
    return {
      buffer: pdfBuffer,
      fileSizeBytes: pdfBuffer.length,
      mimeType: 'application/pdf',
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[PDFRenderer] Failed after ${duration}ms:`, error);
    throw new Error(`PDF rendering failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}


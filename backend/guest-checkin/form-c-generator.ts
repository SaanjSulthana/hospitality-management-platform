// PDF Generator for Form C using Puppeteer
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { FormCData } from './form-c-types';

// Register Handlebars helper for equality check
Handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

/**
 * Generates a Form C PDF from guest data
 * @param data - Guest registration data conforming to FormCData interface
 * @returns Promise<Buffer> - PDF buffer for download
 */
export async function generateFormCPDF(data: FormCData): Promise<Buffer> {
  let browser;
  try {
    // Read the HTML template from source directory (not build directory)
    // Encore compiles to .encore/build but we need the source template
    // Try multiple possible paths
    const possiblePaths = [
      join(process.cwd(), 'guest-checkin', 'templates', 'form-c-template.html'), // If cwd is backend/
      join(process.cwd(), 'backend', 'guest-checkin', 'templates', 'form-c-template.html'), // If cwd is project root
      join(process.cwd(), '..', '..', 'guest-checkin', 'templates', 'form-c-template.html'), // If in build dir
    ];
    
    console.log('Template path resolution:', {
      cwd: process.cwd(),
      possiblePaths: possiblePaths
    });
    
    let templateContent: string | null = null;
    let usedPath: string | null = null;
    
    for (const path of possiblePaths) {
      try {
        templateContent = await readFile(path, 'utf-8');
        usedPath = path;
        console.log('Template found at:', path);
        break;
      } catch (err) {
        console.log('Template not found at:', path);
      }
    }
    
    if (!templateContent || !usedPath) {
      throw new Error(`Template file not found. Tried paths: ${possiblePaths.join(', ')}`);
    }
    
    console.log('Template loaded successfully from:', usedPath, 'length:', templateContent.length);

    // Compile the Handlebars template
    const template = Handlebars.compile(templateContent);

    // Populate the template with data
    const html = template(data);

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set the HTML content
    await page.setContent(html, {
      waitUntil: 'networkidle0'
    });

    // Generate PDF with specific settings for Form C
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      preferCSSPageSize: true
    });

    console.log('Form C PDF generated successfully');
    return Buffer.from(pdfBuffer);

  } catch (error) {
    console.error('Error generating Form C PDF:', error);
    throw new Error(`Failed to generate Form C PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Alternative: Generate PDF from HTML string (useful if template is stored in DB)
 */
export async function generateFormCPDFFromHTML(
  htmlContent: string
): Promise<Buffer> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Helper function to populate template with data
 */
export function populateTemplate(templateContent: string, data: FormCData): string {
  const template = Handlebars.compile(templateContent);
  return template(data);
}

/**
 * Helper function to format date from ISO to DD/MM/YYYY
 */
export function formatDateForFormC(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  
  try {
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Helper function to calculate days between two dates
 */
export function calculateIntendedDuration(checkInDate: string, checkOutDate: string | null | undefined): number {
  if (!checkOutDate) return 7; // Default to 7 days if no checkout date
  
  try {
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 7;
  } catch {
    return 7;
  }
}


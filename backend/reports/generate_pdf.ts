import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { reportsDB } from "./db";

export interface GeneratePDFRequest {
  type: 'daily' | 'range' | 'monthly' | 'yearly';
  date?: string;
  startDate?: string;
  endDate?: string;
  propertyId?: number;
  data?: any;
}

export interface GeneratePDFResponse {
  success: boolean;
  message: string;
  pdfData?: string; // Base64 encoded PDF
}

// Simple PDF generation using HTML to PDF conversion
export const generatePDF = api<GeneratePDFRequest, GeneratePDFResponse>(
  { auth: true, expose: true, method: "POST", path: "/reports/generate-pdf" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { type, date, startDate, endDate, propertyId, data } = req;

    try {
      // Generate HTML content based on report type
      let htmlContent = '';
      let filename = '';

      if (type === 'daily' && data) {
        htmlContent = generateDailyReportHTML(data, authData.orgId);
        filename = `daily-report-${date}.pdf`;
      } else if (type === 'range' && data && startDate && endDate) {
        htmlContent = generateRangeReportHTML(data, startDate, endDate, authData.orgId);
        filename = `reports-${startDate}-to-${endDate}.pdf`;
      } else {
        throw APIError.invalidArgument("Invalid report type or missing data");
      }

      // For now, return the HTML content as a simple response
      // In a production environment, you would use a library like Puppeteer or jsPDF
      // to convert HTML to actual PDF bytes
      
      return {
        success: true,
        message: "PDF generation initiated",
        pdfData: Buffer.from(htmlContent).toString('base64')
      };

    } catch (error) {
      console.error('PDF generation error:', error);
      throw APIError.internal(`Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

function generateDailyReportHTML(reportData: any, orgId: number): string {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(cents / 100);
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Daily Report - ${reportData.date}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
        .card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .card h3 { margin: 0 0 10px 0; color: #333; }
        .amount { font-size: 24px; font-weight: bold; }
        .positive { color: #059669; }
        .negative { color: #dc2626; }
        .transactions { margin-top: 30px; }
        .transaction { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; }
        .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Daily Financial Report</h1>
        <h2>${reportData.date}</h2>
        ${reportData.propertyName ? `<p><strong>Property:</strong> ${reportData.propertyName}</p>` : ''}
      </div>

      <div class="summary">
        <div class="card">
          <h3>Opening Balance</h3>
          <div class="amount">${formatCurrency(reportData.openingBalanceCents)}</div>
        </div>
        <div class="card">
          <h3>Total Received</h3>
          <div class="amount positive">${formatCurrency(reportData.totalReceivedCents)}</div>
          <p>Cash: ${formatCurrency(reportData.cashReceivedCents)} | Bank: ${formatCurrency(reportData.bankReceivedCents)}</p>
        </div>
        <div class="card">
          <h3>Total Expenses</h3>
          <div class="amount negative">${formatCurrency(reportData.totalExpensesCents)}</div>
          <p>Cash: ${formatCurrency(reportData.cashExpensesCents)} | Bank: ${formatCurrency(reportData.bankExpensesCents)}</p>
        </div>
        <div class="card">
          <h3>Closing Balance</h3>
          <div class="amount ${reportData.closingBalanceCents >= 0 ? 'positive' : 'negative'}">${formatCurrency(reportData.closingBalanceCents)}</div>
          <p>Net Flow: ${formatCurrency(reportData.netCashFlowCents)}</p>
        </div>
      </div>

      ${reportData.transactions && reportData.transactions.length > 0 ? `
        <div class="transactions">
          <h3>Transactions</h3>
          ${reportData.transactions.map((tx: any) => `
            <div class="transaction">
              <div>
                <strong>${tx.type === 'revenue' ? tx.source : tx.category}</strong>
                <br>
                <small>${tx.propertyName} - ${tx.paymentMode}</small>
                ${tx.description ? `<br><small>${tx.description}</small>` : ''}
              </div>
              <div class="${tx.type === 'revenue' ? 'positive' : 'negative'}">
                ${tx.type === 'revenue' ? '+' : '-'}${formatCurrency(tx.amountCents)}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="footer">
        <p>Generated on ${new Date().toLocaleString()}</p>
        <p>HostelExp Management System</p>
      </div>
    </body>
    </html>
  `;
}

function generateRangeReportHTML(reportsData: any[], startDate: string, endDate: string, orgId: number): string {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(cents / 100);
  };

  // Calculate totals
  const totals = reportsData.reduce((acc, report) => ({
    totalOpening: acc.totalOpening + report.openingBalanceCents,
    totalReceived: acc.totalReceived + report.totalReceivedCents,
    totalExpenses: acc.totalExpenses + report.totalExpensesCents,
    totalClosing: acc.totalClosing + report.closingBalanceCents,
    totalNetFlow: acc.totalNetFlow + report.netCashFlowCents,
  }), {
    totalOpening: 0,
    totalReceived: 0,
    totalExpenses: 0,
    totalClosing: 0,
    totalNetFlow: 0,
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Date Range Reports - ${startDate} to ${endDate}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
        .card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .card h3 { margin: 0 0 10px 0; color: #333; }
        .amount { font-size: 24px; font-weight: bold; }
        .positive { color: #059669; }
        .negative { color: #dc2626; }
        .daily-reports { margin-top: 30px; }
        .daily-report { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .daily-report h4 { margin: 0 0 10px 0; color: #333; }
        .daily-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }
        .daily-item { text-align: center; }
        .daily-item .label { font-size: 12px; color: #666; }
        .daily-item .value { font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Date Range Financial Reports</h1>
        <h2>${startDate} to ${endDate}</h2>
      </div>

      <div class="summary">
        <div class="card">
          <h3>Total Opening Balance</h3>
          <div class="amount">${formatCurrency(totals.totalOpening)}</div>
        </div>
        <div class="card">
          <h3>Total Received</h3>
          <div class="amount positive">${formatCurrency(totals.totalReceived)}</div>
        </div>
        <div class="card">
          <h3>Total Expenses</h3>
          <div class="amount negative">${formatCurrency(totals.totalExpenses)}</div>
        </div>
        <div class="card">
          <h3>Total Closing Balance</h3>
          <div class="amount ${totals.totalClosing >= 0 ? 'positive' : 'negative'}">${formatCurrency(totals.totalClosing)}</div>
          <p>Net Flow: ${formatCurrency(totals.totalNetFlow)}</p>
        </div>
      </div>

      <div class="daily-reports">
        <h3>Daily Reports</h3>
        ${reportsData.map((report: any) => `
          <div class="daily-report">
            <h4>${report.date} ${report.propertyName ? `- ${report.propertyName}` : ''}</h4>
            <div class="daily-summary">
              <div class="daily-item">
                <div class="label">Opening</div>
                <div class="value">${formatCurrency(report.openingBalanceCents)}</div>
              </div>
              <div class="daily-item">
                <div class="label">Received</div>
                <div class="value positive">${formatCurrency(report.totalReceivedCents)}</div>
              </div>
              <div class="daily-item">
                <div class="label">Expenses</div>
                <div class="value negative">${formatCurrency(report.totalExpensesCents)}</div>
              </div>
              <div class="daily-item">
                <div class="label">Closing</div>
                <div class="value ${report.closingBalanceCents >= 0 ? 'positive' : 'negative'}">${formatCurrency(report.closingBalanceCents)}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="footer">
        <p>Generated on ${new Date().toLocaleString()}</p>
        <p>HostelExp Management System</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Report Export Delegates
 * Refactored export endpoints that delegate to the documents service
 * Replaces base64-encoded exports with proper document generation pipeline
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { reportsDB } from "./db";
import * as documents from "../documents/encore.service";
import { v1Path } from "../shared/http";

interface ExportResponse {
  exportId: string;
  status: 'queued';
  estimatedSeconds: number;
  statusUrl: string;
  downloadUrl: string;
}

/**
 * Export daily report to PDF
 * Delegates to documents service for rendering
 */
async function exportDailyPdfHandler(req: { propertyId: number; date: string; }): Promise<ExportResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

  const { propertyId, date } = req;
  const orgId = authData.orgId;

  const property = await reportsDB.queryRow<{ name: string }>`
    SELECT name FROM properties 
    WHERE id = ${propertyId} AND org_id = ${orgId}
  `;
  if (!property) {
    throw APIError.notFound("Property not found");
  }

  const org = await reportsDB.queryRow<{ name: string }>`
    SELECT name FROM organizations WHERE id = ${orgId}
  `;

  const reportData = await getDailyReportData(propertyId, date, orgId, property.name, org?.name || 'N/A');

  const exportResponse = await documents.createExport({
    exportType: 'daily-report',
    format: 'pdf',
    data: reportData,
  });
  documents.processExport({ exportId: exportResponse.exportId }).catch(error => {
    console.error('[ReportExport] Failed to process export:', error);
  });

  return {
    exportId: exportResponse.exportId,
    status: exportResponse.status,
    estimatedSeconds: exportResponse.estimatedSeconds,
    statusUrl: `/documents/exports/${exportResponse.exportId}/status`,
    downloadUrl: `/documents/exports/${exportResponse.exportId}/download`,
  };
}

export const exportDailyReportPDFv2 = api<{
  propertyId: number;
  date: string;
}, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/reports/v2/export-daily-pdf" },
  exportDailyPdfHandler
);

export const exportDailyReportPDFV1 = api<{
  propertyId: number;
  date: string;
}, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/reports/export/daily-pdf" },
  exportDailyPdfHandler
);

/**
 * Export daily report to Excel
 */
async function exportDailyExcelHandler(req: { propertyId: number; date: string; }): Promise<ExportResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

  const { propertyId, date } = req;
  const orgId = authData.orgId;

  const property = await reportsDB.queryRow<{ name: string }>`
    SELECT name FROM properties 
    WHERE id = ${propertyId} AND org_id = ${orgId}
  `;
  if (!property) {
    throw APIError.notFound("Property not found");
  }

  const org = await reportsDB.queryRow<{ name: string }>`
    SELECT name FROM organizations WHERE id = ${orgId}
  `;

  const reportData = await getDailyReportData(propertyId, date, orgId, property.name, org?.name || 'N/A');

  const exportResponse = await documents.createExport({
    exportType: 'daily-report',
    format: 'xlsx',
    data: reportData,
  });
  documents.processExport({ exportId: exportResponse.exportId }).catch(error => {
    console.error('[ReportExport] Failed to process export:', error);
  });

  return {
    exportId: exportResponse.exportId,
    status: exportResponse.status,
    estimatedSeconds: exportResponse.estimatedSeconds,
    statusUrl: `/documents/exports/${exportResponse.exportId}/status`,
    downloadUrl: `/documents/exports/${exportResponse.exportId}/download`,
  };
}

export const exportDailyReportExcelv2 = api<{
  propertyId: number;
  date: string;
}, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/reports/v2/export-daily-excel" },
  exportDailyExcelHandler
);

export const exportDailyReportExcelV1 = api<{
  propertyId: number;
  date: string;
}, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/reports/export/daily-excel" },
  exportDailyExcelHandler
);

/**
 * Export monthly report to PDF
 */
async function exportMonthlyPdfHandler(req: { propertyId: number; year: number; month: number; }): Promise<ExportResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

  const { propertyId, year, month } = req;
  const orgId = authData.orgId;

  const property = await reportsDB.queryRow<{ name: string }>`
    SELECT name FROM properties 
    WHERE id = ${propertyId} AND org_id = ${orgId}
  `;
  if (!property) {
    throw APIError.notFound("Property not found");
  }

  const org = await reportsDB.queryRow<{ name: string }>`
    SELECT name FROM organizations WHERE id = ${orgId}
  `;

  const reportData = await getMonthlyReportData(propertyId, year, month, orgId, property.name, org?.name || 'N/A');

  const exportResponse = await documents.createExport({
    exportType: 'monthly-report',
    format: 'pdf',
    data: reportData,
  });
  documents.processExport({ exportId: exportResponse.exportId }).catch(error => {
    console.error('[ReportExport] Failed to process export:', error);
  });

  return {
    exportId: exportResponse.exportId,
    status: exportResponse.status,
    estimatedSeconds: exportResponse.estimatedSeconds,
    statusUrl: `/documents/exports/${exportResponse.exportId}/status`,
    downloadUrl: `/documents/exports/${exportResponse.exportId}/download`,
  };
}

export const exportMonthlyReportPDFv2 = api<{
  propertyId: number;
  year: number;
  month: number;
}, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/reports/v2/export-monthly-pdf" },
  exportMonthlyPdfHandler
);

export const exportMonthlyReportPDFV1 = api<{
  propertyId: number;
  year: number;
  month: number;
}, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/reports/export/monthly-pdf" },
  exportMonthlyPdfHandler
);

/**
 * Export monthly report to Excel
 */
async function exportMonthlyExcelHandler(req: { propertyId: number; year: number; month: number; }): Promise<ExportResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

  const { propertyId, year, month } = req;
  const orgId = authData.orgId;

  const property = await reportsDB.queryRow<{ name: string }>`
    SELECT name FROM properties 
    WHERE id = ${propertyId} AND org_id = ${orgId}
  `;
  if (!property) {
    throw APIError.notFound("Property not found");
  }

  const org = await reportsDB.queryRow<{ name: string }>`
    SELECT name FROM organizations WHERE id = ${orgId}
  `;

  const reportData = await getMonthlyReportData(propertyId, year, month, orgId, property.name, org?.name || 'N/A');

  const exportResponse = await documents.createExport({
    exportType: 'monthly-report',
    format: 'xlsx',
    data: reportData,
  });
  documents.processExport({ exportId: exportResponse.exportId }).catch(error => {
    console.error('[ReportExport] Failed to process export:', error);
  });

  return {
    exportId: exportResponse.exportId,
    status: exportResponse.status,
    estimatedSeconds: exportResponse.estimatedSeconds,
    statusUrl: `/documents/exports/${exportResponse.exportId}/status`,
    downloadUrl: `/documents/exports/${exportResponse.exportId}/download`,
  };
}

export const exportMonthlyReportExcelv2 = api<{
  propertyId: number;
  year: number;
  month: number;
}, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/reports/v2/export-monthly-excel" },
  exportMonthlyExcelHandler
);

export const exportMonthlyReportExcelV1 = api<{
  propertyId: number;
  year: number;
  month: number;
}, ExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/reports/export/monthly-excel" },
  exportMonthlyExcelHandler
);

/**
 * Helper function to fetch daily report data
 * Extracted for reuse by PDF and Excel exports
 */
async function getDailyReportData(
  propertyId: number,
  date: string,
  orgId: number,
  propertyName: string,
  orgName: string
): Promise<any> {
  // Calculate opening balance from all transactions up to previous day
  const previousDate = new Date(date);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateStr = previousDate.toISOString().split('T')[0];

  // First try to get from daily_cash_balances
  const previousBalance = await reportsDB.queryRow<{ closing_balance_cents: string }>`
    SELECT closing_balance_cents 
    FROM daily_cash_balances 
    WHERE org_id = ${orgId} 
      AND property_id = ${propertyId} 
      AND balance_date = ${previousDateStr}
  `;

  let openingBalanceCents = 0;
  
  if (previousBalance) {
    openingBalanceCents = parseInt(previousBalance.closing_balance_cents);
  } else {
    // Calculate from all transactions up to previous day
    const allRevenues = await reportsDB.queryAll<{ amount_cents: string; payment_mode: string }>`
      SELECT amount_cents, payment_mode
      FROM revenues
      WHERE org_id = ${orgId}
        AND property_id = ${propertyId}
        AND occurred_at <= ${previousDateStr}::date + INTERVAL '1 day' - INTERVAL '1 second'
        AND status = 'approved'
    `;
    
    const allExpenses = await reportsDB.queryAll<{ amount_cents: string; payment_mode: string }>`
      SELECT amount_cents, payment_mode
      FROM expenses
      WHERE org_id = ${orgId}
        AND property_id = ${propertyId}
        AND expense_date <= ${previousDateStr}::date
        AND status = 'approved'
    `;
    
    const totalCashRevenue = (allRevenues || [])
      .filter(r => r.payment_mode === 'cash')
      .reduce((sum, r) => sum + parseInt(r.amount_cents), 0);
    
    const totalCashExpenses = (allExpenses || [])
      .filter(e => e.payment_mode === 'cash')
      .reduce((sum, e) => sum + parseInt(e.amount_cents), 0);
    
    openingBalanceCents = totalCashRevenue - totalCashExpenses;
  }

  // Fetch today's transactions
  const revenues = await reportsDB.queryAll<{
    amount_cents: string;
    payment_mode: string;
    description: string;
    occurred_at: Date;
  }>`
    SELECT amount_cents, payment_mode, description, occurred_at
    FROM revenues
    WHERE org_id = ${orgId}
      AND property_id = ${propertyId}
      AND occurred_at >= ${date}::date
      AND occurred_at < ${date}::date + INTERVAL '1 day'
      AND status = 'approved'
  `;

  const expenses = await reportsDB.queryAll<{
    amount_cents: string;
    payment_mode: string;
    description: string;
    expense_date: Date;
  }>`
    SELECT amount_cents, payment_mode, description, expense_date
    FROM expenses
    WHERE org_id = ${orgId}
      AND property_id = ${propertyId}
      AND expense_date = ${date}::date
      AND status = 'approved'
  `;

  // Calculate totals
  const totalReceivedCents = (revenues || [])
    .reduce((sum, r) => sum + parseInt(r.amount_cents), 0);

  const totalExpensesCents = (expenses || [])
    .reduce((sum, e) => sum + parseInt(e.amount_cents), 0);

  const closingBalanceCents = openingBalanceCents + totalReceivedCents - totalExpensesCents;

  // Combine transactions for display with fallback descriptions
  const transactions = [
    ...(revenues || []).map((r, index) => ({
      description: r.description || `Revenue Transaction #${index + 1}`,
      type: 'Revenue',
      paymentMode: r.payment_mode?.toUpperCase() || 'CASH',
      amountCents: parseInt(r.amount_cents),
    })),
    ...(expenses || []).map((e, index) => ({
      description: e.description || `Expense Transaction #${index + 1}`,
      type: 'Expense',
      paymentMode: e.payment_mode?.toUpperCase() || 'CASH',
      amountCents: parseInt(e.amount_cents),
    })),
  ];

  return {
    date,
    propertyId,
    propertyName,
    orgName,
    openingBalanceCents,
    totalReceivedCents,
    totalExpensesCents,
    closingBalanceCents,
    transactions,
    generatedAt: new Date(),
  };
}

/**
 * Helper function to fetch monthly report data
 * Extracted for reuse by PDF and Excel exports
 */
async function getMonthlyReportData(
  propertyId: number,
  year: number,
  month: number,
  orgId: number,
  propertyName: string,
  orgName: string
): Promise<any> {
  // Calculate date range for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get opening balance (last day of previous month)
  const previousMonth = new Date(year, month - 1, 0);
  const previousDateStr = previousMonth.toISOString().split('T')[0];

  const previousBalance = await reportsDB.queryRow<{ closing_balance_cents: string }>`
    SELECT closing_balance_cents 
    FROM daily_cash_balances 
    WHERE org_id = ${orgId} 
      AND property_id = ${propertyId} 
      AND balance_date = ${previousDateStr}
  `;

  let openingBalanceCents = 0;
  
  if (previousBalance) {
    openingBalanceCents = parseInt(previousBalance.closing_balance_cents);
  } else {
    // Calculate from all transactions up to previous month
    const allRevenues = await reportsDB.queryAll<{ amount_cents: string; payment_mode: string }>`
      SELECT amount_cents, payment_mode
      FROM revenues
      WHERE org_id = ${orgId}
        AND property_id = ${propertyId}
        AND occurred_at <= ${previousDateStr}::date + INTERVAL '1 day' - INTERVAL '1 second'
        AND status = 'approved'
    `;
    
    const allExpenses = await reportsDB.queryAll<{ amount_cents: string; payment_mode: string }>`
      SELECT amount_cents, payment_mode
      FROM expenses
      WHERE org_id = ${orgId}
        AND property_id = ${propertyId}
        AND expense_date <= ${previousDateStr}::date
        AND status = 'approved'
    `;
    
    const totalCashRevenue = (allRevenues || [])
      .filter(r => r.payment_mode === 'cash')
      .reduce((sum, r) => sum + parseInt(r.amount_cents), 0);
    
    const totalCashExpenses = (allExpenses || [])
      .filter(e => e.payment_mode === 'cash')
      .reduce((sum, e) => sum + parseInt(e.amount_cents), 0);
    
    openingBalanceCents = totalCashRevenue - totalCashExpenses;
  }

  // Fetch month's revenues
  const revenues = await reportsDB.queryAll<{
    amount_cents: string;
    payment_mode: string;
    description: string;
    occurred_at: Date;
  }>`
    SELECT amount_cents, payment_mode, description, occurred_at
    FROM revenues
    WHERE org_id = ${orgId}
      AND property_id = ${propertyId}
      AND occurred_at >= ${startDateStr}::date
      AND occurred_at < ${endDateStr}::date + INTERVAL '1 day'
      AND status = 'approved'
  `;

  // Fetch month's expenses
  const expenses = await reportsDB.queryAll<{
    amount_cents: string;
    payment_mode: string;
    description: string;
    expense_date: Date;
  }>`
    SELECT amount_cents, payment_mode, description, expense_date
    FROM expenses
    WHERE org_id = ${orgId}
      AND property_id = ${propertyId}
      AND expense_date >= ${startDateStr}::date
      AND expense_date <= ${endDateStr}::date
      AND status = 'approved'
  `;

  // Calculate totals by payment mode
  const cashRevenue = (revenues || [])
    .filter(r => r.payment_mode === 'cash')
    .reduce((sum, r) => sum + parseInt(r.amount_cents), 0);

  const bankRevenue = (revenues || [])
    .filter(r => r.payment_mode === 'bank')
    .reduce((sum, r) => sum + parseInt(r.amount_cents), 0);

  const totalReceivedCents = cashRevenue + bankRevenue;

  const cashExpenses = (expenses || [])
    .filter(e => e.payment_mode === 'cash')
    .reduce((sum, e) => sum + parseInt(e.amount_cents), 0);

  const bankExpenses = (expenses || [])
    .filter(e => e.payment_mode === 'bank')
    .reduce((sum, e) => sum + parseInt(e.amount_cents), 0);

  const totalExpensesCents = cashExpenses + bankExpenses;

  const closingBalanceCents = openingBalanceCents + cashRevenue - cashExpenses;

  return {
    year,
    month,
    propertyId,
    propertyName,
    orgName,
    period: `${year}-${String(month).padStart(2, '0')}`,
    openingBalanceCents,
    cashRevenueCents: cashRevenue,
    bankRevenueCents: bankRevenue,
    totalReceivedCents,
    cashExpensesCents: cashExpenses,
    bankExpensesCents: bankExpenses,
    totalExpensesCents,
    closingBalanceCents,
    totalRevenueTransactions: revenues?.length || 0,
    totalExpenseTransactions: expenses?.length || 0,
    generatedAt: new Date(),
  };
}


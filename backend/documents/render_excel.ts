/**
 * Excel Renderer
 * Uses xlsx library to generate Excel workbooks
 */

import * as XLSX from 'xlsx';
import { RenderContext, RenderResult } from './types';
import { formatCurrency } from './templates/helpers/currency';
import { formatDate } from './templates/helpers/date';

export async function renderExcel(context: RenderContext): Promise<RenderResult> {
  const startTime = Date.now();
  
  try {
    console.log(`[ExcelRenderer] Starting render for ${context.exportType}`);
    
    // Create workbook based on export type
    let workbook: XLSX.WorkBook;
    
    switch (context.exportType) {
      case 'daily-report':
        workbook = createDailyReportWorkbook(context.data);
        break;
      case 'monthly-report':
        workbook = createMonthlyReportWorkbook(context.data);
        break;
      case 'staff-leave':
        workbook = createStaffLeaveWorkbook(context.data);
        break;
      case 'staff-attendance':
        workbook = createStaffAttendanceWorkbook(context.data);
        break;
      case 'staff-salary':
        workbook = createStaffSalaryWorkbook(context.data);
        break;
      default:
        throw new Error(`Unsupported export type for Excel: ${context.exportType}`);
    }
    
    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true,
    });
    
    const duration = Date.now() - startTime;
    console.log(`[ExcelRenderer] Completed in ${duration}ms, size: ${excelBuffer.length} bytes`);
    
    return {
      buffer: excelBuffer,
      fileSizeBytes: excelBuffer.length,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ExcelRenderer] Failed after ${duration}ms:`, error);
    throw new Error(`Excel rendering failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function createDailyReportWorkbook(data: any): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  
  // Summary Sheet
  const summaryData = [
    ['DAILY CASH BALANCE REPORT'],
    [''],
    ['Report Information'],
    ['Organization', data.orgName || 'N/A'],
    ['Property', data.propertyName || 'N/A'],
    ['Date', formatDate(data.date, 'long')],
    ['Generated', formatDate(data.generatedAt, 'datetime')],
    [''],
    ['Financial Summary'],
    ['Opening Balance', formatCurrency(data.openingBalanceCents || 0)],
    ['Total Revenue', formatCurrency(data.totalReceivedCents || 0)],
    ['Total Expenses', formatCurrency(data.totalExpensesCents || 0)],
    ['Closing Balance', formatCurrency(data.closingBalanceCents || 0)],
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ width: 25 }, { width: 20 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Transactions Sheet
  if (data.transactions && data.transactions.length > 0) {
    const transactionData = [
      ['TRANSACTION DETAILS'],
      [''],
      ['Description', 'Type', 'Payment Mode', 'Amount']
    ];
    
    data.transactions.forEach((tx: any) => {
      transactionData.push([
        tx.description || 'No description',
        tx.type || 'N/A',
        tx.paymentMode || 'N/A',
        (tx.amountCents / 100).toFixed(2)
      ]);
    });
    
    const transactionSheet = XLSX.utils.aoa_to_sheet(transactionData);
    transactionSheet['!cols'] = [{ width: 35 }, { width: 12 }, { width: 15 }, { width: 15 }];
    XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transactions');
  }
  
  return workbook;
}

function createMonthlyReportWorkbook(data: any): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  
  // Summary Sheet (simplified for now)
  const summaryData = [
    ['MONTHLY CASH BALANCE REPORT'],
    ['Property', data.propertyName || 'N/A'],
    ['Period', `${data.month}/${data.year}`],
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  return workbook;
}

function createStaffLeaveWorkbook(data: any): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  
  const leaveData = [
    ['STAFF LEAVE RECORDS'],
    [''],
    ['Staff Name', 'Leave Type', 'Start Date', 'End Date', 'Status']
  ];
  
  if (data.records) {
    data.records.forEach((record: any) => {
      leaveData.push([
        record.staffName || 'N/A',
        record.leaveType || 'N/A',
        formatDate(record.startDate, 'short'),
        formatDate(record.endDate, 'short'),
        record.status || 'N/A'
      ]);
    });
  }
  
  const leaveSheet = XLSX.utils.aoa_to_sheet(leaveData);
  leaveSheet['!cols'] = [{ width: 25 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 12 }];
  XLSX.utils.book_append_sheet(workbook, leaveSheet, 'Leave Records');
  
  return workbook;
}

function createStaffAttendanceWorkbook(data: any): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  
  const attendanceData = [
    ['STAFF ATTENDANCE RECORDS'],
    [''],
    ['Staff Name', 'Date', 'Check In', 'Check Out', 'Status']
  ];
  
  if (data.records) {
    data.records.forEach((record: any) => {
      attendanceData.push([
        record.staffName || 'N/A',
        formatDate(record.date, 'short'),
        record.checkIn || 'N/A',
        record.checkOut || 'N/A',
        record.status || 'N/A'
      ]);
    });
  }
  
  const attendanceSheet = XLSX.utils.aoa_to_sheet(attendanceData);
  attendanceSheet['!cols'] = [{ width: 25 }, { width: 15 }, { width: 12 }, { width: 12 }, { width: 12 }];
  XLSX.utils.book_append_sheet(workbook, attendanceSheet, 'Attendance');
  
  return workbook;
}

function createStaffSalaryWorkbook(data: any): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  
  const salaryData = [
    ['STAFF SALARY RECORDS'],
    [''],
    ['Staff Name', 'Period', 'Base Salary', 'Deductions', 'Net Pay']
  ];
  
  if (data.records) {
    data.records.forEach((record: any) => {
      salaryData.push([
        record.staffName || 'N/A',
        `${formatDate(record.periodStart, 'short')} - ${formatDate(record.periodEnd, 'short')}`,
        formatCurrency(record.baseSalaryCents || 0),
        formatCurrency(record.deductionCents || 0),
        formatCurrency(record.netPayCents || 0)
      ]);
    });
  }
  
  const salarySheet = XLSX.utils.aoa_to_sheet(salaryData);
  salarySheet['!cols'] = [{ width: 25 }, { width: 25 }, { width: 15 }, { width: 15 }, { width: 15 }];
  XLSX.utils.book_append_sheet(workbook, salarySheet, 'Salary Records');
  
  return workbook;
}


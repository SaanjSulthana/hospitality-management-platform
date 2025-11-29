import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatCurrency as formatCurrencyUtil } from '../../lib/currency';
import { formatCardDateTime } from '../../lib/datetime';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Input } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { useToast } from './use-toast';
import { API_CONFIG } from '../../src/config/api';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Building2,
  Download,
  Eye,
  Plus,
  RefreshCw,
  CreditCard,
  Banknote,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  Edit3,
  Save,
  X,
  BarChart3
} from 'lucide-react';

interface DailyReport {
  date: string;
  propertyId?: number;
  propertyName?: string;
  openingBalanceCents: number;
  cashReceivedCents: number;
  bankReceivedCents: number;
  totalReceivedCents: number;
  cashExpensesCents: number;
  bankExpensesCents: number;
  totalExpensesCents: number;
  closingBalanceCents: number;
  netCashFlowCents: number;
  transactions: any[];
  remarks?: string;
}

interface Property {
  id: number;
  name: string;
}

interface LiveTransactionData {
    cashReceivedCents: number;
    bankReceivedCents: number;
    cashExpensesCents: number;
    bankExpensesCents: number;
}

// Helper function to format currency
const formatCurrency = (cents: number): string => {
  return formatCurrencyUtil(cents);
};

// Helper function to generate date range for current month
const generateDateRange = (date: string): string[] => {
  const currentDate = new Date(date);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Get all days of the current month from 1st to last day
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dateRange: string[] = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    dateRange.push(dateStr);
  }
  
  return dateRange;
};

// Helper function to generate all dates in a month
const generateAllDatesInMonth = (year: number, month: number): string[] => {
  const daysInMonth = new Date(year, month, 0).getDate(); // month is 1-based
  const dates: string[] = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = new Date(year, month - 1, day).toISOString().split('T')[0]; // month - 1 because Date constructor is 0-based
    dates.push(dateStr);
  }
  
  return dates;
};

// Helper function to check if a date is today
const isToday = (dateStr: string): boolean => {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
};

// Helper function to format date for display
const formatDateForDisplay = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    return 'Invalid Date';
  }
};


// Financial Summary Cards Component
interface FinancialSummaryCardsProps {
  propertyId: number;
  startDate: string;
  endDate: string;
  orgId: number;
}

function FinancialSummaryCards({ propertyId, startDate, endDate, orgId }: FinancialSummaryCardsProps) {
  const { getAuthenticatedBackend } = useAuth();
  const { theme } = useTheme();
  
  const formatCurrency = (amountCents: number) => {
    return formatCurrencyUtil(amountCents, theme.currency);
  };

  // Fetch financial summary data using the existing profit-loss API
  const { data: financialSummary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['profit-loss', propertyId, startDate, endDate, orgId],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.reports.getMonthlyYearlyReport({
        propertyId: propertyId,
        startDate: startDate,
        endDate: endDate,
      });
    },
    enabled: !!propertyId && !!startDate && !!endDate && !!orgId,
    staleTime: 30000,
    gcTime: 600000,
  });

  if (isLoadingSummary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-l-4 border-l-gray-300 shadow-sm">
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!financialSummary?.data) {
    return null;
  }

  const { data } = financialSummary;
  const profitMargin = data.totalRevenue > 0 
    ? ((data.netIncome / data.totalRevenue) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {/* Total Revenue */}
      <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded-lg shadow-sm">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            Total Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(data.totalRevenue * 100)}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Total revenue for the period
          </p>
        </CardContent>
      </Card>

      {/* Total Expenses */}
      <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="p-2 bg-red-100 rounded-lg shadow-sm">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            Total Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(data.totalExpenses * 100)}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Total expenses for the period
          </p>
        </CardContent>
      </Card>

      {/* Net Income */}
      <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </div>
            Net Income
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(data.netIncome * 100)}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Net income for the period
          </p>
        </CardContent>
      </Card>

      {/* Profit Margin */}
      <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg shadow-sm">
              <Receipt className="h-4 w-4 text-purple-600" />
            </div>
            Profit Margin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {profitMargin.toFixed(1)}%
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Based on total revenue and expenses
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Monthly Report Spreadsheet Component
interface MonthlyReportSpreadsheetProps {
  year: number;
  month: number;
  propertyId: number;
  orgId: number;
}

function MonthlyReportSpreadsheet({ year, month, propertyId, orgId }: MonthlyReportSpreadsheetProps) {
  const { getAuthenticatedBackend } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for refresh control
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  
  // Manual refresh function
  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['monthly-report', propertyId, year, month, orgId] });
    setLastRefreshTime(new Date());
  };
  

  // Monthly report data query with real-time updates
  const { data: monthlyReportData, isLoading: isLoadingMonthlyData, error: monthlyDataError, dataUpdatedAt } = useQuery({
    queryKey: ['monthly-report', propertyId, year, month, orgId],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      console.log('MonthlyReportSpreadsheet: Fetching monthly data for:', { propertyId, year, month, orgId });
      
      // Use the new monthly report API
      const response = await backend.reports.getMonthlyReport({
        propertyId,
        year,
        month,
      });
      
      console.log('MonthlyReportSpreadsheet: Monthly data:', response);
      return response;
    },
    staleTime: 25000, // Match Finance pattern
    gcTime: 300000, // 5 minutes
    refetchInterval: false, // Rely on realtime events from RealtimeProvider
    refetchOnMount: true, // Refresh when component mounts
    refetchOnReconnect: true, // Refresh when network reconnects
    onSuccess: () => {
      try {
        const last = (window as any).__reportsLastInvalidateAt;
        if (!last) return;
        const key = `monthly|${propertyId}|${year}-${month}`;
        const started = last[key];
        if (started) {
          const ms = Date.now() - started;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[ReportsTelemetry] monthly refetch duration ms:', ms, { propertyId, year, month });
          }
          if (Math.random() < 0.02) {
            fetch(`${API_CONFIG.BASE_URL}/telemetry/client`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sampleRate: 0.02,
                events: [{
                  type: 'reports_refetch_ms',
                  ts: new Date().toISOString(),
                  scope: 'monthly',
                  ms,
                  propertyId, year, month,
                }],
              }),
            }).catch(() => {});
          }
        }
      } catch {}
    }
  });


  // Calculate values from monthly data
  const openingBalanceCents = monthlyReportData?.openingBalanceCents || 0;
  const cashReceivedCents = monthlyReportData?.totalCashReceivedCents || 0;
  const bankReceivedCents = monthlyReportData?.totalBankReceivedCents || 0;
  const totalCashCents = openingBalanceCents + cashReceivedCents;
  const cashExpensesCents = monthlyReportData?.totalCashExpensesCents || 0;
  const bankExpensesCents = monthlyReportData?.totalBankExpensesCents || 0;
  const closingBalanceCents = monthlyReportData?.closingBalanceCents || 0;

  const monthlyTotalRevenue = cashReceivedCents + bankReceivedCents;
  const monthlyTotalExpenses = cashExpensesCents + bankExpensesCents;
  const monthlyNetIncome = monthlyReportData?.netCashFlowCents || 0;



  // Handle export to Excel with loading state
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportToExcel = async () => {
    setIsExportingExcel(true);
    try {
      const token = localStorage.getItem('accessToken');
      
      // Step 1: Create export using new v2 endpoint
      const response = await fetch(`${API_CONFIG.BASE_URL}/reports/v2/export-monthly-excel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId,
          year,
          month,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const { exportId, statusUrl } = result;

      // Step 2: Poll for status
      toast({
        title: "Generating Excel",
        description: "Your export is being processed...",
      });

      const pollStatus = async (): Promise<any> => {
        const statusResponse = await fetch(`${API_CONFIG.BASE_URL}${statusUrl}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (!statusResponse.ok) {
          throw new Error('Failed to check export status');
        }
        
        return statusResponse.json();
      };

      // Poll until ready
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max
      
      while (attempts < maxAttempts) {
        const status = await pollStatus();
        
        if (status.status === 'ready') {
          // Step 3: Download with authentication
          const downloadResponse = await fetch(`${API_CONFIG.BASE_URL}/documents/exports/${exportId}/download`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!downloadResponse.ok) {
            throw new Error('Failed to download file');
          }

          // Get the JSON response with base64 data
          const downloadData = await downloadResponse.json();
          
          // Decode base64 and create blob
          const binaryString = atob(downloadData.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: downloadData.mimeType });

          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = downloadData.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          toast({
            title: "Excel Ready",
            description: "Monthly report Excel has been downloaded.",
          });
          break;
        } else if (status.status === 'failed') {
          throw new Error(status.errorMessage || 'Export failed');
        }
        
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Export timeout - please try again');
      }
    } catch (error: any) {
      console.error('Excel export error:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export Excel. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Handle export to PDF with loading state
  const handleExportToPDF = async () => {
    setIsExportingPDF(true);
    try {
      const token = localStorage.getItem('accessToken');
      
      // Step 1: Create export using new v2 endpoint
      const response = await fetch(`${API_CONFIG.BASE_URL}/reports/v2/export-monthly-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId,
          year,
          month,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const { exportId, statusUrl } = result;

      // Step 2: Poll for status
      toast({
        title: "Generating PDF",
        description: "Your export is being processed...",
      });

      const pollStatus = async (): Promise<any> => {
        const statusResponse = await fetch(`${API_CONFIG.BASE_URL}${statusUrl}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (!statusResponse.ok) {
          throw new Error('Failed to check export status');
        }
        
        return statusResponse.json();
      };

      // Poll until ready
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max
      
      while (attempts < maxAttempts) {
        const status = await pollStatus();
        
        if (status.status === 'ready') {
          // Step 3: Download with authentication
          const downloadResponse = await fetch(`${API_CONFIG.BASE_URL}/documents/exports/${exportId}/download`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!downloadResponse.ok) {
            throw new Error('Failed to download file');
          }

          // Get the JSON response with base64 data
          const downloadData = await downloadResponse.json();
          
          // Decode base64 and create blob
          const binaryString = atob(downloadData.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: downloadData.mimeType });

          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = downloadData.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          toast({
            title: "PDF Ready",
            description: "Monthly report PDF has been downloaded.",
          });
          break;
        } else if (status.status === 'failed') {
          throw new Error(status.errorMessage || 'Export failed');
        }
        
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Export timeout - please try again');
      }
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const currentMonth = `${monthNames[month - 1]} ${year}`;
  const currentDate = new Date();
  const isCurrentMonth = currentDate.getFullYear() === year && currentDate.getMonth() + 1 === month;

  if (isLoadingMonthlyData) {
    return (
      <Card className="border-l-4 border-l-blue-500 shadow-sm">
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">Loading monthly report data...</p>
            <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your financial data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (monthlyDataError) {
    return (
      <Card className="border-l-4 border-l-red-500 shadow-sm">
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-lg font-medium text-red-900 mb-2">Error Loading Data</p>
            <p className="text-sm text-gray-600 mb-4">{monthlyDataError.message}</p>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['monthly-report'] })}
              className="bg-white border-rose-200 text-red-700 hover:bg-rose-50 hover:border-rose-300 font-semibold"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Export Actions */}
      <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                <Receipt className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-gray-900">
                  Monthly Cash Balance Report
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  {currentMonth}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">Property ID</div>
                <div className="text-lg font-bold text-blue-600">#{propertyId}</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              onClick={handleExportToExcel} 
              variant="outline"
              disabled={isExportingExcel}
              className="transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              {isExportingExcel ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              <span className="hidden sm:inline">{isExportingExcel ? 'Generating...' : 'Export Excel'}</span>
              <span className="sm:hidden">Excel</span>
            </Button>
            <Button 
              onClick={handleExportToPDF} 
              variant="outline"
              disabled={isExportingPDF}
              className="transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              {isExportingPDF ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              <span className="hidden sm:inline">{isExportingPDF ? 'Generating...' : 'Export PDF'}</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* Monthly Spreadsheet Table */}
      <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            Monthly Cash Balance Spreadsheet
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live</span>
          </CardTitle>
          <CardDescription className="text-sm text-gray-600">
            Daily cash flow breakdown for {currentMonth} with monthly totals
            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              Scroll to view all dates
            </span>
            {dataUpdatedAt && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="text-left px-2 py-4 border-b-2 border-gray-300 font-semibold text-gray-900 text-sm bg-gray-50 sticky top-0 w-16">Date</th>
                  <th className="text-right px-3 py-4 border-b-2 border-gray-300 font-semibold text-gray-900 text-sm bg-gray-50 sticky top-0 w-28">Cash Rev</th>
                  <th className="text-right px-3 py-4 border-b-2 border-gray-300 font-semibold text-gray-900 text-sm bg-gray-50 sticky top-0 w-28">Bank Rev</th>
                  <th className="text-right px-3 py-4 border-b-2 border-gray-300 font-semibold text-gray-900 text-sm bg-gray-50 sticky top-0 w-28">Total Rev</th>
                  <th className="text-right px-3 py-4 border-b-2 border-gray-300 font-semibold text-gray-900 text-sm bg-gray-50 sticky top-0 w-28">Cash Exp</th>
                  <th className="text-right px-3 py-4 border-b-2 border-gray-300 font-semibold text-gray-900 text-sm bg-gray-50 sticky top-0 w-28">Bank Exp</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Generate all dates in the month
                  const allDates = generateAllDatesInMonth(year, month);
                  
                  // Create a map of daily reports by date for quick lookup
                  const dailyReportsMap = new Map<string, any>();
                  if (monthlyReportData?.dailyReports) {
                    monthlyReportData.dailyReports.forEach((report: any) => {
                      dailyReportsMap.set(report.date, report);
                    });
                  }
                  
                  return allDates.map((dateStr) => {
                    const dailyReport = dailyReportsMap.get(dateStr);
                    const isCurrentDay = isToday(dateStr);
                    
                    return (
                      <tr 
                        key={dateStr}
                        className={`${isCurrentDay ? 'bg-green-50 hover:bg-green-100 border-l-4 border-l-green-500' : 'bg-white hover:bg-gray-50'} transition-colors border-b border-gray-200`}
                      >
                        <td className="px-2 py-4 border-b font-medium text-sm w-16">
                          <div className="flex items-center gap-1">
                            <span className={isCurrentDay ? 'text-green-700 font-semibold' : 'text-gray-900'}>
                              {formatDateForDisplay(dateStr)}
                            </span>
                            {isCurrentDay && (
                              <span className="text-xs bg-green-600 text-white px-1 py-0.5 rounded-full font-medium">
                                Today
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4 border-b text-green-600 font-medium text-sm text-right w-28 tabular-nums">
                          {formatCurrency(dailyReport?.cashReceivedCents || 0)}
                        </td>
                        <td className="px-3 py-4 border-b text-blue-600 text-sm text-right w-28 tabular-nums">
                          {formatCurrency(dailyReport?.bankReceivedCents || 0)}
                        </td>
                        <td className="px-3 py-4 border-b text-gray-900 font-medium text-sm text-right w-28 tabular-nums">
                          {formatCurrency((dailyReport?.cashReceivedCents || 0) + (dailyReport?.bankReceivedCents || 0))}
                        </td>
                        <td className="px-3 py-4 border-b text-red-600 font-medium text-sm text-right w-28 tabular-nums">
                          {formatCurrency(dailyReport?.cashExpensesCents || 0)}
                        </td>
                        <td className="px-3 py-4 border-b text-orange-600 text-sm text-right w-28 tabular-nums">
                          {formatCurrency(dailyReport?.bankExpensesCents || 0)}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
              <tfoot className="bg-gray-100 sticky bottom-0 z-20 shadow-lg">
                <tr className="border-t-2 border-gray-400">
                  <td className="px-2 py-4 font-bold text-sm text-gray-900 bg-gray-100 sticky bottom-0 w-16">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-900 font-bold">
                        {currentMonth} Total
                      </span>
                      <span className="text-xs bg-blue-600 text-white px-1 py-0.5 rounded-full font-medium">
                        Monthly
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4 font-bold text-sm text-green-600 bg-gray-100 sticky bottom-0 text-right w-28 tabular-nums">
                    {formatCurrency(cashReceivedCents)}
                  </td>
                  <td className="px-3 py-4 font-bold text-sm text-blue-600 bg-gray-100 sticky bottom-0 text-right w-28 tabular-nums">
                    {formatCurrency(bankReceivedCents)}
                  </td>
                  <td className="px-3 py-4 font-bold text-sm text-gray-900 bg-gray-100 sticky bottom-0 text-right w-28 tabular-nums">
                    {formatCurrency(monthlyTotalRevenue)}
                  </td>
                  <td className="px-3 py-4 font-bold text-sm text-red-600 bg-gray-100 sticky bottom-0 text-right w-28 tabular-nums">
                    {formatCurrency(cashExpensesCents)}
                  </td>
                  <td className="px-3 py-4 font-bold text-sm text-orange-600 bg-gray-100 sticky bottom-0 text-right w-28 tabular-nums">
                    {formatCurrency(bankExpensesCents)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-2 text-center">
            <div className="inline-flex items-center gap-2 text-xs text-gray-500">
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
              <span>Scroll to view all {generateAllDatesInMonth(year, month).length} days</span>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Enhanced Financial Summary Cards - Monthly Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Monthly Total Revenue */}
        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(monthlyTotalRevenue)}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Total revenue for {currentMonth}
            </p>
          </CardContent>
        </Card>

        {/* Monthly Total Expenses */}
        <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-lg shadow-sm">
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
              Monthly Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(monthlyTotalExpenses)}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Total expenses for {currentMonth}
            </p>
          </CardContent>
        </Card>

        {/* Monthly Net Income */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                <BarChart3 className="h-4 w-4 text-blue-600" />
              </div>
              Monthly Net Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthlyNetIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(monthlyNetIncome)}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Net income for {currentMonth}
            </p>
          </CardContent>
        </Card>

        {/* Monthly Profit Margin */}
        <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg shadow-sm">
                <Receipt className="h-4 w-4 text-purple-600" />
              </div>
              Monthly Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthlyTotalRevenue > 0 ? (monthlyNetIncome >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-600'}`}>
              {monthlyTotalRevenue > 0 ? ((monthlyNetIncome / monthlyTotalRevenue) * 100).toFixed(1) : '0.0'}%
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Based on monthly revenue and expenses
            </p>
          </CardContent>
        </Card>
      </div>

                            </div>
  );
}

// Main Daily Reports Manager Component
interface DailyReportsManagerProps {
  onOpenDailyReportManager?: (propertyId: number, date: string) => void;
}

export function DailyReportsManager({ onOpenDailyReportManager }: DailyReportsManagerProps) {
  const { getAuthenticatedBackend, user } = useAuth();
  const { theme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);

  // Fetch properties
  const { data: propertiesData, isLoading: isLoadingProperties, error: propertiesError } = useQuery({
    queryKey: ['properties', user?.orgId],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      console.log('Fetching properties for orgId:', user?.orgId);
      const response = await backend.properties.list({ orgId: user?.orgId || 0 });
      console.log('Properties response:', response);
      return response.properties || [];
    },
    enabled: !!user?.orgId,
  });

  // Update properties state when data is fetched
  useEffect(() => {
    if (propertiesData) {
      setProperties(propertiesData);
      if (propertiesData.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(propertiesData[0].id);
      }
    }
  }, [propertiesData, selectedPropertyId]);

  if (isLoadingProperties) {
    return (
      <Card className="border-l-4 border-l-blue-500 shadow-sm">
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">Loading properties...</p>
            <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your property data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (propertiesError) {
    return (
      <Card className="border-l-4 border-l-red-500 shadow-sm">
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-lg font-medium text-red-900 mb-2">Error Loading Properties</p>
            <p className="text-sm text-gray-600 mb-4">{propertiesError.message}</p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="bg-white border-rose-200 text-red-700 hover:bg-rose-50 hover:border-rose-300 font-semibold"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedPropertyId || properties.length === 0) {
    return (
      <Card className="border-l-4 border-l-blue-500 shadow-sm">
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">No Properties Available</p>
            <p className="text-sm text-gray-600">Please create a property first to view daily reports.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Property and Date Selection */}
      <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            Monthly Spreadsheet
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live</span>
          </CardTitle>
          <CardDescription className="text-sm text-gray-600">
            View and manage monthly cash balance reports for your properties
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="space-y-2 flex-1 min-w-0">
              <Label htmlFor="property-select" className="text-sm font-medium text-gray-700">Property</Label>
              <Select
                value={selectedPropertyId?.toString() || ''}
                onValueChange={(value) => setSelectedPropertyId(parseInt(value))}
              >
                <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id.toString()}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1 items-end">
              <div className="space-y-2">
                <Label htmlFor="month-select" className="text-sm font-medium text-gray-700">Month</Label>
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(value) => setSelectedMonth(parseInt(value))}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 w-32">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ].map((month, index) => (
                      <SelectItem key={index + 1} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year-select" className="text-sm font-medium text-gray-700">Year</Label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 w-24">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Report Spreadsheet */}
      {selectedPropertyId && (
        <MonthlyReportSpreadsheet
          year={selectedYear}
          month={selectedMonth}
          propertyId={selectedPropertyId}
          orgId={user?.orgId || 0}
        />
      )}
    </div>
  );
}

export default DailyReportsManager;

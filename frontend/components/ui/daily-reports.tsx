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
  X
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


// Daily Report Spreadsheet Component
interface DailyReportSpreadsheetProps {
  date: string;
  propertyId: number;
  orgId: number;
}

function DailyReportSpreadsheet({ date, propertyId, orgId }: DailyReportSpreadsheetProps) {
  const { getAuthenticatedBackend } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for refresh control
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds default
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  

  // Live transaction data query - using real Finance data
  const { data: liveTransactionData, isLoading: isLoadingLiveData, error: liveDataError } = useQuery({
    queryKey: ['live-transaction-data', propertyId, date, orgId],
    queryFn: async (): Promise<LiveTransactionData> => {
      const backend = getAuthenticatedBackend();
      console.log('DailyReportSpreadsheet: Fetching real Finance data for:', { propertyId, date, orgId });
      
      // Fetch real Finance data (same as popup)
      const [revenuesResponse, expensesResponse] = await Promise.all([
        backend.finance.listRevenues({
          propertyId,
          startDate: date,
          endDate: date,
          orgId
        }),
        backend.finance.listExpenses({
          propertyId,
          startDate: date,
          endDate: date,
          orgId
        })
      ]);

      console.log('DailyReportSpreadsheet: Revenues:', revenuesResponse);
      console.log('DailyReportSpreadsheet: Expenses:', expensesResponse);
      
      // Calculate real values from Finance data
      const cashReceivedCents = (revenuesResponse.revenues || [])
        .filter((r: any) => r.paymentMode === 'cash')
        .reduce((sum: number, r: any) => sum + r.amountCents, 0);
      
      const bankReceivedCents = (revenuesResponse.revenues || [])
        .filter((r: any) => r.paymentMode === 'bank')
        .reduce((sum: number, r: any) => sum + r.amountCents, 0);
      
      const cashExpensesCents = (expensesResponse.expenses || [])
        .filter((e: any) => e.paymentMode === 'cash')
        .reduce((sum: number, e: any) => sum + e.amountCents, 0);
      
      const bankExpensesCents = (expensesResponse.expenses || [])
        .filter((e: any) => e.paymentMode === 'bank')
        .reduce((sum: number, e: any) => sum + e.amountCents, 0);

      const result = {
        cashReceivedCents,
        bankReceivedCents,
        cashExpensesCents,
        bankExpensesCents,
      };
      
      console.log('DailyReportSpreadsheet: Calculated values:', result);
      return result;
    },
    refetchInterval: refreshInterval,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 600000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Previous day balance query - using real Finance data
  const { data: previousDayData } = useQuery({
    queryKey: ['previous-day-balance', propertyId, date, orgId],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      try {
        console.log('DailyReportSpreadsheet: Calculating previous day balance for:', yesterdayStr);
        
        // Get previous day's transactions to calculate closing balance
        const [prevRevenuesResponse, prevExpensesResponse] = await Promise.all([
          backend.finance.listRevenues({
            propertyId,
            startDate: yesterdayStr,
            endDate: yesterdayStr,
            orgId
          }),
          backend.finance.listExpenses({
            propertyId,
            startDate: yesterdayStr,
            endDate: yesterdayStr,
            orgId
          })
        ]);
        
        // Calculate previous day's closing balance
        const prevCashRevenue = (prevRevenuesResponse.revenues || [])
          .filter((r: any) => r.paymentMode === 'cash')
          .reduce((sum: number, r: any) => sum + r.amountCents, 0);
        
        const prevCashExpenses = (prevExpensesResponse.expenses || [])
          .filter((e: any) => e.paymentMode === 'cash')
          .reduce((sum: number, e: any) => sum + e.amountCents, 0);
        
        // Assume previous day's opening balance was 0 for calculation
        const prevOpeningBalance = 0;
        const prevClosingBalance = prevOpeningBalance + prevCashRevenue - prevCashExpenses;
        
        console.log('DailyReportSpreadsheet: Previous day closing balance:', prevClosingBalance);
        return { closingBalanceCents: prevClosingBalance };
      } catch (error) {
        console.error('DailyReportSpreadsheet: Error calculating previous day balance:', error);
        return { closingBalanceCents: 0 };
      }
    },
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });

  // Historical data query
  const { data: historicalData } = useQuery({
    queryKey: ['historical-daily-data', propertyId, date],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      const dateRange = generateDateRange(date);
      const startDate = dateRange[0];
      const endDate = dateRange[dateRange.length - 1];
      
      const response = await backend.reports.getDailyReports({
        propertyId,
        startDate,
        endDate,
        orgId
      });
      
      return response.reports || [];
    },
    staleTime: 600000, // 10 minutes
    gcTime: 1800000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Calculate values
  const openingBalanceCents = previousDayData?.closingBalanceCents || 0;
  const cashReceivedCents = liveTransactionData?.cashReceivedCents || 0;
  const bankReceivedCents = liveTransactionData?.bankReceivedCents || 0;
  const totalCashCents = openingBalanceCents + cashReceivedCents;
  const cashExpensesCents = liveTransactionData?.cashExpensesCents || 0;
  const bankExpensesCents = liveTransactionData?.bankExpensesCents || 0;
  const closingBalanceCents = totalCashCents - cashExpensesCents;

  // Update balance mutation
  const updateBalanceMutation = useMutation({
    mutationFn: async (data: { openingBalanceCents?: number; closingBalanceCents?: number; remarks?: string }) => {
      const backend = getAuthenticatedBackend();
      return await backend.reports.updateDailyCashBalanceSmart({
        propertyId,
        date,
        orgId,
        openingBalanceCents: data.openingBalanceCents,
        closingBalanceCents: data.closingBalanceCents,
        remarks: data.remarks,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-transaction-data'] });
      queryClient.invalidateQueries({ queryKey: ['previous-day-balance'] });
      queryClient.invalidateQueries({ queryKey: ['historical-daily-data'] });
      toast({
        title: "Balance Updated",
        description: "Daily cash balance has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update daily cash balance.",
        variant: "destructive",
      });
    },
  });

  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['live-transaction-data'] }),
        queryClient.invalidateQueries({ queryKey: ['previous-day-balance'] }),
        queryClient.invalidateQueries({ queryKey: ['historical-daily-data'] }),
      ]);
      setLastRefreshTime(new Date());
    } finally {
      setIsManualRefreshing(false);
    }
  };

  // Handle save balance
  const handleSaveBalance = async () => {
    await updateBalanceMutation.mutateAsync({
      openingBalanceCents,
      closingBalanceCents,
    });
  };

  // Handle export to Excel with loading state
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportToExcel = async () => {
    setIsExportingExcel(true);
    try {
      // Use direct fetch call since the client hasn't been regenerated yet
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_CONFIG.BASE_URL}/reports/export-daily-excel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId,
          date,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Create download link
      const link = document.createElement('a');
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.excelData}`;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Excel Exported",
        description: "Daily report Excel file has been downloaded successfully.",
      });
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
      // Use direct fetch call since the client hasn't been regenerated yet
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_CONFIG.BASE_URL}/reports/export-daily-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId,
          date,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Create download link
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${result.pdfData}`;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "PDF Exported",
        description: "Daily report PDF has been downloaded successfully.",
      });
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

  const dateRange = generateDateRange(date);
  const currentMonth = new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const fullDate = new Date(date).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  if (isLoadingLiveData) {
    return (
      <Card className="border-l-4 border-l-blue-500 shadow-sm">
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">Loading daily report data...</p>
            <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your financial data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (liveDataError) {
    return (
      <Card className="border-l-4 border-l-red-500 shadow-sm">
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-lg font-medium text-red-900 mb-2">Error Loading Data</p>
            <p className="text-sm text-gray-600 mb-4">{liveDataError.message}</p>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['live-transaction-data'] })}
              className="border-red-300 text-red-700 hover:bg-red-50"
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
      {/* Header */}
      <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                <Receipt className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-gray-900">
                  Daily Cash Balance Report
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  {fullDate} • Property #{propertyId}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={refreshInterval.toString()}
                onValueChange={(value) => setRefreshInterval(parseInt(value))}
              >
                <SelectTrigger className="w-20 h-9 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10000">10s</SelectItem>
                  <SelectItem value="30000">30s</SelectItem>
                  <SelectItem value="60000">1m</SelectItem>
                  <SelectItem value="0">Off</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isManualRefreshing}
                className="h-9 transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                <RefreshCw className={`h-4 w-4 ${isManualRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Actions */}
      <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-4">
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
            <Button 
              onClick={handleSaveBalance} 
              disabled={updateBalanceMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              {updateBalanceMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              <span className="hidden sm:inline">Save Balance</span>
              <span className="sm:hidden">Save</span>
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* Standard Spreadsheet Table */}
      <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            Daily Cash Balance Spreadsheet
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live</span>
          </CardTitle>
          <CardDescription className="text-sm text-gray-600">
            Real-time cash flow tracking with automatic carry-forward calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 border-b font-semibold text-gray-900 text-sm">Date</th>
                  <th className="text-left p-3 border-b font-semibold text-gray-900 text-sm">Opening</th>
                  <th className="text-left p-3 border-b font-semibold text-gray-900 text-sm">Cash Rev</th>
                  <th className="text-left p-3 border-b font-semibold text-gray-900 text-sm">Bank Rev</th>
                  <th className="text-left p-3 border-b font-semibold text-gray-900 text-sm">Total Cash</th>
                  <th className="text-left p-3 border-b font-semibold text-gray-900 text-sm">Cash Exp</th>
                  <th className="text-left p-3 border-b font-semibold text-gray-900 text-sm">Bank Exp</th>
                  <th className="text-left p-3 border-b font-semibold text-gray-900 text-sm">Closing</th>
                </tr>
              </thead>
              <tbody>
                {/* Current Day Row */}
                <tr className="bg-blue-50 hover:bg-blue-100 transition-colors">
                  <td className="p-3 border-b font-medium text-blue-900 text-sm">
                    {new Date(date).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })} <span className="text-blue-600 font-semibold">(Today)</span>
                  </td>
                  <td className="p-3 border-b text-gray-900 text-sm">
                    {formatCurrency(openingBalanceCents)}
                  </td>
                  <td className="p-3 border-b text-green-600 font-medium text-sm">
                    {formatCurrency(cashReceivedCents)}
                  </td>
                  <td className="p-3 border-b text-blue-600 text-sm">
                    {formatCurrency(bankReceivedCents)}
                  </td>
                  <td className="p-3 border-b text-gray-900 font-medium text-sm">
                    {formatCurrency(totalCashCents)}
                  </td>
                  <td className="p-3 border-b text-red-600 font-medium text-sm">
                    {formatCurrency(cashExpensesCents)}
                  </td>
                  <td className="p-3 border-b text-orange-600 text-sm">
                    {formatCurrency(bankExpensesCents)}
                  </td>
                  <td className="p-3 border-b text-gray-900 font-bold text-sm">
                    {formatCurrency(closingBalanceCents)}
                  </td>
                </tr>

                {/* Historical Data Rows - Show last 7 days only */}
                {dateRange.filter(d => d !== date).slice(-7).map((historicalDate, index) => {
                  const report = historicalData?.find((r: any) => r.date === historicalDate);
                  const isEven = index % 2 === 0;
                  
                  return (
                    <tr key={historicalDate} className={`${isEven ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors`}>
                      <td className="p-3 border-b font-medium text-sm">
                        {new Date(historicalDate).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>
                      <td className="p-3 border-b text-gray-900 text-sm">
                        {formatCurrency(report?.openingBalanceCents || 0)}
                      </td>
                      <td className="p-3 border-b text-green-600 text-sm">
                        {formatCurrency(report?.cashReceivedCents || 0)}
                      </td>
                      <td className="p-3 border-b text-blue-600 text-sm">
                        {formatCurrency(report?.bankReceivedCents || 0)}
                      </td>
                      <td className="p-3 border-b text-gray-900 text-sm">
                        {formatCurrency((report?.openingBalanceCents || 0) + (report?.cashReceivedCents || 0))}
                      </td>
                      <td className="p-3 border-b text-red-600 text-sm">
                        {formatCurrency(report?.cashExpensesCents || 0)}
                      </td>
                      <td className="p-3 border-b text-orange-600 text-sm">
                        {formatCurrency(report?.bankExpensesCents || 0)}
                      </td>
                      <td className="p-3 border-b text-gray-900 font-medium text-sm">
                        {formatCurrency(report?.closingBalanceCents || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr>
                  <td className="p-3 border-t font-bold text-gray-900 text-sm">TOTALS</td>
                  <td className="p-3 border-t font-bold text-gray-900 text-sm">
                    {formatCurrency(openingBalanceCents)}
                  </td>
                  <td className="p-3 border-t font-bold text-green-600 text-sm">
                    {formatCurrency(cashReceivedCents)}
                  </td>
                  <td className="p-3 border-t font-bold text-blue-600 text-sm">
                    {formatCurrency(bankReceivedCents)}
                  </td>
                  <td className="p-3 border-t font-bold text-gray-900 text-sm">
                    {formatCurrency(totalCashCents)}
                  </td>
                  <td className="p-3 border-t font-bold text-red-600 text-sm">
                    {formatCurrency(cashExpensesCents)}
                  </td>
                  <td className="p-3 border-t font-bold text-orange-600 text-sm">
                    {formatCurrency(bankExpensesCents)}
                  </td>
                  <td className="p-3 border-t font-bold text-gray-900 text-sm">
                    {formatCurrency(closingBalanceCents)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>


      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(cashReceivedCents)}
            </p>
            <p className="text-sm text-gray-600 mt-1">Cash Revenue</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(bankReceivedCents)}
            </p>
            <p className="text-sm text-gray-600 mt-1">Bank Revenue</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(cashExpensesCents)}
            </p>
            <p className="text-sm text-gray-600 mt-1">Cash Expenses</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(bankExpensesCents)}
            </p>
            <p className="text-sm text-gray-600 mt-1">Bank Expenses</p>
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
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
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
              className="border-red-300 text-red-700 hover:bg-red-50"
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
            Daily Reports
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live</span>
          </CardTitle>
          <CardDescription className="text-sm text-gray-600">
            View and manage daily cash balance reports for your properties
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="date-select" className="text-sm font-medium text-gray-700">Date</Label>
              <Input
                id="date-select"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Report Spreadsheet */}
      {selectedPropertyId && (
        <DailyReportSpreadsheet
          date={selectedDate}
          propertyId={selectedPropertyId}
          orgId={user?.orgId || 0}
        />
      )}
    </div>
  );
}

export default DailyReportsManager;

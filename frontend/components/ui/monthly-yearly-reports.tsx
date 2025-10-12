import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatCurrency as formatCurrencyUtil } from '../../lib/currency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Input } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { FinanceTabs, FinanceTabsList, FinanceTabsTrigger } from './finance-tabs';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Download,
  BarChart3,
  PieChart,
  CreditCard,
  Banknote
} from 'lucide-react';

// Helper function to get current quarter (Indian fiscal year)
function getCurrentQuarter(): string {
  const month = new Date().getMonth() + 1; // getMonth() returns 0-11, so add 1
  // Indian fiscal year: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar)
  if (month >= 4 && month <= 6) return 'Q1';
  if (month >= 7 && month <= 9) return 'Q2';
  if (month >= 10 && month <= 12) return 'Q3';
  return 'Q4'; // January, February, March
}

// Helper function to get quarter months (Indian fiscal year)
function getQuarterMonths(quarter: string): number[] {
  switch (quarter) {
    case 'Q1': return [4, 5, 6]; // April, May, June
    case 'Q2': return [7, 8, 9]; // July, August, September
    case 'Q3': return [10, 11, 12]; // October, November, December
    case 'Q4': return [1, 2, 3]; // January, February, March
    default: return [4, 5, 6];
  }
}

// Helper function to get quarter date range (Indian fiscal year)
function getQuarterDateRange(quarter: string, year: number): { startDate: string; endDate: string } {
  const months = getQuarterMonths(quarter);
  const startDate = `${year}-${months[0].toString().padStart(2, '0')}-01`;
  
  // For Q4 (Jan-Mar), we need to handle the year correctly since it spans across fiscal years
  let endYear = year;
  if (quarter === 'Q4') {
    // Q4 months are Jan-Mar, so the end date should be in the same calendar year
    endYear = year;
  }
  
  const endDate = new Date(endYear, months[2], 0).toISOString().split('T')[0]; // Last day of last month in quarter
  return { startDate, endDate };
}

interface QuarterlyReport {
  quarter: string;
  year: string;
  propertyId?: number;
  propertyName?: string;
  totalOpeningBalanceCents: number;
  totalCashReceivedCents: number;
  totalBankReceivedCents: number;
  totalReceivedCents: number;
  totalCashExpensesCents: number;
  totalBankExpensesCents: number;
  totalExpensesCents: number;
  totalClosingBalanceCents: number;
  netCashFlowCents: number;
  averageDailyBalanceCents: number;
  daysWithTransactions: number;
  totalDays: number;
}

interface YearlyReport {
  year: string;
  propertyId?: number;
  propertyName?: string;
  totalOpeningBalanceCents: number;
  totalCashReceivedCents: number;
  totalBankReceivedCents: number;
  totalReceivedCents: number;
  totalCashExpensesCents: number;
  totalBankExpensesCents: number;
  totalExpensesCents: number;
  totalClosingBalanceCents: number;
  netCashFlowCents: number;
  averageMonthlyBalanceCents: number;
  monthsWithTransactions: number;
  totalMonths: number;
}

export function MonthlyYearlyReports() {
  const { getAuthenticatedBackend } = useAuth();
  const { theme } = useTheme();
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Get properties for selection
  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list({});
    },
  });

  // Get quarterly report
  const { data: quarterlyReport, isLoading: quarterlyReportLoading } = useQuery({
    queryKey: ['quarterly-report', selectedYear, selectedQuarter, selectedPropertyId],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      const { startDate, endDate } = getQuarterDateRange(selectedQuarter, parseInt(selectedYear));
      
      const dailyReports = await backend.reports.getDailyReports({
        startDate,
        endDate,
        propertyId: selectedPropertyId && selectedPropertyId !== 'all' ? parseInt(selectedPropertyId) : undefined,
      });

      // Calculate quarterly totals
      const totalOpeningBalanceCents = dailyReports.reports.reduce((sum: any, report: any) => sum + report.openingBalanceCents, 0);
      const totalCashReceivedCents = dailyReports.reports.reduce((sum: any, report: any) => sum + report.cashReceivedCents, 0);
      const totalBankReceivedCents = dailyReports.reports.reduce((sum: any, report: any) => sum + report.bankReceivedCents, 0);
      const totalCashExpensesCents = dailyReports.reports.reduce((sum: any, report: any) => sum + report.cashExpensesCents, 0);
      const totalBankExpensesCents = dailyReports.reports.reduce((sum: any, report: any) => sum + report.bankExpensesCents, 0);
      const totalClosingBalanceCents = dailyReports.reports.reduce((sum: any, report: any) => sum + report.closingBalanceCents, 0);

      const quarterlyReport: QuarterlyReport = {
        quarter: selectedQuarter,
        year: selectedYear,
        propertyId: selectedPropertyId && selectedPropertyId !== 'all' ? parseInt(selectedPropertyId) : undefined,
        propertyName: selectedPropertyId && selectedPropertyId !== 'all' && properties?.properties.find((p: any) => p.id.toString() === selectedPropertyId)?.name,
        totalOpeningBalanceCents,
        totalCashReceivedCents,
        totalBankReceivedCents,
        totalReceivedCents: totalCashReceivedCents + totalBankReceivedCents,
        totalCashExpensesCents,
        totalBankExpensesCents,
        totalExpensesCents: totalCashExpensesCents + totalBankExpensesCents,
        totalClosingBalanceCents,
        netCashFlowCents: (totalCashReceivedCents + totalBankReceivedCents) - (totalCashExpensesCents + totalBankExpensesCents),
        averageDailyBalanceCents: dailyReports.reports.length > 0 ? totalClosingBalanceCents / dailyReports.reports.length : 0,
        daysWithTransactions: dailyReports.reports.filter((report: any) => report.transactions.length > 0).length,
        totalDays: dailyReports.reports.length,
      };

      return quarterlyReport;
    },
    enabled: !!selectedYear && !!selectedQuarter,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Get yearly report
  const { data: yearlyReport, isLoading: yearlyReportLoading } = useQuery({
    queryKey: ['yearly-report', selectedYear, selectedPropertyId],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      
      const dailyReports = await backend.reports.getDailyReports({
        startDate,
        endDate,
        propertyId: selectedPropertyId && selectedPropertyId !== 'all' ? parseInt(selectedPropertyId) : undefined,
      });

      // Calculate yearly totals
      const totalOpeningBalanceCents = dailyReports.reports.reduce((sum: any, report: any) => sum + report.openingBalanceCents, 0);
      const totalCashReceivedCents = dailyReports.reports.reduce((sum: any, report: any) => sum + report.cashReceivedCents, 0);
      const totalBankReceivedCents = dailyReports.reports.reduce((sum: any, report: any) => sum + report.bankReceivedCents, 0);
      const totalCashExpensesCents = dailyReports.reports.reduce((sum: any, report: any) => sum + report.cashExpensesCents, 0);
      const totalBankExpensesCents = dailyReports.reports.reduce((sum: any, report: any) => sum + report.bankExpensesCents, 0);
      const totalClosingBalanceCents = dailyReports.reports.reduce((sum: any, report: any) => sum + report.closingBalanceCents, 0);

      const yearlyReport: YearlyReport = {
        year: selectedYear,
        propertyId: selectedPropertyId ? parseInt(selectedPropertyId) : undefined,
        propertyName: selectedPropertyId && properties?.properties.find((p: any) => p.id.toString() === selectedPropertyId)?.name,
        totalOpeningBalanceCents,
        totalCashReceivedCents,
        totalBankReceivedCents,
        totalReceivedCents: totalCashReceivedCents + totalBankReceivedCents,
        totalCashExpensesCents,
        totalBankExpensesCents,
        totalExpensesCents: totalCashExpensesCents + totalBankExpensesCents,
        totalClosingBalanceCents,
        netCashFlowCents: (totalCashReceivedCents + totalBankReceivedCents) - (totalCashExpensesCents + totalBankExpensesCents),
        averageMonthlyBalanceCents: dailyReports.reports.length > 0 ? totalClosingBalanceCents / 12 : 0,
        monthsWithTransactions: new Set(dailyReports.reports.map((report: any) => report.date.substring(0, 7))).size,
        totalMonths: 12,
      };

      return yearlyReport;
    },
    enabled: !!selectedYear,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const formatCurrency = (amountCents: number) => {
    return formatCurrencyUtil(amountCents, theme.currency);
  };

  const getMonthName = (month: string) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[parseInt(month) - 1];
  };

  const exportQuarterlyReport = () => {
    if (!quarterlyReport) return;
    
    const headers = [
      'Quarter',
      'Year',
      'Property',
      'Total Opening Balance',
      'Cash Received',
      'Bank Received',
      'Total Received',
      'Cash Expenses',
      'Bank Expenses',
      'Total Expenses',
      'Total Closing Balance',
      'Net Cash Flow',
      'Average Daily Balance',
      'Days with Transactions',
      'Total Days'
    ];

    const csvContent = [
      headers.join(','),
      [
        quarterlyReport.quarter,
        quarterlyReport.year,
        quarterlyReport.propertyName || 'All Properties',
        formatCurrency(quarterlyReport.totalOpeningBalanceCents),
        formatCurrency(quarterlyReport.totalCashReceivedCents),
        formatCurrency(quarterlyReport.totalBankReceivedCents),
        formatCurrency(quarterlyReport.totalReceivedCents),
        formatCurrency(quarterlyReport.totalCashExpensesCents),
        formatCurrency(quarterlyReport.totalBankExpensesCents),
        formatCurrency(quarterlyReport.totalExpensesCents),
        formatCurrency(quarterlyReport.totalClosingBalanceCents),
        formatCurrency(quarterlyReport.netCashFlowCents),
        formatCurrency(quarterlyReport.averageDailyBalanceCents),
        quarterlyReport.daysWithTransactions,
        quarterlyReport.totalDays
      ].join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quarterly-report-${selectedYear}-${selectedQuarter}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportYearlyReport = () => {
    if (!yearlyReport) return;
    
    const headers = [
      'Year',
      'Property',
      'Total Opening Balance',
      'Cash Received',
      'Bank Received',
      'Total Received',
      'Cash Expenses',
      'Bank Expenses',
      'Total Expenses',
      'Total Closing Balance',
      'Net Cash Flow',
      'Average Monthly Balance',
      'Months with Transactions',
      'Total Months'
    ];

    const csvContent = [
      headers.join(','),
      [
        yearlyReport.year,
        yearlyReport.propertyName || 'All Properties',
        formatCurrency(yearlyReport.totalOpeningBalanceCents),
        formatCurrency(yearlyReport.totalCashReceivedCents),
        formatCurrency(yearlyReport.totalBankReceivedCents),
        formatCurrency(yearlyReport.totalReceivedCents),
        formatCurrency(yearlyReport.totalCashExpensesCents),
        formatCurrency(yearlyReport.totalBankExpensesCents),
        formatCurrency(yearlyReport.totalExpensesCents),
        formatCurrency(yearlyReport.totalClosingBalanceCents),
        formatCurrency(yearlyReport.netCashFlowCents),
        formatCurrency(yearlyReport.averageMonthlyBalanceCents),
        yearlyReport.monthsWithTransactions,
        yearlyReport.totalMonths
      ].join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yearly-report-${selectedYear}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="space-y-6">
        {/* Enhanced Header */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900">Quarterly & Yearly Reports</CardTitle>
                  <CardDescription className="text-sm text-gray-600">Aggregated financial reports and analytics</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Live</span>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Enhanced Filters */}
        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              Report Filters
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Active</span>
            </CardTitle>
            <CardDescription className="text-sm text-gray-600">Select year, quarter, and property for aggregated reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="property-filter" className="text-sm font-medium text-gray-700">Property</Label>
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="All Properties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties?.properties.map((property: any) => (
                      <SelectItem key={property.id} value={property.id.toString()}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year-filter" className="text-sm font-medium text-gray-700">Year</Label>
                <Input
                  id="year-filter"
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  min="2020"
                  max="2030"
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quarter-filter" className="text-sm font-medium text-gray-700">Quarter</Label>
                <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1">Q1 (Apr-Jun)</SelectItem>
                    <SelectItem value="Q2">Q2 (Jul-Sep)</SelectItem>
                    <SelectItem value="Q3">Q3 (Oct-Dec)</SelectItem>
                    <SelectItem value="Q4">Q4 (Jan-Mar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <FinanceTabs defaultValue="quarterly" theme={theme}>
          <FinanceTabsList className="grid-cols-2" theme={theme}>
            <FinanceTabsTrigger value="quarterly" theme={theme}>
              <Calendar className="h-4 w-4 mr-2" />
              Quarterly Report
            </FinanceTabsTrigger>
            <FinanceTabsTrigger value="yearly" theme={theme}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Yearly Report
            </FinanceTabsTrigger>
          </FinanceTabsList>

          {/* Content Container */}
          <div className="px-6 py-6">
            <TabsContent value="quarterly" className="space-y-6 mt-0">
              <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-gray-900">
                          Quarterly Report - {selectedQuarter} {selectedYear}
                        </CardTitle>
                        <CardDescription className="text-sm text-gray-600">
                          Financial summary for {selectedQuarter} {selectedYear}
                          {selectedPropertyId && properties?.properties.find((p: any) => p.id.toString() === selectedPropertyId) && 
                            ` - ${properties.properties.find((p: any) => p.id.toString() === selectedPropertyId)?.name}`
                          }
                        </CardDescription>
                      </div>
                    </div>
                    {quarterlyReport && (
                      <Button 
                        onClick={exportQuarterlyReport}
                        className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Export CSV</span>
                        <span className="sm:hidden">Export</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {quarterlyReportLoading ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BarChart3 className="h-5 w-5 text-blue-600 animate-pulse" />
                          </div>
                          <p className="text-lg font-medium text-gray-900">Loading quarterly report...</p>
                          <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your financial data</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : quarterlyReport ? (
                    <div className="space-y-6">
                      {/* Enhanced Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                          <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              </div>
                              Total Received
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                              {formatCurrency(quarterlyReport.totalReceivedCents)}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Cash: {formatCurrency(quarterlyReport.totalCashReceivedCents)} | Bank: {formatCurrency(quarterlyReport.totalBankReceivedCents)}
                            </p>
                          </CardContent>
                        </Card>
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
                              {formatCurrency(quarterlyReport.totalExpensesCents)}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Cash: {formatCurrency(quarterlyReport.totalCashExpensesCents)} | Bank: {formatCurrency(quarterlyReport.totalBankExpensesCents)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                          <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                                <BarChart3 className="h-4 w-4 text-blue-600" />
                              </div>
                              Net Cash Flow
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className={`text-2xl font-bold ${quarterlyReport.netCashFlowCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(quarterlyReport.netCashFlowCents)}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Avg Daily: {formatCurrency(quarterlyReport.averageDailyBalanceCents)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                          <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <div className="p-2 bg-purple-100 rounded-lg shadow-sm">
                                <PieChart className="h-4 w-4 text-purple-600" />
                              </div>
                              Activity
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-purple-600">
                              {quarterlyReport.daysWithTransactions}/{quarterlyReport.totalDays}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Days with transactions
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Enhanced Detailed Breakdown */}
                      <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className="p-2 bg-orange-100 rounded-lg shadow-sm">
                              <Receipt className="h-5 w-5 text-orange-600" />
                            </div>
                            Detailed Breakdown
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                              <h4 className="font-semibold mb-3 text-green-600 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Income Breakdown
                              </h4>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center gap-2 text-sm">
                                    <Banknote className="h-4 w-4" />
                                    Cash Received
                                  </span>
                                  <span className="font-medium text-green-600">{formatCurrency(quarterlyReport.totalCashReceivedCents)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center gap-2 text-sm">
                                    <CreditCard className="h-4 w-4" />
                                    Bank Received
                                  </span>
                                  <span className="font-medium text-blue-600">{formatCurrency(quarterlyReport.totalBankReceivedCents)}</span>
                                </div>
                                <div className="border-t border-green-300 pt-3 flex justify-between items-center font-semibold">
                                  <span>Total Received</span>
                                  <span className="text-green-600">{formatCurrency(quarterlyReport.totalReceivedCents)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                              <h4 className="font-semibold mb-3 text-red-600 flex items-center gap-2">
                                <TrendingDown className="h-4 w-4" />
                                Expense Breakdown
                              </h4>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center gap-2 text-sm">
                                    <Banknote className="h-4 w-4" />
                                    Cash Expenses
                                  </span>
                                  <span className="font-medium text-red-600">{formatCurrency(quarterlyReport.totalCashExpensesCents)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center gap-2 text-sm">
                                    <CreditCard className="h-4 w-4" />
                                    Bank Expenses
                                  </span>
                                  <span className="font-medium text-orange-600">{formatCurrency(quarterlyReport.totalBankExpensesCents)}</span>
                                </div>
                                <div className="border-t border-red-300 pt-3 flex justify-between items-center font-semibold">
                                  <span>Total Expenses</span>
                                  <span className="text-red-600">{formatCurrency(quarterlyReport.totalExpensesCents)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <Card className="">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Calendar className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No data available</h3>
                        <p className="text-gray-500 text-center">No financial data found for this month</p>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="yearly" className="space-y-6 mt-0">
              <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg shadow-sm">
                        <BarChart3 className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-gray-900">
                          Yearly Report - {selectedYear}
                        </CardTitle>
                        <CardDescription className="text-sm text-gray-600">
                          Financial summary for {selectedYear}
                          {selectedPropertyId && properties?.properties.find((p: any) => p.id.toString() === selectedPropertyId) && 
                            ` - ${properties.properties.find((p: any) => p.id.toString() === selectedPropertyId)?.name}`
                          }
                        </CardDescription>
                      </div>
                    </div>
                    {yearlyReport && (
                      <Button 
                        onClick={exportYearlyReport}
                        className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Export CSV</span>
                        <span className="sm:hidden">Export</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {yearlyReportLoading ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BarChart3 className="h-5 w-5 text-blue-600 animate-pulse" />
                          </div>
                          <p className="text-lg font-medium text-gray-900">Loading yearly report...</p>
                          <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your financial data</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : yearlyReport ? (
                    <div className="space-y-6">
                      {/* Enhanced Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                          <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              </div>
                              Total Received
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                              {formatCurrency(yearlyReport.totalReceivedCents)}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Cash: {formatCurrency(yearlyReport.totalCashReceivedCents)} | Bank: {formatCurrency(yearlyReport.totalBankReceivedCents)}
                            </p>
                          </CardContent>
                        </Card>
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
                              {formatCurrency(yearlyReport.totalExpensesCents)}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Cash: {formatCurrency(yearlyReport.totalCashExpensesCents)} | Bank: {formatCurrency(yearlyReport.totalBankExpensesCents)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                          <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                                <BarChart3 className="h-4 w-4 text-blue-600" />
                              </div>
                              Net Cash Flow
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className={`text-2xl font-bold ${yearlyReport.netCashFlowCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(yearlyReport.netCashFlowCents)}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Avg Monthly: {formatCurrency(yearlyReport.averageMonthlyBalanceCents)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                          <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <div className="p-2 bg-purple-100 rounded-lg shadow-sm">
                                <PieChart className="h-4 w-4 text-purple-600" />
                              </div>
                              Activity
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-purple-600">
                              {yearlyReport.monthsWithTransactions}/{yearlyReport.totalMonths}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Months with transactions
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Enhanced Detailed Breakdown */}
                      <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className="p-2 bg-orange-100 rounded-lg shadow-sm">
                              <Receipt className="h-5 w-5 text-orange-600" />
                            </div>
                            Detailed Breakdown
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                              <h4 className="font-semibold mb-3 text-green-600 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Income Breakdown
                              </h4>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center gap-2 text-sm">
                                    <Banknote className="h-4 w-4" />
                                    Cash Received
                                  </span>
                                  <span className="font-medium text-green-600">{formatCurrency(yearlyReport.totalCashReceivedCents)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center gap-2 text-sm">
                                    <CreditCard className="h-4 w-4" />
                                    Bank Received
                                  </span>
                                  <span className="font-medium text-blue-600">{formatCurrency(yearlyReport.totalBankReceivedCents)}</span>
                                </div>
                                <div className="border-t border-green-300 pt-3 flex justify-between items-center font-semibold">
                                  <span>Total Received</span>
                                  <span className="text-green-600">{formatCurrency(yearlyReport.totalReceivedCents)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                              <h4 className="font-semibold mb-3 text-red-600 flex items-center gap-2">
                                <TrendingDown className="h-4 w-4" />
                                Expense Breakdown
                              </h4>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center gap-2 text-sm">
                                    <Banknote className="h-4 w-4" />
                                    Cash Expenses
                                  </span>
                                  <span className="font-medium text-red-600">{formatCurrency(yearlyReport.totalCashExpensesCents)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center gap-2 text-sm">
                                    <CreditCard className="h-4 w-4" />
                                    Bank Expenses
                                  </span>
                                  <span className="font-medium text-orange-600">{formatCurrency(yearlyReport.totalBankExpensesCents)}</span>
                                </div>
                                <div className="border-t border-red-300 pt-3 flex justify-between items-center font-semibold">
                                  <span>Total Expenses</span>
                                  <span className="text-red-600">{formatCurrency(yearlyReport.totalExpensesCents)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <Card className="">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Calendar className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No data available</h3>
                        <p className="text-gray-500 text-center">No financial data found for this year</p>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </FinanceTabs>
      </div>
    </div>
  );
}

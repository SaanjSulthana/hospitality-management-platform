import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { formatCurrency as formatCurrencyUtil } from '../lib/currency';
import { getCurrentDateString } from '../lib/date-utils';
import { getFlagBool } from '../lib/feature-flags';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinanceTabs, FinanceTabsList, FinanceTabsTrigger } from '@/components/ui/finance-tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { API_CONFIG } from '../src/config/api';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Receipt,
  RefreshCw,
  BarChart3,
  Edit3,
  Save,
  X,
  Building2,
  Check
} from 'lucide-react';
import { DailyReportsManager } from '@/components/ui/daily-reports';
import { MonthlyYearlyReports } from '@/components/ui/monthly-yearly-reports';

// Daily Report Manager Content Component (Tab version of popup)
interface DailyReportManagerContentProps {
  selectedPropertyId: string;
  selectedDate: string;
  onPropertyDateChange: (propertyId: number, date: string) => void;
}

// Simplified Daily Report Popup Component
interface DailyReportPopupProps {
  date: string;
  propertyId: number;
  orgId: number;
  isOpen: boolean;
  onClose: () => void;
}

function DailyReportPopup({ date, propertyId, orgId, isOpen, onClose }: DailyReportPopupProps) {
  const { getAuthenticatedBackend } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const TELEMETRY_SAMPLE = 0.02;
  const sendClientTelemetry = (events: any[]) => {
    try {
      if (Math.random() >= TELEMETRY_SAMPLE) return;
      fetch(`${API_CONFIG.BASE_URL}/telemetry/client`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sampleRate: TELEMETRY_SAMPLE, events }),
      }).catch(() => {});
    } catch {}
  };
  
  // State for the popup
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [isEditingOpeningBalance, setIsEditingOpeningBalance] = useState<boolean>(false);

  // Fetch all transactions for the selected date
  const { data: transactionsData, isLoading: isLoadingTransactions, error: transactionsError } = useQuery({
    queryKey: ['daily-transactions', propertyId, date, orgId],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      console.log('Fetching transactions for:', { propertyId, date, orgId });
      
      // Fetch revenues for the date
      const revenuesResponse = await backend.finance.listRevenues({
        propertyId,
        startDate: date,
        endDate: date,
        orgId
      });
      console.log('Revenues response:', revenuesResponse);
      
      // Fetch expenses for the date
      const expensesResponse = await backend.finance.listExpenses({
        propertyId,
        startDate: date,
        endDate: date,
        orgId
      });
      console.log('Expenses response:', expensesResponse);
      
      return {
        revenues: revenuesResponse.revenues || [],
        expenses: expensesResponse.expenses || []
      };
    },
    enabled: isOpen && !!propertyId && !!orgId,
    staleTime: 30000,
    gcTime: 600000,
  });

  // Fetch previous day's closing balance for carry forward
  const { data: previousDayData } = useQuery({
    queryKey: ['previous-day-closing', propertyId, date],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      try {
        // Get previous day's transactions to calculate closing balance
        const prevRevenuesResponse = await backend.finance.listRevenues({
          propertyId,
          startDate: yesterdayStr,
          endDate: yesterdayStr,
          orgId
        });
        
        const prevExpensesResponse = await backend.finance.listExpenses({
          propertyId,
          startDate: yesterdayStr,
          endDate: yesterdayStr,
          orgId
        });
        
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
        
        return { closingBalanceCents: prevClosingBalance };
      } catch (error) {
        return { closingBalanceCents: 0 };
      }
    },
    enabled: isOpen,
    staleTime: 300000,
  });

  // Update opening balance mutation
  const updateBalanceMutation = useMutation({
    mutationFn: async (data: { openingBalanceCents: number }) => {
      const backend = getAuthenticatedBackend();
      return await backend.reports.updateDailyCashBalanceSmart({
        propertyId,
        date,
        orgId,
        openingBalanceCents: data.openingBalanceCents,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-report'] }); // Invalidate monthly reports for real-time updates
      toast({
        title: "Balance Updated",
        description: "Daily cash balance has been updated successfully.",
      });
      setIsEditingOpeningBalance(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update daily cash balance.",
        variant: "destructive",
      });
    },
  });

  // Calculate values from transactions
  const isFirstDay = !previousDayData?.closingBalanceCents || previousDayData.closingBalanceCents === 0;
  const autoCalculatedOpeningBalance = previousDayData?.closingBalanceCents || 0;
  const currentOpeningBalance = openingBalance || autoCalculatedOpeningBalance;
  
  // Calculate from transactions
  const cashRevenue = (transactionsData?.revenues || [])
    .filter((r: any) => r.paymentMode === 'cash')
    .reduce((sum: number, r: any) => sum + r.amountCents, 0);
  
  const bankRevenue = (transactionsData?.revenues || [])
    .filter((r: any) => r.paymentMode === 'bank')
    .reduce((sum: number, r: any) => sum + r.amountCents, 0);
  
  const cashExpenses = (transactionsData?.expenses || [])
    .filter((e: any) => e.paymentMode === 'cash')
    .reduce((sum: number, e: any) => sum + e.amountCents, 0);
  
  const bankExpenses = (transactionsData?.expenses || [])
    .filter((e: any) => e.paymentMode === 'bank')
    .reduce((sum: number, e: any) => sum + e.amountCents, 0);
  
  const totalCash = currentOpeningBalance + cashRevenue;
  const closingBalance = totalCash - cashExpenses;

  const handleSaveOpeningBalance = async () => {
    await updateBalanceMutation.mutateAsync({
      openingBalanceCents: openingBalance,
    });
  };

  const handleAutoFillOpeningBalance = () => {
    setOpeningBalance(autoCalculatedOpeningBalance);
  };

  const formatCurrency = (amountCents: number) => {
    return formatCurrencyUtil(amountCents, 'INR');
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Enhanced Professional Header */}
        <DialogHeader className="border-b pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-xl shadow-sm">
                <Receipt className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Daily Cash Balance Report
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live Data</span>
                </DialogTitle>
                <DialogDescription className="text-lg text-gray-600 mt-1">
                  {new Date(date).toLocaleDateString()}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm text-gray-500">Property ID</p>
                <p className="font-semibold text-gray-900">#{propertyId}</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-1">

        {isLoadingTransactions ? (
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">Loading transaction data...</p>
                <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your financial data</p>
              </div>
            </CardContent>
          </Card>
        ) : transactionsError ? (
          <Card className="border-l-4 border-l-red-500 shadow-sm">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Receipt className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-lg font-medium text-red-900 mb-2">Error loading transaction data</p>
                <p className="text-sm text-gray-600 mb-4">{transactionsError.message}</p>
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
        ) : (
          <div className="space-y-6">
            {/* Enhanced Opening Balance Section */}
            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  Opening Balance (Cash)
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  {isFirstDay 
                    ? 'Day 1: Manually entered (default: ₹0.00)'
                    : `Day 2+: Auto-calculated from previous day's closing balance`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isEditingOpeningBalance ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={openingBalance / 100}
                          onChange={(e) => setOpeningBalance(parseFloat(e.target.value) * 100)}
                          className="w-32"
                          step="0.01"
                        />
                        <Button size="sm" onClick={handleSaveOpeningBalance} disabled={updateBalanceMutation.isPending}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditingOpeningBalance(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-blue-600">
                          {formatCurrency(currentOpeningBalance)}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => setIsEditingOpeningBalance(true)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        {!isFirstDay && (
                          <Button size="sm" variant="outline" onClick={handleAutoFillOpeningBalance}>
                            Auto-fill
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Revenue and Expenses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-green-600 flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    Revenue
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Live Data</span>
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600">Real-time revenue from Finance transactions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Cash Revenue</span>
                      <span className="font-bold text-xl text-green-600">{formatCurrency(cashRevenue)}</span>
                    </div>
                    <div className="text-xs text-green-600 mt-1">From cash transactions</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Bank Revenue</span>
                      <span className="font-bold text-xl text-blue-600">{formatCurrency(bankRevenue)}</span>
                    </div>
                    <div className="text-xs text-blue-600 mt-1">From bank transactions</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    Expenses
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">Live Data</span>
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600">Real-time expenses from Finance transactions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Cash Expenses</span>
                      <span className="font-bold text-xl text-red-600">{formatCurrency(cashExpenses)}</span>
                    </div>
                    <div className="text-xs text-red-600 mt-1">From cash transactions</div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Bank Expenses</span>
                      <span className="font-bold text-xl text-orange-600">{formatCurrency(bankExpenses)}</span>
                    </div>
                    <div className="text-xs text-orange-600 mt-1">From bank transactions</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Enhanced Calculations */}
            <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                  Live Calculations
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">Auto-calculated</span>
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">Real-time calculations based on current data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-gray-700 font-medium">Total Cash</span>
                      <div className="text-xs text-gray-500">Opening Balance + Cash Revenue</div>
                    </div>
                    <span className="font-bold text-xl text-gray-800">{formatCurrency(totalCash)}</span>
                  </div>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-gray-700 font-medium">Closing Balance</span>
                      <div className="text-xs text-gray-500">Total Cash - Cash Expenses</div>
                    </div>
                    <span className="font-bold text-2xl text-purple-600">{formatCurrency(closingBalance)}</span>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-gray-700 font-medium">Next Day Opening Balance</span>
                      <div className="text-xs text-gray-500">Carries forward to tomorrow</div>
                    </div>
                    <span className="font-bold text-xl text-blue-600">{formatCurrency(closingBalance)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </div>

        {/* Enhanced Professional Footer */}
        <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between w-full gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700">Live Data</span>
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Last Updated:</span> {new Date().toLocaleTimeString()}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Data Source:</span> Finance Transactions
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
              <Button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['daily-transactions'] })} 
                disabled={isLoadingTransactions}
                className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingTransactions ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DailyReportManagerContent({ selectedPropertyId, selectedDate, onPropertyDateChange }: DailyReportManagerContentProps) {
  const { getAuthenticatedBackend, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for the manager (removed - using backend API data now)

  const propertyId = parseInt(selectedPropertyId);
  const orgId = user?.orgId || 0;

  // Fetch properties for the selector
  const { data: propertiesData, isLoading: isLoadingProperties, error: propertiesError } = useQuery({
    queryKey: ['properties', user?.orgId],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      console.log('DailyReportManagerContent: Fetching properties for orgId:', user?.orgId);
      const response = await backend.properties.list({ orgId: user?.orgId || 0 });
      console.log('DailyReportManagerContent: Properties response:', response);
      return response.properties || [];
    },
    enabled: !!user?.orgId,
  });

  // Auto-select first property if none selected
  useEffect(() => {
    if (propertiesData && propertiesData.length > 0 && !selectedPropertyId) {
      onPropertyDateChange(propertiesData[0].id, selectedDate);
    }
  }, [propertiesData, selectedPropertyId, selectedDate, onPropertyDateChange]);

  // Fetch daily report data from backend API
  const { data: dailyReportData, isLoading: isLoadingTransactions, error: transactionsError } = useQuery({
    queryKey: ['daily-report', propertyId, selectedDate, orgId],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      console.log('DailyReportManagerContent: Fetching daily report from backend API for:', { propertyId, selectedDate, orgId });
      
      const response = await backend.reports.getDailyReport({
        propertyId,
        date: selectedDate
      });
      
      console.log('DailyReportManagerContent: Daily report response:', response);
      return response;
    },
    enabled: !!propertyId && !!selectedDate && !!orgId,
    staleTime: 25000, // Match Finance pattern
    gcTime: 300000, // 5 minutes
    refetchInterval: false, // Rely on realtime events from RealtimeProvider
    refetchOnMount: true, // Refresh when component mounts
    onSuccess: () => {
      try {
        const last = (window as any).__reportsLastInvalidateAt;
        if (!last) return;
        const key = `daily|${propertyId}|${selectedDate}`;
        const started = last[key];
        if (started) {
          const ms = Date.now() - started;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[ReportsTelemetry] daily refetch duration ms:', ms, { propertyId, date: selectedDate });
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
                  scope: 'daily',
                  ms,
                  propertyId, date: selectedDate,
                }],
              }),
            }).catch(() => {});
          }
        }
      } catch {}
    }
  });

  // Use values from backend API
  const cashRevenue = dailyReportData?.cashReceivedCents || 0;
  const bankRevenue = dailyReportData?.bankReceivedCents || 0;
  const cashExpenses = dailyReportData?.cashExpensesCents || 0;
  const bankExpenses = dailyReportData?.bankExpensesCents || 0;
  const currentOpeningBalance = dailyReportData?.openingBalanceCents || 0;
  const closingBalance = dailyReportData?.closingBalanceCents || 0;
  const isFirstDay = currentOpeningBalance === 0;
  const autoCalculatedOpeningBalance = currentOpeningBalance;
  const totalCash = currentOpeningBalance + cashRevenue;

  const formatCurrency = (amountCents: number) => {
    return formatCurrencyUtil(amountCents, 'INR');
  };

  // Export functions with loading states
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportPDF = async () => {
    if (!propertyId || !selectedDate) {
      toast({
        title: "Export Failed",
        description: "Please select a property and date first.",
        variant: "destructive",
      });
      return;
    }

    setIsExportingPDF(true);
    try {
      const token = localStorage.getItem('accessToken');
      
      // Step 1: Create export using new v2 endpoint
      const response = await fetch(`${API_CONFIG.BASE_URL}/reports/v2/export-daily-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId,
          date: selectedDate
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
          
          // Convert base64 to blob
          const byteCharacters = atob(downloadData.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: downloadData.mimeType });
          
          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = downloadData.filename || `daily-report-${selectedDate}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          toast({
            title: "PDF Ready",
            description: "Daily report PDF has been downloaded.",
          });
          break;
        } else if (status.status === 'failed') {
          throw new Error(status.errorMessage || 'Export generation failed');
        }
        
        // Wait 1 second before next poll
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Export timed out');
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

  const handleExportExcel = async () => {
    if (!propertyId || !selectedDate) {
      toast({
        title: "Export Failed",
        description: "Please select a property and date first.",
        variant: "destructive",
      });
      return;
    }

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
          date: selectedDate
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

  if (!propertiesData || propertiesData.length === 0) {
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

  if (!propertyId || !selectedDate) {
    return (
      <Card className="border-l-4 border-l-blue-500 shadow-sm">
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">Select Property and Date</p>
            <p className="text-sm text-gray-600">Please select a property and date to view the daily report manager.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Enhanced Property Selection and Report Header */}
      <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-xl shadow-sm">
                <Receipt className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl lg:text-2xl font-bold text-gray-900">
                  Daily Cash Balance Report
                </CardTitle>
                <CardDescription className="text-sm lg:text-base text-gray-600 mt-1">
                  {new Date(selectedDate).toLocaleDateString()}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={!propertyId || !selectedDate || isExportingPDF}
                className="transition-all duration-200 hover:scale-105 hover:shadow-md flex-shrink-0"
              >
                {isExportingPDF ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Receipt className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline">{isExportingPDF ? 'Generating PDF...' : 'Export PDF'}</span>
                <span className="sm:hidden">PDF</span>
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={!propertyId || !selectedDate || isExportingExcel}
                className="transition-all duration-200 hover:scale-105 hover:shadow-md flex-shrink-0"
              >
                {isExportingExcel ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline">{isExportingExcel ? 'Generating Excel...' : 'Export Excel'}</span>
                <span className="sm:hidden">Excel</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="property-select" className="text-sm font-medium text-gray-700">Property</Label>
              <Select
                value={selectedPropertyId || ''}
                onValueChange={(value) => onPropertyDateChange(parseInt(value), selectedDate)}
              >
                <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingProperties ? (
                    <SelectItem value="" disabled>Loading properties...</SelectItem>
                  ) : propertiesError ? (
                    <SelectItem value="" disabled>Error loading properties</SelectItem>
                  ) : propertiesData && propertiesData.length > 0 ? (
                    propertiesData.map((property: any) => (
                      <SelectItem key={property.id} value={property.id.toString()}>
                        {property.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>No properties available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-select" className="text-sm font-medium text-gray-700">Date</Label>
              <Input
                id="date-select"
                type="date"
                value={selectedDate}
                onChange={(e) => onPropertyDateChange(parseInt(selectedPropertyId || '0'), e.target.value)}
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoadingTransactions ? (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading transaction data...</p>
              <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your financial data</p>
            </div>
          </CardContent>
        </Card>
      ) : transactionsError ? (
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt className="h-6 w-6 text-red-600" />
              </div>
              <p className="text-lg font-medium text-red-900 mb-2">Error loading transaction data</p>
              <p className="text-sm text-gray-600 mb-4">{transactionsError.message}</p>
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
      ) : (
        <div className="space-y-6">
          {/* Enhanced Opening Balance Section */}
          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    Opening Balance (Cash)
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live Data</span>
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    {isFirstDay 
                      ? 'Day 1: Manually entered (default: ₹0.00)'
                      : `Day 2+: Auto-calculated from previous day's closing balance`
                    }
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Current Value</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(currentOpeningBalance)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-gray-700 font-medium">Auto-Calculated Value</span>
                      <div className="text-xs text-blue-600 mt-1">
                        {isFirstDay 
                          ? 'Based on all cash transactions before this date'
                          : 'Equals previous day\'s closing balance'}
                      </div>
                    </div>
                    <span className="font-bold text-2xl text-blue-600">
                      {formatCurrency(currentOpeningBalance)}
                    </span>
                  </div>
                </div>
                {dailyReportData?.isOpeningBalanceAutoCalculated && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4" />
                      <span><strong>Live Data:</strong> Calculated from Finance transactions</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Revenue and Expenses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-green-600 flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  Revenue
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Live Data</span>
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">Real-time revenue from Finance transactions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">Cash Revenue</span>
                    <span className="font-bold text-xl text-green-600">{formatCurrency(cashRevenue)}</span>
                  </div>
                  <div className="text-xs text-green-600 mt-1">From cash transactions</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">Bank Revenue</span>
                    <span className="font-bold text-xl text-blue-600">{formatCurrency(bankRevenue)}</span>
                  </div>
                  <div className="text-xs text-blue-600 mt-1">From bank transactions</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  Expenses
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">Live Data</span>
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">Real-time expenses from Finance transactions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">Cash Expenses</span>
                    <span className="font-bold text-xl text-red-600">{formatCurrency(cashExpenses)}</span>
                  </div>
                  <div className="text-xs text-red-600 mt-1">From cash transactions</div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">Bank Expenses</span>
                    <span className="font-bold text-xl text-orange-600">{formatCurrency(bankExpenses)}</span>
                  </div>
                  <div className="text-xs text-orange-600 mt-1">From bank transactions</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Calculations */}
          <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                Live Calculations
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">Auto-calculated</span>
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">Real-time calculations based on current data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-gray-700 font-medium">Total Cash</span>
                    <div className="text-xs text-gray-500">Opening Balance + Cash Revenue</div>
                  </div>
                  <span className="font-bold text-xl text-gray-800">{formatCurrency(totalCash)}</span>
                </div>
              </div>
              
              <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-gray-700 font-medium">Closing Balance</span>
                    <div className="text-xs text-gray-500">Total Cash - Cash Expenses</div>
                  </div>
                  <span className="font-bold text-2xl text-purple-600">{formatCurrency(closingBalance)}</span>
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-gray-700 font-medium">Next Day Opening Balance</span>
                    <div className="text-xs text-gray-500">Carries forward to tomorrow</div>
                  </div>
                  <span className="font-bold text-xl text-blue-600">{formatCurrency(closingBalance)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Professional Footer with Quick Actions */}
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-gray-700">Live Data</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Last Updated:</span> {new Date().toLocaleTimeString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Source:</span> Finance Transactions
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['daily-report'] })} 
                    disabled={isLoadingTransactions}
                    className="transition-all duration-200 hover:scale-105 hover:shadow-md flex-shrink-0"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingTransactions ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                    <span className="sm:hidden">Refresh</span>
                  </Button>
                  <Button 
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-md flex-shrink-0"
                    onClick={() => {
                      // Copy current balance to clipboard
                      navigator.clipboard.writeText(`Closing Balance: ${formatCurrency(closingBalance)}`);
                      toast({
                        title: "Copied to Clipboard",
                        description: "Closing balance copied to clipboard",
                      });
                    }}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Copy Balance</span>
                    <span className="sm:hidden">Copy</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { getAuthenticatedBackend, user } = useAuth();
  const { theme } = useTheme();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set page title and description
  useEffect(() => {
    setPageTitle('Reports & Analytics', 'Generate comprehensive reports and analyze performance');
  }, [setPageTitle]);

  const [selectedDate, setSelectedDate] = useState(getCurrentDateString());
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [startDate, setStartDate] = useState(getCurrentDateString());
  const [endDate, setEndDate] = useState(getCurrentDateString());
  
  // State for popup
  const [isPopupOpen, setIsPopupOpen] = useState(false);


  const formatCurrency = (amountCents: number) => {
    return formatCurrencyUtil(amountCents, theme.currency);
  };

  // Reports realtime invalidation (server refetch, debounced)
  useEffect(() => {
    const reportsRealtimeEnabled = getFlagBool('REPORTS_REALTIME_V1', true);
    if (!reportsRealtimeEnabled) return;

    // Track keys to invalidate per batch
    const dailyKeys = new Set<string>();
    const monthlyKeys = new Set<string>();
    const quarterlyKeys = new Set<string>();
    const yearlyKeys = new Set<string>();
    const seenEventIds = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let batches = 0;

    // Expose last-invalidation timestamps for telemetry in child queries
    const lastInvalidateAt: Record<string, number> = {};
    (window as any).__reportsLastInvalidateAt = lastInvalidateAt;

    const toISTDate = (iso: string | Date | undefined): string | null => {
      if (!iso) return null;
      try {
        const d = new Date(iso);
        const y = d.toLocaleString('en-CA', { year: 'numeric', timeZone: 'Asia/Kolkata' });
        const m = d.toLocaleString('en-CA', { month: '2-digit', timeZone: 'Asia/Kolkata' });
        const day = d.toLocaleString('en-CA', { day: '2-digit', timeZone: 'Asia/Kolkata' });
        return `${y}-${m}-${day}`;
      } catch {
        return null;
      }
    };

    const monthFromDate = (dateStr: string) => {
      const [y, m] = dateStr.split('-');
      return { year: parseInt(y, 10), month: parseInt(m, 10) };
    };

    const quarterFromMonth = (year: number, month: number): { q: 'Q1' | 'Q2' | 'Q3' | 'Q4'; year: number } => {
      if (month >= 4 && month <= 6) return { q: 'Q1', year };
      if (month >= 7 && month <= 9) return { q: 'Q2', year };
      if (month >= 10 && month <= 12) return { q: 'Q3', year };
      return { q: 'Q4', year }; // Jan-Mar
    };

    const scheduleInvalidate = () => {
      if (timer) return;
      timer = setTimeout(() => {
        const started = Date.now();
        // Daily
        dailyKeys.forEach((k) => {
          const [_, propertyIdStr, dateStr] = k.split('|');
          lastInvalidateAt[`daily|${propertyIdStr}|${dateStr}`] = Date.now();
          queryClient.invalidateQueries({ queryKey: ['daily-report', parseInt(propertyIdStr, 10), dateStr], exact: false });
        });
        // Monthly
        monthlyKeys.forEach((k) => {
          const [_, propertyIdStr, yearStr, monthStr] = k.split('|');
          lastInvalidateAt[`monthly|${propertyIdStr}|${yearStr}-${monthStr}`] = Date.now();
          queryClient.invalidateQueries({ queryKey: ['monthly-report', parseInt(propertyIdStr, 10), parseInt(yearStr, 10), parseInt(monthStr, 10)], exact: false });
        });
        // Quarterly
        quarterlyKeys.forEach((k) => {
          const [_, yearStr, q, propertyIdStr] = k.split('|');
          lastInvalidateAt[`quarterly|${yearStr}|${q}|${propertyIdStr}`] = Date.now();
          queryClient.invalidateQueries({ queryKey: ['quarterly-report', yearStr, q, propertyIdStr], exact: false });
        });
        // Yearly
        yearlyKeys.forEach((k) => {
          const [_, yearStr, propertyIdStr] = k.split('|');
          lastInvalidateAt[`yearly|${yearStr}|${propertyIdStr}`] = Date.now();
          queryClient.invalidateQueries({ queryKey: ['yearly-report', yearStr, propertyIdStr], exact: false });
        });
        batches += 1;
        if (process.env.NODE_ENV !== 'production') {
          // Dev-only diagnostics
          console.log('[ReportsRealtime] invalidation batch', {
            daily: dailyKeys.size, monthly: monthlyKeys.size,
            quarterly: quarterlyKeys.size, yearly: yearlyKeys.size,
            debounceMs: Date.now() - started,
            batches,
          });
        }
        sendClientTelemetry([{
          type: 'reports_realtime_invalidation',
          ts: new Date().toISOString(),
          daily: dailyKeys.size, monthly: monthlyKeys.size,
          quarterly: quarterlyKeys.size, yearly: yearlyKeys.size,
          batches,
        }]);
        dailyKeys.clear();
        monthlyKeys.clear();
        quarterlyKeys.clear();
        yearlyKeys.clear();
        timer = null;
      }, 1000);
    };

    const onReportsEvents = (e: any) => {
      const events = e?.detail?.events || [];
      if (!Array.isArray(events) || events.length === 0) return;
      for (const ev of events) {
        const id = ev?.eventId;
        if (!id || seenEventIds.has(id)) continue;
        seenEventIds.add(id);
        const propertyId: number | undefined = ev?.propertyId;
        const txDateIso: string | undefined = ev?.metadata?.transactionDate || ev?.timestamp;
        const dates: string[] = Array.isArray(ev?.metadata?.affectedReportDates) ? ev.metadata.affectedReportDates : [];
        const candidates = new Set<string>();
        const d = toISTDate(txDateIso);
        if (d) candidates.add(d);
        dates.forEach((raw) => {
          const dd = toISTDate(raw);
          if (dd) candidates.add(dd);
        });
        // Build keys
        for (const dateStr of candidates) {
          if (!propertyId) continue;
          // Daily key
          dailyKeys.add(['daily', String(propertyId), dateStr].join('|'));
          // Monthly key
          const { year, month } = monthFromDate(dateStr);
          monthlyKeys.add(['monthly', String(propertyId), String(year), String(month)].join('|'));
          // Quarterly & yearly
          const q = quarterFromMonth(year, month);
          quarterlyKeys.add(['quarterly', String(q.year), q.q, String(propertyId)].join('|'));
          yearlyKeys.add(['yearly', String(year), String(propertyId)].join('|'));
        }
      }
      scheduleInvalidate();
    };

    window.addEventListener('finance-stream-events', onReportsEvents as EventListener);
    return () => {
      window.removeEventListener('finance-stream-events', onReportsEvents as EventListener);
      if (timer) clearTimeout(timer);
    };
  }, [queryClient]);

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="px-6 py-6">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
              <p className="text-sm text-gray-600">Generate comprehensive reports and insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live Data</span>
          </div>
        </div>

        <FinanceTabs defaultValue="daily-manager" theme={theme}>
          <FinanceTabsList className="grid-cols-3" theme={theme}>
            <FinanceTabsTrigger value="daily-manager" theme={theme}>
              <Receipt className="h-4 w-4 mr-2" />
              Daily Report Manager
            </FinanceTabsTrigger>
            <FinanceTabsTrigger value="daily-spreadsheet" theme={theme}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Monthly Spreadsheet
            </FinanceTabsTrigger>
            <FinanceTabsTrigger value="monthly-yearly" theme={theme}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Quarterly & Yearly
            </FinanceTabsTrigger>
          </FinanceTabsList>

        {/* Tab Content Container */}
        <div className="px-6 py-6">
          <div className="max-w-7xl mx-auto">
            <TabsContent value="daily-manager" className="space-y-6 mt-0">
              <DailyReportManagerContent 
                selectedPropertyId={selectedPropertyId}
                selectedDate={selectedDate}
                onPropertyDateChange={(propertyId: number, date: string) => {
                  setSelectedPropertyId(propertyId.toString());
                  setSelectedDate(date);
                }}
              />
            </TabsContent>

            <TabsContent value="daily-spreadsheet" className="space-y-6 mt-0">
              <DailyReportsManager 
                onOpenDailyReportManager={(propertyId: number, date: string) => {
                  setSelectedPropertyId(propertyId.toString());
                  setSelectedDate(date);
                }}
              />
            </TabsContent>

            <TabsContent value="monthly-yearly" className="space-y-6 mt-0">
              <MonthlyYearlyReports />
            </TabsContent>
          </div>
        </div>
        </FinanceTabs>
      </div>
    </div>
  );
}

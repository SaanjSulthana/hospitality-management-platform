import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { formatCurrency as formatCurrencyUtil } from '../lib/currency';
import { getCurrentDateString } from '../lib/date-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Building2
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
      queryClient.invalidateQueries({ queryKey: ['daily-transactions'] });
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
                  {new Date(date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
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
  
  // State for the manager
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [isEditingOpeningBalance, setIsEditingOpeningBalance] = useState<boolean>(false);

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

  // Fetch previous day's closing balance for carry forward
  const { data: previousDayData } = useQuery({
    queryKey: ['previous-day-closing', propertyId, selectedDate, orgId],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      const yesterday = new Date(selectedDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      try {
        console.log('DailyReportManagerContent: Calculating previous day balance for:', yesterdayStr);
        
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
        
        // Get previous day's opening balance (if any)
        const prevOpeningBalance = 0; // For now, assume 0. In future, this could be stored in database
        
        const prevClosingBalance = prevOpeningBalance + prevCashRevenue - prevCashExpenses;
        
        console.log('DailyReportManagerContent: Previous day closing balance:', prevClosingBalance);
        return { closingBalanceCents: prevClosingBalance };
      } catch (error) {
        console.error('DailyReportManagerContent: Error calculating previous day balance:', error);
        return { closingBalanceCents: 0 };
      }
    },
    enabled: !!propertyId && !!selectedDate && !!orgId,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });

  // Fetch all transactions for the selected date
  const { data: transactionsData, isLoading: isLoadingTransactions, error: transactionsError } = useQuery({
    queryKey: ['daily-transactions', propertyId, selectedDate, orgId],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      console.log('DailyReportManager: Fetching transactions for:', { propertyId, selectedDate, orgId });
      
      // Fetch revenues for the date
      const revenuesResponse = await backend.finance.listRevenues({
        propertyId,
        startDate: selectedDate,
        endDate: selectedDate,
        orgId
      });
      
      // Fetch expenses for the date
      const expensesResponse = await backend.finance.listExpenses({
        propertyId,
        startDate: selectedDate,
        endDate: selectedDate,
        orgId
      });
      
      return {
        revenues: revenuesResponse.revenues || [],
        expenses: expensesResponse.expenses || []
      };
    },
    enabled: !!propertyId && !!selectedDate && !!orgId,
    staleTime: 30000,
    gcTime: 600000,
  });

  // Calculate values from transactions
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
  
  // Calculate opening balance with carry-forward logic
  const isFirstDay = !previousDayData?.closingBalanceCents || previousDayData.closingBalanceCents === 0;
  const autoCalculatedOpeningBalance = previousDayData?.closingBalanceCents || 0;
  const currentOpeningBalance = openingBalance || autoCalculatedOpeningBalance;
  
  const totalCash = currentOpeningBalance + cashRevenue;
  const closingBalance = totalCash - cashExpenses;

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
          date: selectedDate
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
    <div className="space-y-6">
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
                  {new Date(selectedDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Property ID</p>
                <p className="font-semibold text-gray-900">#{propertyId}</p>
              </div>
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
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="opening-balance" className="text-sm font-medium text-gray-700">Manual Override (Optional)</Label>
                    <Input
                      id="opening-balance"
                      type="number"
                      value={openingBalance / 100}
                      onChange={(e) => setOpeningBalance(parseFloat(e.target.value) * 100)}
                      className="w-full h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setOpeningBalance(autoCalculatedOpeningBalance)}
                      disabled={isFirstDay}
                      className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                    >
                      Auto-fill
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setOpeningBalance(0)}
                      className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
                {!isFirstDay && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-700">
                      <strong>Previous Day Closing:</strong> {formatCurrency(autoCalculatedOpeningBalance)}
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
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['daily-transactions'] })} 
                    disabled={isLoadingTransactions}
                    className="transition-all duration-200 hover:scale-105 hover:shadow-md flex-shrink-0"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingTransactions ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                    <span className="sm:hidden">Refresh</span>
                  </Button>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Tabs defaultValue="daily-manager" className="space-y-0">
        {/* Enhanced Sticky Tabs Navigation */}
        <div className="sticky top-20 z-30 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 border-b-2 border-orange-400 -mx-6 px-4 py-3 shadow-2xl rounded-b-xl">
          <div className="overflow-x-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1 border border-white/20 shadow-inner">
              <TabsList className="grid w-full grid-cols-3 min-w-max bg-transparent h-auto p-0 gap-2">
                <TabsTrigger 
                  value="daily-manager" 
                  className="text-xs sm:text-sm px-4 sm:px-8 py-4 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-orange-300 data-[state=inactive]:text-white data-[state=inactive]:bg-gradient-to-r data-[state=inactive]:from-orange-500/30 data-[state=inactive]:to-orange-600/30 data-[state=inactive]:hover:from-orange-500/50 data-[state=inactive]:hover:to-orange-600/50 data-[state=inactive]:hover:shadow-lg data-[state=inactive]:border data-[state=inactive]:border-white/30 transition-all duration-500 flex items-center gap-2 rounded-xl font-semibold relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <span className="relative z-10">Daily Report Manager</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="daily-spreadsheet" 
                  className="text-xs sm:text-sm px-4 sm:px-8 py-4 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-orange-300 data-[state=inactive]:text-white data-[state=inactive]:bg-gradient-to-r data-[state=inactive]:from-orange-500/30 data-[state=inactive]:to-orange-600/30 data-[state=inactive]:hover:from-orange-500/50 data-[state=inactive]:hover:to-orange-600/50 data-[state=inactive]:hover:shadow-lg data-[state=inactive]:border data-[state=inactive]:border-white/30 transition-all duration-500 flex items-center gap-2 rounded-xl font-semibold relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <span className="relative z-10">Daily Report Spreadsheet</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="monthly-yearly" 
                  className="text-xs sm:text-sm px-4 sm:px-8 py-4 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-orange-300 data-[state=inactive]:text-white data-[state=inactive]:bg-gradient-to-r data-[state=inactive]:from-orange-500/30 data-[state=inactive]:to-orange-600/30 data-[state=inactive]:hover:from-orange-500/50 data-[state=inactive]:hover:to-orange-600/50 data-[state=inactive]:hover:shadow-lg data-[state=inactive]:border data-[state=inactive]:border-white/30 transition-all duration-500 flex items-center gap-2 rounded-xl font-semibold relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <span className="relative z-10">Monthly & Yearly</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        {/* Enhanced Tab Content Container */}
        <div className="px-6 py-6">
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
      </Tabs>
    </div>
  );
}

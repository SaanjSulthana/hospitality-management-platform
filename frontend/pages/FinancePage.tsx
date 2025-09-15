import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { formatCurrency as formatCurrencyUtil } from '../lib/currency';
import { formatCardDateTime } from '../lib/datetime';
import { formatDateForAPI, getCurrentDateString, getCurrentDateTimeString } from '../lib/date-utils';
import { API_CONFIG } from '../src/config/api';
import { FileUpload } from '@/components/ui/file-upload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { ReceiptViewer } from '@/components/ui/receipt-viewer';
import { DailyApprovalManager } from '@/components/ui/daily-approval-manager';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Calendar,
  Building2,
  Upload,
  Check,
  X,
  Eye,
  RefreshCw,
  BarChart3,
  Banknote,
  CreditCard,
  Edit,
  Trash2
} from 'lucide-react';

// Helper function to get current timestamp (deprecated - use date utils instead)
const getCurrentTimestamp = (): string => {
  const timestamp = getCurrentDateTimeString();
  console.log('Current timestamp being sent:', timestamp);
  return timestamp;
};

export default function FinancePage() {
  const { getAuthenticatedBackend, user } = useAuth();
  const { theme } = useTheme();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();

  // Set page title and description
  useEffect(() => {
    setPageTitle('Financial Management', 'Track expenses, revenues, and financial performance');
  }, [setPageTitle]);
  const queryClient = useQueryClient();
  
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isEditExpenseDialogOpen, setIsEditExpenseDialogOpen] = useState(false);
  const [isEditRevenueDialogOpen, setIsEditRevenueDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [editingRevenue, setEditingRevenue] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<{
    id: number;
    type: 'expense' | 'revenue';
    category?: string;
    source?: string;
    propertyName: string;
    amountCents: number;
    description?: string;
    receiptUrl?: string;
    receiptFileId?: number;
    date: Date;
    createdAt?: Date;
    createdByName: string;
    status?: string;
    paymentMode?: string;
    bankReference?: string;
    approvedByName?: string;
    approvedAt?: Date;
  } | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  // Debug date range changes
  React.useEffect(() => {
    console.log('=== DATE RANGE STATE CHANGED ===');
    console.log('New dateRange:', dateRange);
  }, [dateRange]);

  // Date validation function
  const validateDateRange = (startDate: string, endDate: string) => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        toast({
          variant: "destructive",
          title: "Invalid date range",
          description: "Start date must be before or equal to end date.",
        });
        return false;
      }
    }
    return true;
  };

  // Enhanced date range change handler
  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    console.log('=== DATE RANGE CHANGE DEBUG ===');
    console.log('Field:', field);
    console.log('Value:', value);
    console.log('Current dateRange:', dateRange);
    
    const newDateRange = { ...dateRange, [field]: value };
    
    // If only start date is provided, set end date to the same date for full day filtering
    if (field === 'startDate' && value && !newDateRange.endDate) {
      newDateRange.endDate = value;
      console.log('Auto-setting endDate to:', value);
    }
    
    // If only end date is provided, set start date to the same date for full day filtering
    if (field === 'endDate' && value && !newDateRange.startDate) {
      newDateRange.startDate = value;
      console.log('Auto-setting startDate to:', value);
    }
    
    if (field === 'startDate' && newDateRange.endDate && value > newDateRange.endDate) {
      // Auto-adjust end date if it's before start date
      newDateRange.endDate = value;
      console.log('Auto-adjusting endDate to:', value);
    }
    
    console.log('New dateRange:', newDateRange);
    
    if (validateDateRange(newDateRange.startDate, newDateRange.endDate)) {
      setDateRange(newDateRange);
      console.log('Date range updated successfully');
    } else {
      console.log('Date range validation failed');
    }
  };
  const [expenseForm, setExpenseForm] = useState({
    propertyId: '',
    category: '',
    amountCents: '',
    description: '',
    receiptUrl: '',
    receiptFile: null as { fileId: number; filename: string } | null,
    expenseDate: getCurrentDateString(),
    paymentMode: 'cash' as 'cash' | 'bank',
    bankReference: '',
  });
  const [revenueForm, setRevenueForm] = useState({
    propertyId: '',
    source: 'other' as 'room' | 'addon' | 'other',
    amountCents: '',
    description: '',
    receiptUrl: '',
    receiptFile: null as { fileId: number; filename: string } | null,
    occurredAt: getCurrentDateString(),
    paymentMode: 'cash' as 'cash' | 'bank',
    bankReference: '',
  });

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list({});
    },
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', selectedPropertyId, dateRange],
    queryFn: async () => {
      console.log('Fetching expenses with filters:', {
        propertyId: selectedPropertyId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      const backend = getAuthenticatedBackend();
      const result = await backend.finance.listExpenses({
        propertyId: selectedPropertyId && selectedPropertyId !== 'all' ? parseInt(selectedPropertyId) : undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      
      // Debug logging for approval information
      if (result?.expenses) {
        console.log('Expenses with approval info:', result.expenses.map(expense => ({
          id: expense.id,
          status: expense.status,
          approvedByName: expense.approvedByName,
          approvedAt: expense.approvedAt,
          createdByName: expense.createdByName
        })));
      }
      
      return result;
    },
    refetchInterval: 3000, // Refresh every 3 seconds for real-time updates (increased frequency)
    staleTime: 0, // Consider data immediately stale
    gcTime: 0, // Don't cache results
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  });

  const { data: revenues, isLoading: revenuesLoading } = useQuery({
    queryKey: ['revenues', selectedPropertyId, dateRange],
    queryFn: async () => {
      console.log('=== REVENUE FILTER DEBUG ===');
      console.log('Date range state:', dateRange);
      console.log('Selected property ID:', selectedPropertyId);
      console.log('Start date:', dateRange.startDate);
      console.log('End date:', dateRange.endDate);
      console.log('Will send to backend:', {
        propertyId: selectedPropertyId && selectedPropertyId !== 'all' ? parseInt(selectedPropertyId) : undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      
      const backend = getAuthenticatedBackend();
      const result = await backend.finance.listRevenues({
        propertyId: selectedPropertyId && selectedPropertyId !== 'all' ? parseInt(selectedPropertyId) : undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      
      // Debug logging for approval information
      if (result?.revenues) {
        console.log('Revenues with approval info:', result.revenues.map(revenue => ({
          id: revenue.id,
          status: revenue.status,
          approvedByName: revenue.approvedByName,
          approvedAt: revenue.approvedAt,
          createdByName: revenue.createdByName
        })));
      }
      
      return result;
    },
    refetchInterval: 3000, // Refresh every 3 seconds for real-time updates (increased frequency)
    staleTime: 0, // Consider data immediately stale
    gcTime: 0, // Don't cache results
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  });

  const { data: profitLoss } = useQuery({
    queryKey: ['profit-loss', selectedPropertyId, dateRange],
    queryFn: async () => {
      console.log('Fetching profit-loss with filters:', {
        propertyId: selectedPropertyId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      const backend = getAuthenticatedBackend();
      return backend.reports.getMonthlyYearlyReport({
        propertyId: selectedPropertyId && selectedPropertyId !== 'all' ? parseInt(selectedPropertyId) : undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
    },
    staleTime: 0, // Always consider data stale for testing
    gcTime: 0, // Don't cache results
    refetchInterval: 3000, // Refresh every 3 seconds for testing (increased frequency)
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  });

  // Check daily approval status for managers
  const { data: approvalStatus } = useQuery({
    queryKey: ['daily-approval-check'],
    queryFn: async () => {
      // Direct API call since the endpoint isn't in generated client yet
      const response = await fetch(`${API_CONFIG.BASE_URL}/finance/check-daily-approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to check approval status: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: user?.role === 'MANAGER',
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates (increased frequency)
    staleTime: 0, // Consider data immediately stale
    gcTime: 0, // Don't cache results
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('=== ADD EXPENSE MUTATION ===');
      console.log('Input data:', data);
      
      const backend = getAuthenticatedBackend();
      const result = await backend.finance.addExpense({
        ...data,
        propertyId: parseInt(data.propertyId),
        amountCents: parseInt(data.amountCents),
        receiptFileId: data.receiptFile?.fileId || undefined,
        expenseDate: formatDateForAPI(data.expenseDate),
        paymentMode: data.paymentMode || 'cash',
        bankReference: data.bankReference || undefined,
      });
      
      console.log('Add expense result:', result);
      return result;
    },
    onMutate: async (newExpense) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['expenses'] });
      
      // Snapshot the previous value
      const previousExpenses = queryClient.getQueryData(['expenses']);
      
      // Optimistically update the cache
      queryClient.setQueryData(['expenses'], (old: any) => {
        if (!old?.expenses) return old;
        
        const optimisticExpense = {
          id: Date.now(), // Temporary ID
          ...newExpense,
          amountCents: parseInt(newExpense.amountCents),
          propertyId: parseInt(newExpense.propertyId),
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        return {
          ...old,
          expenses: [optimisticExpense, ...old.expenses]
        };
      });
      
      return { previousExpenses };
    },
    onSuccess: () => {
      console.log('Expense added successfully');
      
      // Aggressive cache invalidation for real-time updates
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      // Force immediate refetch for all users
      queryClient.refetchQueries({ queryKey: ['expenses'] });
      queryClient.refetchQueries({ queryKey: ['profit-loss'] });
      queryClient.refetchQueries({ queryKey: ['pending-approvals'] });
      queryClient.refetchQueries({ queryKey: ['daily-approval-check'] });
      
      // Clear form and show success
      setIsExpenseDialogOpen(false);
      setExpenseForm({
        propertyId: '',
        category: '',
        amountCents: '',
        description: '',
        receiptUrl: '',
        receiptFile: null,
        expenseDate: getCurrentDateString(),
        paymentMode: 'cash',
        bankReference: '',
      });
      toast({
        title: "Expense added",
        description: "The expense has been recorded successfully.",
      });
    },
    onError: (error: any, newExpense, context) => {
      // Rollback on error
      if (context?.previousExpenses) {
        queryClient.setQueryData(['expenses'], context.previousExpenses);
      }
      
      console.error('Add expense error:', error);
      
      // Check if this is an authentication error
      if (error.message?.includes('Invalid token') || error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        toast({
          variant: "destructive",
          title: "Session Expired",
          description: "Your session has expired. Please log in again to continue.",
        });
        
        // Redirect to login after a short delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        
        return;
      }
      
      // Handle other errors
      toast({
        variant: "destructive",
        title: "Failed to add expense",
        description: error.message || "Please try again.",
      });
    },
  });

  const addRevenueMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('=== ADD REVENUE MUTATION ===');
      console.log('Input data:', data);
      
      const backend = getAuthenticatedBackend();
      const result = await backend.finance.addRevenue({
        ...data,
        propertyId: parseInt(data.propertyId),
        amountCents: parseInt(data.amountCents),
        receiptFileId: data.receiptFile?.fileId || undefined,
        occurredAt: formatDateForAPI(data.occurredAt),
        paymentMode: data.paymentMode || 'cash',
        bankReference: data.bankReference || undefined,
      });
      
      console.log('Add revenue result:', result);
      return result;
    },
    onMutate: async (newRevenue) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['revenues'] });
      
      // Snapshot the previous value
      const previousRevenues = queryClient.getQueryData(['revenues']);
      
      // Optimistically update the cache
      queryClient.setQueryData(['revenues'], (old: any) => {
        if (!old?.revenues) return old;
        
        const optimisticRevenue = {
          id: Date.now(), // Temporary ID
          ...newRevenue,
          amountCents: parseInt(newRevenue.amountCents),
          propertyId: parseInt(newRevenue.propertyId),
          status: 'approved',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        return {
          ...old,
          revenues: [optimisticRevenue, ...old.revenues]
        };
      });
      
      return { previousRevenues };
    },
    onSuccess: () => {
      console.log('Revenue added successfully');
      
      // Aggressive cache invalidation for real-time updates
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      // Force immediate refetch for all users
      queryClient.refetchQueries({ queryKey: ['revenues'] });
      queryClient.refetchQueries({ queryKey: ['profit-loss'] });
      queryClient.refetchQueries({ queryKey: ['pending-approvals'] });
      queryClient.refetchQueries({ queryKey: ['daily-approval-check'] });
      
      // Clear form and show success
      setIsRevenueDialogOpen(false);
      setRevenueForm({
        propertyId: '',
        source: 'other',
        amountCents: '',
        description: '',
        receiptUrl: '',
        receiptFile: null,
        occurredAt: getCurrentDateString(),
        paymentMode: 'cash',
        bankReference: '',
      });
      toast({
        title: "Revenue added",
        description: "The revenue has been recorded successfully.",
      });
    },
    onError: (error: any, newRevenue, context) => {
      // Rollback on error
      if (context?.previousRevenues) {
        queryClient.setQueryData(['revenues'], context.previousRevenues);
      }
      
      console.error('Add revenue error:', error);
      toast({
        variant: "destructive",
        title: "Failed to add revenue",
        description: error.message || "Please try again.",
      });
    },
  });

  const approveExpenseMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: number; approved: boolean }) => {
      // Direct API call since the generated client might have issues
      const response = await fetch(`${API_CONFIG.BASE_URL}/finance/expenses/${id}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ id, approved }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to approve expense: ${response.statusText}`);
      }
      
      return response.json();
    },
    onMutate: async ({ id, approved }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['expenses'] });
      
      // Snapshot the previous value
      const previousExpenses = queryClient.getQueryData(['expenses']);
      
      // Optimistically update the cache
      queryClient.setQueryData(['expenses'], (old: any) => {
        if (!old?.expenses) return old;
        
        return {
          ...old,
          expenses: old.expenses.map((expense: any) => 
            expense.id === id 
              ? { ...expense, status: approved ? 'approved' : 'rejected' }
              : expense
          )
        };
      });
      
      return { previousExpenses };
    },
    onSuccess: () => {
      console.log('Expense approval successful');
      
      // Aggressive cache invalidation for real-time updates
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      // Force immediate refetch for all users
      queryClient.refetchQueries({ queryKey: ['expenses'] });
      queryClient.refetchQueries({ queryKey: ['profit-loss'] });
      queryClient.refetchQueries({ queryKey: ['pending-approvals'] });
      queryClient.refetchQueries({ queryKey: ['daily-approval-check'] });
      
      toast({
        title: "Expense updated",
        description: "The expense status has been updated.",
      });
    },
    onError: (error: any, { id, approved }, context) => {
      // Rollback on error
      if (context?.previousExpenses) {
        queryClient.setQueryData(['expenses'], context.previousExpenses);
      }
      
      console.error('Approve expense error:', error);
      toast({
        variant: "destructive",
        title: "Failed to update expense",
        description: error.message || "Please try again.",
      });
    },
  });

  const approveRevenueMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: number; approved: boolean }) => {
      // Direct API call for revenue approval
      const response = await fetch(`${API_CONFIG.BASE_URL}/finance/revenues/${id}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ id, approved }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to approve revenue: ${response.statusText}`);
      }
      
      return response.json();
    },
    onMutate: async ({ id, approved }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['revenues'] });
      
      // Snapshot the previous value
      const previousRevenues = queryClient.getQueryData(['revenues']);
      
      // Optimistically update the cache
      queryClient.setQueryData(['revenues'], (old: any) => {
        if (!old?.revenues) return old;
        
        return {
          ...old,
          revenues: old.revenues.map((revenue: any) => 
            revenue.id === id 
              ? { ...revenue, status: approved ? 'approved' : 'rejected' }
              : revenue
          )
        };
      });
      
      return { previousRevenues };
    },
    onSuccess: () => {
      console.log('Revenue approval successful');
      
      // Aggressive cache invalidation for real-time updates
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      // Force immediate refetch for all users
      queryClient.refetchQueries({ queryKey: ['revenues'] });
      queryClient.refetchQueries({ queryKey: ['profit-loss'] });
      queryClient.refetchQueries({ queryKey: ['pending-approvals'] });
      queryClient.refetchQueries({ queryKey: ['daily-approval-check'] });
      
      toast({
        title: "Revenue updated",
        description: "The revenue status has been updated.",
      });
    },
    onError: (error: any, { id, approved }, context) => {
      // Rollback on error
      if (context?.previousRevenues) {
        queryClient.setQueryData(['revenues'], context.previousRevenues);
      }
      
      console.error('Approve revenue error:', error);
      toast({
        variant: "destructive",
        title: "Failed to update revenue",
        description: error.message || "Please try again.",
      });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`${API_CONFIG.BASE_URL}/finance/expenses/${data.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          ...data,
          propertyId: parseInt(data.propertyId),
          amountCents: parseInt(data.amountCents),
          receiptFileId: data.receiptFile?.fileId || undefined,
          expenseDate: formatDateForAPI(data.expenseDate),
          paymentMode: data.paymentMode || 'cash',
          bankReference: data.bankReference || undefined,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to update expense: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
      
      setIsEditExpenseDialogOpen(false);
      setEditingExpense(null);
      toast({
        title: "Expense updated",
        description: user?.role === 'MANAGER' 
          ? "The expense has been updated and is pending approval."
          : "The expense has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Update expense error:', error);
      toast({
        variant: "destructive",
        title: "Failed to update expense",
        description: error.message || "Please try again.",
      });
    },
  });

  const updateRevenueMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`${API_CONFIG.BASE_URL}/finance/revenues/${data.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          ...data,
          propertyId: parseInt(data.propertyId),
          amountCents: parseInt(data.amountCents),
          receiptFileId: data.receiptFile?.fileId || undefined,
          occurredAt: formatDateForAPI(data.occurredAt),
          paymentMode: data.paymentMode || 'cash',
          bankReference: data.bankReference || undefined,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to update revenue: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
      
      setIsEditRevenueDialogOpen(false);
      setEditingRevenue(null);
      toast({
        title: "Revenue updated",
        description: user?.role === 'MANAGER' 
          ? "The revenue has been updated and is pending approval."
          : "The revenue has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Update revenue error:', error);
      toast({
        variant: "destructive",
        title: "Failed to update revenue",
        description: error.message || "Please try again.",
      });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: number) => {
      const backend = getAuthenticatedBackend();
      if (!backend) {
        throw new Error('Not authenticated');
      }
      
      try {
        const response = await backend.finance.deleteExpense(id);
        return response;
      } catch (error: any) {
        console.error('Delete expense error:', error);
        throw new Error(error.message || 'Failed to delete expense');
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
      
      toast({
        title: data.deleted ? "Expense deleted" : "Deletion requested",
        description: data.deleted 
          ? "The expense has been deleted successfully."
          : "Expense deletion has been requested and is pending approval.",
      });
    },
    onError: (error: any) => {
      console.error('Delete expense error:', error);
      toast({
        variant: "destructive",
        title: "Failed to delete expense",
        description: error.message || "Please try again.",
      });
    },
  });

  const deleteRevenueMutation = useMutation({
    mutationFn: async (id: number) => {
      const backend = getAuthenticatedBackend();
      if (!backend) {
        throw new Error('Not authenticated');
      }
      
      try {
        const response = await backend.finance.deleteRevenue(id);
        return response;
      } catch (error: any) {
        console.error('Delete revenue error:', error);
        throw new Error(error.message || 'Failed to delete revenue');
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
      
      toast({
        title: data.deleted ? "Revenue deleted" : "Deletion requested",
        description: data.deleted 
          ? "The revenue has been deleted successfully."
          : "Revenue deletion has been requested and is pending approval.",
      });
    },
    onError: (error: any) => {
      console.error('Delete revenue error:', error);
      toast({
        variant: "destructive",
        title: "Failed to delete revenue",
        description: error.message || "Please try again.",
      });
    },
  });

  const formatCurrency = (amountCents: number) => {
    return formatCurrencyUtil(amountCents, theme.currency);
  };

  // Helper function to format period label
  const formatPeriodLabel = (startDate: Date, endDate: Date) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // If same month and year, show just the month
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
    }
    
    // If different months, show the range
    return `${monthNames[start.getMonth()]} ${start.getFullYear()} - ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
  };

  // File upload handler for revenue form
  const handleRevenueFileUpload = async (file: File): Promise<{ fileId: number; filename: string; url: string }> => {
    if (isUploading) {
      throw new Error('Upload in progress, please wait...');
    }
    
    setIsUploading(true);
    
    try {
      // Convert file to base64 for API
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const base64String = btoa(String.fromCharCode(...buffer));
      
      // Direct API call since uploads service isn't in generated client yet
      const response = await fetch(`${API_CONFIG.BASE_URL}/uploads/file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          fileData: base64String,
          filename: file.name,
          mimeType: file.type,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const uploadResult = await response.json();
      
      const result = {
        fileId: uploadResult.fileId,
        filename: uploadResult.filename,
        url: uploadResult.url,
      };
      
      // Update revenue form state
      setRevenueForm(prev => ({ 
        ...prev, 
        receiptFile: { fileId: result.fileId, filename: result.filename }
      }));
      
      return result;
    } catch (error) {
      console.error('Revenue file upload error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  // File upload handler for expense form
  const handleExpenseFileUpload = async (file: File): Promise<{ fileId: number; filename: string; url: string }> => {
    if (isUploading) {
      throw new Error('Upload in progress, please wait...');
    }
    
    setIsUploading(true);
    
    try {
      // Convert file to base64 for API
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const base64String = btoa(String.fromCharCode(...buffer));
      
      // Direct API call since uploads service isn't in generated client yet
      const response = await fetch(`${API_CONFIG.BASE_URL}/uploads/file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          fileData: base64String,
          filename: file.name,
          mimeType: file.type,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const uploadResult = await response.json();
      
      const result = {
        fileId: uploadResult.fileId,
        filename: uploadResult.filename,
        url: uploadResult.url,
      };
      
      // Update expense form state
      setExpenseForm(prev => ({ 
        ...prev, 
        receiptFile: { fileId: result.fileId, filename: result.filename }
      }));
      
      return result;
    } catch (error) {
      console.error('Expense file upload error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'room': return 'bg-blue-100 text-blue-800';
      case 'addon': return 'bg-purple-100 text-purple-800';
      case 'other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleExpenseSubmit = () => {
    if (!expenseForm.propertyId || !expenseForm.category || !expenseForm.amountCents) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in all required fields.",
      });
      return;
    }
    addExpenseMutation.mutate(expenseForm);
  };

  const handleRevenueSubmit = () => {
    if (!revenueForm.propertyId || !revenueForm.amountCents) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in all required fields.",
      });
      return;
    }
    addRevenueMutation.mutate(revenueForm);
  };

  const handleEditExpense = (expense: any) => {
    setEditingExpense(expense);
    setExpenseForm({
      propertyId: expense.propertyId.toString(),
      category: expense.category,
      amountCents: expense.amountCents.toString(),
      description: expense.description || '',
      receiptUrl: expense.receiptUrl || '',
      receiptFile: expense.receiptFileId ? { fileId: expense.receiptFileId, filename: 'Existing file' } : null,
      expenseDate: new Date(expense.expenseDate).toISOString().split('T')[0],
      paymentMode: expense.paymentMode,
      bankReference: expense.bankReference || '',
    });
    setIsEditExpenseDialogOpen(true);
  };

  const handleEditRevenue = (revenue: any) => {
    setEditingRevenue(revenue);
    setRevenueForm({
      propertyId: revenue.propertyId.toString(),
      source: revenue.source,
      amountCents: revenue.amountCents.toString(),
      description: revenue.description || '',
      receiptUrl: revenue.receiptUrl || '',
      receiptFile: revenue.receiptFileId ? { fileId: revenue.receiptFileId, filename: 'Existing file' } : null,
      occurredAt: new Date(revenue.occurredAt).toISOString().split('T')[0],
      paymentMode: revenue.paymentMode,
      bankReference: revenue.bankReference || '',
    });
    setIsEditRevenueDialogOpen(true);
  };

  const handleUpdateExpenseSubmit = () => {
    if (!expenseForm.propertyId || !expenseForm.category || !expenseForm.amountCents) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in all required fields.",
      });
      return;
    }
    updateExpenseMutation.mutate({ ...expenseForm, id: editingExpense.id });
  };

  const handleUpdateRevenueSubmit = () => {
    if (!revenueForm.propertyId || !revenueForm.amountCents) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in all required fields.",
      });
      return;
    }
    updateRevenueMutation.mutate({ ...revenueForm, id: editingRevenue.id });
  };

  const handleDeleteExpense = (id: number) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      deleteExpenseMutation.mutate(id);
    }
  };

  const handleDeleteRevenue = (id: number) => {
    if (window.confirm('Are you sure you want to delete this revenue?')) {
      deleteRevenueMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="space-y-6">
        {/* Daily Approval Status Banner for Managers */}
        {user?.role === 'MANAGER' && approvalStatus && (
          <Card className={`border-l-4 ${
            !approvalStatus.canAddTransactions 
              ? 'border-l-red-500 bg-red-50 border-red-200' 
              : approvalStatus.hasUnapprovedTransactions 
              ? 'border-l-yellow-500 bg-yellow-50 border-yellow-200'
              : 'border-l-green-500 bg-green-50 border-green-200'
          } shadow-sm hover:shadow-md transition-shadow duration-200`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    !approvalStatus.canAddTransactions 
                      ? 'bg-red-100' 
                      : approvalStatus.hasUnapprovedTransactions 
                      ? 'bg-yellow-100'
                      : 'bg-green-100'
                  }`}>
                    <Calendar className={`h-5 w-5 ${
                      !approvalStatus.canAddTransactions 
                        ? 'text-red-600' 
                        : approvalStatus.hasUnapprovedTransactions 
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${
                      !approvalStatus.canAddTransactions 
                        ? 'text-red-800' 
                        : approvalStatus.hasUnapprovedTransactions 
                        ? 'text-yellow-800'
                        : 'text-green-800'
                    }`}>
                      {!approvalStatus.canAddTransactions 
                        ? 'Approval Required' 
                        : approvalStatus.hasUnapprovedTransactions 
                        ? 'Pending Approval'
                        : 'Approved'}
                    </h3>
                    {approvalStatus.message && (
                      <p className={`text-sm mt-1 ${
                        !approvalStatus.canAddTransactions 
                          ? 'text-red-700' 
                          : approvalStatus.hasUnapprovedTransactions 
                          ? 'text-yellow-700'
                          : 'text-green-700'
                      }`}>
                        {approvalStatus.message}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Manual Refresh Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('Manual refresh of daily approval status...');
                    queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
                    queryClient.refetchQueries({ queryKey: ['daily-approval-check'] });
                    queryClient.invalidateQueries({ queryKey: ['notifications'] });
                    queryClient.refetchQueries({ queryKey: ['notifications'] });
                    toast({
                      title: "Refreshing...",
                      description: "Checking for approval status updates",
                    });
                  }}
                  className="transition-all duration-200 hover:scale-105 hover:shadow-md flex-shrink-0"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Refresh Status</span>
                  <span className="sm:hidden">Refresh</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Search and Filter Section */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              Financial Filters
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live</span>
            </CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Filter transactions by property and date range
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Property Filter */}
              <div className="space-y-2">
                <Label htmlFor="property-filter" className="text-sm font-medium text-gray-700">Property</Label>
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="All properties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All properties</SelectItem>
                    {properties?.properties.map((property: any) => (
                      <SelectItem key={property.id} value={property.id.toString()}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date Filter */}
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-sm font-medium text-gray-700">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* End Date Filter */}
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-sm font-medium text-gray-700">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Clear Filters Button */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 opacity-0">Actions</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedPropertyId('all');
                    setDateRange({ startDate: '', endDate: '' });
                  }}
                  className="h-11 w-full transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Clear Filters</span>
                  <span className="sm:hidden">Clear</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Action Buttons Section */}
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <Dialog open={isRevenueDialogOpen} onOpenChange={setIsRevenueDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                    disabled={user?.role === 'MANAGER' && approvalStatus && !approvalStatus.canAddTransactions}
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Add Revenue</span>
                    <span className="sm:hidden">Revenue</span>
                  </Button>
                </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
              <DialogHeader className="pb-4">
                <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  Add Revenue
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Record new revenue for your property
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-1">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="revenue-property" className="text-sm font-medium text-gray-700">Property *</Label>
                    <Select value={revenueForm.propertyId} onValueChange={(value) => setRevenueForm(prev => ({ ...prev, propertyId: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties?.properties.map((property: any) => (
                          <SelectItem key={property.id} value={property.id.toString()}>
                            {property.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="revenue-source" className="text-sm font-medium text-gray-700">Source</Label>
                    <Select value={revenueForm.source} onValueChange={(value: any) => setRevenueForm(prev => ({ ...prev, source: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="room">Room Revenue</SelectItem>
                        <SelectItem value="addon">Add-on Services</SelectItem>
                        <SelectItem value="other">Other Revenue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="revenue-amount" className="text-sm font-medium text-gray-700">Amount *</Label>
                    <Input
                      id="revenue-amount"
                      type="number"
                      step="0.01"
                      value={revenueForm.amountCents ? (parseInt(revenueForm.amountCents) / 100).toString() : ''}
                      onChange={(e) => setRevenueForm(prev => ({ ...prev, amountCents: (parseFloat(e.target.value) * 100).toString() }))}
                      placeholder="0.00"
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="revenue-description" className="text-sm font-medium text-gray-700">Description</Label>
                    <Textarea
                      id="revenue-description"
                      value={revenueForm.description}
                      onChange={(e) => setRevenueForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Revenue description"
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <FileUpload
                      label="Receipt Upload"
                      description="Upload receipt images (JPG, PNG, GIF, WebP) or PDF files. Max size: 10MB"
                      onFileUpload={handleRevenueFileUpload}
                      value={revenueForm.receiptFile}
                      onClear={() => setRevenueForm(prev => ({ ...prev, receiptFile: null }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="revenue-payment-mode" className="text-sm font-medium text-gray-700">Payment Mode *</Label>
                    <Select value={revenueForm.paymentMode} onValueChange={(value: any) => setRevenueForm(prev => ({ ...prev, paymentMode: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank (UPI/Net Banking/Online)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {revenueForm.paymentMode === 'bank' && (
                    <div className="space-y-2">
                      <Label htmlFor="revenue-bank-reference" className="text-sm font-medium text-gray-700">Bank Reference</Label>
                      <Input
                        id="revenue-bank-reference"
                        value={revenueForm.bankReference}
                        onChange={(e) => setRevenueForm(prev => ({ ...prev, bankReference: e.target.value }))}
                        placeholder="Transaction ID, UPI reference, etc."
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="revenue-date" className="text-sm font-medium text-gray-700">Date</Label>
                    <Input
                      id="revenue-date"
                      type="date"
                      value={revenueForm.occurredAt}
                      onChange={(e) => setRevenueForm(prev => ({ ...prev, occurredAt: e.target.value }))}
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
                <div className="flex items-center justify-between w-full">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsRevenueDialogOpen(false)}
                    className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleRevenueSubmit} 
                    disabled={addRevenueMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    {addRevenueMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Add Revenue
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

              <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="bg-red-600 hover:bg-red-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                    disabled={user?.role === 'MANAGER' && approvalStatus && !approvalStatus.canAddTransactions}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Add Expense</span>
                    <span className="sm:hidden">Expense</span>
                  </Button>
                </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
              <DialogHeader className="pb-4">
                <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="p-2 bg-red-100 rounded-lg shadow-sm">
                    <Plus className="h-5 w-5 text-red-600" />
                  </div>
                  Add Expense
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Record a new expense for your property
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-1">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="expense-property" className="text-sm font-medium text-gray-700">Property *</Label>
                    <Select value={expenseForm.propertyId} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, propertyId: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties?.properties.map((property: any) => (
                          <SelectItem key={property.id} value={property.id.toString()}>
                            {property.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="expense-category" className="text-sm font-medium text-gray-700">Category *</Label>
                    <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="supplies">Supplies</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="utilities">Utilities</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="expense-amount" className="text-sm font-medium text-gray-700">Amount *</Label>
                    <Input
                      id="expense-amount"
                      type="number"
                      step="0.01"
                      value={expenseForm.amountCents ? (parseInt(expenseForm.amountCents) / 100).toString() : ''}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, amountCents: (parseFloat(e.target.value) * 100).toString() }))}
                      placeholder="0.00"
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="expense-description" className="text-sm font-medium text-gray-700">Description</Label>
                    <Textarea
                      id="expense-description"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Expense description"
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <FileUpload
                      label="Receipt Upload"
                      description="Upload receipt images (JPG, PNG, GIF, WebP) or PDF files. Max size: 10MB"
                      onFileUpload={handleExpenseFileUpload}
                      value={expenseForm.receiptFile}
                      onClear={() => setExpenseForm(prev => ({ ...prev, receiptFile: null }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="expense-payment-mode" className="text-sm font-medium text-gray-700">Payment Mode *</Label>
                    <Select value={expenseForm.paymentMode} onValueChange={(value: any) => setExpenseForm(prev => ({ ...prev, paymentMode: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank (UPI/Net Banking/Online)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {expenseForm.paymentMode === 'bank' && (
                    <div className="space-y-2">
                      <Label htmlFor="expense-bank-reference" className="text-sm font-medium text-gray-700">Bank Reference</Label>
                      <Input
                        id="expense-bank-reference"
                        value={expenseForm.bankReference}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, bankReference: e.target.value }))}
                        placeholder="Transaction ID, UPI reference, etc."
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="expense-date" className="text-sm font-medium text-gray-700">Date</Label>
                    <Input
                      id="expense-date"
                      type="date"
                      value={expenseForm.expenseDate}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, expenseDate: e.target.value }))}
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
                <div className="flex items-center justify-between w-full">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsExpenseDialogOpen(false)}
                    className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleExpenseSubmit} 
                    disabled={addExpenseMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    {addExpenseMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Expense
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Expense Dialog */}
          <Dialog open={isEditExpenseDialogOpen} onOpenChange={setIsEditExpenseDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
              <DialogHeader className="pb-4">
                <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg shadow-sm">
                    <Edit className="h-5 w-5 text-orange-600" />
                  </div>
                  Edit Expense
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Update the expense details
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-1">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-expense-property" className="text-sm font-medium text-gray-700">Property *</Label>
                    <Select value={expenseForm.propertyId} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, propertyId: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties?.properties.map((property: any) => (
                          <SelectItem key={property.id} value={property.id.toString()}>
                            {property.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-expense-category" className="text-sm font-medium text-gray-700">Category *</Label>
                    <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="supplies">Supplies</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="utilities">Utilities</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-expense-amount" className="text-sm font-medium text-gray-700">Amount *</Label>
                    <Input
                      id="edit-expense-amount"
                      type="number"
                      step="0.01"
                      value={expenseForm.amountCents ? (parseInt(expenseForm.amountCents) / 100).toString() : ''}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, amountCents: (parseFloat(e.target.value) * 100).toString() }))}
                      placeholder="0.00"
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-expense-description" className="text-sm font-medium text-gray-700">Description</Label>
                    <Textarea
                      id="edit-expense-description"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Expense description"
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <FileUpload
                      label="Receipt Upload"
                      description="Upload receipt images (JPG, PNG, GIF, WebP) or PDF files. Max size: 10MB"
                      onFileUpload={handleExpenseFileUpload}
                      value={expenseForm.receiptFile}
                      onClear={() => setExpenseForm(prev => ({ ...prev, receiptFile: null }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-expense-payment-mode" className="text-sm font-medium text-gray-700">Payment Mode *</Label>
                    <Select value={expenseForm.paymentMode} onValueChange={(value: any) => setExpenseForm(prev => ({ ...prev, paymentMode: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank (UPI/Net Banking/Online)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {expenseForm.paymentMode === 'bank' && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-expense-bank-reference" className="text-sm font-medium text-gray-700">Bank Reference</Label>
                      <Input
                        id="edit-expense-bank-reference"
                        value={expenseForm.bankReference}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, bankReference: e.target.value }))}
                        placeholder="Transaction ID, UPI reference, etc."
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-expense-date" className="text-sm font-medium text-gray-700">Date</Label>
                    <Input
                      id="edit-expense-date"
                      type="date"
                      value={expenseForm.expenseDate}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, expenseDate: e.target.value }))}
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
                <div className="flex items-center justify-between w-full">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditExpenseDialogOpen(false)}
                    className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpdateExpenseSubmit} 
                    disabled={updateExpenseMutation.isPending}
                    className="bg-orange-600 hover:bg-orange-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    {updateExpenseMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Edit className="mr-2 h-4 w-4" />
                        Update Expense
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Revenue Dialog */}
          <Dialog open={isEditRevenueDialogOpen} onOpenChange={setIsEditRevenueDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
              <DialogHeader className="pb-4">
                <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                    <Edit className="h-5 w-5 text-blue-600" />
                  </div>
                  Edit Revenue
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Update the revenue details
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-1">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-revenue-property" className="text-sm font-medium text-gray-700">Property *</Label>
                    <Select value={revenueForm.propertyId} onValueChange={(value) => setRevenueForm(prev => ({ ...prev, propertyId: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties?.properties.map((property: any) => (
                          <SelectItem key={property.id} value={property.id.toString()}>
                            {property.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-revenue-source" className="text-sm font-medium text-gray-700">Source</Label>
                    <Select value={revenueForm.source} onValueChange={(value: any) => setRevenueForm(prev => ({ ...prev, source: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="room">Room Revenue</SelectItem>
                        <SelectItem value="addon">Add-on Services</SelectItem>
                        <SelectItem value="other">Other Revenue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-revenue-amount" className="text-sm font-medium text-gray-700">Amount *</Label>
                    <Input
                      id="edit-revenue-amount"
                      type="number"
                      step="0.01"
                      value={revenueForm.amountCents ? (parseInt(revenueForm.amountCents) / 100).toString() : ''}
                      onChange={(e) => setRevenueForm(prev => ({ ...prev, amountCents: (parseFloat(e.target.value) * 100).toString() }))}
                      placeholder="0.00"
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-revenue-description" className="text-sm font-medium text-gray-700">Description</Label>
                    <Textarea
                      id="edit-revenue-description"
                      value={revenueForm.description}
                      onChange={(e) => setRevenueForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Revenue description"
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <FileUpload
                      label="Receipt Upload"
                      description="Upload receipt images (JPG, PNG, GIF, WebP) or PDF files. Max size: 10MB"
                      onFileUpload={handleRevenueFileUpload}
                      value={revenueForm.receiptFile}
                      onClear={() => setRevenueForm(prev => ({ ...prev, receiptFile: null }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-revenue-payment-mode" className="text-sm font-medium text-gray-700">Payment Mode *</Label>
                    <Select value={revenueForm.paymentMode} onValueChange={(value: any) => setRevenueForm(prev => ({ ...prev, paymentMode: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank (UPI/Net Banking/Online)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {revenueForm.paymentMode === 'bank' && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-revenue-bank-reference" className="text-sm font-medium text-gray-700">Bank Reference</Label>
                      <Input
                        id="edit-revenue-bank-reference"
                        value={revenueForm.bankReference}
                        onChange={(e) => setRevenueForm(prev => ({ ...prev, bankReference: e.target.value }))}
                        placeholder="Transaction ID, UPI reference, etc."
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-revenue-date" className="text-sm font-medium text-gray-700">Date</Label>
                    <Input
                      id="edit-revenue-date"
                      type="date"
                      value={revenueForm.occurredAt}
                      onChange={(e) => setRevenueForm(prev => ({ ...prev, occurredAt: e.target.value }))}
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
                <div className="flex items-center justify-between w-full">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditRevenueDialogOpen(false)}
                    className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpdateRevenueSubmit} 
                    disabled={updateRevenueMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    {updateRevenueMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Edit className="mr-2 h-4 w-4" />
                        Update Revenue
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
            </div>
          </CardContent>
        </Card>

      {/* Daily Approval Manager (Admin Only) */}
      {user?.role === 'ADMIN' && (
        <DailyApprovalManager 
          className="mt-6" 
          propertyId={selectedPropertyId}
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
        />
      )}

        {/* Enhanced Financial Overview */}
        {profitLoss && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
                  {formatCurrency(profitLoss.data.totalRevenue * 100)}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {formatPeriodLabel(new Date(profitLoss.period.startDate), new Date(profitLoss.period.endDate))}
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
                  {formatCurrency(profitLoss.data.totalExpenses * 100)}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {formatPeriodLabel(new Date(profitLoss.period.startDate), new Date(profitLoss.period.endDate))}
                </p>
              </CardContent>
            </Card>

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
                <div className={`text-2xl font-bold ${profitLoss.data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(profitLoss.data.netIncome * 100)}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {formatPeriodLabel(new Date(profitLoss.period.startDate), new Date(profitLoss.period.endDate))}
                </p>
              </CardContent>
            </Card>

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
                <div className={`text-2xl font-bold ${profitLoss.data.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {profitLoss.data.profitMargin.toFixed(1)}%
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {formatPeriodLabel(new Date(profitLoss.period.startDate), new Date(profitLoss.period.endDate))}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Enhanced Financial Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                  <Banknote className="h-4 w-4 text-green-600" />
                </div>
                Cash Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  revenues?.revenues
                    ?.filter((r: any) => r.paymentMode === 'cash' && r.status === 'approved')
                    ?.reduce((sum: number, r: any) => sum + r.amountCents, 0) || 0
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {selectedPropertyId !== 'all' || dateRange.startDate || dateRange.endDate 
                  ? 'Filtered approved cash transactions' 
                  : 'All approved cash transactions'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                </div>
                Bank/UPI Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(
                  revenues?.revenues
                    ?.filter((r: any) => r.paymentMode === 'bank' && r.status === 'approved')
                    ?.reduce((sum: number, r: any) => sum + r.amountCents, 0) || 0
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {selectedPropertyId !== 'all' || dateRange.startDate || dateRange.endDate 
                  ? 'Filtered approved bank/UPI transactions' 
                  : 'All approved bank/UPI transactions'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg shadow-sm">
                  <Banknote className="h-4 w-4 text-red-600" />
                </div>
                Cash Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(
                  expenses?.expenses
                    ?.filter((e: any) => e.paymentMode === 'cash' && e.status === 'approved')
                    ?.reduce((sum: number, e: any) => sum + e.amountCents, 0) || 0
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {selectedPropertyId !== 'all' || dateRange.startDate || dateRange.endDate 
                  ? 'Filtered approved cash expenses' 
                  : 'All approved cash expenses'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="p-2 bg-orange-100 rounded-lg shadow-sm">
                  <CreditCard className="h-4 w-4 text-orange-600" />
                </div>
                Bank/UPI Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(
                  expenses?.expenses
                    ?.filter((e: any) => e.paymentMode === 'bank' && e.status === 'approved')
                    ?.reduce((sum: number, e: any) => sum + e.amountCents, 0) || 0
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {selectedPropertyId !== 'all' || dateRange.startDate || dateRange.endDate 
                  ? 'Filtered approved bank/UPI expenses' 
                  : 'All approved bank/UPI expenses'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Transactions Tabs */}
        <Tabs defaultValue="expenses" className="space-y-0">
          <div className="sticky top-20 z-30 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 border-b-2 border-orange-400 -mx-6 px-4 py-3 shadow-2xl rounded-b-xl">
            <div className="overflow-x-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1 border border-white/20 shadow-inner">
                <TabsList className="grid w-full grid-cols-2 min-w-max bg-transparent h-auto p-0 gap-2">
                  <TabsTrigger 
                    value="expenses" 
                    className="text-xs sm:text-sm px-4 sm:px-8 py-4 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-orange-300 data-[state=inactive]:text-white data-[state=inactive]:bg-gradient-to-r data-[state=inactive]:from-orange-500/30 data-[state=inactive]:to-orange-600/30 data-[state=inactive]:hover:from-orange-500/50 data-[state=inactive]:hover:to-orange-600/50 data-[state=inactive]:hover:shadow-lg data-[state=inactive]:border data-[state=inactive]:border-white/30 transition-all duration-500 flex items-center gap-2 rounded-xl font-semibold relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <span className="relative z-10">Expenses</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="revenues" 
                    className="text-xs sm:text-sm px-4 sm:px-8 py-4 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-orange-300 data-[state=inactive]:text-white data-[state=inactive]:bg-gradient-to-r data-[state=inactive]:from-orange-500/30 data-[state=inactive]:to-orange-600/30 data-[state=inactive]:hover:from-orange-500/50 data-[state=inactive]:hover:to-orange-600/50 data-[state=inactive]:hover:shadow-lg data-[state=inactive]:border data-[state=inactive]:border-white/30 transition-all duration-500 flex items-center gap-2 rounded-xl font-semibold relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <span className="relative z-10">Revenues</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
          </div>

          {/* Content Container */}
          <div className="px-6 py-6">
            <TabsContent value="expenses" className="space-y-6 mt-0">
              <Card className="border-l-4 border-l-red-500 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 bg-red-100 rounded-lg shadow-sm">
                      <Receipt className="h-5 w-5 text-red-600" />
                    </div>
                    Recent Expenses
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">Live</span>
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    Track and manage property expenses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {expensesLoading ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                          <p className="text-lg font-medium text-gray-900">Loading expenses...</p>
                          <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your expense data</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : expenses?.expenses.length === 0 ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Receipt className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses recorded</h3>
                        <p className="text-gray-500 text-center mb-4">Start tracking your property expenses</p>
                        <Button 
                          onClick={() => setIsExpenseDialogOpen(true)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add First Expense
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {expenses?.expenses.map((expense: any) => (
                        <Card key={expense.id} className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-all duration-200">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <h4 className="font-medium truncate">{expense.category}</h4>
                                  <Badge className={`${getStatusColor(expense.status)} flex-shrink-0`}>
                                    {expense.status}
                                  </Badge>
                                  <Badge className={`${expense.paymentMode === 'cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'} flex-shrink-0`}>
                                    {expense.paymentMode}
                                  </Badge>
                                  {expense.bankReference && (
                                    <Badge variant="outline" className="text-xs flex-shrink-0">
                                      {expense.bankReference}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mb-1 truncate">{expense.propertyName}</p>
                                {expense.description && (
                                  <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{expense.description}</p>
                                )}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-gray-500 mt-3">
                                  <span className="flex items-center">
                                    <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                                    {formatCardDateTime(expense.createdAt)}
                                  </span>
                                  <span className="flex items-center bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                                    <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                                    For: {new Date(expense.expenseDate).toLocaleDateString()}
                                  </span>
                                  <span className="truncate">By {expense.createdByName}</span>
                                  {(expense.receiptUrl || expense.receiptFileId) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto p-0 text-blue-600 hover:text-blue-800 flex-shrink-0"
                                      onClick={() => setSelectedReceipt({
                                        id: expense.id,
                                        type: 'expense',
                                        category: expense.category,
                                        propertyName: expense.propertyName,
                                        amountCents: expense.amountCents,
                                        description: expense.description,
                                        receiptUrl: expense.receiptUrl,
                                        receiptFileId: expense.receiptFileId,
                                        date: expense.expenseDate,
                                        createdAt: expense.createdAt,
                                        createdByName: expense.createdByName,
                                        status: expense.status,
                                        paymentMode: expense.paymentMode,
                                        bankReference: expense.bankReference,
                                        approvedByName: expense.approvedByName,
                                        approvedAt: expense.approvedAt,
                                      })}
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      View Receipt
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col sm:items-end mt-3 sm:mt-0">
                                <div className="text-lg font-semibold text-red-600 mb-2">
                                  {formatCurrency(expense.amountCents)}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {user?.role === 'ADMIN' && expense.status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: true })}
                                        disabled={approveExpenseMutation.isPending}
                                        className="flex-shrink-0"
                                      >
                                        <Check className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: false })}
                                        disabled={approveExpenseMutation.isPending}
                                        className="flex-shrink-0"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                  {(user?.role === 'ADMIN' || (user?.role === 'MANAGER' && expense.createdByUserId === parseInt(user.userID))) && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleEditExpense(expense)}
                                        disabled={updateExpenseMutation.isPending}
                                        className="flex-shrink-0"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDeleteExpense(expense.id)}
                                        disabled={deleteExpenseMutation.isPending}
                                        className="text-red-600 hover:text-red-800 flex-shrink-0"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

            <TabsContent value="revenues" className="space-y-6 mt-0">
              <Card className="border-l-4 border-l-green-500 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    Recent Revenues
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Live</span>
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    Track property income and revenue streams
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {revenuesLoading ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                          <p className="text-lg font-medium text-gray-900">Loading revenues...</p>
                          <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your revenue data</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : revenues?.revenues.length === 0 ? (
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <TrendingUp className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No revenue recorded</h3>
                        <p className="text-gray-500 text-center mb-4">Start tracking your property revenue</p>
                        <Button 
                          onClick={() => setIsRevenueDialogOpen(true)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add First Revenue
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {revenues?.revenues.map((revenue: any) => (
                        <Card key={revenue.id} className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all duration-200">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h4 className="font-medium capitalize truncate">{revenue.source} Revenue</h4>
                          <Badge className={`${getSourceColor(revenue.source)} flex-shrink-0`}>
                            {revenue.source}
                          </Badge>
                          <Badge className={`${getStatusColor(revenue.status)} flex-shrink-0`}>
                            {revenue.status}
                          </Badge>
                          <Badge className={`${revenue.paymentMode === 'cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'} flex-shrink-0`}>
                            {revenue.paymentMode}
                          </Badge>
                          {revenue.bankReference && (
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {revenue.bankReference}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-1 truncate">{revenue.propertyName}</p>
                        {revenue.description && (
                          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{revenue.description}</p>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-gray-500 mt-3">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                            {formatCardDateTime(revenue.createdAt)}
                          </span>
                          <span className="flex items-center bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                            <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                            For: {new Date(revenue.occurredAt).toLocaleDateString()}
                          </span>
                          <span className="truncate">By {revenue.createdByName}</span>
                          {(revenue.receiptUrl || revenue.receiptFileId) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 text-blue-600 hover:text-blue-800 flex-shrink-0"
                              onClick={() => setSelectedReceipt({
                                id: revenue.id,
                                type: 'revenue',
                                source: revenue.source,
                                propertyName: revenue.propertyName,
                                amountCents: revenue.amountCents,
                                description: revenue.description,
                                receiptUrl: revenue.receiptUrl,
                                receiptFileId: revenue.receiptFileId,
                                date: revenue.occurredAt,
                                createdAt: revenue.createdAt,
                                createdByName: revenue.createdByName,
                                status: revenue.status,
                                paymentMode: revenue.paymentMode,
                                bankReference: revenue.bankReference,
                                approvedByName: revenue.approvedByName,
                                approvedAt: revenue.approvedAt,
                              })}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Receipt
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col sm:items-end mt-3 sm:mt-0">
                        <div className="text-lg font-semibold text-green-600 mb-2">
                          {formatCurrency(revenue.amountCents)}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {user?.role === 'ADMIN' && revenue.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveRevenueMutation.mutate({ id: revenue.id, approved: true })}
                                disabled={approveRevenueMutation.isPending}
                                className="flex-shrink-0"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveRevenueMutation.mutate({ id: revenue.id, approved: false })}
                                disabled={approveRevenueMutation.isPending}
                                className="flex-shrink-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {(user?.role === 'ADMIN' || (user?.role === 'MANAGER' && revenue.createdByUserId === parseInt(user.userID))) && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditRevenue(revenue)}
                                disabled={updateRevenueMutation.isPending}
                                className="flex-shrink-0"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteRevenue(revenue.id)}
                                disabled={deleteRevenueMutation.isPending}
                                className="text-red-600 hover:text-red-800 flex-shrink-0"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        {/* Receipt Viewer Modal */}
        {selectedReceipt && (
          <ReceiptViewer
            isOpen={!!selectedReceipt}
            onClose={() => setSelectedReceipt(null)}
            transaction={selectedReceipt}
          />
        )}
      </div>
    </div>
  );
}

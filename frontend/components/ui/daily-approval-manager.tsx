import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency as formatCurrencyUtil } from '../../lib/currency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { API_CONFIG } from '@/src/config/api';
import { formatCardDateTime } from '@/lib/datetime';
import {
  Check,
  X,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Receipt,
  User,
  Building2,
  Clock,
  CheckCircle2
} from 'lucide-react';

interface DailyApprovalManagerProps {
  className?: string;
  propertyId?: string;
  startDate?: string;
  endDate?: string;
}

export function DailyApprovalManager({ className, propertyId, startDate, endDate }: DailyApprovalManagerProps) {
  const { getAuthenticatedBackend, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Realtime is handled globally by FinancePage via useFinanceRealtimeV2.
  // This component listens to cache updates and does not run its own polling.

  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());

  // Get today's pending transactions with filters
  const { data: pendingTransactions, isLoading: transactionsLoading, error: transactionsError } = useQuery({
    queryKey: ['today-pending-transactions', propertyId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (propertyId && propertyId !== 'all') {
        params.append('propertyId', propertyId);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }

      const backend = getAuthenticatedBackend();
      if (!backend) {
        throw new Error('Not authenticated');
      }

      const response = await backend.finance.getTodayPendingTransactions({
        propertyId: propertyId && propertyId !== 'all' ? parseInt(propertyId) : undefined,
        startDate,
        endDate,
      });
      return response;
    },
    // ✅ Add these query options to match FinancePage behavior
    refetchInterval: false, // No automatic polling - rely on pub/sub events
    staleTime: 0, // Always refetch when invalidated by pub/sub ✅
    gcTime: 300000, // Cache results for 5 minutes
    refetchOnMount: true, // Refetch when component mounts
  });

  // Bulk approve transactions
  const bulkApproveMutation = useMutation({
    mutationFn: async ({ transactionIds, action }: { transactionIds: number[]; action: 'approve' | 'reject' }) => {
      const backend = getAuthenticatedBackend();
      if (!backend) {
        throw new Error('Not authenticated');
      }

      try {
        const response = await backend.finance.bulkApproveTransactions({
          transactionIds,
          transactionType: 'all',
          action,
        });
        return response;
      } catch (error: any) {
        console.error('Bulk approval error:', error);
        throw new Error(error.message || `Failed to ${action} transactions`);
      }
    },
    onMutate: async ({ transactionIds, action }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['today-pending-transactions'] });

      // Snapshot previous value
      const previousTransactions = queryClient.getQueryData(['today-pending-transactions']);

      // Optimistically update UI
      queryClient.setQueryData(['today-pending-transactions'], (old: any) => {
        if (!old?.transactions) return old;

        return {
          ...old,
          transactions: old.transactions.filter((t: any) =>
            !transactionIds.includes(t.id)
          )
        };
      });

      return { previousTransactions };
    },
    onSuccess: (data, variables) => {
      const action = variables.action === 'approve' ? 'approved' : 'rejected';
      const count = variables.action === 'approve' ? data.results.approved : data.results.rejected;
      const newStatus = variables.action === 'approve' ? 'approved' : 'rejected';

      toast({
        title: `Transactions ${action}`,
        description: `${count} transactions have been ${action} successfully.`,
      });

      // Clear selection and refresh data
      setSelectedTransactions(new Set());

      // Immediately update revenues/expenses lists to reflect the new status
      // This ensures the UI updates even before the realtime event arrives
      queryClient.setQueriesData(
        { queryKey: ['revenues'] },
        (old: any) => {
          if (!old?.revenues) return old;
          return {
            ...old,
            revenues: old.revenues.map((r: any) =>
              variables.transactionIds.includes(r.id)
                ? { ...r, status: newStatus, approvedAt: new Date().toISOString() }
                : r
            ),
          };
        }
      );

      queryClient.setQueriesData(
        { queryKey: ['expenses'] },
        (old: any) => {
          if (!old?.expenses) return old;
          return {
            ...old,
            expenses: old.expenses.map((e: any) =>
              variables.transactionIds.includes(e.id)
                ? { ...e, status: newStatus, approvedAt: new Date().toISOString() }
                : e
            ),
          };
        }
      );

      // Invalidate the approval manager and approval status queries
      queryClient.invalidateQueries({ queryKey: ['today-pending-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });

    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousTransactions) {
        queryClient.setQueryData(['today-pending-transactions'], context.previousTransactions);
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to process transactions",
      });
    },
  });

  const handleSelectAll = () => {
    if (!pendingTransactions?.transactions) return;

    const allIds = pendingTransactions.transactions.map((t: any) => t.id);
    setSelectedTransactions(new Set(allIds));
  };

  const handleClearSelection = () => {
    setSelectedTransactions(new Set());
  };

  const handleTransactionSelect = (transactionId: number, checked: boolean) => {
    const newSelection = new Set(selectedTransactions);
    if (checked) {
      newSelection.add(transactionId);
    } else {
      newSelection.delete(transactionId);
    }
    setSelectedTransactions(newSelection);
  };

  const handleBulkAction = (action: 'approve' | 'reject') => {
    if (selectedTransactions.size === 0) {
      toast({
        variant: "destructive",
        title: "No transactions selected",
        description: "Please select transactions to approve or reject.",
      });
      return;
    }

    bulkApproveMutation.mutate({
      transactionIds: Array.from(selectedTransactions),
      action,
    });
  };

  const formatCurrency = (amountCents: number) => {
    return formatCurrencyUtil(amountCents, 'INR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'revenue' ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    );
  };

  const getTypeColor = (type: string) => {
    return type === 'revenue' ? 'text-green-600' : 'text-red-600';
  };

  if (transactionsError) {
    return (
      <Card className={`border-l-4 border-l-red-500 ${className}`}>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-lg font-medium text-red-900 mb-2">Error loading pending transactions</p>
            <p className="text-sm text-gray-600 mb-4">{(transactionsError as Error).message}</p>
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

  return (
    <div className={className}>
      <Card className="border-none shadow-sm bg-white rounded-3xl lg:bg-white/70 lg:backdrop-blur-xl lg:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] lg:border-white/20 transition-all duration-300">
        <CardHeader className="pb-2 pt-6 px-6 lg:px-8 lg:pt-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-400 rounded-full shadow-sm animate-pulse lg:w-4 lg:h-4" />
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">
                Daily Approval
                <span className="lg:hidden"><br /></span>
                <span className="lg:ml-2">Manager</span>
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none rounded-full px-3 py-1 text-xs font-semibold tracking-wide lg:text-sm lg:px-4 lg:py-1.5 transition-colors">
                Admin Only
              </Badge>
              {/* Desktop Filters summary could go here */}
            </div>
          </div>
          <CardDescription className="text-gray-500 text-sm leading-relaxed mt-2 max-w-sm lg:max-w-none lg:text-base">
            Review and approve pending transactions from managers and staff
            {(propertyId && propertyId !== 'all') || startDate || endDate ? (
              <span className="block mt-2 text-xs font-medium text-blue-600 bg-blue-50 p-2 rounded-lg lg:inline-block lg:ml-2 lg:mt-0">
                Filtered by: {propertyId && propertyId !== 'all' ? `Property ${propertyId}` : ''}
                {startDate && endDate ? ` • ${startDate} to ${endDate}` : ''}
                {startDate && !endDate ? ` • From ${startDate}` : ''}
                {!startDate && endDate ? ` • Until ${endDate}` : ''}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-8 lg:px-8 lg:pb-8">
          {/* Action Buttons Stack (Mobile) / Row (Desktop) */}
          <div className="flex flex-col gap-3 mt-4 lg:flex-row lg:items-center lg:bg-white/50 lg:p-1.5 lg:rounded-2xl lg:border lg:border-gray-100/50">
            <div className="flex gap-2 w-full lg:w-auto">
              <Button
                variant="outline"
                onClick={handleSelectAll}
                disabled={transactionsLoading || !pendingTransactions?.transactions?.length}
                className="h-12 flex-1 lg:flex-none lg:h-10 lg:px-4 justify-center lg:justify-start font-medium text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 rounded-xl lg:rounded-xl transition-all duration-200 lg:bg-white lg:shadow-sm"
              >
                <CheckCircle2 className="h-5 w-5 lg:h-4 lg:w-4 mr-2 text-gray-400" />
                <span className="lg:hidden">Select All</span>
                <span className="hidden lg:inline">All</span>
              </Button>

              <Button
                variant="outline"
                onClick={handleClearSelection}
                disabled={selectedTransactions.size === 0}
                className="h-12 flex-1 lg:flex-none lg:h-10 lg:px-4 justify-center lg:justify-start font-medium text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 rounded-xl lg:rounded-xl transition-all duration-200 lg:bg-white lg:shadow-sm"
              >
                <X className="h-5 w-5 lg:h-4 lg:w-4 mr-2 text-gray-400" />
                <span className="lg:hidden">Clear</span>
                <span className="hidden lg:inline">Clear</span>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 lg:pt-0 lg:flex lg:ml-auto w-full lg:w-auto">
              <Button
                onClick={() => handleBulkAction('approve')}
                disabled={selectedTransactions.size === 0 || bulkApproveMutation.isPending}
                className="h-12 lg:h-10 w-full lg:w-auto font-semibold text-white bg-green-500 hover:bg-green-600 shadow-sm active:scale-[0.98] rounded-xl transition-all duration-200 lg:px-6"
              >
                {bulkApproveMutation.isPending ? (
                  <RefreshCw className="h-5 w-5 lg:h-4 lg:w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-5 w-5 lg:h-4 lg:w-4 mr-2" />
                )}
                <span className="lg:hidden">Approve ({selectedTransactions.size})</span>
                <span className="hidden lg:inline">Approve Selected ({selectedTransactions.size})</span>
              </Button>

              <Button
                onClick={() => handleBulkAction('reject')}
                disabled={selectedTransactions.size === 0 || bulkApproveMutation.isPending}
                className="h-12 lg:h-10 w-full lg:w-auto font-semibold text-white bg-red-500 hover:bg-red-600 shadow-sm active:scale-[0.98] rounded-xl transition-all duration-200 lg:px-6"
              >
                {bulkApproveMutation.isPending ? (
                  <RefreshCw className="h-5 w-5 lg:h-4 lg:w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-5 w-5 lg:h-4 lg:w-4 mr-2" />
                )}
                <span className="lg:hidden">Reject ({selectedTransactions.size})</span>
                <span className="hidden lg:inline">Reject Selected ({selectedTransactions.size})</span>
              </Button>
            </div>
          </div>

          {/* Pending Transactions List */}
          {transactionsLoading ? (
            <div className="flex flex-col items-center justify-center py-8 lg:py-16 text-center bg-gray-50 lg:bg-gray-50/50 rounded-2xl border border-gray-100 lg:border-dashed">
              <RefreshCw className="h-8 w-8 lg:h-10 lg:w-10 animate-spin text-blue-500 mb-3" />
              <p className="text-sm lg:text-base font-medium text-gray-900">Loading transactions...</p>
            </div>
          ) : !pendingTransactions?.transactions?.length ? (
            <div className="flex flex-col items-center justify-center py-8 lg:py-16 text-center bg-green-50/50 lg:bg-green-50/30 rounded-2xl border border-green-100/50 lg:border-green-100/30">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 className="h-6 w-6 lg:h-8 lg:w-8 text-green-600" />
              </div>
              <p className="text-sm lg:text-lg font-medium text-gray-900">All Clear!</p>
              <p className="text-xs lg:text-sm text-gray-500 mt-1 max-w-[200px] lg:max-w-md">No pending transactions to review right now. Great job!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm lg:text-base font-semibold text-gray-900">
                  Pending Transactions ({pendingTransactions.transactions.length})
                </h3>
                {/* Desktop Header Labels could go here for the list below if it wasn't using flex-col on mobile */}
              </div>

              {/* Desktop Headers Row */}
              <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="col-span-1">Select</div>
                <div className="col-span-4">Details</div>
                <div className="col-span-3">Property</div>
                <div className="col-span-2">Submitted By</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>

              <div className="space-y-3">
                {pendingTransactions.transactions.map((transaction: any) => (
                  <div
                    key={`${transaction.type}-${transaction.id}`}
                    className={`
                      relative group border rounded-2xl p-4 transition-all duration-300
                      ${selectedTransactions.has(transaction.id)
                        ? 'bg-blue-50/50 border-blue-200 shadow-sm lg:bg-blue-50/30'
                        : 'bg-white border-gray-100 hover:border-gray-200 lg:hover:bg-white/60 lg:hover:shadow-md lg:hover:-translate-y-0.5'
                      }
                      /* Desktop Grid Layout Override */
                      lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center lg:py-3 lg:px-4
                    `}
                  >
                    {/* Mobile Layout Wrapper */}
                    <div className="flex items-start gap-4 lg:contents">
                      <div className="lg:col-span-1 flex items-center">
                        <Checkbox
                          checked={selectedTransactions.has(transaction.id)}
                          onCheckedChange={(checked) => handleTransactionSelect(transaction.id, checked as boolean)}
                          className="mt-1 lg:mt-0 h-5 w-5 border-2 border-gray-300 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 rounded-md transition-all"
                        />
                      </div>

                      <div className="flex-1 min-w-0 lg:col-span-4 lg:flex lg:flex-col lg:justify-center">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5 lg:mb-0.5">
                          <h4 className="font-semibold text-gray-900 capitalize truncate text-sm lg:text-base">
                            {transaction.category || transaction.source}
                          </h4>
                          <span className={`text-[10px] lg:text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${transaction.type === 'revenue' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {transaction.type}
                          </span>
                        </div>
                        {/* Mobile Property Name (Hidden on Desktop, moved to own col) */}
                        <p className="text-xs text-gray-500 mb-2 truncate font-medium lg:hidden">
                          {transaction.propertyName}
                        </p>
                      </div>

                      {/* Desktop Property Column */}
                      <div className="hidden lg:col-span-3 lg:flex items-center text-sm text-gray-600 font-medium">
                        <Building2 className="h-3.5 w-3.5 mr-2 text-gray-400" />
                        {transaction.propertyName}
                      </div>

                      {/* Desktop User/Time Column */}
                      <div className="hidden lg:col-span-2 lg:flex flex-col justify-center text-xs text-gray-500">
                        <span className="flex items-center mb-1">
                          <User className="h-3 w-3 mr-1.5 text-gray-400" />
                          {transaction.createdByName}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1.5 text-gray-400" />
                          {formatCardDateTime(transaction.createdAt).split(' ')[0]}
                        </span>
                      </div>

                      {/* Mobile User/Time (Hidden on Desktop) */}
                      <div className="flex items-center gap-3 text-xs text-gray-400 lg:hidden">
                        <span className="flex items-center">
                          <User className="h-3 w-3 mr-1" />
                          {transaction.createdByName}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatCardDateTime(transaction.createdAt).split(' ')[0]}
                        </span>
                      </div>


                      <div className="text-right lg:col-span-2 lg:flex lg:flex-col lg:items-end lg:justify-center">
                        <span className={`block font-bold ${getTypeColor(transaction.type)} lg:text-base`}>
                          {formatCurrency(transaction.amountCents)}
                        </span>
                        {transaction.receiptUrl && (
                          <span className="inline-flex items-center text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-1 lg:mt-0.5">
                            <Receipt className="h-3 w-3 mr-1" />
                            Receipt
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
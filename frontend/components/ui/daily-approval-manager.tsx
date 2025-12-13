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
      <Card className="border-l-4 border-l-blue-500 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            Daily Approval Manager
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Admin Only</span>
          </CardTitle>
          <CardDescription className="text-sm text-gray-600">
            Review and approve pending transactions from managers and staff
            {(propertyId && propertyId !== 'all') || startDate || endDate ? (
              <span className="block mt-1 text-xs text-blue-600">
                Filtered by: {propertyId && propertyId !== 'all' ? `Property ${propertyId}` : ''}
                {startDate && endDate ? ` • ${startDate} to ${endDate}` : ''}
                {startDate && !endDate ? ` • From ${startDate}` : ''}
                {!startDate && endDate ? ` • Until ${endDate}` : ''}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={transactionsLoading || !pendingTransactions?.transactions?.length}
              className="transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Select All Pending
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSelection}
              disabled={selectedTransactions.size === 0}
              className="transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Selection
            </Button>
            <div className="flex-1" />
            <Button
              onClick={() => handleBulkAction('approve')}
              disabled={selectedTransactions.size === 0 || bulkApproveMutation.isPending}
              className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              {bulkApproveMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Approve Selected ({selectedTransactions.size})
            </Button>
            <Button
              onClick={() => handleBulkAction('reject')}
              disabled={selectedTransactions.size === 0 || bulkApproveMutation.isPending}
              variant="destructive"
              className="transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              {bulkApproveMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Reject Selected ({selectedTransactions.size})
            </Button>
          </div>

          {/* Pending Transactions List */}
          {transactionsLoading ? (
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="flex items-center justify-center p-12">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900">Loading pending transactions...</p>
                  <p className="text-sm text-gray-600 mt-2">Please wait while we fetch the data</p>
                </div>
              </CardContent>
            </Card>
          ) : !pendingTransactions?.transactions?.length ? (
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No pending transactions</h3>
                <p className="text-gray-500 text-center">
                  {(propertyId && propertyId !== 'all') || startDate || endDate 
                    ? 'No pending transactions match the current filters' 
                    : 'All transactions for today have been approved'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">
                  Pending Transactions ({pendingTransactions.transactions.length})
                </h3>
                <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                  <Clock className="h-3 w-3 mr-1" />
                  Live Updates
                </Badge>
              </div>
              
              {pendingTransactions.transactions.map((transaction: any) => (
                <Card 
                  key={`${transaction.type}-${transaction.id}`} 
                  className="border-l-4 border-l-yellow-500 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={selectedTransactions.has(transaction.id)}
                        onCheckedChange={(checked) => handleTransactionSelect(transaction.id, checked as boolean)}
                        className="mt-1"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getTypeIcon(transaction.type)}
                          <h4 className="font-medium capitalize truncate">
                            {transaction.type} - {transaction.category || transaction.source}
                          </h4>
                          <Badge className={`${getStatusColor(transaction.status)} flex-shrink-0`}>
                            {transaction.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {transaction.paymentMode}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-1 truncate">
                          {transaction.propertyName}
                        </p>
                        
                        {transaction.description && (
                          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed mb-2">
                            {transaction.description}
                          </p>
                        )}
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <User className="h-3 w-3 mr-1 flex-shrink-0" />
                            By {transaction.createdByName}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                            {formatCardDateTime(transaction.createdAt)}
                          </span>
                          {transaction.receiptUrl && (
                            <span className="flex items-center text-blue-600">
                              <Receipt className="h-3 w-3 mr-1 flex-shrink-0" />
                              Has Receipt
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <div className={`text-lg font-semibold ${getTypeColor(transaction.type)}`}>
                          {formatCurrency(transaction.amountCents)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {transaction.type === 'revenue' ? 'Revenue' : 'Expense'}
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
    </div>
  );
}
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { useToast } from './use-toast';
import { ReceiptViewer } from './receipt-viewer';
import { formatTransactionDateTime, formatCardDateTime } from '../../lib/datetime';
import { 
  Calendar, 
  Check, 
  Clock, 
  User, 
  AlertTriangle,
  Users,
  Eye,
  X,
  Zap
} from 'lucide-react';

interface PendingManager {
  managerId: number;
  managerName: string;
  unapprovedTransactionsCount: number;
  lastTransactionDate: string;
  lastApprovalDate?: string;
  needsDailyApproval: boolean;
  hasPendingTransactions: boolean;
  pendingExpenses: number;
  pendingRevenues: number;
}

export function DailyApprovalManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedManager, setSelectedManager] = useState<PendingManager | null>(null);
  const [approvalDate, setApprovalDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewingManager, setReviewingManager] = useState<PendingManager | null>(null);
  const [managerTransactions, setManagerTransactions] = useState<{
    revenues: any[];
    expenses: any[];
  }>({ revenues: [], expenses: [] });
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
    status: string;
    date: Date;
    createdByName: string;
  } | null>(null);

  // Only show for admins
  if (user?.role !== 'ADMIN') {
    return null;
  }

  const { data: pendingApprovals, isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      // Direct API call since the endpoint isn't in generated client yet
      const response = await fetch('http://127.0.0.1:4000/finance/pending-approvals', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pending approvals: ${response.statusText}`);
      }
      
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds for testing
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache results
  });

  const grantApprovalMutation = useMutation({
    mutationFn: async ({ managerUserId, approvalDate, notes }: { 
      managerUserId: number; 
      approvalDate: string; 
      notes?: string;
    }) => {
      // Direct API call since the endpoint isn't in generated client yet
      const response = await fetch('http://127.0.0.1:4000/finance/grant-daily-approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          managerUserId,
          approvalDate,
          notes,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to grant approval: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
      setIsApprovalDialogOpen(false);
      setSelectedManager(null);
      setNotes('');
      toast({
        title: "Approval granted",
        description: "Daily approval has been granted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to grant approval",
        description: error.message || "Please try again.",
      });
    },
  });

  // Quick approve all pending transactions for a manager
  const quickApproveAllMutation = useMutation({
    mutationFn: async ({ managerId }: { managerId: number }) => {
      // Approve all pending revenues and expenses for this manager
      const [revenuesResponse, expensesResponse] = await Promise.all([
        // Get pending revenues for this manager
        fetch('http://127.0.0.1:4000/finance/revenues', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
        }),
        // Get pending expenses for this manager  
        fetch('http://127.0.0.1:4000/finance/expenses', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
        })
      ]);

      const revenues = await revenuesResponse.json();
      const expenses = await expensesResponse.json();

      // Filter for pending transactions by this manager
      const pendingRevenues = revenues.revenues?.filter((r: any) => 
        r.createdByUserId === managerId && r.status === 'pending'
      ) || [];
      const pendingExpenses = expenses.expenses?.filter((e: any) => 
        e.createdByUserId === managerId && e.status === 'pending'
      ) || [];

      // Approve all pending revenues
      const revenueApprovals = pendingRevenues.map((revenue: any) =>
        fetch(`http://127.0.0.1:4000/finance/revenues/${revenue.id}/approve`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({
            id: revenue.id,
            approved: true,
            notes: ''
          }),
        })
      );

      // Approve all pending expenses
      const expenseApprovals = pendingExpenses.map((expense: any) =>
        fetch(`http://127.0.0.1:4000/finance/expenses/${expense.id}/approve`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({
            id: expense.id,
            approved: true,
            notes: ''
          }),
        })
      );

      // Wait for all approvals to complete
      await Promise.all([...revenueApprovals, ...expenseApprovals]);

      return {
        approvedRevenues: pendingRevenues.length,
        approvedExpenses: pendingExpenses.length
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      toast({
        title: "Quick approval completed",
        description: `Approved ${data.approvedRevenues} revenues and ${data.approvedExpenses} expenses.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Quick approval failed",
        description: error.message || "Please try again.",
      });
    },
  });

  const handleApprovalSubmit = () => {
    if (!selectedManager || !approvalDate) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a date for approval.",
      });
      return;
    }
    
    grantApprovalMutation.mutate({
      managerUserId: selectedManager.managerId,
      approvalDate,
      notes,
    });
  };

  const openApprovalDialog = (manager: PendingManager) => {
    setSelectedManager(manager);
    // Default to yesterday since we're approving yesterday's transactions
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setApprovalDate(yesterday);
    setNotes('');
    setIsApprovalDialogOpen(true);
  };

  const openReviewDialog = async (manager: PendingManager) => {
    setReviewingManager(manager);
    setIsReviewDialogOpen(true);
    
    try {
      // Fetch manager's pending transactions
      const [revenuesResponse, expensesResponse] = await Promise.all([
        fetch('http://127.0.0.1:4000/finance/revenues', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
        }),
        fetch('http://127.0.0.1:4000/finance/expenses', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
        })
      ]);

      const revenues = await revenuesResponse.json();
      const expenses = await expensesResponse.json();

      // Filter for pending transactions by this manager
      const pendingRevenues = revenues.revenues?.filter((r: any) => 
        r.createdByUserId === manager.managerId && r.status === 'pending'
      ) || [];
      const pendingExpenses = expenses.expenses?.filter((e: any) => 
        e.createdByUserId === manager.managerId && e.status === 'pending'
      ) || [];

      setManagerTransactions({
        revenues: pendingRevenues,
        expenses: pendingExpenses
      });
    } catch (error) {
      console.error('Failed to fetch manager transactions:', error);
      toast({
        variant: "destructive",
        title: "Failed to load transactions",
        description: "Could not fetch transaction details.",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Daily Approvals
          </CardTitle>
          <CardDescription>
            Manage daily approvals for managers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Daily Approvals
          </CardTitle>
          <CardDescription>
            Manage daily approvals for managers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!pendingApprovals?.pendingManagers || pendingApprovals.pendingManagers.length === 0 ? (
            <div className="text-center py-8">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">All approvals up to date</h3>
              <p className="text-gray-500">
                {isLoading ? 'Loading approvals...' : 'No pending transactions or daily approvals needed'}
              </p>
              {!isLoading && (
                <p className="text-xs text-gray-400 mt-2">
                  Managers with pending transactions or yesterday's unapproved transactions will appear here
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApprovals.pendingManagers?.map((manager: PendingManager) => (
                <div key={manager.managerId} className={`p-4 border rounded-lg ${
                  manager.needsDailyApproval ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{manager.managerName}</h4>
                        <div className="flex gap-1">
                          {manager.needsDailyApproval && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Daily Approval Needed
                            </Badge>
                          )}
                          {manager.hasPendingTransactions && (
                            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 border-orange-200">
                              <Clock className="h-3 w-3 mr-1" />
                              {manager.pendingExpenses + manager.pendingRevenues} Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        {manager.needsDailyApproval && (
                          <p className="text-red-600 font-medium">
                            ⚠️ {manager.unapprovedTransactionsCount} transactions from yesterday need daily approval
                          </p>
                        )}
                        
                        {manager.hasPendingTransactions && (
                          <div className="flex gap-4 text-orange-600">
                            {manager.pendingExpenses > 0 && (
                              <span>📋 {manager.pendingExpenses} pending expenses</span>
                            )}
                            {manager.pendingRevenues > 0 && (
                              <span>💰 {manager.pendingRevenues} pending revenues</span>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-gray-500">
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            Last transaction: {formatCardDateTime(manager.lastTransactionDate)}
                          </span>
                          {manager.lastApprovalDate && (
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              Last daily approval: {formatCardDateTime(manager.lastApprovalDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-4 flex flex-col gap-2">
                      {manager.needsDailyApproval && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openApprovalDialog(manager)}
                          disabled={grantApprovalMutation.isPending}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Grant Daily Approval
                        </Button>
                      )}
                      
                      {manager.hasPendingTransactions && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReviewDialog(manager)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Review
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => quickApproveAllMutation.mutate({ managerId: manager.managerId })}
                            disabled={quickApproveAllMutation.isPending}
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            {quickApproveAllMutation.isPending ? 'Approving...' : 'Quick Approve'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Daily Approval</DialogTitle>
            <DialogDescription>
              Grant daily approval for {selectedManager?.managerName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Approval Date *</Label>
              <Input
                type="date"
                value={approvalDate}
                onChange={(e) => setApprovalDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this approval..."
                rows={3}
              />
            </div>

            {selectedManager && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm space-y-1">
                  <p><strong>Manager:</strong> {selectedManager.managerName}</p>
                  
                  {selectedManager.needsDailyApproval && (
                    <p className="text-red-600"><strong>Yesterday's Unapproved:</strong> {selectedManager.unapprovedTransactionsCount} transactions</p>
                  )}
                  
                  {selectedManager.hasPendingTransactions && (
                    <div className="text-orange-600">
                      <p><strong>Current Pending:</strong></p>
                      <ul className="ml-4 text-xs">
                        {selectedManager.pendingExpenses > 0 && <li>• {selectedManager.pendingExpenses} expenses</li>}
                        {selectedManager.pendingRevenues > 0 && <li>• {selectedManager.pendingRevenues} revenues</li>}
                      </ul>
                    </div>
                  )}
                  
                  <p><strong>Last Transaction:</strong> {new Date(selectedManager.lastTransactionDate).toLocaleDateString()}</p>
                  {selectedManager.lastApprovalDate && (
                    <p><strong>Last Daily Approval:</strong> {new Date(selectedManager.lastApprovalDate).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprovalSubmit} disabled={grantApprovalMutation.isPending}>
              {grantApprovalMutation.isPending ? 'Granting...' : 'Grant Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Transactions Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Review Transactions - {reviewingManager?.managerName}
            </DialogTitle>
            <DialogDescription>
              Review all pending transactions for {reviewingManager?.managerName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col h-[70vh] overflow-auto">
            {/* Pending Revenues */}
            {managerTransactions.revenues.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  💰 Pending Revenues ({managerTransactions.revenues.length})
                </h3>
                <div className="space-y-3">
                  {managerTransactions.revenues.map((revenue: any) => (
                    <div key={revenue.id} className="border rounded-lg p-4 bg-green-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                              {revenue.source}
                            </Badge>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                              {revenue.status}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-lg">₹{(revenue.amountCents / 100).toFixed(2)}</h4>
                          <p className="text-sm text-gray-600">{revenue.propertyName}</p>
                          {revenue.description && (
                            <p className="text-sm text-gray-500 mt-1">{revenue.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            📅 {formatCardDateTime(revenue.occurredAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {revenue.receiptFileId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedReceipt({
                                id: revenue.id,
                                type: 'revenue' as const,
                                source: revenue.source,
                                propertyName: revenue.propertyName,
                                amountCents: revenue.amountCents,
                                description: revenue.description,
                                receiptFileId: revenue.receiptFileId,
                                status: revenue.status,
                                date: new Date(revenue.occurredAt),
                                createdByName: reviewingManager?.managerName || 'Unknown'
                              })}
                            >
                              📄 View Receipt
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={async () => {
                              try {
                                const response = await fetch(`http://127.0.0.1:4000/finance/revenues/${revenue.id}/approve`, {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                                  },
                                  body: JSON.stringify({
                                    id: revenue.id,
                                    approved: true,
                                    notes: ''
                                  }),
                                });
                                
                                if (response.ok) {
                                  toast({
                                    title: "Revenue approved",
                                    description: "Revenue has been approved successfully.",
                                  });
                                  // Refresh the dialog
                                  openReviewDialog(reviewingManager!);
                                  queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
                                  queryClient.invalidateQueries({ queryKey: ['revenues'] });
                                  queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
                                }
                              } catch (error) {
                                toast({
                                  variant: "destructive",
                                  title: "Failed to approve",
                                  description: "Could not approve the revenue.",
                                });
                              }
                            }}
                          >
                            ✅ Approve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Expenses */}
            {managerTransactions.expenses.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  📋 Pending Expenses ({managerTransactions.expenses.length})
                </h3>
                <div className="space-y-3">
                  {managerTransactions.expenses.map((expense: any) => (
                    <div key={expense.id} className="border rounded-lg p-4 bg-red-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                              {expense.category}
                            </Badge>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                              {expense.status}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-lg">₹{(expense.amountCents / 100).toFixed(2)}</h4>
                          <p className="text-sm text-gray-600">{expense.propertyName}</p>
                          {expense.description && (
                            <p className="text-sm text-gray-500 mt-1">{expense.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            📅 {formatCardDateTime(expense.expenseDate)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {expense.receiptFileId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedReceipt({
                                id: expense.id,
                                type: 'expense' as const,
                                category: expense.category,
                                propertyName: expense.propertyName,
                                amountCents: expense.amountCents,
                                description: expense.description,
                                receiptFileId: expense.receiptFileId,
                                status: expense.status,
                                date: new Date(expense.expenseDate),
                                createdByName: reviewingManager?.managerName || 'Unknown'
                              })}
                            >
                              📄 View Receipt
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={async () => {
                              try {
                                const response = await fetch(`http://127.0.0.1:4000/finance/expenses/${expense.id}/approve`, {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                                  },
                                  body: JSON.stringify({
                                    id: expense.id,
                                    approved: true,
                                    notes: ''
                                  }),
                                });
                                
                                if (response.ok) {
                                  toast({
                                    title: "Expense approved",
                                    description: "Expense has been approved successfully.",
                                  });
                                  // Refresh the dialog
                                  openReviewDialog(reviewingManager!);
                                  queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
                                  queryClient.invalidateQueries({ queryKey: ['expenses'] });
                                  queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
                                }
                              } catch (error) {
                                toast({
                                  variant: "destructive",
                                  title: "Failed to approve",
                                  description: "Could not approve the expense.",
                                });
                              }
                            }}
                          >
                            ✅ Approve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No transactions message */}
            {managerTransactions.revenues.length === 0 && managerTransactions.expenses.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No pending transactions found for {reviewingManager?.managerName}</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
              Close
            </Button>
            {(managerTransactions.revenues.length > 0 || managerTransactions.expenses.length > 0) && (
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (reviewingManager) {
                    quickApproveAllMutation.mutate({ managerId: reviewingManager.managerId });
                    setIsReviewDialogOpen(false);
                  }
                }}
                disabled={quickApproveAllMutation.isPending}
              >
                <Zap className="h-4 w-4 mr-2" />
                {quickApproveAllMutation.isPending ? 'Approving All...' : 'Quick Approve All'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Viewer */}
      <ReceiptViewer
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        transaction={selectedReceipt}
      />
    </>
  );
}

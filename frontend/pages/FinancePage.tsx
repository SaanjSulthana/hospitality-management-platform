import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
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
import { 
  DollarSign, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Calendar,
  Building2,
  Upload,
  Check,
  X
} from 'lucide-react';

export default function FinancePage() {
  const { getAuthenticatedBackend, user } = useAuth();
  const { theme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    propertyId: '',
    category: '',
    amountCents: '',
    description: '',
    receiptUrl: '',
    expenseDate: new Date().toISOString().split('T')[0],
  });
  const [revenueForm, setRevenueForm] = useState({
    propertyId: '',
    source: 'other' as 'room' | 'addon' | 'other',
    amountCents: '',
    description: '',
    receiptUrl: '',
    occurredAt: new Date().toISOString().split('T')[0],
  });

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list({});
    },
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.finance.listExpenses({});
    },
  });

  const { data: revenues, isLoading: revenuesLoading } = useQuery({
    queryKey: ['revenues'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.finance.listRevenues({});
    },
  });

  const { data: profitLoss } = useQuery({
    queryKey: ['profit-loss'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.finance.profitLoss({});
    },
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.finance.addExpense({
        ...data,
        amountCents: parseInt(data.amountCents),
        expenseDate: new Date(data.expenseDate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      setIsExpenseDialogOpen(false);
      setExpenseForm({
        propertyId: '',
        category: '',
        amountCents: '',
        description: '',
        receiptUrl: '',
        expenseDate: new Date().toISOString().split('T')[0],
      });
      toast({
        title: "Expense added",
        description: "The expense has been recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to add expense",
        description: error.message || "Please try again.",
      });
    },
  });

  const addRevenueMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      return backend.finance.addRevenue({
        ...data,
        amountCents: parseInt(data.amountCents),
        occurredAt: new Date(data.occurredAt),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      setIsRevenueDialogOpen(false);
      setRevenueForm({
        propertyId: '',
        source: 'other',
        amountCents: '',
        description: '',
        receiptUrl: '',
        occurredAt: new Date().toISOString().split('T')[0],
      });
      toast({
        title: "Revenue added",
        description: "The revenue has been recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to add revenue",
        description: error.message || "Please try again.",
      });
    },
  });

  const approveExpenseMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: number; approved: boolean }) => {
      const backend = getAuthenticatedBackend();
      return backend.finance.approveExpense({ id, approved });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      toast({
        title: "Expense updated",
        description: "The expense status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update expense",
        description: error.message || "Please try again.",
      });
    },
  });

  const formatCurrency = (amountCents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: theme.currency || 'USD',
    }).format(amountCents / 100);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Finance</h1>
          <p className="text-gray-600">Track revenue, expenses, and financial performance</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isRevenueDialogOpen} onOpenChange={setIsRevenueDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <TrendingUp className="mr-2 h-4 w-4" />
                Add Revenue
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Revenue</DialogTitle>
                <DialogDescription>
                  Record new revenue for your property
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Property *</Label>
                  <Select value={revenueForm.propertyId} onValueChange={(value) => setRevenueForm(prev => ({ ...prev, propertyId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties?.properties.map((property) => (
                        <SelectItem key={property.id} value={property.id.toString()}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={revenueForm.source} onValueChange={(value: any) => setRevenueForm(prev => ({ ...prev, source: value }))}>
                    <SelectTrigger>
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
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={revenueForm.amountCents ? (parseInt(revenueForm.amountCents) / 100).toString() : ''}
                    onChange={(e) => setRevenueForm(prev => ({ ...prev, amountCents: (parseFloat(e.target.value) * 100).toString() }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={revenueForm.description}
                    onChange={(e) => setRevenueForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Revenue description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Receipt URL</Label>
                  <Input
                    value={revenueForm.receiptUrl}
                    onChange={(e) => setRevenueForm(prev => ({ ...prev, receiptUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={revenueForm.occurredAt}
                    onChange={(e) => setRevenueForm(prev => ({ ...prev, occurredAt: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRevenueDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRevenueSubmit} disabled={addRevenueMutation.isPending}>
                  {addRevenueMutation.isPending ? 'Adding...' : 'Add Revenue'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Expense</DialogTitle>
                <DialogDescription>
                  Record a new expense for your property
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Property *</Label>
                  <Select value={expenseForm.propertyId} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, propertyId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties?.properties.map((property) => (
                        <SelectItem key={property.id} value={property.id.toString()}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
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
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expenseForm.amountCents ? (parseInt(expenseForm.amountCents) / 100).toString() : ''}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, amountCents: (parseFloat(e.target.value) * 100).toString() }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Expense description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Receipt URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={expenseForm.receiptUrl}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, receiptUrl: e.target.value }))}
                      placeholder="https://..."
                    />
                    <Button type="button" variant="outline" size="sm">
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={expenseForm.expenseDate}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, expenseDate: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleExpenseSubmit} disabled={addExpenseMutation.isPending}>
                  {addExpenseMutation.isPending ? 'Adding...' : 'Add Expense'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Financial Overview */}
      {profitLoss && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(profitLoss.data.totalRevenue * 100)}
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(profitLoss.data.totalExpenses * 100)}
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Income</CardTitle>
              <DollarSign className="h-4 w-4" style={{ color: theme.primaryColor }} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${profitLoss.data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(profitLoss.data.netIncome * 100)}
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${profitLoss.data.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profitLoss.data.profitMargin.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions */}
      <Tabs defaultValue="expenses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="revenues">Revenues</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>
                Track and manage property expenses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {expensesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : expenses?.expenses.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses recorded</h3>
                  <p className="text-gray-500 mb-4">Start tracking your property expenses</p>
                  <Button onClick={() => setIsExpenseDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Expense
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {expenses?.expenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{expense.category}</h4>
                          <Badge className={getStatusColor(expense.status)}>
                            {expense.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{expense.propertyName}</p>
                        {expense.description && (
                          <p className="text-sm text-gray-500">{expense.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(expense.expenseDate).toLocaleDateString()}
                          </span>
                          <span>By {expense.createdByName}</span>
                          {expense.receiptUrl && (
                            <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              View Receipt
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-red-600">
                          {formatCurrency(expense.amountCents)}
                        </div>
                        {user?.role === 'ADMIN' && expense.status === 'pending' && (
                          <div className="flex gap-1 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: true })}
                              disabled={approveExpenseMutation.isPending}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: false })}
                              disabled={approveExpenseMutation.isPending}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenues">
          <Card>
            <CardHeader>
              <CardTitle>Recent Revenues</CardTitle>
              <CardDescription>
                Track property income and revenue streams
              </CardDescription>
            </CardHeader>
            <CardContent>
              {revenuesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : revenues?.revenues.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No revenue recorded</h3>
                  <p className="text-gray-500 mb-4">Start tracking your property revenue</p>
                  <Button onClick={() => setIsRevenueDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Revenue
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {revenues?.revenues.map((revenue) => (
                    <div key={revenue.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium capitalize">{revenue.source} Revenue</h4>
                          <Badge className={getSourceColor(revenue.source)}>
                            {revenue.source}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{revenue.propertyName}</p>
                        {revenue.description && (
                          <p className="text-sm text-gray-500">{revenue.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(revenue.occurredAt).toLocaleDateString()}
                          </span>
                          <span>By {revenue.createdByName}</span>
                          {revenue.receiptUrl && (
                            <a href={revenue.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              View Receipt
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-green-600">
                          {formatCurrency(revenue.amountCents)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

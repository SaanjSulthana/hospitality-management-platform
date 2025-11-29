import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Plus, Download, Calculator, FileText, TrendingUp, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface SalaryComponent {
  id: number;
  staffId: number;
  staffName: string;
  componentType: 'base_salary' | 'overtime' | 'bonus' | 'allowance' | 'deduction';
  amountCents: number;
  effectiveDate: string;
  endDate?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

interface Payslip {
  id: number;
  staffId: number;
  staffName: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  grossPayCents: number;
  deductionsCents: number;
  netPayCents: number;
  status: 'draft' | 'generated' | 'sent' | 'paid';
  generatedAt: string;
  pdfUrl?: string;
}

interface SalaryStats {
  overview: {
    totalStaff: number;
    totalPayrollCents: number;
    averageSalaryCents: number;
    totalPayslips: number;
    pendingPayslips: number;
  };
  periodAnalysis: {
    currentMonth: {
      totalPayrollCents: number;
      averageSalaryCents: number;
      payslipsGenerated: number;
    };
  };
  trends: {
    monthlyTrend: Array<{
      month: string;
      totalPayrollCents: number;
      payslipsGenerated: number;
    }>;
  };
}

const SalaryManagement: React.FC = () => {
  const { getAuthenticatedBackend, user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('components');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isMobile, setIsMobile] = useState(false);

  // Form states
  const [salaryForm, setSalaryForm] = useState({
    staffId: '',
    componentType: 'base_salary' as const,
    amountCents: '',
    effectiveDate: '',
    endDate: '',
    notes: '',
  });

  const [payslipForm, setPayslipForm] = useState({
    staffId: '',
    payPeriodStart: '',
    payPeriodEnd: '',
  });

  const [calculateForm, setCalculateForm] = useState({
    staffId: '',
    month: '',
    year: '',
  });

  // Check mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // API Queries
  const { data: salaryComponents, isLoading: loadingComponents } = useQuery({
    queryKey: ['salaryComponents', searchTerm, filterType],
    queryFn: () => getAuthenticatedBackend().staff.salaryComponents({
      search: searchTerm,
      componentType: filterType === 'all' ? undefined : filterType,
      page: 1,
      limit: 50,
    }),
    refetchInterval: false, // Disabled: Use WebSocket/Pub-Sub for real-time updates
    staleTime: 30000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const { data: payslips, isLoading: loadingPayslips } = useQuery({
    queryKey: ['payslips'],
    queryFn: () => getAuthenticatedBackend().staff.payslips({
      page: 1,
      limit: 50,
    }),
    refetchInterval: false, // Disabled: Use WebSocket/Pub-Sub for real-time updates
    staleTime: 30000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const { data: salaryStats, isLoading: loadingStats } = useQuery({
    queryKey: ['salaryStats'],
    queryFn: () => getAuthenticatedBackend().staff.salaryStatistics(),
    refetchInterval: false, // Disabled: Use WebSocket/Pub-Sub for real-time updates
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  // API Mutations
  const createSalaryComponentMutation = useMutation({
    mutationFn: (data: any) => getAuthenticatedBackend().staff.salaryComponents(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaryComponents'] });
      setIsAddDialogOpen(false);
      setSalaryForm({
        staffId: '',
        componentType: 'base_salary',
        amountCents: '',
        effectiveDate: '',
        endDate: '',
        notes: '',
      });
    },
  });

  const generatePayslipMutation = useMutation({
    mutationFn: (data: any) => getAuthenticatedBackend().staff.generatePayslip(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payslips'] });
      setIsGenerateDialogOpen(false);
      setPayslipForm({
        staffId: '',
        payPeriodStart: '',
        payPeriodEnd: '',
      });
    },
  });

  const calculateSalaryMutation = useMutation({
    mutationFn: (data: any) => getAuthenticatedBackend().staff.calculateSalary(data),
    onSuccess: () => {
      setIsCalculateDialogOpen(false);
    },
  });

  const exportSalaryMutation = useMutation({
    mutationFn: (data: any) => getAuthenticatedBackend().staff.exportSalary(data),
    onSuccess: (data) => {
      if ((data as any).downloadUrl) {
        window.open((data as any).downloadUrl, '_blank');
      }
    },
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getComponentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      base_salary: 'Base Salary',
      overtime: 'Overtime',
      bonus: 'Bonus',
      allowance: 'Allowance',
      deduction: 'Deduction',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'outline',
      generated: 'default',
      sent: 'secondary',
      paid: 'default',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleAddSalaryComponent = () => {
    createSalaryComponentMutation.mutate({
      staffId: parseInt(salaryForm.staffId),
      componentType: salaryForm.componentType,
      amountCents: parseInt(salaryForm.amountCents),
      effectiveDate: salaryForm.effectiveDate,
      endDate: salaryForm.endDate || null,
      notes: salaryForm.notes,
    });
  };

  const handleGeneratePayslip = () => {
    generatePayslipMutation.mutate({
      staffId: parseInt(payslipForm.staffId),
      payPeriodStart: payslipForm.payPeriodStart,
      payPeriodEnd: payslipForm.payPeriodEnd,
    });
  };

  const handleCalculateSalary = () => {
    calculateSalaryMutation.mutate({
      staffId: parseInt(calculateForm.staffId),
      month: parseInt(calculateForm.month),
      year: parseInt(calculateForm.year),
    });
  };

  const handleExportSalary = (format: string) => {
    exportSalaryMutation.mutate({
      format,
      startDate: '2023-01-01',
      endDate: '2023-12-31',
    });
  };

  if (loadingComponents || loadingPayslips || loadingStats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading salary data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            Salary Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage staff salary components and payslips
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Badge variant="outline" className="w-fit">
            <RefreshCw className="h-3 w-3 mr-1" />
            Live updates active
          </Badge>
        </div>
      </div>

      {/* Statistics Cards */}
      {salaryStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(salaryStats.overview.totalPayrollCents)}
              </div>
              <p className="text-xs text-muted-foreground">
                {salaryStats.overview.totalStaff} staff members
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Salary</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(salaryStats.overview.averageSalaryCents)}
              </div>
              <p className="text-xs text-muted-foreground">
                Monthly average
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payslips</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {salaryStats.overview.totalPayslips}
              </div>
              <p className="text-xs text-muted-foreground">
                {salaryStats.overview.pendingPayslips} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Month</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(salaryStats.periodAnalysis.currentMonth.totalPayrollCents)}
              </div>
              <p className="text-xs text-muted-foreground">
                {salaryStats.periodAnalysis.currentMonth.payslipsGenerated} payslips
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <TabsTrigger value="components" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Components</span>
          </TabsTrigger>
          <TabsTrigger value="payslips" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Payslips</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
        </TabsList>

        {/* Salary Components Tab */}
        <TabsContent value="components" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Salary Components</CardTitle>
                  <CardDescription>
                    Manage base salary, overtime, bonuses, and deductions
                  </CardDescription>
                </div>
                {user?.role === 'ADMIN' && (
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Component
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Salary Component</DialogTitle>
                        <DialogDescription>
                          Create a new salary component for staff
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="staffId">Staff Member</Label>
                          <Input
                            id="staffId"
                            type="number"
                            value={salaryForm.staffId}
                            onChange={(e) => setSalaryForm({ ...salaryForm, staffId: e.target.value })}
                            placeholder="Staff ID"
                          />
                        </div>
                        <div>
                          <Label htmlFor="componentType">Component Type</Label>
                          <Select
                            value={salaryForm.componentType}
                            onValueChange={(value: any) => setSalaryForm({ ...salaryForm, componentType: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="base_salary">Base Salary</SelectItem>
                              <SelectItem value="overtime">Overtime</SelectItem>
                              <SelectItem value="bonus">Bonus</SelectItem>
                              <SelectItem value="allowance">Allowance</SelectItem>
                              <SelectItem value="deduction">Deduction</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="amountCents">Amount (cents)</Label>
                          <Input
                            id="amountCents"
                            type="number"
                            value={salaryForm.amountCents}
                            onChange={(e) => setSalaryForm({ ...salaryForm, amountCents: e.target.value })}
                            placeholder="500000"
                          />
                        </div>
                        <div>
                          <Label htmlFor="effectiveDate">Effective Date</Label>
                          <Input
                            id="effectiveDate"
                            type="date"
                            value={salaryForm.effectiveDate}
                            onChange={(e) => setSalaryForm({ ...salaryForm, effectiveDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="notes">Notes</Label>
                          <Textarea
                            id="notes"
                            value={salaryForm.notes}
                            onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })}
                            placeholder="Optional notes"
                          />
                        </div>
                        <Button
                          onClick={handleAddSalaryComponent}
                          disabled={createSalaryComponentMutation.isPending}
                          className="w-full"
                        >
                          {createSalaryComponentMutation.isPending ? 'Adding...' : 'Add Component'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Input
                  placeholder="Search components..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="base_salary">Base Salary</SelectItem>
                    <SelectItem value="overtime">Overtime</SelectItem>
                    <SelectItem value="bonus">Bonus</SelectItem>
                    <SelectItem value="allowance">Allowance</SelectItem>
                    <SelectItem value="deduction">Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Components List */}
              {salaryComponents?.salaryComponents?.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No salary components found</h3>
                  <p className="text-muted-foreground">
                    Start by adding your first salary component
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {salaryComponents?.salaryComponents?.map((component: SalaryComponent) => (
                    <Card key={component.id} className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{component.staffName}</h3>
                            <Badge variant="outline">
                              {getComponentTypeLabel(component.componentType)}
                            </Badge>
                            {component.isActive ? (
                              <Badge variant="default">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(component.amountCents)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Effective: {format(new Date(component.effectiveDate), 'MMM dd, yyyy')}
                          </p>
                          {component.notes && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {component.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Calculator className="h-4 w-4 mr-1" />
                            Calculate
                          </Button>
                          {user?.role === 'ADMIN' && (
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payslips Tab */}
        <TabsContent value="payslips" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Payslips</CardTitle>
                  <CardDescription>
                    Generate and manage employee payslips
                  </CardDescription>
                </div>
                {user?.role === 'ADMIN' && (
                  <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full sm:w-auto">
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Payslip
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Generate Payslip</DialogTitle>
                        <DialogDescription>
                          Create a new payslip for a staff member
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="payslipStaffId">Staff Member</Label>
                          <Input
                            id="payslipStaffId"
                            type="number"
                            value={payslipForm.staffId}
                            onChange={(e) => setPayslipForm({ ...payslipForm, staffId: e.target.value })}
                            placeholder="Staff ID"
                          />
                        </div>
                        <div>
                          <Label htmlFor="payPeriodStart">Pay Period Start</Label>
                          <Input
                            id="payPeriodStart"
                            type="date"
                            value={payslipForm.payPeriodStart}
                            onChange={(e) => setPayslipForm({ ...payslipForm, payPeriodStart: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="payPeriodEnd">Pay Period End</Label>
                          <Input
                            id="payPeriodEnd"
                            type="date"
                            value={payslipForm.payPeriodEnd}
                            onChange={(e) => setPayslipForm({ ...payslipForm, payPeriodEnd: e.target.value })}
                          />
                        </div>
                        <Button
                          onClick={handleGeneratePayslip}
                          disabled={generatePayslipMutation.isPending}
                          className="w-full"
                        >
                          {generatePayslipMutation.isPending ? 'Generating...' : 'Generate Payslip'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {payslips?.payslips?.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No payslips found</h3>
                  <p className="text-muted-foreground">
                    Generate your first payslip to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payslips?.payslips?.map((payslip: Payslip) => (
                    <Card key={payslip.id} className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{payslip.staffName}</h3>
                            {getStatusBadge(payslip.status)}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Gross Pay</p>
                              <p className="font-semibold text-green-600">
                                {formatCurrency(payslip.grossPayCents)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Deductions</p>
                              <p className="font-semibold text-red-600">
                                {formatCurrency(payslip.deductionsCents)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Net Pay</p>
                              <p className="font-semibold text-blue-600">
                                {formatCurrency(payslip.netPayCents)}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            Period: {format(new Date(payslip.payPeriodStart), 'MMM dd')} - {format(new Date(payslip.payPeriodEnd), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {payslip.pdfUrl && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={payslip.pdfUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </a>
                            </Button>
                          )}
                          {user?.role === 'ADMIN' && (
                            <Button variant="outline" size="sm">
                              Update Status
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Trends</CardTitle>
                <CardDescription>Payroll trends over time</CardDescription>
              </CardHeader>
              <CardContent>
                {salaryStats?.trends?.monthlyTrend?.map((trend: any) => (
                  <div key={trend.month} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <span className="font-medium">{trend.month}</span>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(trend.totalPayrollCents)}</p>
                      <p className="text-sm text-muted-foreground">{trend.payslipsGenerated} payslips</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common salary management tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleExportSalary('csv')}
                  disabled={exportSalaryMutation.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export to CSV
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleExportSalary('excel')}
                  disabled={exportSalaryMutation.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export to Excel
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setIsCalculateDialogOpen(true)}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Salary
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Calculate Salary Dialog */}
      <Dialog open={isCalculateDialogOpen} onOpenChange={setIsCalculateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Calculate Salary</DialogTitle>
            <DialogDescription>
              Calculate salary for a specific period
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="calcStaffId">Staff Member</Label>
              <Input
                id="calcStaffId"
                type="number"
                value={calculateForm.staffId}
                onChange={(e) => setCalculateForm({ ...calculateForm, staffId: e.target.value })}
                placeholder="Staff ID"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="month">Month</Label>
                <Input
                  id="month"
                  type="number"
                  min="1"
                  max="12"
                  value={calculateForm.month}
                  onChange={(e) => setCalculateForm({ ...calculateForm, month: e.target.value })}
                  placeholder="12"
                />
              </div>
              <div>
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  min="2020"
                  max="2030"
                  value={calculateForm.year}
                  onChange={(e) => setCalculateForm({ ...calculateForm, year: e.target.value })}
                  placeholder="2023"
                />
              </div>
            </div>
            <Button
              onClick={handleCalculateSalary}
              disabled={calculateSalaryMutation.isPending}
              className="w-full"
            >
              {calculateSalaryMutation.isPending ? 'Calculating...' : 'Calculate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Messages */}
      {createSalaryComponentMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">
                Failed to create salary component
              </p>
            </div>
          </div>
        </div>
      )}

      {generatePayslipMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">
                Failed to generate payslip
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryManagement;

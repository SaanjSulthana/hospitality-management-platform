import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, DollarSign, Users, FileText, Download, BarChart3, PieChart, Calendar, RefreshCw } from 'lucide-react';

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
    previousMonth: {
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
      averageSalaryCents: number;
    }>;
  };
  departmentBreakdown: Array<{
    department: string;
    totalPayrollCents: number;
    staffCount: number;
    averageSalaryCents: number;
  }>;
  componentBreakdown: Array<{
    componentType: string;
    totalAmountCents: number;
    percentage: number;
  }>;
}

const SalaryAnalytics: React.FC = () => {
  const { getAuthenticatedBackend } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [selectedView, setSelectedView] = useState('overview');
  const [isMobile, setIsMobile] = useState(false);

  // Check mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // API Query
  const { data: salaryStats, isLoading, error } = useQuery({
    queryKey: ['salaryStats', selectedPeriod],
    queryFn: () => getAuthenticatedBackend().staff.salaryStatistics({
      period: selectedPeriod,
    }),
    refetchInterval: 60000, // 1 minute
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading salary analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Analytics</h3>
        <p className="text-muted-foreground">
          There was a problem loading the salary analytics. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Salary Analytics
          </h2>
          <p className="text-muted-foreground">
            Comprehensive salary insights and trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline">
            <RefreshCw className="h-3 w-3 mr-1" />
            Live data
          </Badge>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(salaryStats?.overview?.totalPayrollCents || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {salaryStats?.overview?.totalStaff || 0} staff members
            </p>
            {salaryStats?.periodAnalysis && (
              <div className="flex items-center mt-1">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-600">
                  {getPercentageChange(
                    salaryStats.periodAnalysis.currentMonth.totalPayrollCents,
                    salaryStats.periodAnalysis.previousMonth.totalPayrollCents
                  ).toFixed(1)}% vs last month
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Salary</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(salaryStats?.overview?.averageSalaryCents || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Monthly average
            </p>
            {salaryStats?.periodAnalysis && (
              <div className="flex items-center mt-1">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-600">
                  {getPercentageChange(
                    salaryStats.periodAnalysis.currentMonth.averageSalaryCents,
                    salaryStats.periodAnalysis.previousMonth.averageSalaryCents
                  ).toFixed(1)}% vs last month
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payslips</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(salaryStats?.overview?.totalPayslips || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {salaryStats?.overview?.pendingPayslips || 0} pending
            </p>
            {salaryStats?.periodAnalysis && (
              <div className="flex items-center mt-1">
                <TrendingUp className="h-3 w-3 text-blue-500 mr-1" />
                <span className="text-xs text-blue-600">
                  {salaryStats.periodAnalysis.currentMonth.payslipsGenerated} this month
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Count</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(salaryStats?.overview?.totalStaff || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Active employees
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs value={selectedView} onValueChange={setSelectedView} className="space-y-4">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Trends</span>
          </TabsTrigger>
          <TabsTrigger value="breakdown" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            <span className="hidden sm:inline">Breakdown</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Month Summary</CardTitle>
                <CardDescription>Key metrics for this month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {salaryStats?.periodAnalysis?.currentMonth && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Payroll</span>
                      <span className="font-semibold">
                        {formatCurrency(salaryStats.periodAnalysis.currentMonth.totalPayrollCents)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Average Salary</span>
                      <span className="font-semibold">
                        {formatCurrency(salaryStats.periodAnalysis.currentMonth.averageSalaryCents)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Payslips Generated</span>
                      <span className="font-semibold">
                        {salaryStats.periodAnalysis.currentMonth.payslipsGenerated}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Department Breakdown</CardTitle>
                <CardDescription>Payroll by department</CardDescription>
              </CardHeader>
              <CardContent>
                {salaryStats?.departmentBreakdown?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No department data available</p>
                ) : (
                  <div className="space-y-3">
                    {salaryStats?.departmentBreakdown?.map((dept: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{dept.department}</p>
                          <p className="text-sm text-muted-foreground">
                            {dept.staffCount} staff
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatCurrency(dept.totalPayrollCents)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(dept.averageSalaryCents)} avg
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Trends</CardTitle>
              <CardDescription>Payroll trends over the last 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              {salaryStats?.trends?.monthlyTrend?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No trend data available</p>
              ) : (
                <div className="space-y-4">
                  {salaryStats?.trends?.monthlyTrend?.map((trend: any, index: number) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{trend.month}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Payroll</p>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(trend.totalPayrollCents)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Average Salary</p>
                          <p className="font-semibold">
                            {formatCurrency(trend.averageSalaryCents)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payslips</p>
                          <p className="font-semibold">
                            {trend.payslipsGenerated}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Component Breakdown</CardTitle>
                <CardDescription>Salary components distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {salaryStats?.componentBreakdown?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No component data available</p>
                ) : (
                  <div className="space-y-3">
                    {salaryStats?.componentBreakdown?.map((component: any, index: number) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">
                            {getComponentTypeLabel(component.componentType)}
                          </span>
                          <span className="font-semibold">
                            {formatCurrency(component.totalAmountCents)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${component.percentage}%` }}
                          ></div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {component.percentage.toFixed(1)}% of total
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Export and analysis tools</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Export Payroll Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Generate Salary Analysis
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Create Summary Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalaryAnalytics;

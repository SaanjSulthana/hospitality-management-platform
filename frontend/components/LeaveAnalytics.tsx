import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Users, Calendar, CheckCircle, XCircle, Clock, Download, RefreshCw, FileText } from 'lucide-react';

interface LeaveStats {
  overview: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    totalLeaveDays: number;
    averageRequestDays: number;
  };
  periodAnalysis: {
    currentMonth: {
      totalRequests: number;
      approvedRequests: number;
      rejectedRequests: number;
      pendingRequests: number;
      totalLeaveDays: number;
    };
    previousMonth: {
      totalRequests: number;
      approvedRequests: number;
      rejectedRequests: number;
      pendingRequests: number;
      totalLeaveDays: number;
    };
  };
  trends: {
    monthlyTrend: Array<{
      month: string;
      totalRequests: number;
      approvedRequests: number;
      rejectedRequests: number;
      totalLeaveDays: number;
    }>;
  };
  leaveTypeBreakdown: Array<{
    leaveType: string;
    totalRequests: number;
    approvedRequests: number;
    totalDays: number;
    averageDays: number;
  }>;
  staffPerformance: Array<{
    staffId: number;
    staffName: string;
    totalRequests: number;
    approvedRequests: number;
    totalLeaveDays: number;
    approvalRate: number;
  }>;
}

const LeaveAnalytics: React.FC = () => {
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
  const { data: leaveStats, isLoading, error } = useQuery({
    queryKey: ['leaveStats', selectedPeriod],
    queryFn: () => getAuthenticatedBackend().staff.leaveStatistics({
      period: selectedPeriod,
    }),
    refetchInterval: false, // Disabled: Use WebSocket/Pub-Sub for real-time updates
    staleTime: 60000, // 1 minute
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const getLeaveTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      annual_leave: 'Annual Leave',
      sick_leave: 'Sick Leave',
      emergency_leave: 'Emergency Leave',
      maternity_leave: 'Maternity Leave',
      paternity_leave: 'Paternity Leave',
      unpaid_leave: 'Unpaid Leave',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading leave analytics...</p>
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
          There was a problem loading the leave analytics. Please try again.
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
            Leave Analytics
          </h2>
          <p className="text-muted-foreground">
            Comprehensive leave insights and performance metrics
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
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(leaveStats?.overview?.totalRequests || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(leaveStats?.overview?.totalLeaveDays || 0)} total days
            </p>
            {leaveStats?.periodAnalysis && (
              <div className="flex items-center mt-1">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-600">
                  {getPercentageChange(
                    leaveStats.periodAnalysis.currentMonth.totalRequests,
                    leaveStats.periodAnalysis.previousMonth.totalRequests
                  ).toFixed(1)}% vs last month
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leaveStats?.overview?.totalRequests ? 
                ((leaveStats.overview.approvedRequests / leaveStats.overview.totalRequests) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(leaveStats?.overview?.approvedRequests || 0)} approved
            </p>
            {leaveStats?.periodAnalysis && (
              <div className="flex items-center mt-1">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-600">
                  {getPercentageChange(
                    leaveStats.periodAnalysis.currentMonth.approvedRequests,
                    leaveStats.periodAnalysis.previousMonth.approvedRequests
                  ).toFixed(1)}% vs last month
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(leaveStats?.overview?.pendingRequests || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Days</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(leaveStats?.overview?.averageRequestDays || 0).toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              per request
            </p>
            {leaveStats?.periodAnalysis && (
              <div className="flex items-center mt-1">
                <TrendingUp className="h-3 w-3 text-blue-500 mr-1" />
                <span className="text-xs text-blue-600">
                  {getPercentageChange(
                    leaveStats.periodAnalysis.currentMonth.totalLeaveDays,
                    leaveStats.periodAnalysis.previousMonth.totalLeaveDays
                  ).toFixed(1)}% vs last month
                </span>
              </div>
            )}
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
            <Users className="h-4 w-4" />
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
                {leaveStats?.periodAnalysis?.currentMonth && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Requests</span>
                      <span className="font-semibold">
                        {formatNumber(leaveStats.periodAnalysis.currentMonth.totalRequests)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Approved</span>
                      <span className="font-semibold text-green-600">
                        {formatNumber(leaveStats.periodAnalysis.currentMonth.approvedRequests)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Rejected</span>
                      <span className="font-semibold text-red-600">
                        {formatNumber(leaveStats.periodAnalysis.currentMonth.rejectedRequests)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Pending</span>
                      <span className="font-semibold text-yellow-600">
                        {formatNumber(leaveStats.periodAnalysis.currentMonth.pendingRequests)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Leave Days</span>
                      <span className="font-semibold">
                        {formatNumber(leaveStats.periodAnalysis.currentMonth.totalLeaveDays)}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leave Type Breakdown</CardTitle>
                <CardDescription>Requests by leave type</CardDescription>
              </CardHeader>
              <CardContent>
                {leaveStats?.leaveTypeBreakdown?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No leave type data available</p>
                ) : (
                  <div className="space-y-3">
                    {leaveStats?.leaveTypeBreakdown?.map((leaveType: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{getLeaveTypeLabel(leaveType.leaveType)}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(leaveType.totalRequests)} requests
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatNumber(leaveType.approvedRequests)} approved
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(leaveType.totalDays)} days
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
              <CardDescription>Leave request trends over the last 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              {leaveStats?.trends?.monthlyTrend?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No trend data available</p>
              ) : (
                <div className="space-y-4">
                  {leaveStats?.trends?.monthlyTrend?.map((trend: any, index: number) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{trend.month}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-semibold">{formatNumber(trend.totalRequests)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Approved</p>
                          <p className="font-semibold text-green-600">{formatNumber(trend.approvedRequests)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rejected</p>
                          <p className="font-semibold text-red-600">{formatNumber(trend.rejectedRequests)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Days</p>
                          <p className="font-semibold">{formatNumber(trend.totalLeaveDays)}</p>
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
                <CardTitle>Staff Performance</CardTitle>
                <CardDescription>Individual staff leave request performance</CardDescription>
              </CardHeader>
              <CardContent>
                {leaveStats?.staffPerformance?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No staff performance data available</p>
                ) : (
                  <div className="space-y-3">
                    {leaveStats?.staffPerformance?.map((staff: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{staff.staffName}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(staff.totalRequests)} requests
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {staff.approvalRate.toFixed(1)}% approval
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(staff.totalLeaveDays)} days
                          </p>
                        </div>
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
                  Export Leave Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Generate Analytics
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

export default LeaveAnalytics;

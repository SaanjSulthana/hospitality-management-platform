import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Users, Clock, CheckCircle, AlertCircle, Calendar, Download, RefreshCw } from 'lucide-react';

interface ScheduleStats {
  overview: {
    totalSchedules: number;
    completedSchedules: number;
    pendingSchedules: number;
    totalChangeRequests: number;
    pendingChangeRequests: number;
    averageCompletionRate: number;
  };
  periodAnalysis: {
    currentWeek: {
      totalSchedules: number;
      completedSchedules: number;
      completionRate: number;
      averageHours: number;
    };
    previousWeek: {
      totalSchedules: number;
      completedSchedules: number;
      completionRate: number;
      averageHours: number;
    };
  };
  trends: {
    weeklyTrend: Array<{
      week: string;
      totalSchedules: number;
      completedSchedules: number;
      completionRate: number;
      averageHours: number;
    }>;
  };
  staffPerformance: Array<{
    staffId: number;
    staffName: string;
    totalSchedules: number;
    completedSchedules: number;
    completionRate: number;
    averageHours: number;
  }>;
  shiftTypeBreakdown: Array<{
    shiftType: string;
    totalSchedules: number;
    completionRate: number;
    averageHours: number;
  }>;
}

const ScheduleAnalytics: React.FC = () => {
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
  const { data: scheduleStats, isLoading, error } = useQuery({
    queryKey: ['scheduleStats', selectedPeriod],
    queryFn: () => getAuthenticatedBackend().staff.scheduleStatistics({
      period: selectedPeriod,
    }),
    refetchInterval: 60000, // 1 minute
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(1)}h`;
  };

  const getPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const getShiftTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      day_shift: 'Day Shift',
      night_shift: 'Night Shift',
      split_shift: 'Split Shift',
      overtime: 'Overtime',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading schedule analytics...</p>
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
          There was a problem loading the schedule analytics. Please try again.
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
            Schedule Analytics
          </h2>
          <p className="text-muted-foreground">
            Comprehensive schedule insights and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
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
            <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(scheduleStats?.overview?.totalSchedules || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {scheduleStats?.overview?.pendingSchedules || 0} pending
            </p>
            {scheduleStats?.periodAnalysis && (
              <div className="flex items-center mt-1">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-600">
                  {getPercentageChange(
                    scheduleStats.periodAnalysis.currentWeek.totalSchedules,
                    scheduleStats.periodAnalysis.previousWeek.totalSchedules
                  ).toFixed(1)}% vs last week
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(scheduleStats?.overview?.averageCompletionRate || 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {scheduleStats?.overview?.completedSchedules || 0} completed
            </p>
            {scheduleStats?.periodAnalysis && (
              <div className="flex items-center mt-1">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-600">
                  {getPercentageChange(
                    scheduleStats.periodAnalysis.currentWeek.completionRate,
                    scheduleStats.periodAnalysis.previousWeek.completionRate
                  ).toFixed(1)}% vs last week
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Change Requests</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(scheduleStats?.overview?.totalChangeRequests || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {scheduleStats?.overview?.pendingChangeRequests || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatHours(scheduleStats?.periodAnalysis?.currentWeek?.averageHours || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              per schedule
            </p>
            {scheduleStats?.periodAnalysis && (
              <div className="flex items-center mt-1">
                <TrendingUp className="h-3 w-3 text-blue-500 mr-1" />
                <span className="text-xs text-blue-600">
                  {getPercentageChange(
                    scheduleStats.periodAnalysis.currentWeek.averageHours,
                    scheduleStats.periodAnalysis.previousWeek.averageHours
                  ).toFixed(1)}% vs last week
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
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Week Summary</CardTitle>
                <CardDescription>Key metrics for this week</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {scheduleStats?.periodAnalysis?.currentWeek && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Schedules</span>
                      <span className="font-semibold">
                        {formatNumber(scheduleStats.periodAnalysis.currentWeek.totalSchedules)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Completed</span>
                      <span className="font-semibold">
                        {formatNumber(scheduleStats.periodAnalysis.currentWeek.completedSchedules)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Completion Rate</span>
                      <span className="font-semibold">
                        {scheduleStats.periodAnalysis.currentWeek.completionRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Average Hours</span>
                      <span className="font-semibold">
                        {formatHours(scheduleStats.periodAnalysis.currentWeek.averageHours)}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shift Type Breakdown</CardTitle>
                <CardDescription>Performance by shift type</CardDescription>
              </CardHeader>
              <CardContent>
                {scheduleStats?.shiftTypeBreakdown?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No shift type data available</p>
                ) : (
                  <div className="space-y-3">
                    {scheduleStats?.shiftTypeBreakdown?.map((shift: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{getShiftTypeLabel(shift.shiftType)}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(shift.totalSchedules)} schedules
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {shift.completionRate.toFixed(1)}%
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatHours(shift.averageHours)} avg
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
              <CardTitle>Weekly Trends</CardTitle>
              <CardDescription>Schedule performance over the last 12 weeks</CardDescription>
            </CardHeader>
            <CardContent>
              {scheduleStats?.trends?.weeklyTrend?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No trend data available</p>
              ) : (
                <div className="space-y-4">
                  {scheduleStats?.trends?.weeklyTrend?.map((trend: any, index: number) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{trend.week}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-semibold">{formatNumber(trend.totalSchedules)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Completed</p>
                          <p className="font-semibold">{formatNumber(trend.completedSchedules)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rate</p>
                          <p className="font-semibold">{trend.completionRate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Hours</p>
                          <p className="font-semibold">{formatHours(trend.averageHours)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Staff Performance</CardTitle>
                <CardDescription>Individual staff schedule performance</CardDescription>
              </CardHeader>
              <CardContent>
                {scheduleStats?.staffPerformance?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No staff performance data available</p>
                ) : (
                  <div className="space-y-3">
                    {scheduleStats?.staffPerformance?.map((staff: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{staff.staffName}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(staff.totalSchedules)} schedules
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {staff.completionRate.toFixed(1)}%
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatHours(staff.averageHours)} avg
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
                  Export Schedule Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Generate Performance Analysis
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Create Schedule Template
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScheduleAnalytics;

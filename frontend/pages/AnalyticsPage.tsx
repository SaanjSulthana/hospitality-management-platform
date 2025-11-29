import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Target,
  RefreshCw
} from 'lucide-react';
import { getFlagBool } from '../lib/feature-flags';

export default function AnalyticsPage() {
  const { getAuthenticatedBackend } = useAuth();
  const { theme } = useTheme();
  const { setPageTitle } = usePageTitle();
  const [timeRange, setTimeRange] = useState('30');
  const queryClient = useQueryClient();

  // Set page title and description
  useEffect(() => {
    setPageTitle('Analytics Dashboard', 'View detailed analytics and performance metrics');
  }, [setPageTitle]);

  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useQuery({
    queryKey: ['analytics', 'overview', timeRange],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange));
      
      return backend.analytics.overview({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
    },
    retry: (failureCount, error) => {
      if (failureCount < 2) {
        console.error('Analytics query failed:', error);
        return true;
      }
      return false;
    },
    // Disable polling; rely on RealtimeProvider
    refetchInterval: false,
    staleTime: 25000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const isAnyLoading = analyticsLoading;
  const hasErrors = analyticsError;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: theme.currency || 'USD',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };
  // Realtime: listen to analytics events and debounce invalidate
  useEffect(() => {
    try { (window as any).__analyticsSelectedPropertyId = 'all'; } catch {}

    const enabled = getFlagBool('ANALYTICS_REALTIME_V1', true);
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidate = () => {
      // Invalidate analytics overview queries
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      // 2% telemetry
      if (Math.random() < 0.02) {
        try {
          fetch(`/telemetry/client`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sampleRate: 0.02,
              events: [{
                type: 'analytics_realtime_invalidation',
                counts: { scopes: 1 },
                ts: new Date().toISOString(),
              }]
            })
          }).catch(() => {});
        } catch {}
      }
    };

    const onEvents = (e: any) => {
      const events = e?.detail?.events || [];
      if (!Array.isArray(events) || events.length === 0) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(invalidate, Math.floor(400 + Math.random() * 400));
    };
    const onHealth = (_e: any) => {};

    window.addEventListener('analytics-stream-events', onEvents as EventListener);
    window.addEventListener('analytics-stream-health', onHealth as EventListener);
    return () => {
      window.removeEventListener('analytics-stream-events', onEvents as EventListener);
      window.removeEventListener('analytics-stream-health', onHealth as EventListener);
      if (timer) clearTimeout(timer);
    };
  }, [queryClient]);


  const getPerformanceColor = (value: number, threshold: number) => {
    if (value >= threshold) return 'text-green-600';
    if (value >= threshold * 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceIcon = (value: number, threshold: number) => {
    if (value >= threshold) return <TrendingUp className="h-4 w-4 text-green-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  if (isAnyLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-6 py-6">
          <div className="space-y-6">
            {/* Loading Header */}
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="flex items-center justify-center p-12">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900">Loading analytics...</p>
                  <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your performance data</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Loading Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="border-l-4 border-l-green-500 shadow-sm animate-pulse">
                  <CardHeader className="pb-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if there are any errors
  if (hasErrors) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-6 py-6">
          <Card className="border-l-4 border-l-red-500 shadow-sm">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-lg font-medium text-red-900 mb-2">Error loading analytics</p>
                <p className="text-sm text-gray-600 mb-4">
                  {analyticsError ? 'Analytics data failed to load' : 'Properties data failed to load'}
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="bg-white border-rose-200 text-red-700 hover:bg-rose-50 hover:border-rose-300 font-semibold transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-6">
        <div className="space-y-6">
          {/* Enhanced Header */}
          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                Analytics Dashboard
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live</span>
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                Performance insights and key metrics for your hospitality business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Real-time data updates</span>
                  {isAnyLoading && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span className="text-xs">Updating...</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Time Range</label>
                    <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger className="h-11 w-48 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

      {analytics && (
        <>
          {/* Key Performance Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg shadow-sm">
                    <Target className="h-4 w-4 text-purple-600" />
                  </div>
                  Occupancy Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatPercentage(analytics.metrics?.occupancyRate || 0)}
                </div>
                <p className="text-xs text-gray-600 flex items-center gap-1 mt-2">
                  {getPerformanceIcon(analytics.metrics?.occupancyRate || 0, 75)}
                  Target: 75%
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                    <Receipt className="h-4 w-4 text-green-600" />
                  </div>
                  Average Daily Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(analytics.metrics?.adr || 0)}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Per occupied room
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                  </div>
                  RevPAR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(analytics.metrics?.revpar || 0)}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Revenue per available room
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg shadow-sm">
                    <TrendingUp className="h-4 w-4 text-orange-600" />
                  </div>
                  Net Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  (analytics.metrics?.netIncome || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(analytics.metrics?.netIncome || 0)}
                </div>
                <p className="text-xs text-gray-600 flex items-center gap-1 mt-2">
                  {getPerformanceIcon((analytics.metrics?.netIncome || 0) >= 0 ? 1 : 0, 0)}
                  {(analytics.metrics?.netIncome || 0) >= 0 ? 'Profitable' : 'Loss'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Financial Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                    <Receipt className="h-5 w-5 text-green-600" />
                  </div>
                  Total Revenue
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  Last {timeRange} days
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(analytics.metrics?.totalRevenue || 0)}
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Bookings:</span>
                    <span className="font-medium">{analytics.metrics?.totalBookings || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Guests:</span>
                    <span className="font-medium">{analytics.metrics?.totalGuests || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Stay:</span>
                    <span className="font-medium">{(analytics.metrics?.averageStayLength || 0).toFixed(1)} days</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className="p-2 bg-red-100 rounded-lg shadow-sm">
                    <Receipt className="h-5 w-5 text-red-600" />
                  </div>
                  Total Expenses
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  Last {timeRange} days
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold text-red-600">
                  {formatCurrency(analytics.metrics?.totalExpenses || 0)}
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Expense Ratio:</span>
                    <span className="font-medium text-red-600">
                      {(analytics.metrics?.totalRevenue || 0) > 0 
                        ? formatPercentage(((analytics.metrics?.totalExpenses || 0) / (analytics.metrics?.totalRevenue || 1)) * 100)
                        : '0%'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  Net Income
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  Last {timeRange} days
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div 
                  className={`text-3xl font-bold ${
                    (analytics.metrics?.netIncome || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(analytics.metrics?.netIncome || 0)}
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Profit Margin:</span>
                    <span className={`font-medium ${(analytics.metrics?.netIncome || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(analytics.metrics?.totalRevenue || 0) > 0 
                        ? formatPercentage(((analytics.metrics?.netIncome || 0) / (analytics.metrics?.totalRevenue || 1)) * 100)
                        : '0%'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>


        </>
      )}
        </div>
      </div>
    </div>
  );
}

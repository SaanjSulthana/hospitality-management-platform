import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Calendar,
  Building2,
  Target
} from 'lucide-react';

export default function AnalyticsPage() {
  const { getAuthenticatedBackend } = useAuth();
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState('30');

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics', 'overview', timeRange],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange));
      
      return backend.analytics.overview({
        startDate,
        endDate,
      });
    },
  });

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list();
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: theme.currency || 'USD',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getPerformanceColor = (value: number, threshold: number) => {
    if (value >= threshold) return 'text-green-600';
    if (value >= threshold * 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceIcon = (value: number, threshold: number) => {
    if (value >= threshold) return <TrendingUp className="h-4 w-4 text-green-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Analytics</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Performance insights and key metrics</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {analytics && (
        <>
          {/* Key Performance Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
                <div className="flex items-center space-x-1">
                  {getPerformanceIcon(analytics.metrics.occupancyRate, 75)}
                  <Target className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                  {formatPercentage(analytics.metrics.occupancyRate)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: 75%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Daily Rate</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                  {formatCurrency(analytics.metrics.adr)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Per occupied room
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">RevPAR</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                  {formatCurrency(analytics.metrics.revpar)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Revenue per available room
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
                <div className="flex items-center space-x-1">
                  {getPerformanceIcon(analytics.metrics.taskCompletionRate, 90)}
                  <Target className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                  {formatPercentage(analytics.metrics.taskCompletionRate)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: 90%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Financial Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Total Revenue
                </CardTitle>
                <CardDescription>
                  Last {timeRange} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(analytics.metrics.totalRevenue)}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Bookings:</span>
                    <span>{analytics.metrics.totalBookings}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Guests:</span>
                    <span>{analytics.metrics.totalGuests}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Avg Stay:</span>
                    <span>{analytics.metrics.averageStayLength.toFixed(1)} days</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-red-600" />
                  Total Expenses
                </CardTitle>
                <CardDescription>
                  Last {timeRange} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {formatCurrency(analytics.metrics.totalExpenses)}
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm">
                    <span>Expense Ratio:</span>
                    <span>
                      {analytics.metrics.totalRevenue > 0 
                        ? formatPercentage((analytics.metrics.totalExpenses / analytics.metrics.totalRevenue) * 100)
                        : '0%'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" style={{ color: theme.primaryColor }} />
                  Net Income
                </CardTitle>
                <CardDescription>
                  Last {timeRange} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className={`text-3xl font-bold ${
                    analytics.metrics.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(analytics.metrics.netIncome)}
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm">
                    <span>Profit Margin:</span>
                    <span className={analytics.metrics.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {analytics.metrics.totalRevenue > 0 
                        ? formatPercentage((analytics.metrics.netIncome / analytics.metrics.totalRevenue) * 100)
                        : '0%'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Property Performance */}
          {properties && properties.properties.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Property Performance
                </CardTitle>
                <CardDescription>
                  Overview of all properties
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {properties.properties.map((property) => (
                    <div key={property.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{property.name}</h4>
                        <Badge variant="outline">
                          {property.type}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Capacity:</span>
                          <span>{property.capacityJson?.maxGuests || 'N/A'} guests</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Rooms:</span>
                          <span>{property.capacityJson?.totalRooms || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <Badge variant={property.status === 'active' ? 'default' : 'secondary'}>
                            {property.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Performance Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Summary</CardTitle>
              <CardDescription>
                Period: {new Date(analytics.period.startDate).toLocaleDateString()} - {new Date(analytics.period.endDate).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                    {formatPercentage(analytics.metrics.occupancyRate)}
                  </div>
                  <p className="text-sm text-gray-600">Occupancy Rate</p>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                    {formatCurrency(analytics.metrics.adr)}
                  </div>
                  <p className="text-sm text-gray-600">ADR</p>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                    {formatCurrency(analytics.metrics.revpar)}
                  </div>
                  <p className="text-sm text-gray-600">RevPAR</p>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                    {formatPercentage(analytics.metrics.staffUtilization)}
                  </div>
                  <p className="text-sm text-gray-600">Staff Utilization</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

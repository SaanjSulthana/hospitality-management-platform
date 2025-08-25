import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Users, 
  CheckSquare, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  AlertCircle,
  Clock
} from 'lucide-react';

export default function DashboardPage() {
  const { user, getAuthenticatedBackend } = useAuth();
  const { theme } = useTheme();

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.analytics.overview();
    },
  });

  const { data: properties, isLoading: propertiesLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list();
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.tasks.list();
    },
  });

  const getRoleDisplayName = (role: string) => {
    return role.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const urgentTasks = tasks?.tasks.filter(task => 
    task.priority === 'high' && task.status !== 'done'
  ) || [];

  const overdueTasks = tasks?.tasks.filter(task => 
    task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'done'
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {getGreeting()}, {user?.displayName}
        </h1>
        <p className="text-gray-600">
          {getRoleDisplayName(user?.role || '')} Dashboard
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {propertiesLoading ? '...' : properties?.properties.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active properties
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? '...' : `${analytics?.metrics.occupancyRate || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              Current occupancy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? '...' : `$${analytics?.metrics.totalRevenue?.toLocaleString() || 0}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tasksLoading ? '...' : tasks?.tasks.filter(t => t.status !== 'done').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Pending completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Urgent Tasks
            </CardTitle>
            <CardDescription>
              High priority tasks requiring immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            {urgentTasks.length === 0 ? (
              <p className="text-sm text-gray-500">No urgent tasks at the moment</p>
            ) : (
              <div className="space-y-3">
                {urgentTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-gray-600">{task.propertyName}</p>
                    </div>
                    <Badge variant="destructive">High</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Overdue Tasks
            </CardTitle>
            <CardDescription>
              Tasks that have passed their due date
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-gray-500">No overdue tasks</p>
            ) : (
              <div className="space-y-3">
                {overdueTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-gray-600">{task.propertyName}</p>
                      {task.dueAt && (
                        <p className="text-xs text-orange-600">
                          Due: {new Date(task.dueAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="border-orange-500 text-orange-700">
                      Overdue
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>
              Key performance indicators for the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                  ${analytics.metrics.adr.toFixed(0)}
                </div>
                <p className="text-sm text-gray-600">Average Daily Rate</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                  ${analytics.metrics.revpar.toFixed(0)}
                </div>
                <p className="text-sm text-gray-600">RevPAR</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                  {analytics.metrics.totalBookings}
                </div>
                <p className="text-sm text-gray-600">Total Bookings</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                  {analytics.metrics.taskCompletionRate.toFixed(0)}%
                </div>
                <p className="text-sm text-gray-600">Task Completion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

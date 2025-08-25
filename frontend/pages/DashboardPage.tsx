import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Users, 
  CheckSquare, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  AlertCircle,
  Clock,
  Shield,
  UserCheck,
  Plus
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
    enabled: user?.role === 'ADMIN', // Only load analytics for admins
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

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.users.list();
    },
    enabled: user?.role === 'ADMIN', // Only load users for admins
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

  const managersCreated = users?.users.filter(u => u.role === 'MANAGER') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {getGreeting()}, {user?.displayName}
        </h1>
        <p className="text-gray-600 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          {getRoleDisplayName(user?.role || '')} Dashboard
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {user?.role === 'ADMIN' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Managers</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usersLoading ? '...' : managersCreated.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Active managers
              </p>
            </CardContent>
          </Card>
        )}

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

        {user?.role === 'ADMIN' && (
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
        )}

        {user?.role === 'ADMIN' && (
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
        )}

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

      {/* Getting Started Section for New Organizations */}
      {user?.role === 'ADMIN' && (!properties?.properties.length || properties.properties.length === 0) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Building2 className="h-5 w-5" />
              Welcome to Your Hospitality Platform!
            </CardTitle>
            <CardDescription className="text-blue-700">
              Get started by setting up your first property and inviting team members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-lg border border-blue-200">
                <Building2 className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <h3 className="font-medium text-blue-900 mb-2">Add Your First Property</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Set up your hotel, hostel, resort, or apartment
                </p>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Property
                </Button>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border border-blue-200">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <h3 className="font-medium text-blue-900 mb-2">Invite Managers</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Create manager accounts for your team
                </p>
                <Button size="sm" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Manager
                </Button>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border border-blue-200">
                <CheckSquare className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <h3 className="font-medium text-blue-900 mb-2">Create Tasks</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Start managing operations and workflows
                </p>
                <Button size="sm" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Task
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role-specific content */}
      {user?.role === 'ADMIN' ? (
        <>
          {/* Admin Dashboard Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Managers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Recent Managers
                </CardTitle>
                <CardDescription>
                  Recently created manager accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {managersCreated.length === 0 ? (
                  <div className="text-center py-6">
                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">No managers created yet</p>
                    <Button size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Manager
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {managersCreated.slice(0, 5).map((manager) => (
                      <div key={manager.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{manager.displayName}</p>
                          <p className="text-xs text-gray-600">{manager.email}</p>
                          <p className="text-xs text-gray-500">
                            Created {new Date(manager.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline">Manager</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
                  <div className="text-center py-6">
                    <CheckSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">No urgent tasks at the moment</p>
                    <Button size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Task
                    </Button>
                  </div>
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
          </div>

          {/* Quick Stats for Admin */}
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
        </>
      ) : (
        <>
          {/* Manager Dashboard Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* My Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-green-500" />
                  My Tasks
                </CardTitle>
                <CardDescription>
                  Tasks assigned to you
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tasks?.tasks.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">No tasks assigned yet</p>
                    <Button size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Task
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasks?.tasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{task.title}</p>
                          <p className="text-xs text-gray-600">{task.propertyName}</p>
                        </div>
                        <Badge variant={task.priority === 'high' ? 'destructive' : 'outline'}>
                          {task.priority}
                        </Badge>
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
                  <div className="text-center py-6">
                    <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No overdue tasks</p>
                  </div>
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

          {/* Manager Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks and actions for managers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <CheckSquare className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-sm font-medium">View Tasks</p>
                </div>
                <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium">Bookings</p>
                </div>
                <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <Building2 className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <p className="text-sm font-medium">Properties</p>
                </div>
                <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                  <p className="text-sm font-medium">Analytics</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

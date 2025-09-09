import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { LoadingCard, LoadingPage } from '@/components/ui/loading-spinner';
import { NoDataCard } from '@/components/ui/no-data';
import { useApiError } from '@/hooks/use-api-error';
import { useDashboardRealtime } from '@/hooks/use-realtime';
import { API_CONFIG } from '../src/config/api';
import { 
  useStandardQuery, 
  useStandardMutation, 
  QUERY_KEYS, 
  STANDARD_QUERY_CONFIGS,
  API_ENDPOINTS,
  handleStandardError
} from '../src/utils/api-standardizer';
import { 
  Building2, 
  Users, 
  CheckSquare, 
  TrendingUp,
  AlertCircle,
  Clock,
  Shield,
  UserCheck,
  Plus,
  LogOut,
  RefreshCw,
  FileText,
  Calendar,
  Receipt,
  CreditCard,
  Eye,
  Check,
  X
} from 'lucide-react';

export default function DashboardPage() {
  const { user, getAuthenticatedBackend, logout } = useAuth();
  const { theme } = useTheme();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { handleError } = useApiError();
  const { refreshNow, isPolling } = useDashboardRealtime();
  const queryClient = useQueryClient();

  // Set page title and description
  useEffect(() => {
    setPageTitle('Dashboard Overview', 'Monitor your hospitality operations and manage pending tasks');
  }, [setPageTitle]);

  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useStandardQuery(
    QUERY_KEYS.ANALYTICS,
    '/analytics/overview',
    {
      enabled: user?.role === 'ADMIN',
      ...STANDARD_QUERY_CONFIGS.REAL_TIME,
    }
  );

  const { data: properties, isLoading: propertiesLoading, error: propertiesError } = useStandardQuery(
    QUERY_KEYS.PROPERTIES,
    '/properties',
    STANDARD_QUERY_CONFIGS.REAL_TIME
  );

  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useStandardQuery(
    QUERY_KEYS.TASKS,
    '/tasks',
    STANDARD_QUERY_CONFIGS.REAL_TIME
  );

  const { data: users, isLoading: usersLoading, error: usersError } = useStandardQuery(
    QUERY_KEYS.USERS,
    '/users',
    {
      enabled: user?.role === 'ADMIN',
      ...STANDARD_QUERY_CONFIGS.REAL_TIME,
    }
  );

  // New queries for works to be done
  const { data: expenses, isLoading: expensesLoading, error: expensesError } = useStandardQuery(
    QUERY_KEYS.EXPENSES,
    API_ENDPOINTS.EXPENSES,
    {
      ...STANDARD_QUERY_CONFIGS.REAL_TIME,
    }
  );

  const { data: revenues, isLoading: revenuesLoading, error: revenuesError } = useStandardQuery(
    QUERY_KEYS.REVENUES,
    API_ENDPOINTS.REVENUES,
    {
      ...STANDARD_QUERY_CONFIGS.REAL_TIME,
    }
  );

  const { data: leaveRequests, isLoading: leaveRequestsLoading, error: leaveRequestsError } = useStandardQuery(
    QUERY_KEYS.LEAVE_REQUESTS,
    API_ENDPOINTS.LEAVE_REQUESTS,
    {
      ...STANDARD_QUERY_CONFIGS.REAL_TIME,
    }
  );

  // Fetch pending approvals for admins
  const { data: pendingApprovals, isLoading: pendingApprovalsLoading, error: pendingApprovalsError } = useStandardQuery(
    QUERY_KEYS.PENDING_APPROVALS,
    API_ENDPOINTS.PENDING_APPROVALS,
    {
      enabled: user?.role === 'ADMIN',
      ...STANDARD_QUERY_CONFIGS.REAL_TIME,
    }
  );

  const getRoleDisplayName = (role: string) => {
    return role.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Helper function to format currency based on theme
  const formatCurrency = (amount: number) => {
    const currency = theme.currency || 'USD';
    const symbol = currency === 'INR' ? '₹' : '$';
    return `${symbol}${amount.toFixed(2)}`;
  };

  const urgentTasks = tasks?.tasks.filter((task: any) => 
    task.priority === 'high' && task.status !== 'done'
  ) || [];

  const overdueTasks = tasks?.tasks.filter((task: any) => 
    task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'done'
  ) || [];

  // Enhanced data processing for works to be done
  const pendingExpenses = expenses?.expenses.filter((expense: any) => 
    expense.status === 'pending'
  ) || [];

  // Handle missing status property for revenues (frontend client type mismatch)
  const pendingRevenues = revenues?.revenues.filter((revenue: any) => 
    // @ts-ignore - status property exists in backend but not in frontend client type
    (revenue as any).status === 'pending'
  ) || [];

  const pendingLeaveRequests = leaveRequests?.leaveRequests.filter((leave: any) => 
    leave.status === 'pending'
  ) || [];

  const managersCreated = users?.users.filter((u: any) => u.role === 'MANAGER') || [];

  // Calculate totals for works to be done
  const totalPendingApprovals = (() => {
    console.log('=== PENDING APPROVALS DEBUG ===');
    console.log('Pending approvals data:', pendingApprovals);
    console.log('Pending expenses count:', pendingExpenses.length);
    console.log('Pending revenues count:', pendingRevenues.length);
    console.log('Pending leave requests count:', pendingLeaveRequests.length);
    
    // Use the dedicated pending approvals endpoint data if available
    if (pendingApprovals?.pendingManagers && pendingApprovals.pendingManagers.length > 0) {
      const totalFromEndpoint = pendingApprovals.pendingManagers.reduce((sum: number, manager: any) => {
        const managerTotal = manager.pendingExpenses + manager.pendingRevenues;
        console.log(`Manager ${manager.managerName}: ${manager.pendingExpenses} expenses + ${manager.pendingRevenues} revenues = ${managerTotal}`);
        return sum + managerTotal;
      }, 0);
      console.log('Using pending approvals from endpoint:', totalFromEndpoint);
      return totalFromEndpoint;
    }
    
    // Fallback to calculating from individual queries
    const totalFromQueries = pendingExpenses.length + pendingRevenues.length + pendingLeaveRequests.length;
    console.log('Using pending approvals from individual queries:', totalFromQueries);
    return totalFromQueries;
  })();
  const totalUrgentItems = urgentTasks.length + overdueTasks.length;

  // State for quick action modals
  const [showPendingApprovalsModal, setShowPendingApprovalsModal] = React.useState(false);
  const [showUrgentTasksModal, setShowUrgentTasksModal] = React.useState(false);
  const [showOverdueTasksModal, setShowOverdueTasksModal] = React.useState(false);
  const [showFinancialPendingModal, setShowFinancialPendingModal] = React.useState(false);

  const approveExpenseMutation = useStandardMutation(
    '/finance/expenses/:id/approve',
    'PATCH',
    {
      invalidateQueries: [
        QUERY_KEYS.EXPENSES,
        QUERY_KEYS.REVENUES,
        QUERY_KEYS.PENDING_APPROVALS,
        QUERY_KEYS.ANALYTICS,
        QUERY_KEYS.DASHBOARD,
        QUERY_KEYS.PROFIT_LOSS,
        QUERY_KEYS.DAILY_APPROVAL_CHECK,
      ],
      successMessage: "Expense updated successfully",
      errorMessage: "Failed to process expense",
    }
  );

  const approveRevenueMutation = useStandardMutation(
    '/finance/revenues/:id/approve',
    'PATCH',
    {
      invalidateQueries: [
        QUERY_KEYS.REVENUES,
        QUERY_KEYS.EXPENSES,
        QUERY_KEYS.PENDING_APPROVALS,
        QUERY_KEYS.ANALYTICS,
        QUERY_KEYS.DASHBOARD,
        QUERY_KEYS.PROFIT_LOSS,
        QUERY_KEYS.DAILY_APPROVAL_CHECK,
      ],
      refetchQueries: [
        QUERY_KEYS.REVENUES,
        QUERY_KEYS.PENDING_APPROVALS,
        QUERY_KEYS.ANALYTICS,
      ],
      successMessage: "The revenue has been processed successfully.",
      errorMessage: "Failed to process revenue. Please try again.",
    }
  );

  const approveLeaveMutation = useStandardMutation(
    '/staff/leave-requests/:id/approve',
    'PATCH',
    {
      invalidateQueries: [
        QUERY_KEYS.LEAVE_REQUESTS,
        QUERY_KEYS.PENDING_APPROVALS,
        QUERY_KEYS.ANALYTICS,
        QUERY_KEYS.DASHBOARD,
      ],
      refetchQueries: [
        QUERY_KEYS.LEAVE_REQUESTS,
        QUERY_KEYS.PENDING_APPROVALS,
      ],
      successMessage: "The leave request has been processed.",
      errorMessage: "Failed to process leave request. Please try again.",
    }
  );

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out",
        description: "You have been signed out.",
      });
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
      toast({
        variant: 'destructive',
        title: 'Logout failed',
        description: 'Please try again.',
      });
    }
  };

  // Show loading state only if critical data (properties and tasks) is loading
  if (propertiesLoading || tasksLoading) {
    return <LoadingPage text="Loading dashboard..." />;
  }

  // Show error state only if critical data (properties and tasks) failed to load
  if (propertiesError && tasksError) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load dashboard data</h3>
          <p className="text-gray-500 mb-4">
            There was an error loading your dashboard. Please try refreshing the page.
          </p>
          <Button onClick={refreshNow} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-6">

      {/* WORKS TO BE DONE - Priority Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          Works to be Done
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pending Approvals */}
          <Card 
            className="border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 transition-all duration-300 hover:shadow-lg hover:scale-105"
            onClick={() => {
              if (totalPendingApprovals > 0) {
                setShowPendingApprovalsModal(true);
              } else {
                navigate('/finance');
              }
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-900">Pending Approvals</CardTitle>
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4 text-red-600" />
                {totalPendingApprovals > 0 && (
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900">
                {totalPendingApprovals}
              </div>
              <p className="text-xs text-red-700">
                {totalPendingApprovals > 0 ? 'Click to review' : 'Require attention'}
              </p>
            </CardContent>
          </Card>

          {/* Urgent Tasks */}
          <Card 
            className="border-orange-200 bg-orange-50 cursor-pointer hover:bg-orange-100 transition-all duration-300 hover:shadow-lg hover:scale-105"
            onClick={() => {
              if (urgentTasks.length > 0) {
                setShowUrgentTasksModal(true);
              } else {
                navigate('/tasks');
              }
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-900">Urgent Tasks</CardTitle>
              <div className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                {urgentTasks.length > 0 && (
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">
                {urgentTasks.length}
              </div>
              <p className="text-xs text-orange-700">
                {urgentTasks.length > 0 ? 'Click to view' : 'High priority'}
              </p>
            </CardContent>
          </Card>

          {/* Overdue Tasks */}
          <Card 
            className="border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 transition-all duration-300 hover:shadow-lg hover:scale-105"
            onClick={() => {
              if (overdueTasks.length > 0) {
                setShowOverdueTasksModal(true);
              } else {
                navigate('/tasks');
              }
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-900">Overdue Tasks</CardTitle>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-red-600" />
                {overdueTasks.length > 0 && (
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900">
                {overdueTasks.length}
              </div>
              <p className="text-xs text-red-700">
                {overdueTasks.length > 0 ? 'Click to view' : 'Past due date'}
              </p>
            </CardContent>
          </Card>

          {/* Financial Transactions */}
          <Card 
            className="border-blue-200 bg-blue-50 cursor-pointer hover:bg-blue-100 transition-all duration-300 hover:shadow-lg hover:scale-105"
            onClick={() => {
              if (pendingExpenses.length + pendingRevenues.length > 0) {
                setShowFinancialPendingModal(true);
              } else {
                navigate('/finance');
              }
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900">Financial Pending</CardTitle>
              <div className="flex items-center gap-1">
                <CreditCard className="h-4 w-4 text-blue-600" />
                {(pendingExpenses.length + pendingRevenues.length) > 0 && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">
                {pendingExpenses.length + pendingRevenues.length}
              </div>
              <p className="text-xs text-blue-700">
                {(pendingExpenses.length + pendingRevenues.length) > 0 ? 'Click to approve' : 'Expenses & Revenues'}
              </p>
            </CardContent>
          </Card>
        </div>
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
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                {(analytics?.metrics.totalRevenue || (revenues?.revenues && revenues.revenues.length > 0)) && (
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analyticsLoading && revenuesLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-500">Loading...</span>
              </div>
                ) : (
                  <span className="text-green-600">
                    {(() => {
                      // Debug logging
                      console.log('=== REVENUE DEBUG ===');
                      console.log('Analytics data:', analytics);
                      console.log('Revenues data:', revenues);
                      console.log('Analytics loading:', analyticsLoading);
                      console.log('Revenues loading:', revenuesLoading);
                      
                      // Prioritize real revenue data over analytics (which might be mock data)
                      if (revenues?.revenues && revenues.revenues.length > 0) {
                        console.log('Found revenues:', revenues.revenues.length, 'items');
                        console.log('Backend totalAmount (includes pending):', revenues.totalAmount);
                        
                        // Calculate only approved revenues for dashboard display
                        const approvedRevenues = revenues.revenues.filter((revenue: any) => {
                          // @ts-ignore - status property exists in backend but not in frontend client type
                          const status = (revenue as any).status;
                          const isApproved = status === 'approved' || status === undefined || status === null;
                          console.log(`Revenue ${revenue.id}: status=${status}, amount=${revenue.amountCents/100}, approved=${isApproved}`);
                          return isApproved;
                        });
                        
                        console.log('Approved revenues count:', approvedRevenues.length);
                        
                        // Calculate total from approved revenues only
                        const totalApprovedRevenue = approvedRevenues.reduce((sum: any, revenue: any) => {
                          const amount = revenue.amountCents / 100; // Convert cents to currency
                          return sum + amount;
                        }, 0);
                        
                        console.log('Total approved revenue:', totalApprovedRevenue);
                        
                        // Use theme currency setting for formatting
                        const currency = theme.currency || 'USD';
                        const symbol = currency === 'INR' ? '₹' : '$';
                        
                        return `${symbol}${totalApprovedRevenue.toLocaleString()}`;
                      }
                      
                      // Fallback to analytics data if no real revenue data available
                      if (analytics?.metrics?.totalRevenue) {
                        console.log('Using analytics revenue (fallback):', analytics.metrics.totalRevenue);
                        const currency = theme.currency || 'USD';
                        const symbol = currency === 'INR' ? '₹' : '$';
                        return `${symbol}${analytics.metrics.totalRevenue.toLocaleString()}`;
                      }
                      
                      console.log('No revenue data available');
                      const currency = theme.currency || 'USD';
                      const symbol = currency === 'INR' ? '₹' : '$';
                      return `${symbol}0`;
                    })()}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {revenues?.revenues && revenues.revenues.length > 0 ? 'This month' : 
                 analytics?.metrics.totalRevenue ? 'Last 30 days' : 'No data'}
              </p>
              {(analytics?.metrics.totalRevenue || (revenues?.revenues && revenues.revenues.length > 0)) && (
                <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
                  <TrendingUp className="h-3 w-3" />
                  <span>Live data</span>
                </div>
              )}
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
              {tasksLoading ? '...' : tasks?.tasks.filter((t: any) => t.status !== 'done').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Pending completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Role-specific content */}
      {user?.role === 'ADMIN' ? (
        <>
          {/* Admin Dashboard Content - Enhanced with Works to be Done */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Approvals - Financial */}
            <Card>
          <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-blue-500" />
                  Pending Financial Approvals
            </CardTitle>
                <CardDescription>
                  Expenses and revenues awaiting approval
            </CardDescription>
          </CardHeader>
          <CardContent>
                {pendingExpenses.length === 0 && pendingRevenues.length === 0 ? (
                  <div className="text-center py-6">
                    <Receipt className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">No pending financial approvals</p>
                    <Button size="sm" variant="outline" onClick={() => navigate('/finance')}>
                  <Plus className="mr-2 h-4 w-4" />
                      View Finance
                </Button>
              </div>
                ) : (
                  <div className="space-y-3">
                    {pendingExpenses.slice(0, 3).map((expense: any) => (
                      <div key={`expense-${expense.id}`} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{expense.description || 'Expense'}</p>
                          <p className="text-xs text-gray-600">{expense.propertyName}</p>
                          <p className="text-xs text-orange-600">
                            {formatCurrency(expense.amountCents / 100)} • {expense.category}
                          </p>
              </div>
                        <Badge variant="outline" className="border-orange-500 text-orange-700">
                          Expense
                        </Badge>
                      </div>
                    ))}
                    {pendingRevenues.slice(0, 3).map((revenue: any) => (
                      <div key={`revenue-${revenue.id}`} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{revenue.description || 'Revenue'}</p>
                          <p className="text-xs text-gray-600">{revenue.propertyName}</p>
                          <p className="text-xs text-green-600">
                            {formatCurrency(revenue.amountCents / 100)} • {revenue.source}
                          </p>
              </div>
                        <Badge variant="outline" className="border-green-500 text-green-700">
                          Revenue
                        </Badge>
            </div>
                    ))}
                    {(pendingExpenses.length > 3 || pendingRevenues.length > 3) && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => navigate('/finance')}>
                        View All ({pendingExpenses.length + pendingRevenues.length})
                      </Button>
                    )}
                  </div>
                )}
          </CardContent>
        </Card>

            {/* Pending Leave Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-500" />
                  Pending Leave Requests
                </CardTitle>
                <CardDescription>
                  Staff leave requests awaiting approval
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingLeaveRequests.length === 0 ? (
                  <div className="text-center py-6">
                    <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">No pending leave requests</p>
                    <Button size="sm" variant="outline" onClick={() => navigate('/staff')}>
                      <Plus className="mr-2 h-4 w-4" />
                      View Staff
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingLeaveRequests.slice(0, 5).map((leave: any) => (
                      <div key={leave.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{leave.staffName}</p>
                          <p className="text-xs text-gray-600">{leave.leaveType}</p>
                          <p className="text-xs text-purple-600">
                            {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-purple-500 text-purple-700">
                          Pending
                        </Badge>
                      </div>
                    ))}
                    {pendingLeaveRequests.length > 5 && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => navigate('/staff')}>
                        View All ({pendingLeaveRequests.length})
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Urgent Tasks for Admin */}
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
                  <Button size="sm" variant="outline" onClick={() => navigate('/tasks')}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Task
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                  {urgentTasks.slice(0, 5).map((task: any) => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{task.title}</p>
                          <p className="text-xs text-gray-600">{task.propertyName}</p>
                        </div>
                        <Badge variant="destructive">High</Badge>
                      </div>
                    ))}
                  {urgentTasks.length > 5 && (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => navigate('/tasks')}>
                      View All ({urgentTasks.length})
                    </Button>
                  )}
                  </div>
                )}
              </CardContent>
            </Card>

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
                  {managersCreated.slice(0, 5).map((manager: any) => (
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

          {/* Getting Started Section for New Organizations */}
          {(!properties?.properties.length || properties.properties.length === 0) && (
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
                      {formatCurrency(analytics.metrics.adr)}
                    </div>
                    <p className="text-sm text-gray-600">Average Daily Rate</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                      {formatCurrency(analytics.metrics.revpar)}
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
                    {tasks?.tasks.slice(0, 5).map((task: any) => (
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
                    {overdueTasks.slice(0, 5).map((task: any) => (
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
                  <Building2 className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <p className="text-sm font-medium">Properties</p>
                </div>
                <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                   <Receipt className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium">Finance</p>
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
      
      {/* Quick Action Modals */}
      
                    {/* Pending Approvals Modal */}
      {showPendingApprovalsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Pending Approvals</h3>
              <Button variant="outline" size="sm" onClick={() => setShowPendingApprovalsModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Pending Expenses */}
              {pendingExpenses.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Pending Expenses</h4>
                  <div className="space-y-2">
                    {pendingExpenses.map((expense: any) => (
                      <div key={expense.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{expense.description || 'Expense'}</p>
                          <p className="text-xs text-gray-600">{expense.propertyName}</p>
                          <p className="text-xs text-orange-600">
                            {formatCurrency(expense.amountCents / 100)} • {expense.category}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: true })}
                            disabled={approveExpenseMutation.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: false })}
                            disabled={approveExpenseMutation.isPending}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Revenues */}
              {pendingRevenues.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Pending Revenues</h4>
                  <div className="space-y-2">
                    {pendingRevenues.map((revenue: any) => (
                      <div key={revenue.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{revenue.description || 'Revenue'}</p>
                          <p className="text-xs text-gray-600">{revenue.propertyName}</p>
                          <p className="text-xs text-green-600">
                            ${(revenue.amountCents / 100).toFixed(2)} • {revenue.source}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => approveRevenueMutation.mutate({ id: revenue.id, approved: true })}
                            disabled={approveRevenueMutation.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => approveRevenueMutation.mutate({ id: revenue.id, approved: false })}
                            disabled={approveRevenueMutation.isPending}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Leave Requests */}
              {pendingLeaveRequests.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Pending Leave Requests</h4>
                  <div className="space-y-2">
                    {pendingLeaveRequests.map((leave: any) => (
                      <div key={leave.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{leave.staffName}</p>
                          <p className="text-xs text-gray-600">{leave.leaveType}</p>
                          <p className="text-xs text-purple-600">
                            {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => approveLeaveMutation.mutate({ id: leave.id, approved: true })}
                            disabled={approveLeaveMutation.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => approveLeaveMutation.mutate({ id: leave.id, approved: false })}
                            disabled={approveLeaveMutation.isPending}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {totalPendingApprovals === 0 && (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No pending approvals</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Urgent Tasks Modal */}
      {showUrgentTasksModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Urgent Tasks</h3>
              <Button variant="outline" size="sm" onClick={() => setShowUrgentTasksModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              {urgentTasks.length > 0 ? (
                urgentTasks.map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-gray-600">{task.propertyName}</p>
                      {task.dueAt && (
                        <p className="text-xs text-red-600">
                          Due: {new Date(task.dueAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/tasks`)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No urgent tasks</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overdue Tasks Modal */}
      {showOverdueTasksModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Overdue Tasks</h3>
              <Button variant="outline" size="sm" onClick={() => setShowOverdueTasksModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              {overdueTasks.length > 0 ? (
                overdueTasks.map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-gray-600">{task.propertyName}</p>
                      {task.dueAt && (
                        <p className="text-xs text-red-600">
                          Due: {new Date(task.dueAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/tasks`)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No overdue tasks</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Financial Pending Modal */}
      {showFinancialPendingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Financial Pending</h3>
              <Button variant="outline" size="sm" onClick={() => setShowFinancialPendingModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Pending Expenses */}
              {pendingExpenses.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Pending Expenses</h4>
                  <div className="space-y-2">
                    {pendingExpenses.map((expense: any) => (
                      <div key={expense.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{expense.description || 'Expense'}</p>
                          <p className="text-xs text-gray-600">{expense.propertyName}</p>
                          <p className="text-xs text-orange-600">
                            {formatCurrency(expense.amountCents / 100)} • {expense.category}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: true })}
                            disabled={approveExpenseMutation.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: false })}
                            disabled={approveExpenseMutation.isPending}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Revenues */}
              {pendingRevenues.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Pending Revenues</h4>
                  <div className="space-y-2">
                    {pendingRevenues.map((revenue: any) => (
                      <div key={revenue.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{revenue.description || 'Revenue'}</p>
                          <p className="text-xs text-gray-600">{revenue.propertyName}</p>
                          <p className="text-xs text-green-600">
                            {formatCurrency(revenue.amountCents / 100)} • {revenue.source}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => approveRevenueMutation.mutate({ id: revenue.id, approved: true })}
                            disabled={approveRevenueMutation.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => approveRevenueMutation.mutate({ id: revenue.id, approved: false })}
                            disabled={approveRevenueMutation.isPending}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingExpenses.length === 0 && pendingRevenues.length === 0 && (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No pending financial transactions</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

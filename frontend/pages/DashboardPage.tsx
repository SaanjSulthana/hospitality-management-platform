import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useNavigate } from 'react-router-dom';
import { LoadingCard, SkeletonCard, SkeletonStats, SkeletonActionCards } from '@/components/ui/loading-spinner';
import { NoDataCard } from '@/components/ui/no-data';
import { useApiError } from '@/hooks/use-api-error';
import { QUERY_KEYS } from '../src/utils/api-standardizer';
import { useDashboardData } from '../hooks/useDashboardData';
import { useDashboardRealtime } from '../hooks/useDashboardRealtime';

// Imported Components
import { ActionCards } from '../components/dashboard/ActionCards';
import { StatsOverview } from '../components/dashboard/StatsOverview';
import { DashboardModals } from '../components/dashboard/DashboardModals';

import {
  Hotel,
  UserCog,
  Users,
  ClipboardList,
  CheckSquare,
  TrendingUp,
  Siren,
  AlertCircle,
  AlarmClock,
  Clock,
  Plus,
  RefreshCw,
  ClipboardCheck,
  CalendarClock,
  Calendar,
  Receipt,
  IndianRupee,
  Check
} from 'lucide-react';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const { setPageTitle } = usePageTitle();
  const navigate = useNavigate();
  const { handleError } = useApiError();
  const queryClient = useQueryClient();

  // Set page title and description
  useEffect(() => {
    setPageTitle('Dashboard Overview', 'Monitor your hospitality operations and manage pending tasks');
  }, [setPageTitle]);

  // Local refresh helper used by the error state button
  const refreshNow = () => {
    try {
      const keys = [
        QUERY_KEYS.ANALYTICS,
        QUERY_KEYS.DASHBOARD,
        QUERY_KEYS.PROPERTIES,
        QUERY_KEYS.TASKS,
        QUERY_KEYS.USERS,
        QUERY_KEYS.REVENUES,
        QUERY_KEYS.EXPENSES,
        QUERY_KEYS.LEAVE_REQUESTS,
        QUERY_KEYS.PENDING_APPROVALS,
      ];
      keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
      // Force a couple of critical refetches
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.ANALYTICS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.DASHBOARD] });
    } catch (e) {
      console.warn('refreshNow failed, reloading page', e);
      window.location.reload();
    }
  };

  // Realtime subscriptions
  useDashboardRealtime();

  // Data fetching (Hooks)
  const dashboardData = useDashboardData();
  const {
    analytics, analyticsLoading,
    properties, propertiesLoading, propertiesError,
    tasks, tasksLoading, tasksError,
    pendingApprovals,
    urgentTasks,
    overdueTasks,
    pendingExpenses,
    pendingRevenues,
    pendingLeaveRequests,
    managersCreated,
    totalPendingApprovals,
    totalUrgentItems
  } = dashboardData;

  // State for quick action modals
  const [showPendingApprovalsModal, setShowPendingApprovalsModal] = React.useState(false);
  const [showUrgentTasksModal, setShowUrgentTasksModal] = React.useState(false);
  const [showOverdueTasksModal, setShowOverdueTasksModal] = React.useState(false);
  const [showFinancialPendingModal, setShowFinancialPendingModal] = React.useState(false);

  // Progressive rendering: Show layout immediately, skeleton loaders for loading sections
  const isInitialLoading = propertiesLoading && tasksLoading && !properties && !tasks;

  // Show error state only if critical data (properties and tasks) failed to load
  if (propertiesError && tasksError) {
    return (
      <div className="w-full space-y-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load dashboard data</h3>
          <p className="text-gray-500 mb-4">
            There was an error loading your dashboard. Please try refreshing the page.
          </p>
          <Button onClick={refreshNow} variant="outline" className="h-11 bg-white border-rose-200 text-red-700 hover:bg-rose-50 hover:border-rose-300 font-semibold px-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const handleActionCardClick = (type: 'approvals' | 'urgent' | 'financial' | 'leave') => {
    switch (type) {
      case 'approvals':
        if (totalPendingApprovals > 0) setShowPendingApprovalsModal(true);
        else navigate('/finance');
        break;
      case 'urgent':
        if (urgentTasks.length > 0) setShowUrgentTasksModal(true);
        else navigate('/tasks');
        break;
      case 'financial':
        if (pendingRevenues.length > 0 || pendingExpenses.length > 0) setShowFinancialPendingModal(true);
        else navigate('/finance');
        break;
      case 'leave':
        navigate('/staff');
        break;
    }
  };

  // Helper function to format currency - always use INR for now
  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  return (
    <div className="w-full space-y-4 md:space-y-6 pt-safe pb-safe pb-20 sm:pb-safe px-4 sm:px-6">

      {/* Works to be Done - Show skeleton if initial loading */}
      {isInitialLoading ? (
        <SkeletonActionCards />
      ) : (
        <ActionCards
          stats={{
            pendingApprovals: totalPendingApprovals,
            urgentItems: totalUrgentItems,
            financialPending: pendingRevenues.length + pendingExpenses.length,
            pendingLeave: pendingLeaveRequests.length,
            urgentTasksCount: urgentTasks.length
          }}
          onAction={handleActionCardClick}
        />
      )}

      {user?.role === 'ADMIN' ? (
        <>
          {/* Stats Overview - Show skeleton while analytics loads */}
          {analyticsLoading ? <SkeletonStats /> : analytics && <StatsOverview analytics={analytics} />}

          <div className="flex overflow-x-auto snap-x snap-mandatory px-4 -mx-4 pb-4 no-scrollbar sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 sm:overflow-visible sm:px-0 sm:mx-0 sm:pb-0">
            {/* Properties Overview - Consider Componentizing later */}
            <Card className="snap-start min-w-[75vw] sm:min-w-0 h-full">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Hotel className="h-5 w-5 text-blue-500" />
                  Properties Overview
                </CardTitle>
                <CardDescription>
                  Status of all managed properties
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                {propertiesLoading ? (
                  <LoadingCard />
                ) : properties?.properties.length === 0 ? (
                  <NoDataCard
                    title="No Properties"
                    description="Get started by adding your first property"
                    action={
                      <Button onClick={() => navigate('/properties')} className="h-11 px-4">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Property
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xl md:text-3xl font-bold text-gray-900">{properties?.properties.length}</p>
                        <p className="text-sm text-gray-500">Total Properties</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          {properties?.properties.filter((p: any) => p.status === 'active').length} Active
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{
                          width: `${(properties?.properties.filter((p: any) => p.status === 'active').length / (properties?.properties.length || 1)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Pending Approvals Detail - Left as is for now */}
            <Card className="snap-start min-w-[75vw] sm:min-w-0 h-full">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <ClipboardCheck className="h-5 w-5 text-indigo-500" />
                  Recent Approvals
                </CardTitle>
                <CardDescription>
                  Latest items requiring your approval
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                {totalPendingApprovals === 0 ? (
                  <div className="text-center py-6">
                    <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">All caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingExpenses.length > 0 && (
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">Expenses</span>
                        <Badge variant="secondary">{pendingExpenses.length}</Badge>
                      </div>
                    )}
                    {pendingRevenues.length > 0 && (
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">Revenues</span>
                        <Badge variant="secondary">{pendingRevenues.length}</Badge>
                      </div>
                    )}
                    {pendingLeaveRequests.length > 0 && (
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">Leave Requests</span>
                        <Badge variant="secondary">{pendingLeaveRequests.length}</Badge>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Leave Requests - Left as is for now */}
            <Card className="snap-start min-w-[75vw] sm:min-w-0 h-full">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <CalendarClock className="h-5 w-5 text-purple-500" />
                  Pending Leave Requests
                </CardTitle>
                <CardDescription>
                  Staff leave requests awaiting approval
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                {pendingLeaveRequests.length === 0 ? (
                  <div className="text-center py-6">
                    <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">No pending leave requests</p>
                    <Button variant="outline" onClick={() => navigate('/staff')} className="h-11 px-4">
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
                      <Button variant="outline" className="w-full h-11" onClick={() => navigate('/staff')}>
                        View All ({pendingLeaveRequests.length})
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <UserCog className="h-5 w-5 text-blue-500" />
                Recent Managers
              </CardTitle>
              <CardDescription>
                Recently created manager accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              {managersCreated.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-3">No managers created yet</p>
                  <Button variant="outline" className="h-11 px-4">
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
        </>
      ) : (
        <>
          {/* Manager Dashboard Content - Simplification */}
          <div className="flex overflow-x-auto snap-x snap-mandatory px-4 -mx-4 pb-4 no-scrollbar sm:grid lg:grid-cols-2 gap-6 sm:overflow-visible sm:px-0 sm:mx-0 sm:pb-0">
            <Card className="snap-start min-w-[75vw] sm:min-w-0 h-full">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <ClipboardList className="h-5 w-5 text-green-500" />
                  My Tasks
                </CardTitle>
                <CardDescription>
                  Tasks assigned to you
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                {tasks?.tasks.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">No tasks assigned yet</p>
                    <Button variant="outline" className="h-11 px-4">
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

            <Card className="snap-start min-w-[75vw] sm:min-w-0 h-full">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <AlarmClock className="h-5 w-5 text-orange-500" />
                  Overdue Tasks
                </CardTitle>
                <CardDescription>
                  Tasks that have passed their due date
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                {/* Logic preserved from original */}
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
        </>
      )}

      {/* Modals Component */}
      <DashboardModals
        state={{
          showPendingApprovals: showPendingApprovalsModal,
          showUrgentTasks: showUrgentTasksModal,
          showOverdueTasks: showOverdueTasksModal,
          showFinancialPending: showFinancialPendingModal
        }}
        actions={{
          setShowPendingApprovals: setShowPendingApprovalsModal,
          setShowUrgentTasks: setShowUrgentTasksModal,
          setShowOverdueTasks: setShowOverdueTasksModal,
          setShowFinancialPending: setShowFinancialPendingModal
        }}
        data={{
          pendingExpenses,
          pendingRevenues,
          pendingLeaveRequests,
          urgentTasks,
          overdueTasks,
          totalPendingApprovals
        }}
      />
    </div>
  );
}

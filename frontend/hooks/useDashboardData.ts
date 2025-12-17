import { useStandardQuery, QUERY_KEYS } from '../src/utils/api-standardizer';
import { QUERY_CATEGORIES } from '../src/config/query-config';
import { API_ENDPOINTS } from '../src/utils/api-standardizer';
import { getFlagBool } from '../lib/feature-flags';
import { useRouteActive } from './use-route-aware-query';
import { useAuth } from '../contexts/AuthContext';

const __DEV__ = process.env.NODE_ENV === 'development';

export function useDashboardData() {
    const { user } = useAuth();
    const routeActive = useRouteActive(['/dashboard']);

    const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useStandardQuery(
        QUERY_KEYS.ANALYTICS,
        '/analytics/overview',
        {
            enabled: routeActive && user?.role === 'ADMIN',
            ...QUERY_CATEGORIES.analytics,
        }
    );

    const { data: properties, isLoading: propertiesLoading, error: propertiesError } = useStandardQuery(
        QUERY_KEYS.PROPERTIES,
        '/properties',
        {
            enabled: routeActive,
            ...QUERY_CATEGORIES.properties,
        }
    );

    const { data: tasks, isLoading: tasksLoading, error: tasksError } = useStandardQuery(
        QUERY_KEYS.TASKS,
        '/tasks',
        {
            enabled: routeActive,
            ...QUERY_CATEGORIES.tasks,
        }
    );

    const { data: users, isLoading: usersLoading, error: usersError } = useStandardQuery(
        QUERY_KEYS.USERS,
        '/users',
        {
            enabled: routeActive && user?.role === 'ADMIN',
            ...QUERY_CATEGORIES.users,
        }
    );

    const { data: expenses, isLoading: expensesLoading, error: expensesError } = useStandardQuery(
        QUERY_KEYS.EXPENSES,
        API_ENDPOINTS.EXPENSES,
        {
            enabled: routeActive,
            ...(getFlagBool('REALTIME_PATCH_MODE', true) ? QUERY_CATEGORIES['realtime-connected'] : QUERY_CATEGORIES.expenses),
        }
    );

    const { data: revenues, isLoading: revenuesLoading, error: revenuesError } = useStandardQuery(
        QUERY_KEYS.REVENUES,
        API_ENDPOINTS.REVENUES,
        {
            enabled: routeActive,
            ...(getFlagBool('REALTIME_PATCH_MODE', true) ? QUERY_CATEGORIES['realtime-connected'] : QUERY_CATEGORIES.revenues),
        }
    );

    const { data: leaveRequests, isLoading: leaveRequestsLoading, error: leaveRequestsError } = useStandardQuery(
        QUERY_KEYS.LEAVE_REQUESTS,
        API_ENDPOINTS.LEAVE_REQUESTS,
        {
            enabled: routeActive,
            ...QUERY_CATEGORIES['leave-requests'],
        }
    );

    const { data: pendingApprovals, isLoading: pendingApprovalsLoading, error: pendingApprovalsError } = useStandardQuery(
        QUERY_KEYS.PENDING_APPROVALS,
        API_ENDPOINTS.PENDING_APPROVALS,
        {
            enabled: routeActive && user?.role === 'ADMIN',
            ...(user?.role === 'ADMIN'
                ? { ...QUERY_CATEGORIES['pending-approvals'], staleTime: 600_000 }
                : QUERY_CATEGORIES['pending-approvals']),
        }
    );

    // Derived State
    const urgentTasks = tasks?.tasks.filter((task: any) =>
        task.priority === 'high' && task.status !== 'done'
    ) || [];

    const overdueTasks = tasks?.tasks.filter((task: any) =>
        task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'done'
    ) || [];

    const pendingExpenses = expenses?.expenses.filter((expense: any) =>
        expense.status === 'pending'
    ) || [];

    const pendingRevenues = revenues?.revenues.filter((revenue: any) =>
        // @ts-ignore - status property exists in backend but not in frontend client type
        (revenue as any).status === 'pending'
    ) || [];

    const pendingLeaveRequests = leaveRequests?.leaveRequests.filter((leave: any) =>
        leave.status === 'pending'
    ) || [];

    const managersCreated = users?.users.filter((u: any) => u.role === 'MANAGER') || [];

    const totalPendingApprovals = (() => {
        // Instant: derive from live list caches (revenues/expenses/leave)
        // Endpoint still fetched for detailed manager breakdowns elsewhere.
        return pendingExpenses.length + pendingRevenues.length + pendingLeaveRequests.length;
    })();

    const totalUrgentItems = urgentTasks.length + overdueTasks.length;

    return {
        analytics, analyticsLoading, analyticsError,
        properties, propertiesLoading, propertiesError,
        tasks, tasksLoading, tasksError,
        users, usersLoading, usersError,
        expenses, expensesLoading, expensesError,
        revenues, revenuesLoading, revenuesError,
        leaveRequests, leaveRequestsLoading, leaveRequestsError,
        pendingApprovals, pendingApprovalsLoading, pendingApprovalsError,
        urgentTasks,
        overdueTasks,
        pendingExpenses,
        pendingRevenues,
        pendingLeaveRequests,
        managersCreated,
        totalPendingApprovals,
        totalUrgentItems
    };
}

import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Check, Eye, AlertCircle, Clock, FileText, CreditCard } from 'lucide-react';
import { useStandardMutation, QUERY_KEYS } from '@/src/utils/api-standardizer';
import { useNavigate } from 'react-router-dom';

interface DashboardModalsProps {
    state: {
        showPendingApprovals: boolean;
        showUrgentTasks: boolean;
        showOverdueTasks: boolean;
        showFinancialPending: boolean;
    };
    actions: {
        setShowPendingApprovals: (show: boolean) => void;
        setShowUrgentTasks: (show: boolean) => void;
        setShowOverdueTasks: (show: boolean) => void;
        setShowFinancialPending: (show: boolean) => void;
    };
    data: {
        pendingExpenses: any[];
        pendingRevenues: any[];
        pendingLeaveRequests: any[];
        urgentTasks: any[];
        overdueTasks: any[];
        totalPendingApprovals: number;
    };
}

export function DashboardModals({ state, actions, data }: DashboardModalsProps) {
    const navigate = useNavigate();

    // Helper function to format currency
    const formatCurrency = (amount: number) => {
        return `₹${amount.toFixed(2)}`;
    };

    const approveExpenseMutation = useStandardMutation(
        '/finance/expenses/:id/approve',
        'PATCH',
        {
            invalidateQueries: [
                QUERY_KEYS.EXPENSES,
                QUERY_KEYS.REVENUES,
                QUERY_KEYS.DAILY_APPROVAL_CHECK,
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
                QUERY_KEYS.DAILY_APPROVAL_CHECK,
                QUERY_KEYS.ANALYTICS,
                QUERY_KEYS.DASHBOARD,
                QUERY_KEYS.PROFIT_LOSS,
                QUERY_KEYS.DAILY_APPROVAL_CHECK,
            ],
            refetchQueries: [
                QUERY_KEYS.REVENUES,
                QUERY_KEYS.DAILY_APPROVAL_CHECK,
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
                QUERY_KEYS.DAILY_APPROVAL_CHECK,
                QUERY_KEYS.ANALYTICS,
                QUERY_KEYS.DASHBOARD,
            ],
            refetchQueries: [
                QUERY_KEYS.LEAVE_REQUESTS,
                QUERY_KEYS.DAILY_APPROVAL_CHECK,
            ],
            successMessage: "The leave request has been processed.",
            errorMessage: "Failed to process leave request. Please try again.",
        }
    );

    return (
        <>
            {/* Pending Approvals Modal */}
            {state.showPendingApprovals && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-lg sm:mx-4 p-4 sm:p-6 overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Pending Approvals</h3>
                            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => actions.setShowPendingApprovals(false)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {/* Pending Expenses */}
                            {data.pendingExpenses.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Pending Expenses</h4>
                                    <div className="space-y-2">
                                        {data.pendingExpenses.map((expense: any) => (
                                            <div key={expense.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{expense.description || 'Expense'}</p>
                                                    <p className="text-xs text-gray-600">{expense.propertyName}</p>
                                                    <p className="text-xs text-orange-600">
                                                        {formatCurrency(expense.amountCents / 100)} • {expense.category}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <Button
                                                        className="h-11 bg-green-600 hover:bg-green-700"
                                                        onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: true })}
                                                        disabled={approveExpenseMutation.isPending}
                                                    >
                                                        <Check className="h-4 w-4 mr-1" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        className="h-11"
                                                        onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: false })}
                                                        disabled={approveExpenseMutation.isPending}
                                                    >
                                                        <X className="h-4 w-4 mr-1" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pending Revenues */}
                            {data.pendingRevenues.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Pending Revenues</h4>
                                    <div className="space-y-2">
                                        {data.pendingRevenues.map((revenue: any) => (
                                            <div key={revenue.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{revenue.description || 'Revenue'}</p>
                                                    <p className="text-xs text-gray-600">{revenue.propertyName}</p>
                                                    <p className="text-xs text-green-600">
                                                        {formatCurrency(revenue.amountCents / 100)} • {revenue.source}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <Button
                                                        className="h-11 bg-green-600 hover:bg-green-700"
                                                        onClick={() => approveRevenueMutation.mutate({ id: revenue.id, approved: true })}
                                                        disabled={approveRevenueMutation.isPending}
                                                    >
                                                        <Check className="h-4 w-4 mr-1" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        className="h-11"
                                                        onClick={() => approveRevenueMutation.mutate({ id: revenue.id, approved: false })}
                                                        disabled={approveRevenueMutation.isPending}
                                                    >
                                                        <X className="h-4 w-4 mr-1" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pending Leave Requests */}
                            {data.pendingLeaveRequests.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Pending Leave Requests</h4>
                                    <div className="space-y-2">
                                        {data.pendingLeaveRequests.map((leave: any) => (
                                            <div key={leave.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{leave.staffName}</p>
                                                    <p className="text-xs text-gray-600">{leave.leaveType}</p>
                                                    <p className="text-xs text-purple-600">
                                                        {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <Button
                                                        className="h-11 bg-green-600 hover:bg-green-700"
                                                        onClick={() => approveLeaveMutation.mutate({ id: leave.id, approved: true })}
                                                        disabled={approveLeaveMutation.isPending}
                                                    >
                                                        <Check className="h-4 w-4 mr-1" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        className="h-11"
                                                        onClick={() => approveLeaveMutation.mutate({ id: leave.id, approved: false })}
                                                        disabled={approveLeaveMutation.isPending}
                                                    >
                                                        <X className="h-4 w-4 mr-1" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.totalPendingApprovals === 0 && (
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
            {state.showUrgentTasks && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-lg sm:mx-4 p-4 sm:p-6 overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Urgent Tasks</h3>
                            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => actions.setShowUrgentTasks(false)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {data.urgentTasks.length > 0 ? (
                                data.urgentTasks.map((task: any) => (
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
                                                variant="outline"
                                                className="h-11"
                                                onClick={() => navigate(`/tasks`)}
                                            >
                                                <Eye className="h-4 w-4 mr-1" />
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
            {state.showOverdueTasks && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-lg sm:mx-4 p-4 sm:p-6 overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Overdue Tasks</h3>
                            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => actions.setShowOverdueTasks(false)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {data.overdueTasks.length > 0 ? (
                                data.overdueTasks.map((task: any) => (
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
                                                variant="outline"
                                                className="h-11"
                                                onClick={() => navigate(`/tasks`)}
                                            >
                                                <Eye className="h-4 w-4 mr-1" />
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
            {state.showFinancialPending && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-lg sm:mx-4 p-4 sm:p-6 overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Financial Pending</h3>
                            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => actions.setShowFinancialPending(false)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {/* Reuse the logic for displaying pending expenses/revenues from above or just duplicate for now to be safe */}
                            {/* Pending Expenses */}
                            {data.pendingExpenses.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Pending Expenses</h4>
                                    <div className="space-y-2">
                                        {data.pendingExpenses.map((expense: any) => (
                                            <div key={expense.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{expense.description || 'Expense'}</p>
                                                    <p className="text-xs text-gray-600">{expense.propertyName}</p>
                                                    <p className="text-xs text-orange-600">
                                                        {formatCurrency(expense.amountCents / 100)} • {expense.category}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <Button
                                                        className="h-11 bg-green-600 hover:bg-green-700"
                                                        onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: true })}
                                                        disabled={approveExpenseMutation.isPending}
                                                    >
                                                        <Check className="h-4 w-4 mr-1" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        className="h-11"
                                                        onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: false })}
                                                        disabled={approveExpenseMutation.isPending}
                                                    >
                                                        <X className="h-4 w-4 mr-1" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pending Revenues */}
                            {data.pendingRevenues.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Pending Revenues</h4>
                                    <div className="space-y-2">
                                        {data.pendingRevenues.map((revenue: any) => (
                                            <div key={revenue.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{revenue.description || 'Revenue'}</p>
                                                    <p className="text-xs text-gray-600">{revenue.propertyName}</p>
                                                    <p className="text-xs text-green-600">
                                                        {formatCurrency(revenue.amountCents / 100)} • {revenue.source}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <Button
                                                        className="h-11 bg-green-600 hover:bg-green-700"
                                                        onClick={() => approveRevenueMutation.mutate({ id: revenue.id, approved: true })}
                                                        disabled={approveRevenueMutation.isPending}
                                                    >
                                                        <Check className="h-4 w-4 mr-1" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        className="h-11"
                                                        onClick={() => approveRevenueMutation.mutate({ id: revenue.id, approved: false })}
                                                        disabled={approveRevenueMutation.isPending}
                                                    >
                                                        <X className="h-4 w-4 mr-1" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.pendingExpenses.length === 0 && data.pendingRevenues.length === 0 && (
                                <div className="text-center py-8">
                                    <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-500">No pending financial transactions</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

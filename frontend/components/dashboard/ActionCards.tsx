import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ListTodo, ClipboardCheck, UserMinus, IndianRupee, Siren } from 'lucide-react';

interface ActionCardsProps {
    stats: {
        pendingApprovals: number;
        urgentItems: number;
        financialPending: number;
        pendingLeave: number;
        urgentTasksCount: number; // for the label
    };
    onAction: (type: 'approvals' | 'urgent' | 'financial' | 'leave') => void;
}

export function ActionCards({ stats, onAction }: ActionCardsProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-red-500" />
                Works to be Done
            </h2>

            <div className="flex overflow-x-auto snap-x snap-mandatory px-4 -mx-4 pb-4 no-scrollbar sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:overflow-visible sm:px-0 sm:mx-0 sm:pb-0">
                {/* Pending Approvals */}
                <Card
                    className="snap-start min-w-[75vw] sm:min-w-0 border-red-200 bg-red-50 cursor-pointer active:scale-[0.98] transition-all duration-200 shadow-sm sm:hover:shadow-lg sm:hover:scale-105"
                    onClick={() => onAction('approvals')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-6 sm:pb-2">
                        <CardTitle className="text-sm font-medium text-red-900">Pending Approvals</CardTitle>
                        <div className="flex items-center gap-1">
                            <ClipboardCheck className="h-4 w-4 text-red-600" />
                            {stats.pendingApprovals > 0 && (
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="text-xl sm:text-2xl font-bold text-red-900">
                            {stats.pendingApprovals}
                        </div>
                        <p className="text-xs text-red-700">
                            {stats.pendingApprovals > 0 ? 'Click to review' : 'Require attention'}
                        </p>
                    </CardContent>
                </Card>

                {/* Urgent Tasks */}
                <Card
                    className="snap-start min-w-[75vw] sm:min-w-0 border-orange-200 bg-orange-50 cursor-pointer active:scale-[0.98] transition-all duration-200 shadow-sm sm:hover:shadow-lg sm:hover:scale-105"
                    onClick={() => onAction('urgent')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-6 sm:pb-2">
                        <CardTitle className="text-sm font-medium text-orange-900">Urgent Tasks</CardTitle>
                        <div className="flex items-center gap-1">
                            <Siren className="h-4 w-4 text-orange-600" />
                            {stats.urgentItems > 0 && (
                                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="text-xl sm:text-2xl font-bold text-orange-900">
                            {stats.urgentItems}
                        </div>
                        <p className="text-xs text-orange-700">
                            {stats.urgentItems > 0 ? `${stats.urgentTasksCount} high priority` : 'No urgent tasks'}
                        </p>
                    </CardContent>
                </Card>

                {/* Financial Pending */}
                <Card
                    className="snap-start min-w-[75vw] sm:min-w-0 border-amber-200 bg-amber-50 cursor-pointer active:scale-[0.98] transition-all duration-200 shadow-sm sm:hover:shadow-lg sm:hover:scale-105"
                    onClick={() => onAction('financial')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-6 sm:pb-2">
                        <CardTitle className="text-sm font-medium text-amber-900">Financial Pending</CardTitle>
                        <IndianRupee className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="text-xl sm:text-2xl font-bold text-amber-900">
                            {stats.financialPending}
                        </div>
                        <p className="text-xs text-amber-700">
                            Awaiting processing
                        </p>
                    </CardContent>
                </Card>

                {/* Pending Leave Requests */}
                <Card
                    className="snap-start min-w-[75vw] sm:min-w-0 border-purple-200 bg-purple-50 cursor-pointer active:scale-[0.98] transition-all duration-200 shadow-sm sm:hover:shadow-lg sm:hover:scale-105"
                    onClick={() => onAction('leave')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-6 sm:pb-2">
                        <CardTitle className="text-sm font-medium text-purple-900">Leave Requests</CardTitle>
                        <UserMinus className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="text-xl sm:text-2xl font-bold text-purple-900">
                            {stats.pendingLeave}
                        </div>
                        <p className="text-xs text-purple-700">
                            {stats.pendingLeave > 0 ? 'Awaiting approval' : 'All clear'}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

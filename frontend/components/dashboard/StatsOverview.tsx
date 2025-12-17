import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useTheme } from '@/contexts/ThemeContext';
import { IndianRupee, TrendingUp, BedDouble, CheckCircle2 } from 'lucide-react';

interface StatsOverviewProps {
    analytics: {
        metrics: {
            adr: number;
            revpar: number;
            totalBookings: number;
            taskCompletionRate: number;
        };
    } | undefined;
}

export function StatsOverview({ analytics }: StatsOverviewProps) {
    const { theme } = useTheme();

    // Helper function to format currency - always use INR for now
    const formatCurrency = (amount: number) => {
        return `₹${amount.toFixed(2)}`;
    };

    if (!analytics) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription>
                    Key performance indicators for the last 30 days
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
                <div className="flex overflow-x-auto snap-x snap-mandatory px-4 -mx-4 pb-4 no-scrollbar sm:grid sm:grid-cols-4 gap-4 sm:overflow-visible sm:px-0 sm:mx-0 sm:pb-0">
                    <div className="snap-start flex-1 min-w-[30%] text-center p-2 flex flex-col items-center justify-center gap-1">
                        <IndianRupee className="h-5 w-5 text-gray-400 mb-1" />
                        <div className="text-xl sm:text-2xl font-bold" style={{ color: theme.primaryColor }}>
                            {formatCurrency(analytics.metrics.adr)}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600">Average Daily Rate</p>
                    </div>
                    <div className="snap-start flex-1 min-w-[30%] text-center p-2 flex flex-col items-center justify-center gap-1">
                        <TrendingUp className="h-5 w-5 text-gray-400 mb-1" />
                        <div className="text-xl sm:text-2xl font-bold" style={{ color: theme.primaryColor }}>
                            {formatCurrency(analytics.metrics.revpar)}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600">RevPAR</p>
                    </div>
                    <div className="snap-start flex-1 min-w-[30%] text-center p-2 flex flex-col items-center justify-center gap-1">
                        <BedDouble className="h-5 w-5 text-gray-400 mb-1" />
                        <div className="text-xl sm:text-2xl font-bold" style={{ color: theme.primaryColor }}>
                            {analytics.metrics.totalBookings}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600">Total Bookings</p>
                    </div>
                    <div className="snap-start flex-1 min-w-[30%] text-center p-2 flex flex-col items-center justify-center gap-1">
                        <CheckCircle2 className="h-5 w-5 text-gray-400 mb-1" />
                        <div className="text-xl sm:text-2xl font-bold" style={{ color: theme.primaryColor }}>
                            {analytics.metrics.taskCompletionRate.toFixed(0)}%
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600">Task Completion</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}


import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string;
    subtitle?: string;
    icon: LucideIcon;
    iconColor?: string;
    iconBgColor?: string;
    valueColor?: string;
    className?: string;
    compact?: boolean; // For mobile horizontal scroll
}

export function StatsCard({
    title,
    value,
    subtitle,
    icon: Icon,
    iconColor = "text-blue-500",
    iconBgColor = "bg-blue-50",
    valueColor = "text-gray-900",
    className,
    compact = false,
}: StatsCardProps) {
    return (
        <Card className={cn(
            "border-none shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all duration-300 bg-white backdrop-blur-xl rounded-3xl",
            compact ? "min-w-[85vw] sm:min-w-[240px] flex-shrink-0 snap-center" : "",
            className
        )}>
            <CardContent className={cn("flex flex-col h-full justify-between", compact ? "p-5" : "p-6")}>
                <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                        <h3 className="text-[13px] font-medium text-gray-400 uppercase tracking-wide">{title}</h3>
                        <div className={cn("font-semibold tracking-tighter leading-none", valueColor, compact ? "text-3xl" : "text-4xl")}>
                            {value}
                        </div>
                    </div>
                    <div className={cn("p-2 rounded-full flex-shrink-0 opacity-80", iconBgColor)}>
                        <Icon className={cn("h-5 w-5", iconColor)} />
                    </div>
                </div>

                {subtitle && (
                    <div className="mt-auto pt-2">
                        <p className="text-xs font-medium text-gray-400 flex items-center gap-1">
                            {subtitle}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

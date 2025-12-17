import React, { useState } from 'react';
import {
    SlidersHorizontal,
    ChevronDown,
    ChevronUp,
    Hotel,
    CalendarDays,
    ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
    SheetClose
} from "@/components/ui/sheet";
import { cn } from '@/lib/utils';

interface FinanceFiltersProps {
    selectedPropertyId: string;
    onPropertyChange: (value: string) => void;
    dateRange: { startDate: string; endDate: string };
    onDateRangeChange: (field: 'startDate' | 'endDate', value: string) => void;
    properties: any[];
    onReset: () => void;
    className?: string;
}

export function FinanceFilters({
    selectedPropertyId,
    onPropertyChange,
    dateRange,
    onDateRangeChange,
    properties,
    onReset,
    className
}: FinanceFiltersProps) {
    // Desktop collapse state
    const [isDesktopOpen, setIsDesktopOpen] = useState(true);

    // Mobile Calendar selection state
    const [activeMobileDateField, setActiveMobileDateField] = useState<'startDate' | 'endDate' | null>(null);

    // Helper to handle date selection
    const handleDateChange = (date: Date | undefined, field: 'startDate' | 'endDate') => {
        if (!date) {
            onDateRangeChange(field, '');
            return;
        }
        // Format to YYYY-MM-DD for consistency
        const formatted = format(date, 'yyyy-MM-dd');
        onDateRangeChange(field, formatted);
        if (activeMobileDateField) {
            setActiveMobileDateField(null); // Mobile: Return to main view
        }
    };

    // Helper component for Date Field using new DatePicker
    const DateField = ({
        label,
        field,
        value,
        mobile
    }: {
        label: string,
        field: 'startDate' | 'endDate',
        value: string,
        mobile: boolean
    }) => {
        const dateValue = value ? new Date(value) : undefined;

        return (
            <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700 ml-1">{label}</Label>
                <DatePicker
                    date={dateValue}
                    setDate={(date) => handleDateChange(date, field)}
                    placeholder={field === 'startDate' ? 'Start date' : 'End date'}
                    className="max-w-full"
                />
            </div>
        )
    }

    // Common Filter Content (Property + Date)
    const FilterContent = ({ mobile = false }: { mobile?: boolean }) => (
        <div className={cn("space-y-4", mobile ? "" : "pt-2 sm:pt-0")}>
            {/* Property Filter */}
            <div className="space-y-2">
                <Label htmlFor="property-filter" className="text-sm font-semibold text-gray-700 ml-1">
                    Property
                </Label>
                <Select value={selectedPropertyId} onValueChange={onPropertyChange}>
                    <SelectTrigger className="h-14 text-base bg-gray-50/80 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500/20 hover:bg-gray-100 transition-all shadow-sm">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            <Hotel className="h-4 w-4 text-gray-400 shrink-0" />
                            <SelectValue placeholder="All properties" />
                        </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-xl">
                        <SelectItem value="all" className="rounded-lg h-10 cursor-pointer">All properties</SelectItem>
                        {properties?.map((property: any) => (
                            <SelectItem key={property.id} value={property.id.toString()} className="rounded-lg h-10 cursor-pointer">
                                {property.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Date Filters Row */}
            <div className="grid grid-cols-2 gap-3">
                <DateField
                    label="Start"
                    field="startDate"
                    value={dateRange.startDate}
                    mobile={mobile}
                />
                <DateField
                    label="End"
                    field="endDate"
                    value={dateRange.endDate}
                    mobile={mobile}
                />
            </div>

            {/* Clear Filters Button (Desktop Only or inside scrollable area) */}
            <Button
                variant="ghost"
                onClick={onReset}
                className="w-full h-12 text-sm font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all duration-200 mt-2"
            >
                Reset Filters
            </Button>
        </div>
    );

    return (
        <>
            {/* MOBILE IMPLEMENTATION: Advanced Bottom Sheet */}
            <div className="sm:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Card className="rounded-3xl border-none shadow-xl shadow-gray-200/50 bg-white overflow-hidden transition-all duration-300 active:scale-[0.98] cursor-pointer">
                            <div className="p-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-blue-50 rounded-2xl">
                                            <SlidersHorizontal className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold tracking-tight text-gray-900 leading-none">
                                                Money Matters
                                            </h3>
                                            <p className="text-xs font-medium text-gray-400 mt-1">
                                                Filter your transaction data
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronDown className="h-5 w-5 text-gray-300" />
                                </div>
                            </div>
                        </Card>
                    </SheetTrigger>

                    <SheetContent side="bottom" className="flex flex-col h-[85vh] p-0 overflow-hidden">
                        {/* Visual Drag Handle + Sticky Header */}
                        <div className="shrink-0 bg-white border-b border-gray-100/50">
                            {/* Drag Handle */}
                            <div className="w-full flex justify-center pt-3 pb-1">
                                <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                            </div>

                            {/* Header Content with Navigation */}
                            <SheetHeader className="px-6 pb-4 pt-2 text-left min-h-[80px] justify-center">
                                {activeMobileDateField ? (
                                    <div className="flex items-center gap-2 animate-in slide-in-from-left-5 duration-200">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="-ml-2 h-10 w-10 text-gray-500 rounded-full"
                                            onClick={() => setActiveMobileDateField(null)}
                                        >
                                            <ArrowLeft className="h-6 w-6" />
                                        </Button>
                                        <SheetTitle className="text-2xl font-bold text-gray-900">
                                            {activeMobileDateField === 'startDate' ? 'Select Start Date' : 'Select End Date'}
                                        </SheetTitle>
                                    </div>
                                ) : (
                                    <div className="animate-in slide-in-from-right-5 duration-200">
                                        <SheetTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 rounded-xl">
                                                <SlidersHorizontal className="h-5 w-5 text-blue-600" />
                                            </div>
                                            Money Matters
                                        </SheetTitle>
                                        <SheetDescription className="mt-1">
                                            Filter transactions by property and date range.
                                        </SheetDescription>
                                    </div>
                                )}
                            </SheetHeader>
                        </div>

                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
                            {activeMobileDateField ? (
                                // DatePicker View
                                <div className="flex justify-center animate-in zoom-in-95 duration-200">
                                    <div className="w-full max-w-[340px]">
                                        <DatePicker
                                            date={
                                                activeMobileDateField === 'startDate' && dateRange.startDate
                                                    ? new Date(dateRange.startDate)
                                                    : activeMobileDateField === 'endDate' && dateRange.endDate
                                                        ? new Date(dateRange.endDate)
                                                        : undefined
                                            }
                                            setDate={(date) => {
                                                if (activeMobileDateField) {
                                                    handleDateChange(date, activeMobileDateField);
                                                }
                                            }}
                                            placeholder={activeMobileDateField === 'startDate' ? 'Start date' : 'End date'}
                                            className="max-w-full"
                                        />
                                    </div>
                                </div>
                            ) : (
                                // Normal Form View
                                <div className="animate-in fade-in duration-200">
                                    <FilterContent mobile />
                                </div>
                            )}
                        </div>

                        {/* Sticky Lower Footer for Primary Action (Only visible in main view) */}
                        {!activeMobileDateField && (
                            <SheetFooter className="shrink-0 p-6 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sm:flex-row gap-3">
                                <SheetClose asChild>
                                    <Button className="w-full h-12 text-base rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 active:scale-[0.98] transition-all">
                                        Apply Filters
                                    </Button>
                                </SheetClose>
                            </SheetFooter>
                        )}
                    </SheetContent>
                </Sheet>
            </div>

            {/* DESKTOP IMPLEMENTATION: Collapsible Card */}
            <Card className={cn("hidden sm:block rounded-3xl border-none shadow-xl shadow-gray-200/50 bg-white overflow-hidden transition-all duration-300 lg:bg-white/70 lg:backdrop-blur-xl lg:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] lg:border-white/20", className)}>
                <div
                    className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={(e) => {
                        // Prevent toggle if clicking on interactive elements (like popover trigger)
                        if ((e.target as HTMLElement).closest('button')) return;
                        setIsDesktopOpen(!isDesktopOpen);
                    }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 rounded-2xl">
                                <SlidersHorizontal className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold tracking-tight text-gray-900 leading-none">Money Matters</h3>
                                <p className="text-xs font-medium text-gray-400 mt-1">Filter your transaction data</p>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 bg-gray-50 text-gray-400 rounded-full active:scale-95 transition-transform active:bg-gray-100 hover:bg-gray-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsDesktopOpen(!isDesktopOpen);
                            }}
                        >
                            {isDesktopOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>

                <div className={cn(
                    "px-5 pb-6 pt-0 duration-300 ease-in-out",
                    isDesktopOpen ? "block animate-in slide-in-from-top-2" : "hidden"
                )}>
                    <FilterContent />
                </div>
            </Card>
        </>
    );
}

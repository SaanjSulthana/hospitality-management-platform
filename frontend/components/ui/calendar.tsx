import * as React from "react"

import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-4 bg-white rounded-2xl", className)}
            classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:flex-x-4 sm:space-y-0",
                month: "space-y-4 w-full",
                month_caption: "flex justify-between items-center mb-4 px-1",
                caption_label: "text-lg font-bold text-gray-900 pl-1",
                nav: "flex items-center gap-1",
                button_previous: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-8 w-8 bg-transparent p-0 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                ),
                button_next: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-8 w-8 bg-transparent p-0 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                ),
                // Force Table to behave like Block/Flex for responsive Grid
                month_grid: "w-full border-collapse space-y-1 block",
                weekdays: "grid grid-cols-7 w-full mb-1",
                weekday: "text-gray-400 font-medium text-[0.8rem] h-9 flex items-center justify-center",
                week: "grid grid-cols-7 w-full mt-1",
                weeks: "block w-full",
                day_button: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-10 w-10 p-0 font-normal aria-selected:opacity-100 rounded-full mx-auto relative text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent"
                ),
                range_end: "day-range-end",
                selected:
                    "bg-transparent border-[2.5px] border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600 font-semibold",
                today: "text-red-500 font-bold relative after:content-[''] after:absolute after:bottom-[3px] after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-red-500 after:rounded-full",
                outside:
                    "text-gray-300 opacity-50 aria-selected:bg-transparent aria-selected:text-gray-300 aria-selected:opacity-30",
                disabled: "text-gray-300 opacity-50",
                range_middle:
                    "aria-selected:bg-accent aria-selected:text-accent-foreground",
                hidden: "invisible",
                ...classNames,
            }}
            {...props}
        />
    )
}
Calendar.displayName = "Calendar"

export { Calendar }

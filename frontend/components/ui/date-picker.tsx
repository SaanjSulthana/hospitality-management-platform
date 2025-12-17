import * as React from "react"
import { format, isValid, parse, isBefore, isAfter, isSameDay } from "date-fns"
import { Calendar as CalendarIcon, AlertCircle } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"

export interface DatePickerProps {
    date?: Date
    setDate: (date: Date | undefined) => void
    className?: string
    placeholder?: string
    disabledDates?: (date: Date) => boolean
    minDate?: Date
    maxDate?: Date
}

export function DatePicker({
    date,
    setDate,
    className,
    placeholder = "MM/DD/YYYY",
    disabledDates,
    minDate,
    maxDate,
}: DatePickerProps) {
    const [inputValue, setInputValue] = React.useState("")
    const [error, setError] = React.useState<string | null>(null)
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
    const [selectedTime, setSelectedTime] = React.useState({ hour: 12, minute: 0, period: 'PM' as 'AM' | 'PM' })

    // Sync input value when date prop changes
    React.useEffect(() => {
        if (date) {
            setInputValue(format(date, "MM/dd/yyyy"))
            setError(null)
            // Extract time from date
            const hours = date.getHours()
            const minutes = date.getMinutes()
            setSelectedTime({
                hour: hours % 12 || 12,
                minute: minutes,
                period: hours >= 12 ? 'PM' : 'AM'
            })
        } else {
            setInputValue("")
        }
    }, [date])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value

        // Allow only numbers and slashes
        value = value.replace(/[^0-9/]/g, "")

        // Auto-formatting (masking)
        if (value.length === 2 && inputValue.length === 1) {
            value += "/"
        } else if (value.length === 2 && inputValue.length === 3) {
            // Deleting the slash
            value = value.substring(0, 1)
        } else if (value.length === 5 && inputValue.length === 4) {
            value += "/"
        } else if (value.length === 5 && inputValue.length === 6) {
            // Deleting the second slash
            value = value.substring(0, 4)
        }

        // Limit length to MM/DD/YYYY (10 chars)
        if (value.length > 10) return

        setInputValue(value)

        // Validation logic
        if (value.length === 10) {
            const parsedDate = parse(value, "MM/dd/yyyy", new Date())

            if (!isValid(parsedDate)) {
                setError("Invalid date")
                setDate(undefined)
                return
            }

            if (format(parsedDate, "MM/dd/yyyy") !== value) {
                setError("Date does not exist")
                setDate(undefined)
                return
            }

            if (disabledDates && disabledDates(parsedDate)) {
                setError("Date is disabled")
                setDate(undefined)
                return
            }

            if (minDate && isBefore(parsedDate, minDate) && !isSameDay(parsedDate, minDate)) {
                setError("Date is too early")
                setDate(undefined)
                return
            }

            if (maxDate && isAfter(parsedDate, maxDate) && !isSameDay(parsedDate, maxDate)) {
                setError("Date is too late")
                setDate(undefined)
                return
            }

            setError(null)
            // Apply current time to the date
            const dateWithTime = new Date(parsedDate)
            const hours = selectedTime.period === 'PM' ? (selectedTime.hour % 12) + 12 : selectedTime.hour % 12
            dateWithTime.setHours(hours, selectedTime.minute, 0, 0)
            setDate(dateWithTime)
        } else {
            if (date) setDate(undefined);
            setError(null)
        }
    }

    const handleCalendarSelect = (newDate: Date | undefined) => {
        if (newDate) {
            // Apply selected time to the date
            const dateWithTime = new Date(newDate)
            const hours = selectedTime.period === 'PM' ? (selectedTime.hour % 12) + 12 : selectedTime.hour % 12
            dateWithTime.setHours(hours, selectedTime.minute, 0, 0)
            setDate(dateWithTime)
            setInputValue(format(dateWithTime, "MM/dd/yyyy"))
            setError(null)
            setIsPopoverOpen(false)
        } else {
            setDate(undefined)
            setInputValue("")
        }
    }

    const handleTimeChange = (type: 'hour' | 'minute' | 'period', value: number | string) => {
        const newTime = { ...selectedTime }
        if (type === 'hour') newTime.hour = value as number
        if (type === 'minute') newTime.minute = value as number
        if (type === 'period') newTime.period = value as 'AM' | 'PM'

        setSelectedTime(newTime)

        // Update date if one is selected
        if (date) {
            const updatedDate = new Date(date)
            const hours = newTime.period === 'PM' ? (newTime.hour % 12) + 12 : newTime.hour % 12
            updatedDate.setHours(hours, newTime.minute, 0, 0)
            setDate(updatedDate)
        }
    }

    return (
        <div className={cn("relative w-full max-w-[300px]", className)}>
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <div className="relative group">
                    <Input
                        type="text"
                        placeholder={placeholder}
                        value={inputValue}
                        onChange={handleInputChange}
                        className={cn(
                            "pr-10 h-11 text-base transition-all duration-200",
                            "border-gray-200 focus:border-blue-500 hover:border-gray-300",
                            "placeholder:text-gray-400",
                            error ? "border-red-500 focus:border-red-500 ring-red-100" : ""
                        )}
                    />
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-11 w-11 text-gray-500 hover:text-blue-600 hover:bg-transparent"
                            aria-label="Open calendar"
                        >
                            <CalendarIcon className="h-5 w-5" />
                        </Button>
                    </PopoverTrigger>
                </div>

                {/* Inline Error Message */}
                {error && (
                    <div className="absolute -bottom-6 left-0 text-xs text-red-500 flex items-center gap-1 animate-in slide-in-from-left-1 fade-in duration-200">
                        <AlertCircle className="h-3 w-3" />
                        {error}
                    </div>
                )}

                <PopoverContent
                    className="w-[min(340px,calc(100vw-2rem))] p-0 border-0 bg-transparent shadow-none"
                    align="start"
                >
                    <div className="bg-white rounded-[13px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-2.5 sm:p-3 pt-3 sm:pt-4 pb-2">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={handleCalendarSelect}
                            initialFocus
                            disabled={disabledDates}
                            defaultMonth={date || new Date()}
                            captionLayout="dropdown"
                            fromYear={2020}
                            toYear={2030}
                            classNames={{
                                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                                month: "space-y-1.5 sm:space-y-2 w-full",
                                month_caption: "flex justify-center relative items-center h-[36px] sm:h-[40px] mb-2",
                                caption_label: "hidden", // Hide when using dropdown
                                dropdowns: "flex gap-1 sm:gap-1.5 items-center justify-center relative z-10",
                                dropdown: "appearance-none bg-white/95 border border-gray-200/60 rounded-md px-1.5 sm:px-2 py-0.5 sm:py-1 text-[12px] sm:text-[13px] font-[600] text-black cursor-pointer hover:bg-white hover:border-gray-300 transition-all shadow-sm max-h-[32px] leading-tight",
                                dropdown_month: "w-[85px] sm:w-[95px] order-2",
                                dropdown_year: "w-[60px] sm:w-[65px] order-1",
                                nav: "flex items-center absolute w-full justify-between left-0 top-1 px-1 z-20 pointer-events-none",
                                button_previous: "h-[30px] w-[30px] bg-transparent p-0 text-gray-900/80 hover:text-black active:scale-95 active:bg-gray-200 transition-all flex items-center justify-center touch-manipulation pointer-events-auto hover:bg-gray-100/80 rounded-full disabled:opacity-30 disabled:pointer-events-none",
                                button_next: "h-[30px] w-[30px] bg-transparent p-0 text-gray-900/80 hover:text-black active:scale-95 active:bg-gray-200 transition-all flex items-center justify-center touch-manipulation pointer-events-auto hover:bg-gray-100/80 rounded-full disabled:opacity-30 disabled:pointer-events-none",
                                month_grid: "w-full border-collapse block",
                                weeks: "w-full block space-y-0",
                                weekdays: "grid grid-cols-7 w-full mb-1 gap-0",
                                weekday: "text-[9px] sm:text-[10px] font-[600] text-[rgba(60,60,67,0.4)] w-[34px] sm:w-[42px] h-[14px] sm:h-[16px] flex items-center justify-center uppercase tracking-wider",
                                week: "grid grid-cols-7 w-full gap-0",
                                day_button: "h-[32px] w-[32px] sm:h-[38px] sm:w-[38px] p-0 font-[400] text-[14px] sm:text-[16px] text-black aria-selected:opacity-100 rounded-full hover:bg-black/5 active:bg-black/10 flex items-center justify-center transition-all duration-150 tracking-[-0.3px] relative text-center touch-manipulation",
                                selected: "bg-[#0088FF] text-white hover:bg-[#0088FF] hover:text-white focus:bg-[#0088FF] focus:text-white active:bg-[#0077EE] font-[510] shadow-md shadow-blue-200/50",
                                today: "text-red-500 font-[600] relative after:content-[''] after:absolute after:bottom-[3px] after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-red-500 after:rounded-full",
                                outside: "text-gray-300 opacity-40 aria-selected:bg-transparent aria-selected:text-gray-300 aria-selected:opacity-30",
                                disabled: "text-gray-300 opacity-40 line-through decoration-gray-300",
                                hidden: "invisible",
                            }}
                        />
                        {/* Separator and Time Selector */}
                        <div className="px-1.5 sm:px-2 mt-1.5 sm:mt-2">
                            <div className="h-[0.5px] bg-[#000000]/12 w-full mb-1.5 sm:mb-2" />
                            <div className="flex justify-between items-center">
                                <span className="text-[14px] sm:text-[15px] text-black tracking-[-0.43px] font-[400]">Time</span>
                                <div className="flex items-center gap-1">
                                    {/* Hour Selector */}
                                    <select
                                        value={selectedTime.hour}
                                        onChange={(e) => handleTimeChange('hour', parseInt(e.target.value))}
                                        className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#767680]/12 rounded-lg text-[14px] sm:text-[15px] text-black border-0 cursor-pointer hover:bg-[#767680]/20 transition-colors appearance-none text-center w-[42px] sm:w-[48px] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:hidden scrollbar-width-none"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                            <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                                        ))}
                                    </select>
                                    <span className="text-[14px] sm:text-[15px] text-black">:</span>
                                    {/* Minute Selector */}
                                    <select
                                        value={selectedTime.minute}
                                        onChange={(e) => handleTimeChange('minute', parseInt(e.target.value))}
                                        className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#767680]/12 rounded-lg text-[14px] sm:text-[15px] text-black border-0 cursor-pointer hover:bg-[#767680]/20 transition-colors appearance-none text-center w-[50px] sm:w-[56px] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:hidden scrollbar-width-none"
                                    >
                                        {Array.from({ length: 60 }, (_, i) => i).map(m => (
                                            <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                                        ))}
                                    </select>
                                    {/* AM/PM Selector */}
                                    <select
                                        value={selectedTime.period}
                                        onChange={(e) => handleTimeChange('period', e.target.value)}
                                        className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#767680]/12 rounded-lg text-[14px] sm:text-[15px] text-black border-0 cursor-pointer hover:bg-[#767680]/20 transition-colors appearance-none text-center w-[48px] sm:w-[52px] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:hidden scrollbar-width-none"
                                    >
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}

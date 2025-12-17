import * as React from "react"
import { DatePicker } from "./date-picker"

export function DatePickerDemo() {
    const [date, setDate] = React.useState<Date | undefined>(new Date())

    return (
        <div className="p-8 border rounded-xl bg-gray-50/50 space-y-4 max-w-md mx-auto">
            <div className="space-y-1">
                <h3 className="text-lg font-semibold text-gray-900">Book your stay</h3>
                <p className="text-sm text-gray-500">Select a date for check-in. Past dates are disabled.</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">
                    Check-in Date
                </label>
                <DatePicker
                    date={date}
                    setDate={setDate}
                    disabledDates={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />

                <div className="pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                        Selected date: <span className="font-mono text-gray-900 ml-1">{date ? date.toLocaleDateString() : "None"}</span>
                    </p>
                </div>
            </div>
        </div>
    )
}

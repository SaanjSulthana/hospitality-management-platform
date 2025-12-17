# DatePicker Component - Usage Guide

The DatePicker component is a fully-featured, mobile-responsive date and time picker with Apple-style design.

## Location
`frontend/components/ui/date-picker.tsx`

## Features
- ✅ Manual date input with auto-formatting (MM/DD/YYYY)
- ✅ Calendar popover with month/year dropdowns
- ✅ Time selection (Hour, Minute, AM/PM)
- ✅ Inline validation with error messages
- ✅ Date range constraints (min/max dates)
- ✅ Disabled dates support
- ✅ Fully responsive (mobile to desktop)
- ✅ Touch-optimized
- ✅ Apple-style glassmorphism design

## Basic Usage

```tsx
import { DatePicker } from "@/components/ui/date-picker"
import { useState } from "react"

function MyComponent() {
  const [date, setDate] = useState<Date | undefined>(new Date())

  return (
    <DatePicker
      date={date}
      setDate={setDate}
    />
  )
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `date` | `Date \| undefined` | - | The selected date (controlled) |
| `setDate` | `(date: Date \| undefined) => void` | - | Callback when date changes |
| `className` | `string` | - | Additional CSS classes |
| `placeholder` | `string` | `"MM/DD/YYYY"` | Input placeholder text |
| `disabledDates` | `(date: Date) => boolean` | - | Function to disable specific dates |
| `minDate` | `Date` | - | Minimum selectable date |
| `maxDate` | `Date` | - | Maximum selectable date |

## Examples

### Disable Past Dates
```tsx
<DatePicker
  date={date}
  setDate={setDate}
  disabledDates={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
/>
```

### Date Range (Min/Max)
```tsx
<DatePicker
  date={date}
  setDate={setDate}
  minDate={new Date('2024-01-01')}
  maxDate={new Date('2024-12-31')}
/>
```

### Disable Weekends
```tsx
<DatePicker
  date={date}
  setDate={setDate}
  disabledDates={(date) => {
    const day = date.getDay()
    return day === 0 || day === 6 // Sunday or Saturday
  }}
/>
```

### Custom Placeholder
```tsx
<DatePicker
  date={date}
  setDate={setDate}
  placeholder="Select check-in date"
/>
```

## Time Selection

The DatePicker automatically includes time selection. The selected time is stored in the `Date` object:

```tsx
const [checkIn, setCheckIn] = useState<Date>()

// Access time
if (checkIn) {
  console.log(checkIn.getHours())    // 0-23
  console.log(checkIn.getMinutes())  // 0-59
}
```

## Styling

The component uses Tailwind CSS and can be customized via the `className` prop:

```tsx
<DatePicker
  date={date}
  setDate={setDate}
  className="max-w-full" // Override default max-width
/>
```

## Responsive Behavior

- **Mobile (< 640px)**: Compact layout with 36px day cells
- **Desktop (≥ 640px)**: Full layout with 44px day cells
- **Calendar width**: Adapts to viewport (min 340px, max 100vw - 2rem)

## Accessibility

- Keyboard navigation supported
- ARIA labels on interactive elements
- Touch-optimized for mobile devices
- Focus management

## Integration Examples

### Booking Form
```tsx
function BookingForm() {
  const [checkIn, setCheckIn] = useState<Date>()
  const [checkOut, setCheckOut] = useState<Date>()

  return (
    <div className="space-y-4">
      <DatePicker
        date={checkIn}
        setDate={setCheckIn}
        placeholder="Check-in"
        disabledDates={(date) => date < new Date()}
      />
      <DatePicker
        date={checkOut}
        setDate={setCheckOut}
        placeholder="Check-out"
        minDate={checkIn}
        disabledDates={(date) => checkIn ? date <= checkIn : false}
      />
    </div>
  )
}
```

### Task Deadline
```tsx
<DatePicker
  date={deadline}
  setDate={setDeadline}
  placeholder="Set deadline"
  minDate={new Date()}
/>
```

## Notes

- The component handles timezone automatically
- Time defaults to 12:00 PM if not set
- Validation errors appear inline below the input
- Calendar closes automatically after date selection

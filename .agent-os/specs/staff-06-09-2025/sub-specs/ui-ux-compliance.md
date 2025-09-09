# UI/UX Compliance Guide

This document ensures all frontend implementations follow the UI/UX rules from @ui-ux-rules.mdc.

## ✅ Responsive Design Compliance

### Mobile-First Breakpoints
```typescript
// Required breakpoints for all components
const breakpoints = {
  mobile: '320px',    // Minimum mobile width
  tablet: '768px',    // Tablet breakpoint
  desktop: '1024px+'  // Desktop and larger
};

// Tailwind CSS classes for responsive design
const responsiveClasses = {
  grid: {
    mobile: 'grid-cols-1',
    tablet: 'md:grid-cols-2',
    desktop: 'lg:grid-cols-3 xl:grid-cols-4'
  },
  layout: {
    mobile: 'flex-col space-y-4',
    tablet: 'md:flex-row md:space-y-0 md:space-x-4',
    desktop: 'lg:space-x-6'
  }
};
```

### Touch-Friendly Interactions
```typescript
// Minimum button sizes for touch accessibility
const touchSizes = {
  mobile: 'min-h-[44px] min-w-[44px]',  // WCAG AA compliance
  tablet: 'md:min-h-[48px] md:min-w-[48px]',
  desktop: 'lg:min-h-[52px] lg:min-w-[52px]'
};

// Adequate spacing between touch targets
const touchSpacing = 'space-y-2 md:space-y-0 md:space-x-2';
```

## ✅ Table Responsiveness

### Horizontal Scroll Implementation
```typescript
// Tables with >3 columns must be horizontally scrollable on mobile
<div className="overflow-x-auto">
  <table className="min-w-full">
    <thead className="sticky top-0 bg-white z-10">
      <tr>
        <th className="px-4 py-2 text-left">Column 1</th>
        <th className="px-4 py-2 text-left">Column 2</th>
        <th className="px-4 py-2 text-left">Column 3</th>
        <th className="px-4 py-2 text-left">Column 4</th>
        {/* More columns... */}
      </tr>
    </thead>
    <tbody>
      {/* Table rows with alternating colors */}
    </tbody>
  </table>
</div>
```

### Card Format for Mobile
```typescript
// Collapse wide tables into cards on mobile
<div className="block md:hidden">
  {data.map((item, index) => (
    <Card key={item.id} className={`mb-4 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="font-medium">{item.name}</span>
            <Badge variant="outline">{item.status}</Badge>
          </div>
          <div className="text-sm text-gray-600">
            <p>Date: {item.date}</p>
            <p>Department: {item.department}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  ))}
</div>
```

### Sticky Headers Implementation
```typescript
// Fixed headers for large datasets
<thead className="sticky top-0 bg-white border-b z-10">
  <tr className="bg-gray-50">
    <th className="px-4 py-3 text-left font-semibold">Name</th>
    <th className="px-4 py-3 text-left font-semibold">Date</th>
    <th className="px-4 py-3 text-left font-semibold">Status</th>
  </tr>
</thead>
```

## ✅ Excel-Style Features

### Responsive Spreadsheet Grid
```typescript
// Spreadsheet-like grid with mobile support
<div className="overflow-auto max-h-[600px] border rounded-lg">
  <div className="grid grid-cols-12 min-w-[800px]">
    {/* Sticky row numbers */}
    <div className="sticky left-0 bg-gray-50 border-r p-2 font-mono text-sm">
      #
    </div>
    
    {/* Sticky column headers */}
    <div className="sticky top-0 bg-gray-50 border-b p-2 font-semibold">
      Header 1
    </div>
    
    {/* Data cells with focus states */}
    <div className="p-2 border-b border-r focus:ring-2 focus:ring-blue-500 focus:outline-none">
      Data
    </div>
  </div>
</div>
```

### Mobile Pinch-to-Zoom Support
```typescript
// Enable pinch-to-zoom on mobile for Excel-style grids
import { useGesture } from 'react-use-gesture';

const ExcelGrid = () => {
  const bind = useGesture({
    onPinch: ({ offset: [scale] }) => {
      // Handle pinch-to-zoom scaling
    }
  });

  return (
    <div 
      {...bind()}
      className="overflow-auto touch-pan-x touch-pan-y"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Grid content */}
    </div>
  );
};
```

## ✅ Accessibility Compliance

### WCAG 2.1 AA Standards
```typescript
// Semantic HTML with proper ARIA labels
<table role="table" aria-label="Staff attendance data">
  <thead>
    <tr role="row">
      <th 
        role="columnheader" 
        scope="col"
        className="px-4 py-2 text-left font-semibold"
      >
        Staff Name
      </th>
      <th 
        role="columnheader" 
        scope="col"
        className="px-4 py-2 text-left font-semibold"
      >
        Check-in Time
      </th>
    </tr>
  </thead>
  <tbody>
    <tr role="row">
      <td role="cell" className="px-4 py-2">{staffName}</td>
      <td role="cell" className="px-4 py-2">{checkInTime}</td>
    </tr>
  </tbody>
</table>
```

### High Contrast Focus States
```typescript
// Clear focus indicators for all interactive elements
const focusStyles = "focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none";

// Button with proper focus states
<Button 
  className={`px-4 py-2 bg-blue-600 text-white rounded ${focusStyles}`}
  aria-label="Check in staff member"
>
  Check In
</Button>
```

### Screen Reader Support
```typescript
// Proper labeling for form controls
<Label htmlFor="staff-select" className="block text-sm font-medium">
  Select Staff Member
</Label>
<Select id="staff-select" aria-describedby="staff-help">
  <SelectTrigger className={focusStyles}>
    <SelectValue placeholder="Choose staff member" />
  </SelectTrigger>
  <SelectContent>
    {staff.map(member => (
      <SelectItem key={member.id} value={member.id}>
        {member.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
<div id="staff-help" className="text-sm text-gray-500">
  Select a staff member to view their attendance
</div>
```

## ✅ Performance Optimization

### Lazy Loading Implementation
```typescript
// Lazy load large datasets
import { useVirtualizer } from '@tanstack/react-virtual';

const VirtualizedTable = ({ data }) => {
  const parentRef = useRef();
  
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });

  return (
    <div ref={parentRef} className="h-96 overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {/* Row content */}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Asset Optimization
```typescript
// Optimize images and assets
const OptimizedImage = ({ src, alt }) => (
  <img
    src={src}
    alt={alt}
    loading="lazy"
    className="w-full h-auto"
    style={{
      maxWidth: '100%',
      height: 'auto',
    }}
  />
);
```

## ✅ Cross-Platform Compatibility

### WebView/React Native/Capacitor Ready
```typescript
// Avoid platform-specific hacks
const isMobile = window.innerWidth < 768;
const isTouch = 'ontouchstart' in window;

// Use responsive design instead of platform detection
<div className="flex flex-col md:flex-row">
  {/* Content adapts based on screen size, not platform */}
</div>
```

### Touch Event Handling
```typescript
// Handle both mouse and touch events
const handleInteraction = (e) => {
  e.preventDefault();
  // Handle interaction
};

<div
  onMouseDown={handleInteraction}
  onTouchStart={handleInteraction}
  className="touch-manipulation"
>
  Interactive content
</div>
```

## ✅ Implementation Checklist

### Before Starting Frontend Development
- [ ] Review UI/UX rules from @ui-ux-rules.mdc
- [ ] Set up responsive breakpoints (320px, 768px, 1024px+)
- [ ] Configure touch-friendly button sizes (44px minimum)
- [ ] Plan table responsiveness strategy
- [ ] Set up accessibility testing tools

### During Development
- [ ] Implement mobile-first responsive design
- [ ] Add touch-friendly interactions
- [ ] Create responsive tables with horizontal scroll
- [ ] Implement card format for mobile
- [ ] Add sticky headers for large datasets
- [ ] Ensure WCAG 2.1 AA compliance
- [ ] Test with screen readers
- [ ] Optimize for performance

### After Development
- [ ] Test on actual mobile devices
- [ ] Verify accessibility compliance
- [ ] Test cross-platform compatibility
- [ ] Validate responsive behavior
- [ ] Check performance metrics
- [ ] Conduct user testing

## 🚨 Critical Success Factors

1. **Mobile-First Design**: Always start with 320px mobile layout
2. **Touch-Friendly**: Minimum 44px button height, adequate spacing
3. **Responsive Tables**: Horizontal scroll on mobile, sticky headers
4. **Accessibility**: WCAG 2.1 AA compliance, semantic HTML, ARIA labels
5. **Performance**: Lazy loading, asset optimization, minimal DOM nesting
6. **Cross-Platform**: WebView/React Native/Capacitor compatibility
7. **Excel-Style Features**: Pinch-to-zoom, keyboard navigation, cell focus
8. **Card Format**: Collapse wide content into cards on mobile

This compliance guide ensures all frontend implementations meet the highest standards for responsiveness, accessibility, and user experience across all devices and platforms.

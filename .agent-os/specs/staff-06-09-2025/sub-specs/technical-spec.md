# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-05-enhanced-staff-management/spec.md

## Technical Requirements

### Backend Architecture (Encore Framework)
- **Service Structure**: Extend existing `staff` service with new endpoints following Encore patterns
- **Database Design**: Add new tables using Encore SQLDatabase with proper migrations
- **Authentication**: Use `getAuthData()` from `~encore/auth` and `requireRole()` from `../auth/middleware`
- **API Design**: Use Encore `api()` function with proper `{ auth: true, expose: true }` configuration
- **Data Validation**: Comprehensive input validation with `APIError` class for error handling
- **Transaction Management**: Use Encore database transactions with `await db.begin()`, `tx.commit()`, `tx.rollback()`

### Encore-Specific Patterns
- **API Endpoints**: Use `api<RequestType, ResponseType>()` with proper TypeScript interfaces
- **Database Queries**: Use template literals with `queryRow`, `queryAll`, `exec` methods
- **Error Handling**: Use `APIError.unauthenticated()`, `APIError.notFound()`, `APIError.internal()`
- **Authentication**: Always use `async (req) =>` signature, call `getAuthData()` inside function
- **Organization Isolation**: Include `org_id = ${authData.orgId}` in all database queries
- **Role Validation**: Use `requireRole("ADMIN", "MANAGER")(authData)` pattern

### Frontend Architecture (Encore + React Query + UI/UX Compliance)
- **Component Structure**: Extend existing StaffPage.tsx with new tabs and components
- **State Management**: Use React Query for server state, local state for UI interactions
- **API Integration**: Use `getAuthenticatedBackend()` for all API calls
- **Authentication**: Use `useAuth()` hook and check `user?.role === 'ADMIN'` for conditional rendering
- **Error Handling**: Implement comprehensive `onError` handlers with `useToast()`
- **Real-time Updates**: Use React Query with `refetchInterval: 3000` for live updates
- **UI Components**: Leverage existing shadcn/ui components with consistent styling
- **Form Validation**: Client-side validation with server-side verification

### UI/UX Responsiveness Requirements
- **Mobile-First Design**: Start with 320px mobile layouts, expand to 768px tablet, 1024px+ desktop
- **Fluid Layouts**: Use flexbox/grid instead of fixed positioning, avoid hardcoded pixels
- **Touch-Friendly**: Buttons minimum 44px height, adequate tap zone spacing
- **Responsive Tables**: Horizontal scroll on mobile (>3 columns), sticky headers for large datasets
- **Excel-Style Features**: Pinch-to-zoom on mobile, cell focus/keyboard navigation on desktop
- **Card Format**: Collapse wide tables into cards on mobile, side-by-side on larger screens
- **Accessibility**: WCAG 2.1 AA compliance, high contrast, semantic HTML, clear focus states
- **Performance**: Lazy loading, asset compression, minimal DOM nesting
- **Cross-Platform**: WebView/React Native/Capacitor compatibility

### Encore Development Checklist Compliance
- **Backend Setup**: ✅ Extend existing `backend/staff/` service directory
- **Database File**: ✅ Use existing `backend/staff/db.ts` with Encore SQLDatabase
- **Encore Service**: ✅ Extend existing `backend/staff/encore.service.ts`
- **Authentication**: ✅ Import `getAuthData` from `~encore/auth`
- **Role Middleware**: ✅ Import `requireRole` from `../auth/middleware`
- **API Signature**: ✅ Use `async (req) =>` (NOT `async (req, authData)`)
- **Database Queries**: ✅ Include `org_id = ${authData.orgId}` in all queries
- **Error Handling**: ✅ Use `APIError` class with try-catch blocks
- **Frontend Integration**: ✅ Use `getAuthenticatedBackend()` for API calls
- **Database Connection**: ✅ Use `encore db shell hospitality` for testing

### Database Schema Extensions
- **Attendance Table**: Track check-in/check-out times with location and device info
- **Salary Components Table**: Store salary structure and variable components
- **Payslips Table**: Store generated payslips with PDF references
- **Schedule Changes Table**: Track shift change requests and approvals
- **Enhanced Staff Table**: Add fields for salary components and attendance settings

### API Endpoints
- **Staff Management**: CRUD operations with role-based filtering
- **Attendance**: Check-in/check-out, history, and reporting endpoints
- **Salary**: Calculation, payslip generation, and financial reporting
- **Schedules**: Enhanced scheduling with change request management
- **Leave**: Extended leave management with approval workflows

### Security Requirements
- **Role-based Access**: Strict permission checks for all operations
- **Data Isolation**: Organization-level data separation
- **Input Sanitization**: Prevent SQL injection and XSS attacks
- **Audit Logging**: Track all sensitive operations
- **Session Management**: Secure token handling and refresh

### Performance Requirements
- **Response Times**: API responses under 500ms for standard operations
- **Database Optimization**: Proper indexing for attendance and salary queries
- **Caching Strategy**: Cache frequently accessed data (staff lists, schedules)
- **Pagination**: Implement pagination for large datasets
- **File Handling**: Efficient PDF generation and storage

### Integration Requirements
- **Existing Services**: Seamless integration with current auth, properties, and users services
- **Notification System**: Extend existing notification system for new events
- **File Storage**: Use existing upload service for payslip storage
- **Reporting**: Integrate with existing reports service for analytics

### Error Handling
- **API Errors**: Comprehensive error responses with proper HTTP status codes
- **Frontend Errors**: User-friendly error messages with retry mechanisms
- **Database Errors**: Graceful handling of constraint violations and timeouts
- **File Operations**: Proper error handling for PDF generation and storage

### Testing Requirements
- **Unit Tests**: Test all business logic and data transformations
- **Integration Tests**: Test API endpoints with various scenarios
- **Frontend Tests**: Test component rendering and user interactions
- **Database Tests**: Test migrations and data integrity
- **Security Tests**: Verify role-based access and data isolation

## UI/UX Implementation Details

### Responsive Design Patterns
```typescript
// Mobile-first breakpoints
const breakpoints = {
  mobile: '320px',
  tablet: '768px', 
  desktop: '1024px+'
};

// Fluid layout patterns
const responsiveGrid = {
  mobile: 'grid-cols-1',
  tablet: 'md:grid-cols-2', 
  desktop: 'lg:grid-cols-3 xl:grid-cols-4'
};

// Touch-friendly button sizing
const buttonSizes = {
  mobile: 'min-h-[44px] min-w-[44px]', // WCAG AA compliance
  tablet: 'md:min-h-[48px]',
  desktop: 'lg:min-h-[52px]'
};
```

### Table Responsiveness
```typescript
// Responsive table with horizontal scroll
<div className="overflow-x-auto">
  <table className="min-w-full">
    <thead className="sticky top-0 bg-white">
      {/* Sticky headers for large datasets */}
    </thead>
    <tbody>
      {/* Alternating row colors for readability */}
    </tbody>
  </table>
</div>

// Card format for mobile
<div className="block md:hidden">
  {data.map(item => (
    <Card key={item.id} className="mb-4">
      {/* Card layout for mobile */}
    </Card>
  ))}
</div>
```

### Excel-Style Features
```typescript
// Spreadsheet-like grid with responsive behavior
<div className="overflow-auto max-h-[600px]">
  <div className="grid grid-cols-12 min-w-[800px]">
    {/* Sticky row numbers */}
    <div className="sticky left-0 bg-gray-50">#</div>
    {/* Sticky column headers */}
    <div className="sticky top-0 bg-gray-50">Header</div>
    {/* Data cells with focus states */}
  </div>
</div>
```

### Accessibility Implementation
```typescript
// Semantic HTML with ARIA labels
<table role="table" aria-label="Staff attendance data">
  <thead>
    <tr role="row">
      <th role="columnheader" scope="col">Name</th>
      <th role="columnheader" scope="col">Date</th>
    </tr>
  </thead>
  <tbody>
    <tr role="row">
      <td role="cell">{name}</td>
      <td role="cell">{date}</td>
    </tr>
  </tbody>
</table>

// High contrast focus states
const focusStyles = "focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none";
```

## External Dependencies

### Backend Dependencies
- **PDF Generation**: `puppeteer` or `jsPDF` for payslip generation
- **Date/Time Handling**: `date-fns` for advanced date operations
- **Excel Export**: `xlsx` library for attendance report generation
- **File Storage**: Existing upload service integration

### Frontend Dependencies
- **Date Picker**: Enhanced date/time picker components with mobile support
- **File Download**: Browser download API for payslips and reports
- **Charts/Graphs**: `recharts` for responsive attendance and salary analytics
- **Export Functions**: Client-side CSV/Excel export capabilities
- **Responsive Tables**: `@tanstack/react-table` for advanced table features with mobile support
- **Mobile Gestures**: `react-use-gesture` for pinch-to-zoom and touch interactions
- **Responsive Design**: `tailwindcss` with custom breakpoints for mobile-first design
- **Accessibility**: `@headlessui/react` for accessible components and ARIA support

### Justification for Dependencies
- **PDF Generation**: Essential for professional payslip generation and reporting
- **Excel Export**: Required for attendance reports and financial data export
- **Date Libraries**: Necessary for complex date calculations in salary and attendance
- **Chart Libraries**: Needed for visual analytics and reporting dashboards
- **Table Libraries**: Required for responsive tables with sorting, filtering, and pagination
- **Gesture Libraries**: Essential for mobile-friendly Excel-style interactions
- **Responsive Design**: Critical for mobile-first, touch-friendly interfaces
- **Accessibility Libraries**: Required for WCAG 2.1 AA compliance and screen reader support

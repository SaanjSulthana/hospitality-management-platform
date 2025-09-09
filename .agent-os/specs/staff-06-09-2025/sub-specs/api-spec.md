# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-05-enhanced-staff-management/spec.md

## Endpoints (Encore Framework)

### Staff Management Endpoints

#### GET /staff
**Purpose:** List all staff members with filtering and pagination
**Encore Pattern:** `api<ListStaffRequest, ListStaffResponse>({ auth: true, expose: true, method: "GET", path: "/staff" })`
**Parameters:** 
```typescript
interface ListStaffRequest {
  propertyId?: number;
  department?: string;
  status?: string;
  page?: number;
  limit?: number;
}
```
**Response:** 
```typescript
interface ListStaffResponse {
  staff: StaffInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```
**Implementation Pattern:**
```typescript
export const list = api<ListStaffRequest, ListStaffResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff" },
  async (req) => {
    const authData = getAuthData();
    requireRole("ADMIN", "MANAGER")(authData);
    // Implementation with org_id isolation
  }
);
```
**Errors:** 401 (Unauthorized), 403 (Forbidden)

#### POST /staff
**Purpose:** Create a new staff member
**Parameters:** 
```typescript
{
  userId: number,
  propertyId?: number,
  department: 'frontdesk' | 'housekeeping' | 'maintenance' | 'fnb' | 'admin',
  hourlyRateCents?: number,
  baseSalaryCents?: number,
  hireDate?: Date,
  notes?: string
}
```
**Response:** StaffInfo object
**Errors:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 409 (Conflict)

#### PATCH /staff/:id
**Purpose:** Update staff member information
**Parameters:** 
```typescript
{
  propertyId?: number,
  department?: string,
  hourlyRateCents?: number,
  baseSalaryCents?: number,
  status?: 'active' | 'inactive',
  notes?: string
}
```
**Response:** Updated StaffInfo object
**Errors:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)

#### DELETE /staff/:id
**Purpose:** Delete a staff member
**Parameters:** None
**Response:** 
```typescript
{
  success: boolean,
  message: string
}
```
**Errors:** 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)

### Attendance Management Endpoints

#### POST /staff/attendance/checkin
**Purpose:** Check in a staff member
**Parameters:** 
```typescript
{
  staffId: number,
  checkInTime?: Date, // Optional, defaults to current time
  notes?: string
}
```
**Response:** 
```typescript
{
  id: number,
  staffId: number,
  attendanceDate: Date,
  checkInTime: Date,
  status: string
}
```
**Errors:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 409 (Already Checked In)

#### POST /staff/attendance/checkout
**Purpose:** Check out a staff member
**Parameters:** 
```typescript
{
  staffId: number,
  checkOutTime?: Date, // Optional, defaults to current time
  notes?: string
}
```
**Response:** 
```typescript
{
  id: number,
  staffId: number,
  attendanceDate: Date,
  checkInTime: Date,
  checkOutTime: Date,
  totalHours: number,
  overtimeHours: number,
  status: string
}
```
**Errors:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (No Check In Found)

#### GET /staff/attendance
**Purpose:** Get attendance records with filtering
**Parameters:** 
- `staffId` (optional): Filter by staff member
- `startDate` (optional): Start date for range
- `endDate` (optional): End date for range
- `status` (optional): Filter by attendance status
- `page` (optional): Page number
- `limit` (optional): Items per page
**Response:** 
```typescript
{
  attendance: AttendanceRecord[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```
**Errors:** 401 (Unauthorized), 403 (Forbidden)

#### GET /staff/attendance/reports
**Purpose:** Generate attendance reports
**Parameters:** 
- `staffId` (optional): Filter by staff member
- `startDate`: Start date for report
- `endDate`: End date for report
- `format`: 'json' | 'csv' | 'excel'
**Response:** Report data or file download
**Errors:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden)

### Salary Management Endpoints

#### GET /staff/salary/:staffId
**Purpose:** Get salary information for a staff member
**Parameters:** None
**Response:** 
```typescript
{
  staffId: number,
  currentSalary: SalaryComponent,
  salaryHistory: SalaryComponent[],
  payslips: PayslipSummary[]
}
```
**Errors:** 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)

#### POST /staff/salary/:staffId
**Purpose:** Set salary components for a staff member
**Parameters:** 
```typescript
{
  baseSalaryCents: number,
  hourlyRateCents?: number,
  overtimeRateCents?: number,
  bonusCents?: number,
  allowanceCents?: number,
  deductionCents?: number,
  effectiveFrom: Date,
  effectiveTo?: Date
}
```
**Response:** SalaryComponent object
**Errors:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)

#### POST /staff/payslips/generate
**Purpose:** Generate payslips for a period
**Parameters:** 
```typescript
{
  staffIds?: number[], // Optional, defaults to all staff
  payPeriodStart: Date,
  payPeriodEnd: Date,
  generatePdfs: boolean
}
```
**Response:** 
```typescript
{
  generatedPayslips: number,
  payslips: PayslipInfo[]
}
```
**Errors:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden)

#### GET /staff/payslips/:id/download
**Purpose:** Download a payslip PDF
**Parameters:** None
**Response:** PDF file download
**Errors:** 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)

#### GET /staff/payslips
**Purpose:** List payslips with filtering
**Parameters:** 
- `staffId` (optional): Filter by staff member
- `startDate` (optional): Start date for range
- `endDate` (optional): End date for range
- `status` (optional): Filter by payslip status
- `page` (optional): Page number
- `limit` (optional): Items per page
**Response:** 
```typescript
{
  payslips: PayslipInfo[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```
**Errors:** 401 (Unauthorized), 403 (Forbidden)

### Enhanced Schedule Management Endpoints

#### GET /staff/schedules
**Purpose:** List schedules with enhanced filtering
**Parameters:** 
- `staffId` (optional): Filter by staff member
- `propertyId` (optional): Filter by property
- `startDate` (optional): Start date for range
- `endDate` (optional): End date for range
- `status` (optional): Filter by schedule status
- `page` (optional): Page number
- `limit` (optional): Items per page
**Response:** 
```typescript
{
  schedules: ScheduleInfo[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```
**Errors:** 401 (Unauthorized), 403 (Forbidden)

#### POST /staff/schedules/:id/complete
**Purpose:** Mark a schedule as completed
**Parameters:** 
```typescript
{
  actualStartTime?: Date,
  actualEndTime?: Date,
  completionNotes?: string
}
```
**Response:** Updated ScheduleInfo object
**Errors:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)

#### POST /staff/schedules/change-request
**Purpose:** Request a schedule change
**Parameters:** 
```typescript
{
  originalScheduleId: number,
  requestedDate: Date,
  requestedStartTime?: string,
  requestedEndTime?: string,
  reason: string
}
```
**Response:** ScheduleChangeRequest object
**Errors:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)

#### POST /staff/schedules/change-request/:id/approve
**Purpose:** Approve or reject a schedule change request
**Parameters:** 
```typescript
{
  approved: boolean,
  adminNotes?: string
}
```
**Response:** 
```typescript
{
  success: boolean,
  changeRequestId: number,
  status: string
}
```
**Errors:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)

### Enhanced Leave Management Endpoints

#### GET /staff/leave-requests
**Purpose:** List leave requests with enhanced filtering
**Parameters:** 
- `staffId` (optional): Filter by staff member
- `status` (optional): Filter by request status
- `leaveType` (optional): Filter by leave type
- `startDate` (optional): Start date for range
- `endDate` (optional): End date for range
- `page` (optional): Page number
- `limit` (optional): Items per page
**Response:** 
```typescript
{
  leaveRequests: LeaveRequestInfo[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```
**Errors:** 401 (Unauthorized), 403 (Forbidden)

#### POST /staff/leave-requests
**Purpose:** Create a leave request (existing endpoint, enhanced)
**Parameters:** 
```typescript
{
  leaveType: 'vacation' | 'sick' | 'personal' | 'emergency',
  startDate: Date,
  endDate: Date,
  reason?: string,
  isEmergency?: boolean
}
```
**Response:** LeaveRequestInfo object
**Errors:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 409 (Overlapping Request)

#### POST /staff/leave/:id/approve
**Purpose:** Approve or reject a leave request (existing endpoint, enhanced)
**Parameters:** 
```typescript
{
  approved: boolean,
  adminNotes?: string
}
```
**Response:** 
```typescript
{
  success: boolean,
  leaveRequestId: number,
  status: string
}
```
**Errors:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)

## Data Types

### StaffInfo
```typescript
interface StaffInfo {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  propertyId?: number;
  propertyName?: string;
  department: string;
  hourlyRateCents: number;
  baseSalaryCents: number;
  performanceRating: number;
  hireDate?: Date;
  notes?: string;
  status: string;
  salaryType: 'hourly' | 'monthly' | 'daily';
  attendanceTrackingEnabled: boolean;
  leaveBalance: number;
}
```

### AttendanceRecord
```typescript
interface AttendanceRecord {
  id: number;
  staffId: number;
  staffName: string;
  attendanceDate: Date;
  checkInTime?: Date;
  checkOutTime?: Date;
  totalHours: number;
  overtimeHours: number;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'leave';
  notes?: string;
}
```

### SalaryComponent
```typescript
interface SalaryComponent {
  id: number;
  staffId: number;
  baseSalaryCents: number;
  hourlyRateCents: number;
  overtimeRateCents: number;
  bonusCents: number;
  allowanceCents: number;
  deductionCents: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
}
```

### PayslipInfo
```typescript
interface PayslipInfo {
  id: number;
  staffId: number;
  staffName: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  baseSalaryCents: number;
  overtimePayCents: number;
  bonusCents: number;
  allowanceCents: number;
  deductionCents: number;
  totalEarningsCents: number;
  netPayCents: number;
  hoursWorked: number;
  overtimeHours: number;
  daysPresent: number;
  daysAbsent: number;
  leaveDays: number;
  status: 'draft' | 'generated' | 'paid';
  pdfFilePath?: string;
  generatedAt?: Date;
}
```

### ScheduleInfo
```typescript
interface ScheduleInfo {
  id: number;
  staffId: number;
  staffName: string;
  propertyId: number;
  propertyName: string;
  shiftDate: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  actualStartTime?: Date;
  actualEndTime?: Date;
  actualHours: number;
  completionNotes?: string;
  isCompleted: boolean;
  notes?: string;
}
```

### ScheduleChangeRequest
```typescript
interface ScheduleChangeRequest {
  id: number;
  staffId: number;
  staffName: string;
  originalScheduleId: number;
  requestedDate: Date;
  requestedStartTime?: string;
  requestedEndTime?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedByUserId?: number;
  approvedByName?: string;
  approvedAt?: Date;
  adminNotes?: string;
  createdAt: Date;
}
```

### LeaveRequestInfo
```typescript
interface LeaveRequestInfo {
  id: number;
  staffId: number;
  staffName: string;
  leaveType: 'vacation' | 'sick' | 'personal' | 'emergency';
  startDate: Date;
  endDate: Date;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  isEmergency: boolean;
  leaveBalanceBefore?: number;
  leaveBalanceAfter?: number;
  approvedByUserId?: number;
  approvedByName?: string;
  approvedAt?: Date;
  adminNotes?: string;
  createdAt: Date;
}
```

## Error Handling

### Standard Error Response
```typescript
interface APIError {
  code: string;
  message: string;
  details?: any;
}
```

### Common Error Codes
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `BAD_REQUEST`: Invalid request data
- `CONFLICT`: Resource already exists or conflicts
- `VALIDATION_ERROR`: Input validation failed
- `INTERNAL_ERROR`: Server error

## Encore Framework Compliance

### Required Imports and Patterns
```typescript
// All backend endpoints must include:
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

// Standard endpoint pattern:
export const endpointName = api<RequestType, ResponseType>(
  { auth: true, expose: true, method: "HTTP_METHOD", path: "/path" },
  async (req) => {
    const authData = getAuthData();
    requireRole("ADMIN", "MANAGER")(authData);
    
    const tx = await staffDB.begin();
    try {
      // Implementation with org_id isolation
      await tx.commit();
      return response;
    } catch (error) {
      await tx.rollback();
      if (error instanceof APIError) throw error;
      throw APIError.internal("Operation failed");
    }
  }
);
```

### Database Query Patterns
```typescript
// Always include org_id in queries:
const result = await tx.queryRow`
  SELECT * FROM table_name 
  WHERE org_id = ${authData.orgId} AND other_conditions = ${value}
`;

// Use parameterized queries (template literals):
const results = await tx.queryAll`
  SELECT * FROM table_name 
  WHERE org_id = ${authData.orgId} 
  AND column = ${param1} 
  AND other_column = ${param2}
`;
```

### Error Handling Patterns
```typescript
// Standard error handling:
try {
  // Business logic
} catch (error) {
  if (error instanceof APIError) {
    throw error; // Re-throw APIError instances
  }
  console.error('Operation error:', error);
  throw APIError.internal("Operation failed");
}
```

## Authentication & Authorization

### Role-Based Access Control
- **ADMIN**: Full access to all endpoints
- **MANAGER**: Limited access to staff under their properties
- **STAFF**: Access to own data only

### Permission Matrix
| Endpoint | ADMIN | MANAGER | STAFF |
|----------|-------|---------|-------|
| Staff CRUD | ✅ | ❌ | ❌ |
| Attendance (All) | ✅ | ✅ (Own Property) | ✅ (Own Only) |
| Salary Management | ✅ | ❌ | ✅ (View Own) |
| Schedule Management | ✅ | ✅ (Own Property) | ✅ (Own Only) |
| Leave Requests | ✅ | ✅ (Own Property) | ✅ (Own Only) |
| Reports | ✅ | ✅ (Own Property) | ❌ |

## Rate Limiting
- **Standard endpoints**: 100 requests per minute
- **Report generation**: 10 requests per minute
- **File downloads**: 20 requests per minute
- **Bulk operations**: 5 requests per minute

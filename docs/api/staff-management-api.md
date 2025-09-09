# Staff Management API Documentation

## Overview

The Staff Management API provides comprehensive endpoints for managing staff members, attendance, salary, schedules, and leave requests in the hospitality management platform. All endpoints follow RESTful conventions and require proper authentication.

## Base URL

```
https://api.hospitality-platform.com
```

## Authentication

All API endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Response Format

All responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

## Error Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { ... }
  }
}
```

---

## Staff Management Endpoints

### 1. List Staff Members

**GET** `/api/staff`

Retrieve a paginated list of staff members with optional filtering.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `search` | string | No | Search by name or email |
| `role` | string | No | Filter by role (ADMIN, MANAGER, STAFF) |
| `department` | string | No | Filter by department |
| `isActive` | boolean | No | Filter by active status |
| `orgId` | string | No | Organization ID (auto-injected) |

#### Response

```json
{
  "success": true,
  "data": {
    "staff": [
      {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "role": "MANAGER",
        "department": "Operations",
        "isActive": true,
        "createdAt": "2023-01-01T00:00:00Z",
        "updatedAt": "2023-01-01T00:00:00Z"
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### 2. Create Staff Member

**POST** `/api/staff`

Create a new staff member.

#### Request Body

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "MANAGER",
  "department": "Operations",
  "isActive": true
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "MANAGER",
    "department": "Operations",
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00Z"
  },
  "message": "Staff member created successfully"
}
```

### 3. Update Staff Member

**PUT** `/api/staff/{id}`

Update an existing staff member.

#### Request Body

```json
{
  "name": "John Smith",
  "email": "john.smith@example.com",
  "role": "MANAGER",
  "department": "Operations",
  "isActive": true
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Smith",
    "email": "john.smith@example.com",
    "role": "MANAGER",
    "department": "Operations",
    "isActive": true,
    "updatedAt": "2023-01-01T00:00:00Z"
  },
  "message": "Staff member updated successfully"
}
```

### 4. Delete Staff Member

**DELETE** `/api/staff/{id}`

Delete a staff member (soft delete).

#### Response

```json
{
  "success": true,
  "message": "Staff member deleted successfully"
}
```

---

## Attendance Management Endpoints

### 1. List Attendance Records

**GET** `/api/staff/attendance`

Retrieve attendance records with filtering options.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `staffId` | integer | No | Filter by staff member ID |
| `date` | string | No | Filter by date (YYYY-MM-DD) |
| `status` | string | No | Filter by status (present, absent, late) |
| `orgId` | string | No | Organization ID (auto-injected) |

#### Response

```json
{
  "success": true,
  "data": {
    "attendance": [
      {
        "id": 1,
        "staffId": 1,
        "staffName": "John Doe",
        "checkInTime": "2023-12-01T09:00:00Z",
        "checkOutTime": "2023-12-01T17:00:00Z",
        "status": "present",
        "totalHours": 8,
        "date": "2023-12-01",
        "notes": "Regular shift"
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### 2. Check In

**POST** `/api/staff/attendance/checkin`

Record staff check-in.

#### Request Body

```json
{
  "staffId": 1,
  "notes": "Regular shift start"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "staffId": 1,
    "checkInTime": "2023-12-01T09:00:00Z",
    "status": "present",
    "date": "2023-12-01"
  },
  "message": "Check-in recorded successfully"
}
```

### 3. Check Out

**POST** `/api/staff/attendance/checkout`

Record staff check-out.

#### Request Body

```json
{
  "attendanceId": 1,
  "notes": "Regular shift end"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "staffId": 1,
    "checkInTime": "2023-12-01T09:00:00Z",
    "checkOutTime": "2023-12-01T17:00:00Z",
    "status": "present",
    "totalHours": 8,
    "date": "2023-12-01"
  },
  "message": "Check-out recorded successfully"
}
```

---

## Salary Management Endpoints

### 1. List Salary Components

**GET** `/api/staff/salary/components`

Retrieve salary components for staff members.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `staffId` | integer | No | Filter by staff member ID |
| `componentType` | string | No | Filter by component type |
| `isActive` | boolean | No | Filter by active status |
| `orgId` | string | No | Organization ID (auto-injected) |

#### Response

```json
{
  "success": true,
  "data": {
    "salaryComponents": [
      {
        "id": 1,
        "staffId": 1,
        "staffName": "John Doe",
        "componentType": "base_salary",
        "amountCents": 500000,
        "effectiveDate": "2023-01-01",
        "isActive": true,
        "createdAt": "2023-01-01T00:00:00Z"
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### 2. Create Salary Component

**POST** `/api/staff/salary/components`

Create a new salary component.

#### Request Body

```json
{
  "staffId": 1,
  "componentType": "base_salary",
  "amountCents": 500000,
  "effectiveDate": "2023-01-01",
  "description": "Base monthly salary"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "staffId": 1,
    "componentType": "base_salary",
    "amountCents": 500000,
    "effectiveDate": "2023-01-01",
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00Z"
  },
  "message": "Salary component created successfully"
}
```

### 3. Generate Payslip

**POST** `/api/staff/salary/payslips/generate`

Generate a payslip for a staff member.

#### Request Body

```json
{
  "staffId": 1,
  "payPeriodStart": "2023-12-01",
  "payPeriodEnd": "2023-12-31"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "staffId": 1,
    "payPeriodStart": "2023-12-01",
    "payPeriodEnd": "2023-12-31",
    "grossPayCents": 500000,
    "deductionsCents": 50000,
    "netPayCents": 450000,
    "status": "generated",
    "pdfUrl": "https://api.hospitality-platform.com/payslips/1.pdf",
    "generatedAt": "2023-12-31T00:00:00Z"
  },
  "message": "Payslip generated successfully"
}
```

---

## Schedule Management Endpoints

### 1. List Schedules

**GET** `/api/staff/schedules`

Retrieve staff schedules with filtering options.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `staffId` | integer | No | Filter by staff member ID |
| `shiftDate` | string | No | Filter by shift date (YYYY-MM-DD) |
| `status` | string | No | Filter by status (scheduled, completed, cancelled) |
| `orgId` | string | No | Organization ID (auto-injected) |

#### Response

```json
{
  "success": true,
  "data": {
    "schedules": [
      {
        "id": 1,
        "staffId": 1,
        "staffName": "John Doe",
        "shiftDate": "2023-12-01",
        "startTime": "09:00:00",
        "endTime": "17:00:00",
        "shiftType": "day_shift",
        "status": "scheduled",
        "isCompleted": false,
        "createdAt": "2023-11-30T00:00:00Z"
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### 2. Create Schedule

**POST** `/api/staff/schedules`

Create a new schedule for a staff member.

#### Request Body

```json
{
  "staffId": 1,
  "shiftDate": "2023-12-01",
  "startTime": "09:00:00",
  "endTime": "17:00:00",
  "shiftType": "day_shift",
  "notes": "Regular day shift"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "staffId": 1,
    "shiftDate": "2023-12-01",
    "startTime": "09:00:00",
    "endTime": "17:00:00",
    "shiftType": "day_shift",
    "status": "scheduled",
    "isCompleted": false,
    "createdAt": "2023-11-30T00:00:00Z"
  },
  "message": "Schedule created successfully"
}
```

### 3. Mark Schedule Complete

**PUT** `/api/staff/schedules/{id}/complete`

Mark a schedule as completed.

#### Request Body

```json
{
  "actualStartTime": "09:00:00",
  "actualEndTime": "17:00:00",
  "notes": "Completed successfully"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "completed",
    "isCompleted": true,
    "actualStartTime": "09:00:00",
    "actualEndTime": "17:00:00",
    "completedAt": "2023-12-01T17:00:00Z"
  },
  "message": "Schedule marked as completed"
}
```

---

## Leave Management Endpoints

### 1. List Leave Requests

**GET** `/api/staff/leave/requests`

Retrieve leave requests with filtering options.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `staffId` | integer | No | Filter by staff member ID |
| `status` | string | No | Filter by status (pending, approved, rejected) |
| `leaveType` | string | No | Filter by leave type |
| `orgId` | string | No | Organization ID (auto-injected) |

#### Response

```json
{
  "success": true,
  "data": {
    "leaveRequests": [
      {
        "id": 1,
        "staffId": 1,
        "staffName": "John Doe",
        "leaveType": "annual_leave",
        "startDate": "2023-12-15",
        "endDate": "2023-12-17",
        "totalDays": 3,
        "reason": "Family vacation",
        "status": "pending",
        "requestedAt": "2023-12-01T00:00:00Z",
        "isEmergency": false
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### 2. Create Leave Request

**POST** `/api/staff/leave/requests`

Create a new leave request.

#### Request Body

```json
{
  "staffId": 1,
  "leaveType": "annual_leave",
  "startDate": "2023-12-15",
  "endDate": "2023-12-17",
  "reason": "Family vacation",
  "isEmergency": false
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "staffId": 1,
    "leaveType": "annual_leave",
    "startDate": "2023-12-15",
    "endDate": "2023-12-17",
    "totalDays": 3,
    "reason": "Family vacation",
    "status": "pending",
    "requestedAt": "2023-12-01T00:00:00Z",
    "isEmergency": false
  },
  "message": "Leave request created successfully"
}
```

### 3. Approve Leave Request

**PUT** `/api/staff/leave/requests/{id}/approve`

Approve a leave request.

#### Request Body

```json
{
  "notes": "Approved for family vacation"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "approved",
    "reviewedAt": "2023-12-02T00:00:00Z",
    "reviewedBy": "Admin",
    "notes": "Approved for family vacation"
  },
  "message": "Leave request approved successfully"
}
```

### 4. Reject Leave Request

**PUT** `/api/staff/leave/requests/{id}/reject`

Reject a leave request.

#### Request Body

```json
{
  "reason": "Insufficient leave balance"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "rejected",
    "reviewedAt": "2023-12-02T00:00:00Z",
    "reviewedBy": "Admin",
    "reason": "Insufficient leave balance"
  },
  "message": "Leave request rejected"
}
```

---

## Statistics and Reports Endpoints

### 1. Get Staff Statistics

**GET** `/api/staff/statistics`

Retrieve comprehensive staff statistics.

#### Response

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalStaff": 50,
      "activeStaff": 45,
      "totalAttendance": 1200,
      "presentToday": 42
    },
    "attendance": {
      "averageHoursPerDay": 8.2,
      "punctualityRate": 0.95,
      "absenteeismRate": 0.05
    },
    "salary": {
      "totalMonthlyPayroll": 25000000,
      "averageSalary": 500000,
      "salaryGrowthRate": 0.08
    },
    "leave": {
      "totalLeaveRequests": 120,
      "approvalRate": 0.85,
      "averageLeaveDays": 3.2
    }
  }
}
```

### 2. Export Attendance Report

**GET** `/api/staff/reports/attendance/export`

Export attendance data in various formats.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | string | Yes | Export format (csv, excel, pdf) |
| `startDate` | string | Yes | Start date (YYYY-MM-DD) |
| `endDate` | string | Yes | End date (YYYY-MM-DD) |
| `staffId` | integer | No | Filter by staff member ID |

#### Response

```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://api.hospitality-platform.com/reports/attendance_2023-12-01_2023-12-31.csv",
    "expiresAt": "2023-12-31T23:59:59Z"
  },
  "message": "Attendance report exported successfully"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid input data |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource already exists |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

---

## Rate Limiting

- **General endpoints**: 100 requests per minute
- **Report generation**: 10 requests per minute
- **Bulk operations**: 5 requests per minute

---

## Webhooks

The API supports webhooks for real-time notifications:

### Events

- `staff.created` - New staff member created
- `staff.updated` - Staff member updated
- `attendance.checked_in` - Staff checked in
- `attendance.checked_out` - Staff checked out
- `leave.requested` - Leave request submitted
- `leave.approved` - Leave request approved
- `leave.rejected` - Leave request rejected

### Webhook Payload

```json
{
  "event": "staff.created",
  "timestamp": "2023-12-01T00:00:00Z",
  "data": {
    "staffId": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

---

## SDKs and Examples

### JavaScript/TypeScript

```typescript
import { StaffManagementAPI } from '@hospitality-platform/staff-api';

const api = new StaffManagementAPI({
  baseURL: 'https://api.hospitality-platform.com',
  apiKey: 'your-api-key'
});

// List staff members
const staff = await api.staff.list({
  page: 1,
  limit: 10,
  role: 'MANAGER'
});

// Create new staff member
const newStaff = await api.staff.create({
  name: 'John Doe',
  email: 'john@example.com',
  role: 'MANAGER',
  department: 'Operations'
});
```

### Python

```python
from hospitality_platform import StaffManagementAPI

api = StaffManagementAPI(
    base_url='https://api.hospitality-platform.com',
    api_key='your-api-key'
)

# List staff members
staff = api.staff.list(page=1, limit=10, role='MANAGER')

# Create new staff member
new_staff = api.staff.create(
    name='John Doe',
    email='john@example.com',
    role='MANAGER',
    department='Operations'
)
```

---

## Support

For API support and questions:

- **Email**: api-support@hospitality-platform.com
- **Documentation**: https://docs.hospitality-platform.com
- **Status Page**: https://status.hospitality-platform.com

# Staff API Versioning Audit

**Generated:** 2025-11-25  
**Status:** 🎯 Auditing for 100% Coverage

---

## Executive Summary

The staff service has **54 endpoints** across 44 files with **partial versioning** (6 endpoints have V1 versions). This is the **largest service** with 48 endpoints still needing versioning.

---

## Versioning Status Overview

### ✅ **Already Versioned Endpoints (6 endpoints)**

These endpoints have BOTH legacy and V1 versions:

#### **Export Functions (6 endpoints):**
| Legacy Endpoint | V1 Endpoint | Legacy Path | V1 Path |
|----------------|-------------|-------------|---------|
| `exportLeavev2` | `exportLeaveV1` | `/staff/v2/leave/export` | `/v1/staff/export/leave` |
| `exportAttendancev2` | `exportAttendanceV1` | `/staff/v2/attendance/export` | `/v1/staff/export/attendance` |
| `exportSalaryv2` | `exportSalaryV1` | `/staff/v2/salary/export` | `/v1/staff/export/salary` |

---

### 🔴 **Missing V1 Versions - User-Facing Endpoints (48 endpoints)**

These are primary user-facing endpoints that need V1 versions:

#### **CRUD Operations (6 endpoints):**
| Endpoint | Current Path | Required V1 Path | Priority |
|----------|-------------|------------------|----------|
| `create` | `POST /staff` | `POST /v1/staff` | 🔴 HIGH |
| `list` | `GET /staff` | `GET /v1/staff` | 🔴 HIGH |
| `update` | `PUT /staff/update` | `PUT /v1/staff/update` | 🔴 HIGH |
| `updateSimple` | `PUT /staff/update-simple` | `PUT /v1/staff/update-simple` | 🔴 HIGH |
| `deleteStaff` | `DELETE /staff/:id` | `DELETE /v1/staff/:id` | 🔴 HIGH |
| `search` | `POST /staff/search` | `POST /v1/staff/search` | 🔴 HIGH |

#### **Staff Updates (4 endpoints):**
| Endpoint | Current Path | Required V1 Path | Priority |
|----------|-------------|------------------|----------|
| `updateStatus` | `PUT /staff/:staffId/status` | `PUT /v1/staff/:staffId/status` | 🔴 HIGH |
| `updateDepartment` | `PUT /staff/:staffId/department` | `PUT /v1/staff/:staffId/department` | 🔴 HIGH |
| `updatePerformance` | `PUT /staff/:staffId/performance` | `PUT /v1/staff/:staffId/performance` | 🔴 HIGH |
| `assignProperty` | `POST /staff/assign-property` | `POST /v1/staff/assign-property` | 🔴 HIGH |

#### **Attendance Management (5 endpoints):**
| Endpoint | Current Path | Required V1 Path | Priority |
|----------|-------------|------------------|----------|
| `checkIn` | `POST /staff/:staffId/check-in` | `POST /v1/staff/:staffId/check-in` | 🔴 HIGH |
| `checkOut` | `POST /staff/:staffId/check-out` | `POST /v1/staff/:staffId/check-out` | 🔴 HIGH |
| `listAttendance` | `GET /staff/attendance` | `GET /v1/staff/attendance` | 🔴 HIGH |
| `updateAttendance` | `PUT /staff/attendance/:attendanceId` | `PUT /v1/staff/attendance/:attendanceId` | 🔴 HIGH |
| `validateAttendance` | `POST /staff/attendance/validate` | `POST /v1/staff/attendance/validate` | 🟡 MEDIUM |

#### **Leave Management (8 endpoints):**
| Endpoint | Current Path | Required V1 Path | Priority |
|----------|-------------|------------------|----------|
| `requestLeave` | `POST /staff/leave-requests` | `POST /v1/staff/leave-requests` | 🔴 HIGH |
| `listLeaveRequests` | `GET /staff/leave-requests` | `GET /v1/staff/leave-requests` | 🔴 HIGH |
| `approveLeaveRequest` | `POST /staff/leave-requests/approve` | `POST /v1/staff/leave-requests/approve` | 🔴 HIGH |
| `approveLeave` | `POST /staff/leave/approve` | `POST /v1/staff/leave/approve` | 🔴 HIGH |
| `createEmergencyLeave` | `POST /staff/emergency-leave` | `POST /v1/staff/emergency-leave` | 🔴 HIGH |
| `approveEmergencyLeave` | `POST /staff/emergency-leave/approve` | `POST /v1/staff/emergency-leave/approve` | 🔴 HIGH |
| `getLeaveBalance` | `GET /staff/:staffId/leave-balance` | `GET /v1/staff/:staffId/leave-balance` | 🔴 HIGH |
| `updateLeaveBalance` | `PUT /staff/:staffId/leave-balance` | `PUT /v1/staff/:staffId/leave-balance` | 🔴 HIGH |

#### **Schedule Management (6 endpoints):**
| Endpoint | Current Path | Required V1 Path | Priority |
|----------|-------------|------------------|----------|
| `createSchedule` | `POST /staff/schedules` | `POST /v1/staff/schedules` | 🔴 HIGH |
| `listSchedules` | `GET /staff/schedules` | `GET /v1/staff/schedules` | 🔴 HIGH |
| `markScheduleCompletion` | `PUT /staff/schedules/:scheduleId/completion` | `PUT /v1/staff/schedules/:scheduleId/completion` | 🔴 HIGH |
| `createScheduleChangeRequest` | `POST /staff/schedule-change-requests` | `POST /v1/staff/schedule-change-requests` | 🔴 HIGH |
| `listScheduleChangeRequests` | `GET /staff/schedule-change-requests` | `GET /v1/staff/schedule-change-requests` | 🔴 HIGH |
| `approveScheduleChangeRequest` | `POST /staff/schedule-change-requests/approve` | `POST /v1/staff/schedule-change-requests/approve` | 🔴 HIGH |

#### **Salary & Payroll (8 endpoints):**
| Endpoint | Current Path | Required V1 Path | Priority |
|----------|-------------|------------------|----------|
| `calculateSalary` | `POST /staff/calculate-salary` | `POST /v1/staff/calculate-salary` | 🔴 HIGH |
| `createSalaryComponent` | `POST /staff/salary-components` | `POST /v1/staff/salary-components` | 🔴 HIGH |
| `listSalaryComponents` | `GET /staff/salary-components` | `GET /v1/staff/salary-components` | 🔴 HIGH |
| `generatePayslip` | `POST /staff/generate-payslip` | `POST /v1/staff/generate-payslip` | 🔴 HIGH |
| `listPayslips` | `GET /staff/payslips` | `GET /v1/staff/payslips` | 🔴 HIGH |
| `getPayslip` | `GET /staff/payslips/:payslipId` | `GET /v1/staff/payslips/:payslipId` | 🔴 HIGH |
| `updatePayslipStatus` | `PUT /staff/payslips/:payslipId/status` | `PUT /v1/staff/payslips/:payslipId/status` | 🔴 HIGH |
| `validateSalary` | `POST /staff/salary/validate` | `POST /v1/staff/salary/validate` | 🟡 MEDIUM |

#### **Statistics & Reports (5 endpoints):**
| Endpoint | Current Path | Required V1 Path | Priority |
|----------|-------------|------------------|----------|
| `getStatistics` | `GET /staff/statistics` | `GET /v1/staff/statistics` | 🔴 HIGH |
| `getAttendanceStatistics` | `GET /staff/attendance/statistics` | `GET /v1/staff/attendance/statistics` | 🔴 HIGH |
| `getLeaveStatistics` | `GET /staff/leave/statistics` | `GET /v1/staff/leave/statistics` | 🔴 HIGH |
| `getScheduleStatistics` | `GET /staff/schedules/statistics` | `GET /v1/staff/schedules/statistics` | 🔴 HIGH |
| `getSalaryStatistics` | `GET /staff/salary/statistics` | `GET /v1/staff/salary/statistics` | 🔴 HIGH |

#### **Validation Endpoints (3 endpoints):**
| Endpoint | Current Path | Required V1 Path | Priority |
|----------|-------------|------------------|----------|
| `validateAttendance` | `POST /staff/attendance/validate` | `POST /v1/staff/attendance/validate` | 🟡 MEDIUM |
| `validateLeaveRequest` | `POST /staff/leave/validate` | `POST /v1/staff/leave/validate` | 🟡 MEDIUM |
| `validateSchedule` | `POST /staff/schedules/validate` | `POST /v1/staff/schedules/validate` | 🟡 MEDIUM |

#### **Legacy Export Endpoints (3 endpoints):**
| Endpoint | Current Path | Required V1 Path | Priority |
|----------|-------------|------------------|----------|
| `exportLeave` | `POST /staff/leave/export` | N/A (superseded by V1) | 🟢 LOW |
| `exportAttendance` | `POST /staff/attendance/export` | N/A (superseded by V1) | 🟢 LOW |
| `exportSalary` | `POST /staff/salary/export` | N/A (superseded by V1) | 🟢 LOW |

---

### ⚙️ **Admin/Debug Endpoints (1 endpoint - DEFERRED)**

| Endpoint | Path | Purpose |
|----------|------|---------|
| `fixSchema` | `POST /staff/fix-schema` | Schema maintenance (admin only) |

---

## Summary Statistics

| Category | Count | Percentage |
|----------|-------|------------|
| **Total Endpoints** | 54 | 100% |
| **User-Facing Endpoints** | 51 | 94% |
| **✅ Already Versioned** | 6 | 12% (of user-facing) |
| **🔴 Missing V1** | 48 | 94% (of user-facing) |
| **⚙️ Admin/Debug (Deferred)** | 1 | 2% |

---

## Current Status: 12% → Target: 100%

To achieve 100% versioning coverage for user-facing endpoints, we need to:

1. ✅ Version 48 user-facing endpoints
2. ✅ Update frontend API client with all V1 paths
3. ✅ Generate completion report

---

## Implementation Pattern

All versioned endpoints should follow this pattern:

```typescript
// Shared handler for core logic
async function handlerFunction(req: RequestType): Promise<ResponseType> {
  // Implementation logic
}

// LEGACY: Endpoint description (keep for backward compatibility)
export const legacyEndpoint = api<RequestType, ResponseType>(
  { auth: true, expose: true, method: "POST", path: "/staff/resource" },
  handlerFunction
);

// V1: Endpoint description
export const endpointV1 = api<RequestType, ResponseType>(
  { auth: true, expose: true, method: "POST", path: "/v1/staff/resource" },
  handlerFunction
);
```

---

## Quality Metrics

- ✅ **Zero code duplication** - Use shared handlers
- ✅ **Type safety** - Full TypeScript coverage
- ✅ **Backward compatibility** - Legacy paths continue to work
- ✅ **Consistent naming** - `*V1` suffix for all v1 endpoints

---

## Next Steps

1. **Implement V1 versions** for 48 user-facing endpoints
2. **Update frontend API client** with all V1 paths
3. **Generate 100% completion report**
4. **Test all endpoints** to ensure backward compatibility

---

**Last Updated:** 2025-11-25  
**Target:** 100% User-Facing Endpoint Versioning  
**Current:** 12% (6/51 user-facing endpoints)  
**Work Required:** 48 endpoints - **Largest service to version!**


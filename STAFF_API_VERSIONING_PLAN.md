# Staff API Versioning - Implementation Plan

**Generated:** 2025-11-25  
**Status:** 🚧 In Progress  
**Scale:** **LARGEST SERVICE** - 48 endpoints to version

---

## 🎯 Executive Summary

The staff service is **the largest service** requiring API versioning with:
- **54 total endpoints**
- **51 user-facing endpoints**
- **6 already versioned** (12%)
- **48 endpoints need versioning** (88%)

This is **2.3x larger** than the reports service (which had 16 endpoints) and **6.9x larger** than auth (which had 7 endpoints).

---

## 📋 **Completion Status**

| Category | Endpoints | Status |
|----------|-----------|--------|
| CRUD Operations | 6 | ⏳ In Progress (1/6 done) |
| Staff Updates | 4 | 🔴 Pending |
| Attendance | 5 | 🔴 Pending |
| Leave Management | 8 | 🔴 Pending |
| Schedule Management | 6 | 🔴 Pending |
| Salary & Payroll | 8 | 🔴 Pending |
| Statistics & Reports | 5 | 🔴 Pending |
| Validation | 3 | 🔴 Pending |
| Export (Already Versioned) | 6 | ✅ Complete |
| **TOTAL** | **51** | **7/51 (14%)** |

---

## 🔥 **Files Completed So Far:**

1. ✅ `backend/staff/create.ts` - Added createHandler + createV1
2. ⏳ Remaining 47 files to process...

---

## 📊 **Implementation Strategy**

### **Phase 1: Core CRUD (6 endpoints)**
- ✅ `create.ts` - DONE
- 🔴 `list.ts`
- 🔴 `update.ts`
- 🔴 `update_simple.ts`
- 🔴 `delete.ts`
- 🔴 `search.ts`

### **Phase 2: Staff Updates (4 endpoints)**
- 🔴 `update_status.ts`
- 🔴 `update_department.ts`
- 🔴 `update_performance.ts`
- 🔴 `assign_property.ts`

### **Phase 3: Attendance (5 endpoints)**
- 🔴 `check_in.ts`
- 🔴 `check_out.ts`
- 🔴 `list_attendance.ts`
- 🔴 `update_attendance.ts`
- 🔴 `attendance_validation.ts`

### **Phase 4: Leave Management (8 endpoints)**
- 🔴 `request_leave.ts`
- 🔴 `list_leave_requests.ts`
- 🔴 `approve_leave_request.ts`
- 🔴 `approve_leave.ts`
- 🔴 `emergency_leave.ts` (2 endpoints)
- 🔴 `leave_balance.ts` (2 endpoints)

### **Phase 5: Schedule Management (6 endpoints)**
- 🔴 `create_schedule.ts`
- 🔴 `list_schedules.ts`
- 🔴 `mark_schedule_completion.ts`
- 🔴 `create_schedule_change_request.ts`
- 🔴 `list_schedule_change_requests.ts`
- 🔴 `approve_schedule_change_request.ts`

### **Phase 6: Salary & Payroll (8 endpoints)**
- 🔴 `calculate_salary.ts`
- 🔴 `salary_components.ts` (2 endpoints)
- 🔴 `generate_payslip.ts`
- 🔴 `payslips.ts` (3 endpoints)
- 🔴 `salary_validation.ts`

### **Phase 7: Statistics & Reports (5 endpoints)**
- 🔴 `statistics.ts`
- 🔴 `attendance_statistics.ts`
- 🔴 `leave_statistics.ts`
- 🔴 `schedule_statistics.ts`
- 🔴 `salary_statistics.ts`

### **Phase 8: Validation (3 endpoints)**
- 🔴 `attendance_validation.ts`
- 🔴 `leave_validation.ts`
- 🔴 `schedule_validation.ts`

### **Phase 9: Frontend Update**
- 🔴 Update `frontend/src/utils/api-standardizer.ts` with ~48 new path constants

### **Phase 10: Final**
- 🔴 Generate completion reports
- 🔴 Verify zero linter errors
- 🔴 Test all endpoints

---

## ⏱️ **Estimated Effort**

| Phase | Endpoints | Estimated Time | Status |
|-------|-----------|----------------|--------|
| Phase 1: CRUD | 6 | ~10 min | ⏳ 17% |
| Phase 2: Updates | 4 | ~7 min | 🔴 |
| Phase 3: Attendance | 5 | ~9 min | 🔴 |
| Phase 4: Leave | 8 | ~14 min | 🔴 |
| Phase 5: Schedule | 6 | ~11 min | 🔴 |
| Phase 6: Payroll | 8 | ~14 min | 🔴 |
| Phase 7: Statistics | 5 | ~9 min | 🔴 |
| Phase 8: Validation | 3 | ~5 min | 🔴 |
| Phase 9: Frontend | 1 | ~3 min | 🔴 |
| Phase 10: Final | - | ~5 min | 🔴 |
| **TOTAL** | **48** | **~90 min** | **2%** |

---

## 🎨 **Implementation Pattern**

Each file follows this pattern:

```typescript
// Shared handler
async function handlerFunction(req: RequestType): Promise<ResponseType> {
  // Existing logic moved here
}

// LEGACY: Description (keep for backward compatibility)
export const legacyEndpoint = api<RequestType, ResponseType>(
  { auth: true, expose: true, method: "POST", path: "/staff/resource" },
  handlerFunction
);

// V1: Description
export const endpointV1 = api<RequestType, ResponseType>(
  { auth: true, expose: true, method: "POST", path: "/v1/staff/resource" },
  handlerFunction
);
```

---

## 📈 **Progress Tracking**

```
[█░░░░░░░░░] 7/51 endpoints (14%)
```

**Files completed:** 1/48  
**Time elapsed:** ~2 minutes  
**Time remaining:** ~88 minutes (estimated)

---

## 🚀 **Next Steps**

1. Continue with remaining CRUD endpoints (list, update, updateSimple, delete, search)
2. Process through phases 2-8 systematically
3. Update frontend API client
4. Generate completion reports
5. Achieve 100% coverage!

---

**Last Updated:** 2025-11-25  
**Target:** 100% User-Facing Endpoint Versioning  
**Current:** 14% (7/51 endpoints including exports)  
**Status:** 🚧 **LARGEST SERVICE IN PROGRESS**


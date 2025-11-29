# 🔍 Tasks API Versioning - Complete Audit

## 📊 **Summary**

**Total Endpoints:** 15  
**Already Versioned:** 8 endpoints (53%)  
**Need Versioning:** 4 endpoints (27%)  
**System/Setup (Excluded):** 3 endpoints (20%)

**Target for 100%:** 12/12 user-facing endpoints

---

## ✅ **Already Versioned (8 endpoints)**

These endpoints already have both legacy and `/v1` versions:

1. ✅ **create.ts** - `create`, `createV1`
   - POST `/tasks`
   - POST `/v1/tasks`

2. ✅ **list.ts** - `list`, `listV1`
   - GET `/tasks`
   - GET `/v1/tasks`

3. ✅ **update.ts** - `update`, `updateV1`
   - PATCH `/tasks/:id`
   - PATCH `/v1/tasks/:id`

4. ✅ **delete.ts** - `deleteTask`, `deleteTaskV1`
   - DELETE `/tasks/:id`
   - DELETE `/v1/tasks/:id`

5. ✅ **assign.ts** - `assignTask`, `assignTaskV1`
   - PATCH `/tasks/:id/assign`
   - PATCH `/v1/tasks/:id/assign`

6. ✅ **update_status.ts** - `updateTaskStatus`, `updateTaskStatusV1`
   - PATCH `/tasks/:id/status`
   - PATCH `/v1/tasks/:id/status`

7. ✅ **update_hours.ts** - `updateTaskHours`, `updateTaskHoursV1`
   - PATCH `/tasks/:id/hours`
   - PATCH `/v1/tasks/:id/hours`

8. ✅ **add_attachment.ts** - `addAttachment`, `addAttachmentV1`
   - POST `/tasks/attachments`
   - POST `/v1/tasks/attachments`

---

## 🔴 **Need Versioning (4 endpoints)**

### **images.ts** - All 4 image-related endpoints need V1 versions:

1. ⏳ **uploadTaskImage**
   - Current: POST `/tasks/:taskId/images`
   - Need: POST `/v1/tasks/:taskId/images`

2. ⏳ **listTaskImages**
   - Current: GET `/tasks/:taskId/images`
   - Need: GET `/v1/tasks/:taskId/images`

3. ⏳ **deleteTaskImage**
   - Current: DELETE `/tasks/:taskId/images/:imageId`
   - Need: DELETE `/v1/tasks/:taskId/images/:imageId`

4. ⏳ **setTaskImagePrimary**
   - Current: PUT `/tasks/:taskId/images/:imageId/primary`
   - Need: PUT `/v1/tasks/:taskId/images/:imageId/primary`

---

## ⚙️ **System/Setup Endpoints (Excluded from versioning)**

These are internal system setup endpoints that don't need versioning:

1. ⚙️ **add_storage_location.ts** - `addStorageLocationColumns`
   - POST `/tasks/add-storage-location-columns`
   - Purpose: Database migration/setup

2. ⚙️ **quick_setup_attachments.ts** - `quickSetupAttachments`
   - POST `/tasks/quick-setup-attachments`
   - Purpose: Quick setup utility (auth: false)

3. ⚙️ **setup_task_attachments_table.ts** - `setupTaskAttachmentsTable`
   - POST `/tasks/setup-attachments-table`
   - Purpose: Database table setup

---

## 📋 **Implementation Plan**

### **Phase 1: Images Module (4 endpoints)** ⏳
- Convert `images.ts` to use shared handlers
- Add V1 versions for all 4 endpoints
- Maintain backward compatibility

### **Phase 2: Frontend Update** ⏳
- Update `api-standardizer.ts` with V1 paths for images

### **Phase 3: Verification & Completion** ⏳
- Run lints on all modified files
- Generate 100% completion report

---

## 🎯 **Success Criteria**

- ✅ 12/12 user-facing endpoints versioned (100%)
- ✅ Zero linter errors
- ✅ Backward compatibility maintained
- ✅ Consistent pattern across all endpoints
- ✅ Frontend API client updated

---

## ⏱️ **Estimated Time**

**Total:** ~10 minutes
- Phase 1 (Images): 6 minutes
- Phase 2 (Frontend): 2 minutes
- Phase 3 (Verification): 2 minutes

---

**Ready to achieve 100% coverage!** 🚀


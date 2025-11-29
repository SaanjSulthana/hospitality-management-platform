# 🔍 Branding API Versioning - Complete Audit

## 📊 **Summary**

**Total Endpoints:** 5  
**Already Versioned:** 0 endpoints (0%)  
**Need Versioning:** 5 endpoints (100%)  
**System/Setup (Excluded):** 0 endpoints

**Target for 100%:** 5/5 user-facing endpoints

---

## 🔴 **Need Versioning (5 endpoints)**

All branding endpoints need V1 versions:

### **1. get_theme.ts** - Get organization theme
- ⏳ **getOrgTheme**
  - Current: GET `/branding/theme`
  - Need: GET `/v1/branding/theme`

### **2. update_theme.ts** - Update and cleanup theme (2 endpoints)
- ⏳ **updateOrgTheme**
  - Current: PATCH `/branding/theme`
  - Need: PATCH `/v1/branding/theme`

- ⏳ **cleanupInvalidThemeSettings**
  - Current: POST `/branding/cleanup-theme`
  - Need: POST `/v1/branding/cleanup-theme`

### **3. upload_logo.ts** - Upload organization logo
- ⏳ **uploadLogo**
  - Current: POST `/branding/logo`
  - Need: POST `/v1/branding/logo`

### **4. serve_logo.ts** - Serve logo file
- ⏳ **serveLogo**
  - Current: GET `/branding/logo/:orgId/:filename`
  - Need: GET `/v1/branding/logo/:orgId/:filename`

---

## 📋 **Implementation Plan**

### **Phase 1: Theme Management (3 endpoints)** ⏳
- Convert `get_theme.ts` to use shared handler
- Convert `update_theme.ts` to use shared handlers (2 endpoints)
- Add V1 versions for all 3 endpoints

### **Phase 2: Logo Management (2 endpoints)** ⏳
- Convert `upload_logo.ts` to use shared handler
- Convert `serve_logo.ts` to use shared handler
- Add V1 versions for both endpoints

### **Phase 3: Frontend Update** ⏳
- Update `api-standardizer.ts` with V1 paths

### **Phase 4: Verification & Completion** ⏳
- Run lints on all modified files
- Generate 100% completion report

---

## 🎯 **Success Criteria**

- ✅ 5/5 user-facing endpoints versioned (100%)
- ✅ Zero linter errors
- ✅ Backward compatibility maintained
- ✅ Consistent pattern across all endpoints
- ✅ Frontend API client updated

---

## ⏱️ **Estimated Time**

**Total:** ~12 minutes
- Phase 1 (Theme): 5 minutes
- Phase 2 (Logo): 4 minutes
- Phase 3 (Frontend): 1 minute
- Phase 4 (Verification): 2 minutes

---

## 📁 **Files to Modify**

**Backend (4 files):**
1. `backend/branding/get_theme.ts`
2. `backend/branding/update_theme.ts`
3. `backend/branding/upload_logo.ts`
4. `backend/branding/serve_logo.ts`

**Frontend (1 file):**
1. `frontend/src/utils/api-standardizer.ts`

---

**Ready to achieve 100% coverage!** 🚀


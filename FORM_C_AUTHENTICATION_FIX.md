# Form C Authentication & Database Fix

## 🔧 Issues Fixed

### Issue 1: Incorrect Auth Import ❌
**Error:** `SyntaxError: The requested module 'encore.dev/auth' does not provide an export named 'getAuthData'`

**Root Cause:** Wrong import module for authentication

**Fix Applied:**
```typescript
// ❌ BEFORE (Wrong)
import { getAuthData } from "encore.dev/auth";

// ✅ AFTER (Correct)
import { getAuthData } from "~encore/auth";
```

### Issue 2: Wrong Auth Field ❌
**Root Cause:** Using `auth.userID` to filter by organization

**Fix Applied:**
```typescript
// ❌ BEFORE (Wrong)
WHERE gc.org_id = ${auth.userID}

// ✅ AFTER (Correct)  
WHERE org_id = ${auth.orgId}
```

**Auth Data Structure:**
```typescript
interface AuthData {
  userID: string;    // User ID (not for org filtering)
  orgId: number;     // Organization ID (correct field)
  role: UserRole;
  email: string;
  displayName: string;
  createdByUserId?: number;
}
```

### Issue 3: Cross-Service Database JOIN ❌
**Root Cause:** Attempting to JOIN `properties` table from a different microservice database

**Problem:**
```sql
-- ❌ This fails because properties table is in properties_db, not guest_checkins_db
SELECT gc.*, p.name, p.address, p.city
FROM guest_checkins gc
LEFT JOIN properties p ON gc.property_id = p.id
```

**Fix Applied:**
```sql
-- ✅ Query only guest_checkins table
SELECT *
FROM guest_checkins
WHERE id = ${guestCheckInId} 
  AND org_id = ${auth.orgId}
```

**Workaround for Missing Property Data:**
- Use default values for property fields in Form C
- Add TODO comment to fetch property details via API in future
- Use fallback fields from guest check-in data where available

```typescript
accommodation: {
  name: checkIn.property_name || 'Hotel Name (Add in check-in form)',
  address: checkIn.property_address || checkIn.address || 'Property Address (Add in check-in form)',
  cityDistrict: (checkIn.property_city || checkIn.indian_city_district || 'CITY').toUpperCase(),
  state: (checkIn.property_state || checkIn.indian_state || 'STATE').toUpperCase(),
  starRating: 'Not Rated',
  phoneNo: checkIn.phone || '',
  mobileNo: checkIn.phone || ''
}
```

## 📋 Changes Summary

| File | Changes Made |
|------|--------------|
| `backend/guest-checkin/generate-c-form.ts` | 1. Fixed auth import<br>2. Changed `auth.userID` to `auth.orgId`<br>3. Removed properties table JOIN<br>4. Updated accommodation mapping with defaults |

## ✅ Testing

Run the Encore development server:
```bash
cd backend
encore run
```

Expected output:
```
✔ Building Encore application graph... Done!
✔ Analyzing service topology... Done!
✔ Creating PostgreSQL database cluster... Done!
✔ Starting PubSub daemon... Done!
✔ Starting Object Storage server... Done!
✔ Fetching application secrets... Done!
✔ Running database migrations... Done!
✔ Starting Encore application... Done!

Encore development server running!

Your API is running at:     http://127.0.0.1:4000
Development Dashboard URL:  http://127.0.0.1:9400/hospitality-management-platform-cr8i
```

## 🚀 Next Steps

1. ✅ **Fixed:** Authentication import and usage
2. ✅ **Fixed:** Cross-service database query
3. ⏳ **Future Enhancement:** Fetch property details via API call to properties service
4. ⏳ **Future Enhancement:** Add property name/address fields to guest check-in form

## 📚 Key Learnings

### Encore Authentication Pattern
```typescript
// 1. Import from ~encore/auth (internal module)
import { getAuthData } from "~encore/auth";

// 2. Use in authenticated endpoints
export const myEndpoint = api.raw(
  { auth: true, method: "POST", path: "/my-path" },
  async (req, res) => {
    const auth = getAuthData()!;
    // Access: auth.userID, auth.orgId, auth.role, etc.
  }
);
```

### Microservice Database Boundaries
- Each Encore service has its own database
- Cannot JOIN tables across service boundaries
- Use API calls or service-to-service communication for cross-service data
- Store denormalized data if needed for performance

### Encore Service Architecture
```
backend/
├── auth/           → auth_db (users, sessions)
├── properties/     → properties_db (properties)
├── guest-checkin/  → guest_checkins_db (guest_checkins)
└── finance/        → finance_db (transactions)
```

Each service is **isolated** with its own database!

## 🔐 Security Notes

- Authentication is now properly enforced via `auth: true`
- Organization-level access control via `auth.orgId`
- Users can only access guest check-ins from their own organization
- Returns 404 for unauthorized access (not 403 to avoid information leakage)

---

**Status:** ✅ All issues resolved. Server should start successfully now!


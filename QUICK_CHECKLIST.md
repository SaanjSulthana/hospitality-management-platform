# 🚀 Quick Development Checklist

## ✅ Before Starting New Feature

### Backend Setup
- [ ] Create service directory: `backend/[service-name]/`
- [ ] Create database file: `backend/[service-name]/db.ts`
- [ ] Create encore service: `backend/[service-name]/encore.service.ts`
- [ ] Import `getAuthData` from `~encore/auth`
- [ ] Import `requireRole` from `../auth/middleware`

### Frontend Setup
- [ ] Create page component: `frontend/pages/[PageName].tsx`
- [ ] Import `useAuth` and `getAuthenticatedBackend`
- [ ] Import `useQuery` and `useMutation` from React Query
- [ ] Import `useToast` for notifications

## 🔐 Authentication Checklist

### Backend
- [ ] Use `async (req) =>` signature (NOT `async (req, authData)`)
- [ ] Call `getAuthData()` inside function
- [ ] Validate roles with `requireRole("ADMIN")(authData)`
- [ ] Include `org_id` in all database queries
- [ ] Wrap logic in try-catch blocks

### Frontend
- [ ] Use `getAuthenticatedBackend()` for API calls
- [ ] Check user roles before rendering: `user?.role === 'ADMIN'`
- [ ] Handle authentication errors in `onError`
- [ ] Redirect to login on token expiry

## 🗄️ Database Checklist

### ⚠️ CRITICAL: Database Connection Method
- [ ] **ALWAYS use Encore database shell**: `encore db shell hospitality`
- [ ] **NEVER use Docker direct connection**: `docker exec hospitality-postgres psql...`
- [ ] **Reason**: Encore manages application data, Docker shows raw PostgreSQL
- [ ] **Data isolation**: Application data is organization-specific and requires proper context

### Database Queries
- [ ] All queries include `org_id = $1` parameter
- [ ] Use parameterized queries (NOT string concatenation)
- [ ] Handle database errors gracefully
- [ ] Validate input parameters before queries
- [ ] Use proper database methods: `queryRow`, `queryAll`, `exec`

### Database Testing
- [ ] Test with Encore database shell: `encore db shell hospitality`
- [ ] Verify data exists in application context
- [ ] Check organization-specific data isolation
- [ ] Validate user authentication context

## ⚠️ Error Handling Checklist

### Backend
- [ ] Import and use `APIError` class
- [ ] Wrap main logic in try-catch
- [ ] Re-throw `APIError` instances
- [ ] Convert other errors to `APIError.internal()`
- [ ] Log errors for debugging

### Frontend
- [ ] Handle loading states: `isLoading`
- [ ] Handle error states: `error`
- [ ] Implement comprehensive `onError` handlers
- [ ] Show user-friendly error messages
- [ ] Handle authentication errors separately

## 🎯 API Response Checklist

- [ ] Define TypeScript interfaces for requests/responses
- [ ] Use consistent response structure
- [ ] Include proper error status codes
- [ ] Validate response data
- [ ] Handle empty/null responses

## 🔄 State Management Checklist

- [ ] Use React Query for server state
- [ ] Use local state for UI state
- [ ] Invalidate queries after mutations
- [ ] Handle optimistic updates properly
- [ ] Implement proper loading states

## 🧪 Testing Checklist

- [ ] Test with valid authentication
- [ ] Test with expired tokens
- [ ] Test role-based access control
- [ ] Test error scenarios
- [ ] Test multi-tenant isolation

## 📝 Code Quality Checklist

- [ ] TypeScript types properly defined
- [ ] No `any` types (use proper interfaces)
- [ ] Consistent naming conventions
- [ ] Proper error logging
- [ ] Clean, readable code structure

## 🚨 Common Mistakes to Avoid

### Authentication & API Issues
- ❌ `async (req, authData)` - Use `async (req)` + `getAuthData()`
- ❌ Missing `org_id` in database queries
- ❌ No error handling in try-catch blocks
- ❌ Using expired tokens without refresh
- ❌ Missing role validation
- ❌ No loading/error states
- ❌ Hardcoded values instead of parameters

### Database Connection Issues
- ❌ **Using Docker database connection** - Use `encore db shell hospitality`
- ❌ **Checking "empty" database** - Data exists in Encore context, not Docker
- ❌ **Wrong database shell** - Use `encore db shell hospitality` not `docker exec...`

### API Endpoint Issues
- ❌ **Wrong HTTP method** - Check if endpoint expects GET/POST/PATCH/DELETE
- ❌ **Missing path parameters** - Ensure ID is passed correctly in URL
- ❌ **Incorrect request body format** - Match expected API schema
- ❌ **Missing required fields** - Validate all required parameters

### Frontend Integration Issues
- ❌ **Wrong API call method** - Use correct HTTP method for endpoint
- ❌ **Incorrect parameter passing** - Pass ID as path parameter, not body
- ❌ **Missing error handling** - Always handle API errors gracefully
- ❌ **Stale data issues** - Use proper cache invalidation

## 🔧 Quick Fixes

### If you get "Invalid token" error:
1. Check if token is expired
2. Implement token refresh
3. Clear backend cache
4. Redirect to login

### If you get TypeScript compilation errors:
1. Check API signature: `async (req)` not `async (req, authData)`
2. Import `getAuthData` from `~encore/auth`
3. Use proper error types
4. Check interface definitions

### If you get database errors:
1. Ensure `org_id` is included in queries
2. Use parameterized queries
3. Handle errors gracefully
4. Check database connection

### If you see "empty" database or missing data:
1. **Use correct connection**: `encore db shell hospitality` (NOT Docker)
2. **Check application context**: Data is organization-specific
3. **Verify authentication**: Login with proper credentials
4. **Check organization isolation**: Each org has separate data
5. **Use Encore database shell**: `cd backend && encore db shell hospitality`

### If you get "endpoint not found" errors:
1. **Check HTTP method**: GET vs POST vs PATCH vs DELETE
2. **Verify endpoint URL**: Ensure path matches backend definition
3. **Check path parameters**: ID should be in URL, not body
4. **Verify endpoint exists**: Check backend service files
5. **Check encore.service.ts**: Ensure endpoint is properly exported

### If you get "path parameter is not a valid number" errors:
1. **Check ID format**: Ensure ID is a valid integer
2. **Verify parameter passing**: ID should be in URL path
3. **Check frontend API calls**: Use correct parameter format
4. **Validate data types**: Ensure numbers are not strings
5. **Check optimistic updates**: Filter out invalid IDs

### If you get SQL/database errors:
1. **Check parameter indexing**: SQL parameters start from $1, $2, etc.
2. **Verify column names**: Ensure columns exist in database
3. **Check SQL syntax**: Use proper template literals
4. **Validate data types**: Match database column types
5. **Check foreign key constraints**: Ensure referenced data exists

### If you get role/permission errors:
1. **Check requireRole calls**: Include all necessary roles
2. **Verify role types**: Use 'ADMIN' | 'MANAGER' (not 'SUPER_ADMIN')
3. **Check middleware**: Ensure proper role validation
4. **Verify user roles**: Check database user role values
5. **Update type definitions**: Keep frontend/backend in sync

### If you get "is not a function" errors (Frontend Client Issues):
1. **Check if endpoint exists in backend**: Verify the function is implemented
2. **Check if endpoint is exported**: Ensure it's in `encore.service.ts`
3. **Check generated client**: Look in `frontend/client.ts` for the function
4. **Restart backend**: `cd backend && encore run` to regenerate client
5. **Use direct fetch as workaround**: Call API directly until client regenerates
6. **Check client generation**: Look in `backend/encore.gen/internal/clients/[service]/endpoints.d.ts`

### If you get "path parameter is not a valid number" errors (Client Generation Issues):
1. **Check if function exists in generated client**: The endpoint might not be generated yet
2. **Use direct fetch as immediate fix**: Bypass the generated client entirely
3. **Verify endpoint exists in backend**: Ensure the backend endpoint is properly defined
4. **Check HTTP method and path**: Ensure frontend call matches backend definition
5. **Restart backend to regenerate client**: This is the permanent solution
6. **Apply same pattern for other endpoints**: Use direct fetch for any missing client functions

### If you get "Not Found" errors (ID Type Issues):
1. **Check ID type conversion**: Ensure string IDs are converted to numbers
2. **Add ID validation**: Use `parseInt(id.toString(), 10)` and check `isNaN()`
3. **Check database queries**: Ensure all queries use properly typed IDs
4. **Verify property exists**: Add logging to show available records
5. **Check organization isolation**: Ensure records belong to user's org
6. **Use consistent ID types**: Use the same typed ID throughout the function

### If property updates don't persist in UI (Data Type Issues):
1. **Check JSON field types**: Backend may return JSON fields as strings instead of objects
2. **Parse JSON fields**: Use `JSON.parse()` for string fields in backend responses
3. **Verify data consistency**: Ensure list and update endpoints return same data format
4. **Check frontend expectations**: Frontend expects objects, not JSON strings
5. **Add type checking**: Use `typeof field === 'string'` before parsing
6. **Test data flow**: Verify backend stores and returns correct data types

### If transaction dates show wrong time (Date/Time Issues):
1. **Use current timestamp**: Always use `new Date().toISOString()` for transaction timestamps
2. **Avoid date manipulation**: Don't try to combine user-selected dates with current time
3. **Use helper function**: Create `getCurrentTimestamp()` for consistent timestamp generation
4. **Preserve actual time**: Transactions should show the exact time they were created/updated
5. **Test timestamp accuracy**: Verify transactions show the correct current time
6. **Check timezone handling**: Ensure timestamps are properly formatted for the backend
7. **Fix backend processing**: Backend should use `new Date()` directly, not process user-provided dates
8. **Check both frontend and backend**: Ensure both frontend sends current timestamp and backend uses it correctly
9. **CRITICAL: Check database schema**: Ensure database columns use `TIMESTAMPTZ` not `DATE` for time storage
10. **Fix schema inconsistency**: Expenses and revenues must use same column type for timestamps

### 🚀 Quick Database Schema Diagnosis (Timestamp Issues):
1. **Check column types**: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'table_name'`
2. **Compare similar tables**: If one table works and another doesn't, compare their column definitions
3. **Look for DATE vs TIMESTAMPTZ**: `DATE` only stores date (loses time), `TIMESTAMPTZ` stores full timestamp
4. **Check backend logs**: Look for "using current timestamp" messages to confirm backend is working
5. **Test with new records**: Old records may have wrong timestamps, test with fresh data
6. **Create migration endpoint**: Temporary endpoint to fix schema without manual database access
7. **Verify migration success**: Check schema after migration to confirm column type changed
8. **Clean up migration files**: Remove temporary migration endpoints after successful fix

### 🔧 Quick Database Schema Fixes:
```sql
-- Check current schema
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'expenses' AND column_name = 'expense_date';

-- Fix DATE to TIMESTAMPTZ (5-step process)
ALTER TABLE expenses ADD COLUMN expense_date_new TIMESTAMPTZ;
UPDATE expenses SET expense_date_new = expense_date::TIMESTAMPTZ;
ALTER TABLE expenses ALTER COLUMN expense_date_new SET NOT NULL;
ALTER TABLE expenses DROP COLUMN expense_date;
ALTER TABLE expenses RENAME COLUMN expense_date_new TO expense_date;
```

### 🎯 Quick Migration Endpoint Template:
```typescript
// Temporary endpoint to fix database schema
export const runMigration = api(
  { auth: true, expose: true, method: "POST", path: "/service/run-migration" },
  async () => {
    const authData = getAuthData();
    requireRole("ADMIN")(authData);
    
    const tx = await db.begin();
    try {
      // Check current schema
      const schema = await tx.queryAll`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'your_table' AND column_name = 'your_column'
      `;
      
      // Run migration steps
      await tx.exec`ALTER TABLE your_table ADD COLUMN your_column_new TIMESTAMPTZ`;
      await tx.exec`UPDATE your_table SET your_column_new = your_column::TIMESTAMPTZ`;
      await tx.exec`ALTER TABLE your_table ALTER COLUMN your_column_new SET NOT NULL`;
      await tx.exec`ALTER TABLE your_table DROP COLUMN your_column`;
      await tx.exec`ALTER TABLE your_table RENAME COLUMN your_column_new TO your_column`;
      
      await tx.commit();
      return { message: "Migration completed", schema };
    } catch (error) {
      await tx.rollback();
      throw APIError.internal(`Migration failed: ${error.message}`);
    }
  }
);
```

## 🔍 Advanced Troubleshooting Guide

### Common Error Patterns & Solutions

#### 1. **"Failed to fetch" / "endpoint not found"**
```typescript
// ❌ Wrong - Missing endpoint
const result = await backend.finance.approveRevenue(id, { status });

// ✅ Correct - Check if endpoint exists
const result = await backend.finance.approveRevenueById(id, { status });
```

#### 2. **"path parameter is not a valid number"**
```typescript
// ❌ Wrong - Passing ID in body
updateStatus(id, { status })

// ✅ Correct - ID in path, status in body
updateStatus(id, { status })
```

#### 3. **SQL Parameter Indexing Errors**
```typescript
// ❌ Wrong - Parameter indexing mismatch
WHERE id = $1 AND org_id = $2  // But using $3, $4 in query

// ✅ Correct - Sequential parameter indexing
WHERE id = $1 AND org_id = $2  // Use $1, $2 consistently
```

#### 4. **Role Type Mismatches**
```typescript
// ❌ Wrong - Using removed role
requireRole("ADMIN", "MANAGER", "SUPER_ADMIN")

// ✅ Correct - Only valid roles
requireRole("ADMIN", "MANAGER")
```

#### 5. **Database Connection Confusion**
```bash
# ❌ Wrong - Shows different data
docker exec hospitality-postgres psql -U hospitality_user -d hospitality_platform

# ✅ Correct - Shows application data
cd backend && encore db shell hospitality
```

#### 6. **Frontend Client Generation Issues**
```typescript
// ❌ Error: "backend.properties.deleteProperty is not a function"
const result = await backend.properties.deleteProperty({ id: propertyId });

// ✅ Quick Fix - Use direct fetch call
const response = await fetch(`http://localhost:4000/properties/${propertyId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'Content-Type': 'application/json',
  },
});

// ✅ Permanent Fix - Restart backend to regenerate client
// cd backend && encore run
```

#### 7. **"Path Parameter is not a Valid Number" Errors (Client Generation)**
```typescript
// ❌ Error: "path parameter is not a valid number" - Missing client function
const result = await backend.properties.update(propertyId, updateData);

// ✅ Quick Fix - Use direct fetch call instead of generated client
const response = await fetch(`http://localhost:4000/properties/${propertyId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(updateData),
});

if (!response.ok) {
  throw new Error(`Failed to update property: ${response.statusText}`);
}

const result = await response.json();

// ✅ Permanent Fix - Restart backend to regenerate client
// cd backend && encore run
```

#### 8. **"Not Found" Errors (ID Type Issues)**
```typescript
// ❌ Error: "Property not found" - ID type mismatch
export const deleteProperty = api<DeletePropertyRequest, DeletePropertyResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/properties/:id" },
  async (req) => {
    const { id } = req; // This might be a string from URL params
    
    // Direct usage without type conversion
    const propertyRow = await propertiesDB.queryRow`
      SELECT id, name FROM properties WHERE id = ${id} AND org_id = ${authData.orgId}
    `;
  }
);

// ✅ Correct - Proper ID type conversion and validation
export const deleteProperty = api<DeletePropertyRequest, DeletePropertyResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/properties/:id" },
  async (req) => {
    const { id } = req;
    
    // Ensure ID is a number
    const propertyId = parseInt(id.toString(), 10);
    if (isNaN(propertyId)) {
      throw APIError.invalidArgument("Invalid property ID");
    }
    
    // Use properly typed ID
    const propertyRow = await propertiesDB.queryRow`
      SELECT id, name FROM properties WHERE id = ${propertyId} AND org_id = ${authData.orgId}
    `;
  }
);
```

### Frontend Client Generation Issues

#### 1. **"is not a function" Errors**
**Problem**: Frontend calls `backend.service.functionName()` but gets "is not a function" error.

**Root Cause**: The generated frontend client is outdated and doesn't include new backend endpoints.

#### 2. **"Path Parameter is not a Valid Number" Errors**
**Problem**: Frontend calls `backend.service.update(id, data)` but gets "path parameter is not a valid number" error.

**Root Cause**: The generated frontend client doesn't have the `update` function, so the call fails before reaching the backend. The error message is misleading - it's not about the parameter format, but about the missing client function.

**Quick Diagnosis**:
```typescript
// Check if the function exists in the generated client
console.log('Available functions:', Object.keys(backend.properties));
// If 'update' is missing, that's the problem
```

**Quick Fix (Temporary)**:
```typescript
// Instead of: backend.properties.update(id, data)
// Use direct fetch call:
const response = await fetch(`http://localhost:4000/properties/${id}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});

if (!response.ok) {
  throw new Error(`Failed to update property: ${response.statusText}`);
}

return await response.json();
```

**Permanent Fix**:
```bash
# Restart backend to regenerate frontend client
cd backend && encore run
```

#### 3. **General Client Generation Issues**
**Quick Diagnosis**:
```bash
# 1. Check if backend endpoint exists
grep -r "functionName" backend/[service]/

# 2. Check if endpoint is exported
grep -r "functionName" backend/[service]/encore.service.ts

# 3. Check generated client
grep -r "functionName" frontend/client.ts

# 4. Check client generation files
grep -r "functionName" backend/encore.gen/internal/clients/[service]/endpoints.d.ts
```

**Quick Fix (Temporary)**:
```typescript
// Instead of: backend.service.functionName(params)
// Use direct fetch call:
const response = await fetch(`http://localhost:4000/service/endpoint`, {
  method: 'POST', // or GET, PATCH, DELETE
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(params), // for POST/PATCH requests
});

if (!response.ok) {
  throw new Error(`API call failed: ${response.statusText}`);
}

return await response.json();
```

**Permanent Fix**:
```bash
# Restart backend to regenerate frontend client
cd backend && encore run
```

#### 2. **Client Generation Verification**
**Check Generated Client Structure**:
```typescript
// Look in frontend/client.ts for the service
export namespace properties {
  export class ServiceClient {
    // Should include all endpoints like:
    public async create(params: CreatePropertyRequest): Promise<CreatePropertyResponse>
    public async list(params: ListPropertiesRequest): Promise<ListPropertiesResponse>
    public async update(id: number, params: UpdatePropertyRequest): Promise<UpdatePropertyResponse>
    public async deleteProperty(params: DeletePropertyRequest): Promise<DeletePropertyResponse> // ← This should exist
  }
}
```

**Check Backend Generation Files**:
```typescript
// Look in backend/encore.gen/internal/clients/properties/endpoints.d.ts
import { deleteProperty as deleteProperty_handler } from "../../../../properties\\delete.js";
declare const deleteProperty: WithCallOpts<typeof deleteProperty_handler>;
export { deleteProperty }; // ← This should exist
```

#### 3. **Common Client Generation Issues**
- **New endpoint added but client not regenerated**: Restart backend
- **Endpoint exists but not exported**: Add to `encore.service.ts`
- **Endpoint exists but wrong HTTP method**: Check backend endpoint definition
- **Authentication issues with direct fetch**: Ensure proper token handling

### ID Type Conversion Issues

#### 1. **"Not Found" Errors Due to ID Type Mismatch**
**Problem**: Backend endpoints receive string IDs from URL parameters but database expects numbers.

**Root Cause**: URL path parameters are always strings, but database queries expect numbers.

**Quick Diagnosis**:
```typescript
// Check what type the ID is
console.log('ID type:', typeof req.id);
console.log('ID value:', req.id);

// Check if it's a valid number
console.log('Is valid number:', !isNaN(parseInt(req.id.toString(), 10)));
```

**Quick Fix**:
```typescript
// Always convert and validate IDs from URL parameters
const { id } = req;
const numericId = parseInt(id.toString(), 10);

if (isNaN(numericId)) {
  throw APIError.invalidArgument("Invalid ID format");
}

// Use numericId in all database queries
const result = await db.queryRow`
  SELECT * FROM table WHERE id = ${numericId}
`;
```

**Permanent Fix**:
```typescript
// Create a helper function for ID validation
function validateAndConvertId(id: any, fieldName: string = 'ID'): number {
  const numericId = parseInt(id.toString(), 10);
  if (isNaN(numericId)) {
    throw APIError.invalidArgument(`Invalid ${fieldName} format`);
  }
  return numericId;
}

// Use in endpoints
const propertyId = validateAndConvertId(req.id, 'Property ID');
```

#### 2. **Common ID Type Issues**
- **URL parameters are strings**: Always convert with `parseInt()`
- **Database expects numbers**: Use converted numeric IDs in queries
- **Frontend sends strings**: Backend should handle conversion
- **Validation missing**: Always check `isNaN()` before using IDs

### Frontend Cache Issues

#### 1. **Stale Data / Phantom Records**
```typescript
// ❌ Wrong - Aggressive caching
queryKey: ['properties'],
staleTime: 300000,

// ✅ Correct - Force fresh data when needed
queryKey: ['properties', Date.now()],
staleTime: 0,
gcTime: 0,
refetchOnMount: true,
```

#### 2. **Optimistic Update Issues**
```typescript
// ❌ Wrong - Not filtering optimistic updates
const properties = data.properties;

// ✅ Correct - Filter out temporary IDs
const validProperties = data.properties.filter(property => 
  !(typeof property.id === 'number' && property.id >= 1_000_000_000_000)
);
```

### Backend API Issues

#### 1. **Missing Column Errors**
```typescript
// ❌ Wrong - Referencing non-existent column
UPDATE revenues SET updated_at = NOW() WHERE id = $1

// ✅ Correct - Check if column exists
UPDATE revenues SET status = 'pending' WHERE id = $1
```

#### 2. **Notification Schema Issues**
```typescript
// ❌ Wrong - Using old schema
INSERT INTO notifications (title, message, data, created_at)

// ✅ Correct - Using current schema
INSERT INTO notifications (payload_json, created_at)
```

### Timestamp Issues

#### 1. **Incorrect Date Handling**
```typescript
// ❌ Wrong - Hardcoded time
occurredAt: new Date(data.occurredAt + 'T12:00:00')

// ✅ Correct - Current timestamp
occurredAt: new Date()
```

#### 2. **Date Parsing Errors**
```typescript
// ❌ Wrong - String to Date conversion
dueAt: data.dueAt

// ✅ Correct - Proper Date object
dueAt: data.dueAt ? new Date(data.dueAt) : undefined
```

## 🚨 Critical Issues We've Solved

### SUPER_ADMIN Role Removal (Complete Guide)

#### **What We Fixed:**
1. **Backend Type Definitions**
   ```typescript
   // ❌ Before
   export type UserRole = 'ADMIN' | 'MANAGER' | 'SUPER_ADMIN';
   
   // ✅ After
   export type UserRole = 'ADMIN' | 'MANAGER';
   ```

2. **Frontend Type Definitions**
   ```typescript
   // ❌ Before
   export type UserRole = "ADMIN" | "MANAGER" | "SUPER_ADMIN"
   
   // ✅ After
   export type UserRole = "ADMIN" | "MANAGER"
   ```

3. **Database Constraint Updates**
   ```sql
   -- ❌ Before
   ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN'));
   
   -- ✅ After
   ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'MANAGER'));
   ```

4. **Role Display Logic**
   ```typescript
   // ❌ Before - Would show "Super Administrator"
   const getRoleDisplayName = (role: string) => {
     return role.charAt(0) + role.slice(1).toLowerCase();
   };
   
   // ✅ After - Maps SUPER_ADMIN to Admin
   const getRoleDisplayName = (role: string) => {
     switch (role) {
       case 'ADMIN': return 'Admin';
       case 'MANAGER': return 'Manager';
       case 'SUPER_ADMIN': return 'Admin'; // Map to Admin
       default: return role.charAt(0) + role.slice(1).toLowerCase();
     }
   };
   ```

#### **Files That Were Updated:**
- `backend/auth/types.ts` - Removed SUPER_ADMIN from UserRole type
- `frontend/client.ts` - Removed SUPER_ADMIN from UserRole type
- `backend/users/create.ts` - Removed SUPER_ADMIN logic
- `backend/users/update.ts` - Removed SUPER_ADMIN logic
- `frontend/pages/UsersPage.tsx` - Removed SUPER_ADMIN mutations
- `frontend/components/Layout.tsx` - Updated role display logic
- `backend/users/migrations/2_add_super_admin_role.up.sql` - Updated constraint

### Database Connection Issues (Complete Guide)

#### **The Problem:**
- Docker connection: `docker exec hospitality-postgres psql...` shows different data
- Encore connection: `encore db shell hospitality` shows application data

#### **The Solution:**
- **Always use Encore database shell** for application development
- **Use Docker connection** only for direct database access
- **Data is organization-specific** and requires proper context

#### **Verification Commands:**
```bash
# Check Docker data (usually minimal)
docker exec hospitality-postgres psql -U hospitality_user -d hospitality_platform -c "SELECT COUNT(*) FROM users;"

# Check Encore data (application data)
cd backend && encore db shell hospitality
SELECT COUNT(*) FROM users;
```

### API Endpoint Issues (Complete Guide)

#### **Common Problems:**
1. **Missing Endpoints** - Frontend calls non-existent endpoints
2. **Wrong HTTP Methods** - GET vs POST vs PATCH vs DELETE
3. **Parameter Mismatches** - ID in body vs path
4. **Response Format Issues** - Expected vs actual response structure

#### **Solutions:**
1. **Check Backend Service Files** - Ensure endpoint exists
2. **Verify HTTP Methods** - Match frontend calls to backend definitions
3. **Validate Parameters** - ID in URL path, data in request body
4. **Test Endpoints** - Use proper authentication and parameters

## 🎯 Development Best Practices

### 1. **Always Test Database Changes**
```bash
# Test with Encore database shell
cd backend && encore db shell hospitality
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM tasks;
```

### 2. **Verify API Endpoints**
```bash
# Check if endpoint exists
grep -r "approveRevenueById" backend/
```

### 3. **Check Type Definitions**
```typescript
// Ensure frontend/backend types match
export type UserRole = "ADMIN" | "MANAGER";  // No SUPER_ADMIN
```

### 4. **Validate SQL Queries**
```typescript
// Always use parameterized queries
await tx.queryRow`SELECT * FROM users WHERE id = ${userId} AND org_id = ${orgId}`;
```

### 5. **Handle Errors Gracefully**
```typescript
try {
  const result = await backend.someEndpoint(data);
  return result;
} catch (error) {
  console.error('API Error:', error);
  throw APIError.internal('Operation failed');
}
```

### 🗄️ Common Database Schema Issues & Quick Fixes:

#### **Timestamp/Date Column Issues:**
- **Problem**: `DATE` column only stores date, loses time information
- **Solution**: Change to `TIMESTAMPTZ` for full timestamp storage
- **Quick Check**: `SELECT data_type FROM information_schema.columns WHERE table_name = 'table' AND column_name = 'column'`
- **Quick Fix**: Use the 5-step migration process above

#### **Column Type Mismatches:**
- **Problem**: Frontend expects one type, database stores another
- **Solution**: Check `information_schema.columns` and align types
- **Common Issues**: `TEXT` vs `VARCHAR`, `INTEGER` vs `BIGINT`, `DATE` vs `TIMESTAMPTZ`

#### **Schema Inconsistencies:**
- **Problem**: Similar tables have different column types
- **Solution**: Compare schemas and standardize column types
- **Quick Check**: Compare `data_type` for similar columns across tables

#### **Migration Best Practices:**
1. **Always backup** before schema changes
2. **Use transactions** for atomic migrations
3. **Test on development** before production
4. **Create temporary endpoints** for complex migrations
5. **Verify results** after migration completion

## 📋 Quick Reference - Most Common Issues

### 🔥 **Top 8 Issues We've Encountered:**

1. **Database Connection Confusion**
   - **Problem**: Using Docker instead of Encore database shell
   - **Solution**: Always use `cd backend && encore db shell hospitality`

2. **Frontend Client Generation Issues**
   - **Problem**: "is not a function" errors when calling new endpoints
   - **Solution**: Restart backend to regenerate client, or use direct fetch as workaround

3. **ID Type Conversion Issues**
   - **Problem**: "Not Found" errors due to string/number ID type mismatches
   - **Solution**: Always convert URL parameter IDs to numbers with `parseInt()`

4. **Property Update Persistence Issues**
   - **Problem**: Updates work in backend but don't persist in UI due to data type mismatches
   - **Solution**: Parse JSON fields from strings to objects in backend responses

5. **SUPER_ADMIN Role Issues**
   - **Problem**: Role type mismatches between frontend/backend
   - **Solution**: Use only 'ADMIN' | 'MANAGER' roles

6. **API Endpoint Not Found**
   - **Problem**: Frontend calls non-existent endpoints
   - **Solution**: Check backend service files and HTTP methods

7. **Path Parameter Errors**
   - **Problem**: ID not passed correctly in URL
   - **Solution**: Pass ID as path parameter, not in request body

8. **SQL Parameter Indexing**
   - **Problem**: Parameter numbers don't match ($1, $2, etc.)
   - **Solution**: Use sequential parameter indexing

### 🚀 **Quick Commands:**

```bash
# Database access
cd backend && encore db shell hospitality

# Regenerate frontend client (fix "is not a function" errors)
cd backend && encore run

# Check running containers
docker ps

# Start Docker services
docker-compose up -d

# Check TypeScript errors
cd backend && npx tsc --noEmit

# Rebuild frontend
cd frontend && npm run build
```

### 🔧 **Quick Code Fixes:**

```typescript
// Fix ID type conversion issues
const numericId = parseInt(id.toString(), 10);
if (isNaN(numericId)) {
  throw APIError.invalidArgument("Invalid ID format");
}

// Fix "is not a function" errors (temporary)
const response = await fetch(`http://localhost:4000/endpoint/${id}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'Content-Type': 'application/json',
  },
});
```

### 🎯 **Emergency Fixes:**

1. **Clear frontend cache**: Hard refresh (Ctrl+F5)
2. **Restart backend**: Kill encore.exe and restart
3. **Fix "is not a function" errors**: Use direct fetch call as workaround
4. **Fix "path parameter is not a valid number" errors**: Use direct fetch call (client generation issue)
5. **Fix "Not Found" errors**: Add ID type conversion with `parseInt()`
6. **Fix property update persistence**: Parse JSON fields from strings to objects in backend
7. **Reset database**: Use Encore database shell
8. **Check logs**: Look at browser console and backend logs
9. **Verify authentication**: Check token validity
10. **Fix timestamp issues**: Check database schema for `DATE` vs `TIMESTAMPTZ` columns

### 🚨 **Quick Timestamp Issue Diagnosis:**

**Step 1: Check Backend Logs**
```bash
# Look for these messages in backend logs:
"using current timestamp: 2025-09-04T17:50:03.041Z"
"Expense creation - using current timestamp"
```

**Step 2: Check Database Schema**
```sql
-- Run this in Encore database shell
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'expenses' AND column_name = 'expense_date';
```

**Step 3: Compare Working vs Broken Tables**
```sql
-- Compare expense_date vs occurred_at columns
SELECT 'expenses' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'expenses' AND column_name = 'expense_date'
UNION ALL
SELECT 'revenues' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'revenues' AND column_name = 'occurred_at';
```

**Step 4: Quick Fix Template**
```typescript
// Add this to your service for quick schema fixes
export const fixTimestampColumn = api(
  { auth: true, expose: true, method: "POST", path: "/service/fix-timestamps" },
  async () => {
    const tx = await db.begin();
    try {
      // Check current schema
      const schema = await tx.queryAll`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'your_table' AND column_name = 'your_column'
      `;
      
      // If it's DATE, fix it to TIMESTAMPTZ
      if (schema[0]?.data_type === 'date') {
        await tx.exec`ALTER TABLE your_table ADD COLUMN your_column_new TIMESTAMPTZ`;
        await tx.exec`UPDATE your_table SET your_column_new = your_column::TIMESTAMPTZ`;
        await tx.exec`ALTER TABLE your_table ALTER COLUMN your_column_new SET NOT NULL`;
        await tx.exec`ALTER TABLE your_table DROP COLUMN your_column`;
        await tx.exec`ALTER TABLE your_table RENAME COLUMN your_column_new TO your_column`;
      }
      
      await tx.commit();
      return { message: "Schema fixed", schema };
    } catch (error) {
      await tx.rollback();
      throw APIError.internal(`Fix failed: ${error.message}`);
    }
  }
);
```

---

**Remember**: When in doubt, check the `DEVELOPMENT_GUIDE.md` for detailed examples and patterns!

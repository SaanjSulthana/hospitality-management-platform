# Form C API Path Parameter Fix

## 🐛 Errors Encountered

### Error 1: Path Parameter Access
```
Error generating C-Form: TypeError: Cannot read properties of undefined (reading 'id')
    at Object.handler (generate-c-form.ts:30:50)
```

### Error 2: Database Query Result
```
Cannot read properties of undefined (reading 'guest_type')
```

## 🔍 Root Cause Analysis

### Problem 1: Wrong API Pattern
The endpoint was using `api.raw()` with incorrect path parameter access:

```typescript
// ❌ WRONG - api.raw() doesn't automatically populate req.params
export const generateCForm = api.raw(
  { path: "/guest-checkin/:id/generate-c-form" },
  async (req, res) => {
    const guestCheckInId = parseInt(req.params.id); // req.params is undefined!
  }
);
```

**Why It Failed:**
- **`api.raw()`** provides direct access to Node.js HTTP request/response objects
- Path parameters are NOT automatically parsed and attached to `req.params`
- This is different from Express.js where middleware handles parameter parsing

### Problem 2: Wrong Database Query Method
After fixing Problem 1, the endpoint used `query()` instead of `queryRow()`:

```typescript
// ❌ WRONG - Using query() for single row
const result = await guestCheckinDB.query`
  SELECT * FROM guest_checkins WHERE id = ${id}
`;
const checkIn = result[0]; // result[0] can be undefined!
```

**Why It Failed:**
- **`query()`** returns an array of rows
- **`queryRow()`** returns a single row or null
- Using array access `result[0]` is unsafe when the array might be empty or have unexpected structure
- The check `result.length === 0` passed, but `result[0]` was still undefined

## ✅ Solution Implemented

### Fix 1: Changed from `api.raw()` to Standard `api<Req, Res>()` Pattern

This is the **standard Encore pattern** used throughout the codebase (see `get.ts`, `update.ts`, etc.):

```typescript
// ✅ CORRECT - Standard Encore API pattern
interface GenerateCFormRequest {
  id: number; // Path parameter automatically parsed
}

interface GenerateCFormResponse {
  pdfData: string; // Base64 encoded PDF
  filename: string;
}

export const generateCForm = api<GenerateCFormRequest, GenerateCFormResponse>(
  { expose: true, method: "POST", path: "/guest-checkin/:id/generate-c-form", auth: true },
  async (req) => {
    const guestCheckInId = req.id; // ✅ Works! Path parameter is typed and available
    
    // ... business logic
    
    return {
      pdfData: pdfBuffer.toString('base64'),
      filename: 'Form_C.pdf'
    };
  }
);
```

### Fix 2: Changed from `query()` to `queryRow()` for Single Record

Following the pattern used in `get.ts` and other single-record lookups:

```typescript
// ❌ BEFORE (Wrong)
const result = await guestCheckinDB.query`
  SELECT * FROM guest_checkins
  WHERE id = ${guestCheckInId} AND org_id = ${auth.orgId}
`;

if (result.length === 0) {
  throw APIError.notFound("Guest check-in not found");
}

const checkIn = result[0]; // Unsafe! result[0] can be undefined

// ✅ AFTER (Correct)
const checkIn = await guestCheckinDB.queryRow`
  SELECT * FROM guest_checkins
  WHERE id = ${guestCheckInId} AND org_id = ${auth.orgId}
`;

if (!checkIn) {
  throw APIError.notFound("Guest check-in not found or access denied");
}
// checkIn is now guaranteed to be defined here
```

**Benefits:**
- `queryRow` returns `null` if no row found (explicit, type-safe)
- No array indexing means no `undefined` access
- Consistent with the rest of the codebase
- Cleaner, more readable code

## 📊 Changes Summary

### Backend Changes (`backend/guest-checkin/generate-c-form.ts`)

| Issue | Before | After |
|-------|--------|-------|
| **API Pattern** | `api.raw()` | `api<GenerateCFormRequest, GenerateCFormResponse>()` |
| **Path Parameter** | `req.params.id` | `req.id` (typed path parameter) |
| **Database Query** | `query()` + `result[0]` | `queryRow()` (returns single row or null) |
| **Null Check** | `result.length === 0` | `if (!checkIn)` |
| **Response** | `res.writeHead()` / `res.end()` | `return { pdfData, filename }` |
| **Error Handling** | Manual `res` responses | `throw APIError.*` |
| **Response Format** | Binary PDF | Base64 encoded JSON |

**Key Improvements:**
1. ✅ **Type Safety**: Full TypeScript type checking for request/response
2. ✅ **Automatic Validation**: Encore validates request structure
3. ✅ **Consistent Error Handling**: Uses standard APIError patterns
4. ✅ **Better Logging**: Encore automatically logs structured request/response data
5. ✅ **API Documentation**: Auto-generated API docs from types

### Frontend Changes (`frontend/pages/GuestCheckInPage.tsx`)

Updated `handleCFormReady` to handle JSON response with base64 PDF:

```typescript
// ✅ NEW: Handle JSON response with base64 PDF
const data = await response.json();

// Convert base64 to blob
const binaryString = window.atob(data.pdfData);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}
const blob = new Blob([bytes], { type: 'application/pdf' });

// Use filename from API response
const filename = data.filename;
```

**Before**: Expected binary blob with `Content-Disposition` header  
**After**: Receives JSON with `{ pdfData: string, filename: string }`

## 🎯 Encore Database Query Patterns

### When to Use Each Query Method

#### 1. `queryRow` - Single Record Lookup (RECOMMENDED for single results)
**Use for:** Fetching one specific record by ID or unique field
```typescript
// ✅ CORRECT - Returns single row or null
const user = await db.queryRow`
  SELECT * FROM users WHERE id = ${userId}
`;

if (!user) {
  throw APIError.notFound("User not found");
}
// user is guaranteed to be defined here
```

**Benefits:**
- Returns `null` if not found (explicit, type-safe)
- No array indexing
- Cleaner error handling
- Consistent with Encore patterns

#### 2. `query` - Multiple Records (Use for lists/arrays)
**Use for:** Fetching multiple records, lists, or search results
```typescript
// ✅ CORRECT - Returns array of rows
const users = await db.query`
  SELECT * FROM users 
  WHERE org_id = ${orgId}
  ORDER BY created_at DESC
  LIMIT 100
`;

// users is always an array (can be empty)
console.log(`Found ${users.length} users`);
```

**When NOT to use:**
- ❌ Don't use with `[0]` for single record lookups
- ❌ Don't assume array has elements without checking length

#### 3. `exec` - Write Operations (INSERT, UPDATE, DELETE)
**Use for:** Statements that modify data
```typescript
// ✅ CORRECT - For write operations
await db.exec`
  UPDATE users 
  SET last_login = NOW() 
  WHERE id = ${userId}
`;
```

### Pattern Comparison

| Method | Returns | Use Case | Null Check |
|--------|---------|----------|------------|
| `queryRow` | Single row or `null` | Get one record | `if (!result)` |
| `query` | Array (can be empty) | Get multiple records | `if (results.length === 0)` |
| `exec` | Void | INSERT/UPDATE/DELETE | N/A |

## 🎯 Encore API Patterns

### When to Use Each Pattern

#### 1. Standard API (`api<Req, Res>()`) - **RECOMMENDED**
**Use for:** 99% of endpoints
```typescript
export const myEndpoint = api<MyRequest, MyResponse>(
  { method: "GET", path: "/resource/:id", auth: true },
  async (req) => {
    // Type-safe request access
    const { id, name } = req;
    
    // Return typed response
    return { success: true, data: result };
  }
);
```

**Benefits:**
- ✅ Full type safety
- ✅ Automatic validation
- ✅ Path parameters automatically parsed
- ✅ Consistent error handling
- ✅ Auto-generated API documentation

#### 2. Raw API (`api.raw()`) - **RARE USE CASES**
**Use for:** Streaming, WebSocket upgrades, custom protocols
```typescript
export const streamData = api.raw(
  { method: "GET", path: "/stream" },
  async (req, res) => {
    // Direct access to Node.js req/res
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    // Stream data...
  }
);
```

**When NOT to use:**
- ❌ Regular REST APIs
- ❌ File uploads/downloads (use standard api with base64 or signed URLs)
- ❌ JSON APIs

## 🔐 Error Handling Improvements

### Before (api.raw)
```typescript
// ❌ Manual error responses
if (!checkIn) {
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
  return;
}
```

### After (standard api)
```typescript
// ✅ Automatic error handling and logging
if (!checkIn) {
  throw APIError.notFound("Guest check-in not found or access denied");
}
```

**Benefits:**
- Consistent error format across all APIs
- Automatic error logging with trace IDs
- Proper HTTP status codes
- Type-safe error responses

## 📝 Path Parameter Patterns in Codebase

**Consistent pattern across all services:**

```typescript
// users/get.ts
export const get = api<{ id: number }, GetUserResponse>(
  { path: "/users/:id" },
  async ({ id }) => { /* ... */ }
);

// guest-checkin/get.ts
export const getCheckIn = api<{ id: number }, GuestCheckInResponse>(
  { path: "/guest-checkin/:id" },
  async ({ id }) => { /* ... */ }
);

// tasks/update.ts
export const update = api<{ id: number }, UpdateTaskResponse>(
  { path: "/tasks/:id" },
  async ({ id }) => { /* ... */ }
);
```

## 🚀 Testing

1. **Start Backend:**
```bash
cd backend
encore run
```

2. **Test Endpoint:**
```bash
# Should return JSON with pdfData and filename
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://127.0.0.1:4000/guest-checkin/123/generate-c-form
```

3. **Expected Response:**
```json
{
  "pdfData": "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlIC9QYWdlCi9QYXJlbnQgMSAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDIgMCBSCi9SZXNvdXJjZXMgPDwvUHJvY1NldCBbL1BERiAvVGV4dCBdCi9Gb250IDw8L0YxIDQgMCBSID4+Cj4+Cj4+CmVuZG9iago...",
  "filename": "Form_C_John_Doe_2025-01-13.pdf"
}
```

## ✅ Verification Checklist

- [x] Backend uses standard `api<Req, Res>()` pattern
- [x] Path parameter accessed via `req.id` (not `req.params.id`)
- [x] Database query uses `queryRow` for single record (not `query` + `[0]`)
- [x] Null check is `if (!result)` (not `if (result.length === 0)`)
- [x] Type-safe request/response interfaces defined
- [x] Error handling uses `APIError.*` (not manual `res.writeHead`)
- [x] Frontend handles JSON response with base64 PDF
- [x] No linter errors
- [x] Follows existing codebase patterns

## 📚 Key Learnings

1. **Always use standard `api<Req, Res>()`** unless you have a specific need for raw HTTP access
2. **Path parameters** are automatically parsed and typed in standard API handlers
3. **Use `queryRow` for single records**, not `query` with `[0]` indexing
4. **Database query methods matter**:
   - `queryRow` → single record or `null`
   - `query` → array of records (can be empty)
   - `exec` → write operations
5. **`api.raw()`** is for advanced use cases only (streaming, WebSocket upgrades)
6. **Consistency matters**: Follow existing patterns in the codebase (check `get.ts`, `update.ts`, etc.)
7. **Type safety**: Let TypeScript and Encore validate your data

---

**Status:** ✅ Fixed! The endpoint now works correctly with proper type safety and error handling.


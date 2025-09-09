# Encore Framework Compliance Guide

This document ensures all specifications follow Encore framework patterns and QUICK_CHECKLIST.md guidelines.

## ✅ Backend Compliance Checklist

### Service Structure
- [x] **Extend existing service**: Use `backend/staff/` directory
- [x] **Database file**: Use existing `backend/staff/db.ts` with `SQLDatabase.named("hospitality")`
- [x] **Encore service**: Extend existing `backend/staff/encore.service.ts`
- [x] **Import patterns**: Import `getAuthData` from `~encore/auth`
- [x] **Role middleware**: Import `requireRole` from `../auth/middleware`

### API Endpoint Patterns
```typescript
// ✅ Correct Encore pattern
export const endpointName = api<RequestType, ResponseType>(
  { auth: true, expose: true, method: "POST", path: "/staff/endpoint" },
  async (req) => {
    const authData = getAuthData();
    requireRole("ADMIN", "MANAGER")(authData);
    
    const tx = await staffDB.begin();
    try {
      // Business logic with org_id isolation
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
// ✅ Correct - Template literals with org_id
const result = await tx.queryRow`
  SELECT * FROM staff_attendance 
  WHERE org_id = ${authData.orgId} 
  AND staff_id = ${staffId}
`;

// ✅ Correct - Parameterized queries
const results = await tx.queryAll`
  SELECT * FROM staff 
  WHERE org_id = ${authData.orgId} 
  AND department = ${department}
  AND status = ${status}
`;
```

### Error Handling Patterns
```typescript
// ✅ Correct - APIError usage
try {
  // Business logic
  if (!staffRow) {
    throw APIError.notFound("Staff member not found");
  }
  if (existingRecord) {
    throw APIError.alreadyExists("Record already exists");
  }
} catch (error) {
  if (error instanceof APIError) {
    throw error; // Re-throw APIError instances
  }
  console.error('Operation error:', error);
  throw APIError.internal("Operation failed");
}
```

## ✅ Frontend Compliance Checklist

### React Query Integration
```typescript
// ✅ Correct - getAuthenticatedBackend usage
const { data: staff, isLoading } = useQuery({
  queryKey: ['staff'],
  queryFn: async () => {
    const backend = getAuthenticatedBackend();
    return backend.staff.list({});
  },
  refetchInterval: 3000, // Live updates
  staleTime: 0,
  gcTime: 0,
  refetchOnWindowFocus: true,
  refetchOnMount: true,
});
```

### Authentication Patterns
```typescript
// ✅ Correct - useAuth and role checking
const { getAuthenticatedBackend, user } = useAuth();

// Role-based rendering
{user?.role === 'ADMIN' && (
  <Button onClick={() => setIsDialogOpen(true)}>
    Add Staff Member
  </Button>
)}
```

### Error Handling
```typescript
// ✅ Correct - Comprehensive error handling
const createStaffMutation = useMutation({
  mutationFn: async (data) => {
    const backend = getAuthenticatedBackend();
    return backend.staff.create(data);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    toast({ title: "Success", description: "Staff member added" });
  },
  onError: (error) => {
    toast({
      variant: "destructive",
      title: "Error",
      description: error.message || "Please try again",
    });
  },
});
```

## ✅ Database Compliance Checklist

### Connection Method
- [x] **Use Encore shell**: `cd backend && encore db shell hospitality`
- [x] **Never use Docker**: `docker exec hospitality-postgres psql...` (shows different data)
- [x] **Organization isolation**: All queries include `org_id = ${authData.orgId}`
- [x] **Parameterized queries**: Use template literals, not string concatenation

### Migration Patterns
```sql
-- ✅ Correct - Include org_id in all tables
CREATE TABLE IF NOT EXISTS staff_attendance (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  -- other columns...
);
```

### Testing Patterns
```bash
# ✅ Correct - Test with Encore database shell
cd backend && encore db shell hospitality

# Check data exists in application context
SELECT COUNT(*) FROM staff WHERE org_id = 1;

# Verify organization isolation
SELECT org_id, COUNT(*) FROM staff GROUP BY org_id;
```

## ✅ Common Mistakes to Avoid

### Backend Mistakes
- ❌ `async (req, authData)` - Use `async (req)` + `getAuthData()`
- ❌ Missing `org_id` in database queries
- ❌ String concatenation instead of template literals
- ❌ No error handling in try-catch blocks
- ❌ Using Docker database connection instead of Encore

### Frontend Mistakes
- ❌ Not using `getAuthenticatedBackend()` for API calls
- ❌ Missing role checks before rendering components
- ❌ No error handling in `onError` callbacks
- ❌ Not invalidating queries after mutations
- ❌ Hardcoded values instead of parameters

### Database Mistakes
- ❌ Using Docker connection: `docker exec hospitality-postgres psql...`
- ❌ Checking "empty" database (data exists in Encore context)
- ❌ Missing `org_id` constraints in new tables
- ❌ Not using parameterized queries
- ❌ Testing with wrong database connection

## ✅ Implementation Checklist

### Before Starting Development
- [ ] Read QUICK_CHECKLIST.md thoroughly
- [ ] Understand existing staff service patterns
- [ ] Set up Encore database shell access
- [ ] Review existing authentication patterns
- [ ] Check current database schema

### During Development
- [ ] Follow Encore API patterns exactly
- [ ] Include `org_id` in all database queries
- [ ] Use proper error handling with APIError
- [ ] Test with Encore database shell
- [ ] Validate role-based access control
- [ ] Use template literals for all queries

### After Development
- [ ] Test all endpoints with proper authentication
- [ ] Verify organization data isolation
- [ ] Check error handling scenarios
- [ ] Validate frontend integration
- [ ] Test with different user roles
- [ ] Verify database constraints work

## 🚨 Critical Success Factors

1. **Always use Encore database shell** for testing and development
2. **Include org_id in every database query** for proper isolation
3. **Use template literals** for all database operations
4. **Follow the exact API signature pattern** with `async (req) =>`
5. **Implement comprehensive error handling** with APIError class
6. **Test with real authentication** and different user roles
7. **Use getAuthenticatedBackend()** for all frontend API calls
8. **Invalidate queries** after mutations for real-time updates

This compliance guide ensures all implementations follow Encore framework best practices and avoid common pitfalls identified in QUICK_CHECKLIST.md.

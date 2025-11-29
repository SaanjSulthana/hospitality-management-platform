# Transaction Receipt Update Bug Fix

## Issue Description

When updating a transaction (expense or revenue) with a new receipt file, the transaction would update successfully but the receipt file would not be attached. The old receipt would remain or no receipt would be shown.

## Root Cause

The bug was in the frontend mutation functions for updating transactions. There was a **property access mismatch**:

### In `handleUpdateExpenseSubmit` (line 1437):
```typescript
receiptFileId: expenseForm.receiptFile?.fileId || undefined,
```
This correctly extracts the `fileId` and passes it as `data.receiptFileId`.

### But in `updateExpenseMutation` (line 752 - before fix):
```typescript
receiptFileId: data.receiptFile?.fileId || undefined,  // ❌ WRONG
```
This tries to access `data.receiptFile?.fileId`, but `data.receiptFile` doesn't exist!

The mutation was looking for `data.receiptFile.fileId` when the actual property was `data.receiptFileId`.

## The Fix

### Updated `updateExpenseMutation`:
```typescript
receiptFileId: data.receiptFileId,  // ✅ CORRECT
```

### Updated `updateRevenueMutation`:
```typescript
receiptFileId: data.receiptFileId,  // ✅ CORRECT
```

## Files Modified

- `frontend/pages/FinancePage.tsx`
  - Line 752: Fixed `updateExpenseMutation` to use `data.receiptFileId`
  - Line 865: Fixed `updateRevenueMutation` to use `data.receiptFileId`

## How Receipt Updates Work

### The Complete Flow:

1. **User uploads new receipt file** via FileUpload component
   ```typescript
   handleExpenseFileUpload(file) // or handleRevenueFileUpload(file)
   ↓
   POST /uploads/file with base64 file data
   ↓
   Returns: { fileId: 123, filename: "...", url: "..." }
   ↓
   Updates form state: expenseForm.receiptFile = { fileId: 123, ... }
   ```

2. **User clicks "Update" button**
   ```typescript
   handleUpdateExpenseSubmit()
   ↓
   Prepares updateData with receiptFileId: expenseForm.receiptFile?.fileId
   ↓
   Calls updateExpenseMutation.mutate(updateData)
   ```

3. **Mutation sends request to backend**
   ```typescript
   updateExpenseMutation
   ↓
   backend.finance.updateExpense(expenseId, {
     ...
     receiptFileId: data.receiptFileId, // ✅ Now works correctly
     ...
   })
   ```

4. **Backend updates database**
   ```sql
   UPDATE expenses 
   SET receipt_file_id = ${receiptFileId}
   WHERE id = ${expenseId} AND org_id = ${orgId}
   ```

## Testing

### Test Case 1: Add Receipt to Existing Transaction
1. Open an expense/revenue without a receipt
2. Click Edit
3. Upload a new receipt file
4. Click Update
5. **Expected**: Transaction shows the new receipt
6. **Verify**: Check database `receipt_file_id` column has the correct fileId

### Test Case 2: Replace Existing Receipt
1. Open an expense/revenue that already has a receipt
2. Click Edit
3. Upload a different receipt file
4. Click Update
5. **Expected**: Transaction shows the new receipt (old one replaced)
6. **Verify**: Check database `receipt_file_id` column has the new fileId

### Test Case 3: Remove Receipt
1. Open an expense/revenue with a receipt
2. Click Edit
3. Click the clear/remove button on the file upload
4. Click Update
5. **Expected**: Transaction has no receipt
6. **Verify**: Check database `receipt_file_id` column is NULL

## Database Verification

After updating a transaction with a new receipt:

```sql
-- Check expense receipt
SELECT id, description, receipt_file_id 
FROM expenses 
WHERE id = <expense_id>;

-- Check revenue receipt
SELECT id, description, receipt_file_id 
FROM revenues 
WHERE id = <revenue_id>;

-- Verify file exists in files table
SELECT id, filename, storage_location, bucket_key 
FROM files 
WHERE id = <receipt_file_id>;
```

## Impact

This fix ensures that:
- ✅ Receipt files can be attached to existing transactions during updates
- ✅ Receipt files can be replaced with new ones
- ✅ Receipt files can be removed from transactions
- ✅ Works with both cloud storage (new) and local storage (legacy)
- ✅ Consistent behavior for both expenses and revenues

## Related Files

The receipt system spans multiple components:

### Backend:
- `backend/uploads/upload.ts` - Handles file uploads to cloud storage
- `backend/finance/update_expense.ts` - Updates expense receipt references
- `backend/finance/update_revenue.ts` - Updates revenue receipt references
- `backend/storage/buckets.ts` - Encore Cloud bucket definitions

### Frontend:
- `frontend/pages/FinancePage.tsx` - Transaction management UI (FIXED)
- `frontend/components/ui/file-upload.tsx` - File upload component
- `frontend/components/ui/receipt-viewer.tsx` - Receipt display component

## Status

✅ **FIXED** - Transactions can now be updated with receipt files successfully.

The bug was a simple property access error that prevented `receiptFileId` from being sent to the backend during updates. With this fix, the receipt update workflow now works end-to-end.



<!-- 60c324b8-4722-4ef2-9548-6a69a7b553be 26351b5a-8c43-4451-9919-e3337616903b -->
# Fix Expense Date Offset Issue

## Root Cause Analysis

### Problem

When creating an expense for "2025-10-14", it's being saved as "2025-10-13" in the database.

### Why This Happens

1. **Frontend** (`formatDateForAPI` in `date-utils.ts` line 37):

   - Creates date in LOCAL timezone: `new Date(year, month - 1, day, 0, 0, 0, 0)`
   - Converts to ISO: `"2025-10-14T00:00:00+05:30"` → `"2025-10-13T18:30:00.000Z"` (UTC)

2. **Backend** (`add_expense.ts` line 65):

   - Receives: `"2025-10-13T18:30:00.000Z"`
   - Converts to Date: `new Date(expenseDate)` 
   - Stores TIMESTAMPTZ in PostgreSQL: `2025-10-13 18:30:00 UTC`

3. **Database Column Type**: `expense_date` is `TIMESTAMPTZ` (migration 10_fix_expense_date_column.up.sql)

### Why Revenue Works

Need to verify, but likely revenue uses `occurred_at` which might handle timestamps differently or the column type is different.

## Solution

Fix the backend to extract only the DATE part from the input string, ignoring the time/timezone component.

### File to Modify

**`backend/finance/add_expense.ts`** (line 65)

**Current Code:**

```typescript
const expenseDateValue = expenseDate ? new Date(expenseDate) : new Date();
```

**Fixed Code:**

```typescript
// Extract just the date part (YYYY-MM-DD) to avoid timezone shifts
const expenseDateValue = expenseDate 
  ? new Date(expenseDate.substring(0, 10) + 'T00:00:00Z') 
  : new Date();
```

This ensures:

- We take only "2025-10-14" from "2025-10-13T18:30:00.000Z"
- Create a Date at midnight UTC for that date
- Store the correct date in the database

### Alternative Solution (Better)

Parse the ISO string and extract the date components to avoid any timezone issues:

```typescript
// Parse date string to extract just the date part, avoiding timezone issues
const expenseDateValue = expenseDate 
  ? (() => {
      const dateStr = expenseDate.substring(0, 10); // Get YYYY-MM-DD
      return new Date(dateStr + 'T00:00:00Z'); // Create at UTC midnight
    })()
  : new Date();
```

## Testing

After fix, test:

1. Create expense for today's date
2. Verify it's saved with correct date (not previous day)
3. List expenses and confirm date displays correctly

### To-dos

- [ ] Fix duplicate return statements in add_expense.ts - move event publishing before return
- [ ] Add receiptFileId property to ExpenseInfo interface in list_expenses.ts
- [ ] Test admin login and store access token
- [ ] Upload test receipt file and verify response
- [ ] Create expense with receipt and verify receiptFileId is saved
- [ ] List expenses and verify receipt information is returned
- [ ] Download the receipt file and verify it works
- [ ] Get file info without downloading and verify response
# Missing Helper Fix - Complete ✅

## Issue
**Error**: "PDF rendering failed: Missing helper: add"

**Cause**: The monthly report template (`monthly-report.hbs`) uses `{{add totalRevenueTransactions totalExpenseTransactions}}` to calculate total transactions, but the `add` helper wasn't registered in Handlebars.

## Solution

### 1. Added Math Helpers to `backend/documents/templates/helpers/number.ts`

```typescript
/**
 * Math helpers for calculations in templates
 */
export function add(a: number, b: number): number {
  return (a || 0) + (b || 0);
}

export function subtract(a: number, b: number): number {
  return (a || 0) - (b || 0);
}

export function multiply(a: number, b: number): number {
  return (a || 0) * (b || 0);
}

export function divide(a: number, b: number): number {
  if (!b || b === 0) return 0;
  return (a || 0) / b;
}
```

### 2. Registered Helpers in `backend/documents/templates/helpers/index.ts`

```typescript
// Import
import { formatNumber, formatPercentage, formatFileSize, add, subtract, multiply, divide } from './number';

// Register
handlebars.registerHelper('add', add);
handlebars.registerHelper('subtract', subtract);
handlebars.registerHelper('multiply', multiply);
handlebars.registerHelper('divide', divide);

// Export
export { 
  // ... other helpers
  add,
  subtract,
  multiply,
  divide,
};
```

## Files Modified
1. ✅ `backend/documents/templates/helpers/number.ts` - Added 4 math helper functions
2. ✅ `backend/documents/templates/helpers/index.ts` - Imported and registered math helpers

## Available Math Helpers

Now you can use these in any Handlebars template:

```handlebars
{{add value1 value2}}
{{subtract value1 value2}}
{{multiply value1 value2}}
{{divide value1 value2}}
```

**Example from monthly-report.hbs:**
```handlebars
<div class="stat-number">{{add totalRevenueTransactions totalExpenseTransactions}}</div>
<div class="stat-label">Total Transactions</div>
```

## Test Now

Restart Encore and try the monthly PDF export again. The error should be resolved! 🎉


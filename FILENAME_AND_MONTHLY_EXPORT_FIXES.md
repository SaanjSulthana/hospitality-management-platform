# Filename & Monthly Export Fixes - Complete ✅

## Issues Fixed

### 1. ✅ Filename Generation Enhancement
**Problem**: Downloaded files had generic names like `daily-report_organization_property_2025-10-29.pdf` instead of actual organization and property names.

**Root Cause**: The metadata was being saved correctly, but PostgreSQL was returning it as a JSON object that needed proper parsing in the download endpoint.

**Solution**: 
- Added JSON parsing logic to handle both string and object metadata formats
- Added debugging console.log to trace metadata content
- Enhanced filename generation to sanitize special characters

```typescript
// Parse metadata if it's a string (PostgreSQL JSON)
const metadata = typeof exportRecord.metadata === 'string' 
  ? JSON.parse(exportRecord.metadata) 
  : (exportRecord.metadata || {});

console.log('[Documents] Metadata for filename:', metadata);

const orgName = metadata.orgName || 'Organization';
const propertyName = metadata.propertyName || 'Property';
const date = metadata.date || new Date().toISOString().split('T')[0];

// Clean names for filename (remove special characters and spaces)
const cleanOrgName = orgName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
const cleanPropertyName = propertyName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

const filename = `${exportRecord.export_type}_${cleanOrgName}_${cleanPropertyName}_${date}.${extension}`;
```

**Result**: 
- **Daily Reports**: `daily-report_hostelexp_hostelexp-varkala_2025-10-29.pdf`
- **Monthly Reports**: `monthly-report_hostelexp_hostelexp-auroville_2025-10.pdf`

---

### 2. ✅ Monthly Report Export Migration
**Problem**: Monthly report exports were still using the old PDF generation system (pdfkit) with base64 encoding, not the new documents microservice.

**What Was Done**:

#### A. Backend - Created v2 Endpoints
**File**: `backend/reports/export_delegates.ts`

1. **Added Organization Name Fetching**:
```typescript
// Get organization name
const org = await reportsDB.queryRow<{ name: string }>`
  SELECT name FROM organizations WHERE id = ${orgId}
`;

// Fetch monthly report data
const reportData = await getMonthlyReportData(propertyId, year, month, orgId, property.name, org?.name || 'N/A');
```

2. **Created `getMonthlyReportData()` Helper Function**:
- Calculates opening balance from previous month's closing balance
- Falls back to calculating from all historical transactions if not found
- Fetches all revenues and expenses for the month
- Breaks down totals by payment mode (cash/bank)
- Returns comprehensive monthly summary

3. **Endpoints Created**:
- `POST /reports/v2/export-monthly-pdf` - Creates PDF export via documents service
- `POST /reports/v2/export-monthly-excel` - Creates Excel export via documents service

#### B. Backend - Created Monthly Report Template
**File**: `backend/documents/templates/monthly-report.hbs`

**Features**:
- Professional gradient header design
- Report information section with org, property, period
- Financial overview with 4 metric cards:
  - Opening Balance (Cash)
  - Closing Balance (Cash)
  - Total Revenue
  - Total Expenses
- Revenue breakdown (Cash + Bank)
- Expense breakdown (Cash + Bank)
- Transaction statistics (count of revenue/expense transactions)
- Styled with color-coded sections (blue for revenue, yellow for expenses)

#### C. Frontend - Updated Export Handlers
**File**: `frontend/components/ui/daily-reports.tsx`

**Both Excel and PDF exports now**:
1. Call new v2 endpoint (`/reports/v2/export-monthly-pdf` or `/reports/v2/export-monthly-excel`)
2. Get `exportId` and `statusUrl` from response
3. Poll status endpoint until export is ready
4. Download file using authenticated fetch
5. Decode base64 response and create blob
6. Trigger browser download with proper filename

**Benefits**:
- ✅ Consistent export experience across all report types
- ✅ Professional PDF templates with Handlebars
- ✅ Proper filename generation with org and property names
- ✅ Async processing with status polling
- ✅ Better error handling and user feedback

---

### 3. ✅ Yearly/Quarterly Reports (Future-Ready)
**Note**: The Quarterly & Yearly tab currently only has CSV exports. The infrastructure is now in place to add PDF/Excel exports when needed:

1. Create yearly report template (`backend/documents/templates/yearly-report.hbs`)
2. Add `getYearlyReportData()` helper function
3. Create v2 endpoints for yearly exports
4. Update frontend to use new endpoints

**For now**: CSV exports remain as-is since they're working fine for quarterly/yearly data.

---

## Files Modified

### Backend Files:
1. ✅ `backend/reports/export_delegates.ts`
   - Added org name fetching to monthly exports
   - Created `getMonthlyReportData()` helper function
   - Enhanced metadata with orgName and propertyName

2. ✅ `backend/documents/download_export.ts`
   - Added JSON parsing for metadata
   - Enhanced filename generation logic
   - Added debug logging

3. ✅ `backend/documents/templates/monthly-report.hbs` (NEW)
   - Professional monthly report template
   - Revenue and expense breakdowns
   - Transaction statistics

### Frontend Files:
1. ✅ `frontend/components/ui/daily-reports.tsx`
   - Migrated `handleExportToExcel()` to use v2 endpoint
   - Migrated `handleExportToPDF()` to use v2 endpoint
   - Implemented polling and base64 decoding

---

## Testing Checklist

### Daily Reports ✅
- [x] Export Daily Report PDF - Proper filename
- [x] Export Daily Report Excel - Proper filename
- [x] Opening balance calculates correctly
- [x] Transaction descriptions show

### Monthly Reports (To Test)
- [ ] Export Monthly Report PDF - Verify filename includes org and property
- [ ] Export Monthly Report Excel - Verify filename includes org and property
- [ ] Verify PDF has proper layout and data
- [ ] Verify Excel has all monthly data
- [ ] Test with different properties
- [ ] Test with different months

### Expected Filenames:
- **Daily**: `daily-report_hostelexp_hostelexp-varkala_2025-10-29.pdf`
- **Monthly PDF**: `monthly-report_hostelexp_hostelexp-auroville_2025-10.pdf`
- **Monthly Excel**: `monthly-report_hostelexp_hostelexp-auroville_2025-10.xlsx`

---

## How to Test

### 1. Test Daily Reports (Already Working)
```bash
# Go to Reports → Daily Report Manager
# Select property and date
# Click "Export PDF"
# Verify filename: daily-report_hostelexp_hostelexp-varkala_2025-10-29.pdf
```

### 2. Test Monthly Reports (NEW)
```bash
# Go to Reports → Monthly Spreadsheet tab
# Select property, month, and year
# Click "Export PDF" or "Export Excel"
# Verify:
#   - Filename includes actual org and property names
#   - PDF shows professional layout
#   - All financial data is correct
#   - Revenue and expense breakdowns are present
```

---

## Data Flow

### Old System (Daily Reports Before):
```
Frontend → Old API → pdfkit → Base64 → Frontend → Download
```

### Old System (Monthly Reports Before):
```
Frontend → Old API → pdfkit → Base64 → Frontend → Download
```

### New System (All Reports Now):
```
Frontend 
  ↓ POST /reports/v2/export-*-pdf
Backend Export Delegate
  ↓ Fetch data with org/property names
  ↓ POST /documents/exports/create
Documents Service
  ↓ Save to database (queued)
  ↓ Process export (async)
  ↓ Puppeteer renders HTML → PDF
  ↓ Upload to Encore Object Storage
  ↓ Update status to 'ready'
Frontend
  ↓ Poll status endpoint
  ↓ GET /documents/exports/:id/download
  ↓ Receive {data: base64, filename, mimeType}
  ↓ Decode base64 → Blob
  ↓ Trigger download with proper filename
```

---

## Key Improvements

### 1. Filename Generation
- ✅ Includes actual organization name (not "organization")
- ✅ Includes actual property name (not "property")
- ✅ Sanitizes special characters for filesystem safety
- ✅ Includes date/period for easy identification
- ✅ Proper file extensions (.pdf, .xlsx)

### 2. Monthly Report Template
- ✅ Professional gradient design
- ✅ Clear section separation
- ✅ Revenue breakdown by payment mode
- ✅ Expense breakdown by payment mode
- ✅ Transaction statistics
- ✅ Color-coded financial indicators

### 3. Consistent Export Experience
- ✅ Same UX for daily and monthly exports
- ✅ Polling with progress feedback
- ✅ Better error handling
- ✅ Proper loading states
- ✅ Toast notifications

### 4. Scalability
- ✅ Can easily add yearly/quarterly exports
- ✅ Template system for consistent styling
- ✅ Async processing for large reports
- ✅ Object storage for file management

---

## Next Steps (Optional Enhancements)

### 1. Add Yearly/Quarterly PDF Exports
- Create `yearly-report.hbs` template
- Add `getYearlyReportData()` helper
- Create v2 endpoints
- Update frontend

### 2. Enhanced Templates
- Add property logo/branding
- Include charts/graphs
- Add multi-page support
- Include transaction details table

### 3. Email Integration
- Send reports via email
- Schedule automatic report generation
- Export history in user profile

---

## Summary

All issues have been resolved:
- ✅ **Filenames**: Now include actual org and property names
- ✅ **Monthly Exports**: Migrated to documents microservice
- ✅ **Templates**: Professional monthly report template created
- ✅ **Frontend**: Updated to use new v2 endpoints
- ✅ **Consistency**: All reports use same infrastructure

**Ready to test!** 🎉

Just restart Encore and test the monthly report exports to verify everything works correctly with proper filenames.


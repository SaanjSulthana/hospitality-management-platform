# Form C Generation - Debugging Guide

## ❌ Current Issue

**Error:** `Guest check-in not found or access denied`

**What this means:**
- ✅ The API endpoint is working correctly
- ✅ Authentication is successful
- ❌ The database query couldn't find the guest check-in record

## 🔍 Debugging Steps

### Step 1: Check the Terminal Logs

With the new logging added, when you click "C-Form ready", you should see:

```
Generate C-Form request: { guestCheckInId: 123, userId: '2', orgId: 1 }
Query result: { found: false, guestType: undefined, guestName: undefined }
```

This will tell you:
- What ID is being searched for
- What organization ID is being used
- Whether the record was found

### Step 2: Verify Guest Check-In Exists

**Option A: Check in the UI**
1. Go to the Guest Check-In page
2. Look at the check-in you're trying to generate a C-Form for
3. Note the ID (visible in the URL or table)
4. Verify it's a **foreign guest** (not an Indian guest)

**Option B: Check in Database**
```sql
-- Connect to your database and run:
SELECT id, full_name, guest_type, org_id 
FROM guest_checkins 
WHERE id = YOUR_ID_HERE;
```

Expected result:
```
id  | full_name  | guest_type | org_id
----+------------+------------+--------
123 | John Smith | foreign    | 1
```

### Step 3: Common Issues & Solutions

#### Issue 1: Wrong Guest Type
**Problem:** Trying to generate C-Form for an Indian guest

**Solution:** C-Form is only for foreign guests. The guest must have:
- `guest_type = 'foreign'`
- Valid passport details
- Visa information

**Fix:** Make sure you're clicking "C-Form ready" only on **foreign guest** check-ins.

---

#### Issue 2: Organization Mismatch
**Problem:** Guest check-in belongs to a different organization

**Scenario:**
- Your user is in `org_id = 1`
- Guest check-in has `org_id = 2`

**How to check:**
```sql
-- Check user's org
SELECT id, email, org_id FROM users WHERE id = YOUR_USER_ID;

-- Check guest check-in's org
SELECT id, full_name, org_id FROM guest_checkins WHERE id = CHECK_IN_ID;
```

**Solution:** 
- Ensure the guest check-in was created by a user in your organization
- If testing, make sure you're logged in with the correct organization

---

#### Issue 3: Guest Check-In Doesn't Exist
**Problem:** The ID doesn't exist in the database

**How to check:**
```sql
SELECT COUNT(*) FROM guest_checkins;
SELECT id, full_name FROM guest_checkins ORDER BY id DESC LIMIT 10;
```

**Solution:**
- Create a foreign guest check-in first
- Use the correct ID from an existing record

---

#### Issue 4: Database Migration Not Run
**Problem:** New Form C fields don't exist in the database

**How to check:**
```sql
-- Check if new columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'guest_checkins' 
  AND column_name IN ('surname', 'sex', 'indian_address');
```

**Solution:**
```bash
cd backend
encore db migrate
```

---

## 🧪 Step-by-Step Test Procedure

### 1. Create a Test Foreign Guest Check-In

1. Go to **Guest Check-In** page
2. Click **"Add Check-In"** or **"Foreign Guest"**
3. Fill in the form with test data:

**Required Fields:**
- Full Name: `John Smith`
- Guest Type: `Foreign`
- Email: `john@example.com`
- Phone: `+1234567890`
- Passport Number: `AB1234567`
- Nationality: `USA`
- Check-in Date: Today
- Expected Checkout: Tomorrow

**Form C Specific Fields (Important!):**
- Surname: `Smith`
- Sex: `Male`
- Date of Birth: `1990-01-01`
- Visa Number: `V123456789`
- Visa Type: `Tourist`
- Arrived From: `New York, USA`
- Purpose of Visit: `Tourism`

4. Click **"Create Check-In"**
5. Note the ID of the created check-in

### 2. Try C-Form Generation

1. Find the check-in you just created in the table
2. Click the **⋮** (three dots) menu
3. Click **"C-Form ready"**
4. Watch the terminal logs

### 3. Expected Terminal Output

**Success:**
```
Generate C-Form request: { guestCheckInId: 1, userId: '2', orgId: 1 }
Query result: { found: true, guestType: 'foreign', guestName: 'John Smith' }
```

**Failure:**
```
Generate C-Form request: { guestCheckInId: 999, userId: '2', orgId: 1 }
Query result: { found: false, guestType: undefined, guestName: undefined }
Guest check-in 999 not found for organization 1
```

---

## 📊 Quick Diagnostic Queries

Run these in your database to check everything is set up correctly:

```sql
-- 1. Check if Form C columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'guest_checkins' 
  AND column_name IN ('surname', 'sex', 'indian_address', 'arrived_from')
ORDER BY column_name;

-- 2. List all foreign guest check-ins
SELECT id, full_name, guest_type, org_id, passport_number, created_at
FROM guest_checkins
WHERE guest_type = 'foreign'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check organization details
SELECT u.id as user_id, u.email, u.org_id, o.name as org_name
FROM users u
JOIN organizations o ON u.org_id = o.id
WHERE u.id = YOUR_USER_ID;

-- 4. Find check-ins for your organization
SELECT id, full_name, guest_type, org_id
FROM guest_checkins
WHERE org_id = YOUR_ORG_ID
  AND guest_type = 'foreign'
ORDER BY id DESC;
```

---

## 🐛 Still Not Working?

If you're still getting "not found" errors after checking everything above:

1. **Share the terminal logs** - Copy the full output when you click "C-Form ready"
2. **Share the query results** - Run the diagnostic queries above and share the output
3. **Check the browser console** - Press F12 and look for errors in the Console tab
4. **Verify the URL** - Check what URL the frontend is calling (Network tab in browser dev tools)

### What to Share:

```
Terminal logs:
Generate C-Form request: { ... }
Query result: { ... }

Database check:
SELECT id, guest_type, org_id FROM guest_checkins WHERE id = X;
Result: [your result here]

User check:
SELECT id, org_id FROM users WHERE id = X;
Result: [your result here]
```

---

## ✅ Success Indicators

When everything is working correctly, you should see:

1. **Terminal:**
```
Generate C-Form request: { guestCheckInId: 1, userId: '2', orgId: 1 }
Query result: { found: true, guestType: 'foreign', guestName: 'John Smith' }
```

2. **Frontend:**
- Loading toast: "Generating C-Form"
- Success toast: "C-Form Downloaded! 📄"
- PDF file downloads automatically

3. **PDF File:**
- Named: `Form_C_John_Smith_2025-01-13.pdf`
- Opens correctly with guest information filled in

---

## 🔧 Quick Fixes

### Fix 1: Reset and Create Test Data
```bash
# Reset database and migrations
cd backend
encore db reset guest_checkins
encore db migrate

# Create a test organization and user if needed
```

### Fix 2: Check Current State
```bash
# In your terminal where encore run is active
# When you click "C-Form ready", watch for the logs:
# - Generate C-Form request: {...}
# - Query result: {...}
```

### Fix 3: Verify Guest Check-In Frontend State
```typescript
// In browser console (F12), check:
console.log('Check-ins:', checkIns); // Should show your guest check-ins
console.log('Selected ID:', selectedCheckIn.id); // Should match what you're clicking
```

---

**Next Step:** Try clicking "C-Form ready" again and share the terminal logs showing the `Generate C-Form request` and `Query result` lines. This will tell us exactly what's happening! 🔍


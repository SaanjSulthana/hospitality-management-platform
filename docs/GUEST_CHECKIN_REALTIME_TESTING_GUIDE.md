# Guest Check-In Realtime Testing Guide

> **Purpose:** Step-by-step testing guide for validating the realtime implementation  
> **Estimated Time:** 45-60 minutes  
> **Prerequisites:** Development environment running (backend + frontend)

---

## 🚀 Pre-Test Setup

### 1. Start Backend
```bash
cd backend
encore run
```

Verify backend is running at `http://localhost:4000`

### 2. Start Frontend
```bash
cd frontend
npm run dev
```

Verify frontend is running at `http://localhost:5173`

### 3. Login
- Open browser: `http://localhost:5173/login`
- Login with test credentials
- Navigate to Guest Check-In page

---

## 🧪 Test Scenario 1: Multi-Tab Leader Election

### Objective
Verify only 1 tab per browser session performs long-polling

### Steps
1. **Open 5 tabs:**
   - Open 5 browser tabs
   - Navigate all to Guest Check-In → Guest Details tab
   - Login in all tabs with the same user

2. **Open DevTools in each tab:**
   - Press F12 in each tab
   - Go to Network tab
   - Filter by "subscribe"

3. **Observe Network Activity:**
   - Look for requests to `/v1/guest-checkin/realtime/subscribe`

### Expected Results
✅ **PASS if:**
- Only 1 tab shows active/pending `subscribe` requests
- The other 4 tabs show NO `subscribe` requests
- Console logs show "Leader election" messages in 1 tab only

❌ **FAIL if:**
- Multiple tabs show active `subscribe` requests
- All tabs are polling independently

### Troubleshooting
If multiple tabs are polling:
1. Check console for "Failed to acquire lease" messages
2. Verify Web Locks API support: Open console and run:
   ```javascript
   'locks' in navigator
   ```
3. Try in a different browser (Chrome/Edge recommended)

---

## 🧪 Test Scenario 2: Leader Failover

### Objective
Verify new leader emerges when current leader closes

### Steps
1. **Identify Leader Tab:**
   - From previous test, note which tab has active `subscribe` requests
   - Label it "Tab 1 (Leader)"

2. **Close Leader Tab:**
   - Close Tab 1
   - Wait 5 seconds

3. **Check Remaining Tabs:**
   - Open DevTools Network in remaining tabs
   - Filter for "subscribe"

### Expected Results
✅ **PASS if:**
- Within 3-5 seconds, one of the remaining tabs becomes leader
- New leader starts showing `subscribe` requests
- Only 1 tab is now polling

❌ **FAIL if:**
- No tab becomes leader after 10 seconds
- Multiple tabs start polling

---

## 🧪 Test Scenario 3: Event Delivery (Create)

### Objective
Verify realtime updates when creating a guest

### Steps
1. **Setup:**
   - Open 2 tabs: Tab A and Tab B
   - Both on Guest Check-In → Guest Details
   - Logged in as same user

2. **Create Guest in Tab A:**
   - Click "Indian Guest" tab
   - Fill required fields:
     - Property: Select any property
     - Name: "Test Guest Realtime 1"
     - Email: "test1@curat.ai"
     - Phone: "+910000000001"
     - Address: "Test Address"
     - Aadhaar: "123456789012"
   - Upload Aadhaar document (any image)
   - Click "Complete Check-In"

3. **Observe Tab B:**
   - DO NOT refresh Tab B
   - Watch the guest list

### Expected Results
✅ **PASS if:**
- Tab B updates within 2 seconds
- New guest "Test Guest Realtime 1" appears in list
- No page refresh occurred
- No duplicate entries

❌ **FAIL if:**
- Tab B doesn't update (need manual refresh)
- Guest appears but with delay > 5 seconds
- Duplicate guests appear

### Debugging
If Tab B doesn't update:
1. Check Tab B console for errors
2. Check Network tab for `subscribe` requests
3. Check backend logs for event publishing:
   ```
   [GuestRealtimeSubscriber] Event buffered
   ```

---

## 🧪 Test Scenario 4: Property Filtering

### Objective
Verify property-specific event filtering

### Steps
1. **Setup:**
   - Ensure you have at least 2 properties
   - Open Tab A: Filter to Property 1
   - Open Tab B: Filter to Property 2

2. **Create Guest in Property 1:**
   - In Tab A, create guest:
     - Property: Property 1
     - Name: "Property 1 Guest"
     - Other required fields
   - Complete check-in

3. **Observe Both Tabs:**
   - Watch Tab A and Tab B

### Expected Results
✅ **PASS if:**
- Tab A updates instantly (new guest appears)
- Tab B does NOT update (different property filter)
- When Tab B changes filter to "All Properties", the guest appears

❌ **FAIL if:**
- Tab B updates even though it's filtered to different property
- Tab A doesn't update

---

## 🧪 Test Scenario 5: Logout Broadcast

### Objective
Verify realtime stops immediately on logout

### Steps
1. **Setup:**
   - Open Tab A and Tab B
   - Both logged in
   - Both on Guest Check-In page

2. **Monitor Tab B:**
   - Open DevTools Network in Tab B
   - Filter for "subscribe"
   - Note the active/pending request

3. **Logout from Tab A:**
   - In Tab A, click logout

4. **Observe Tab B:**
   - Watch Network tab
   - Watch console

### Expected Results
✅ **PASS if:**
- Tab B's active `subscribe` request is aborted within 200ms
- No new `subscribe` requests start in Tab B
- Console shows "auth-control logout" message
- No "jwt malformed" or authentication errors
- Tab B navigates to login page or shows session expired banner

❌ **FAIL if:**
- Tab B continues making `subscribe` requests
- See "jwt malformed" errors
- Tab B doesn't redirect/show banner

---

## 🧪 Test Scenario 6: Fast-Empty Backoff

### Objective
Verify RTT-aware backoff prevents wasted requests

### Steps
1. **Setup:**
   - Open 1 tab only
   - Navigate to Guest Details tab
   - DO NOT create any guests

2. **Monitor Network:**
   - Open DevTools Network
   - Filter for "subscribe"
   - Note the timing of requests

3. **Observe Pattern (60 seconds):**
   - Watch the timing between requests
   - Note the duration of each request

### Expected Results
✅ **PASS if:**
- First request: ~25 seconds duration (timeout)
- After 2-3 empty responses: Next request delayed 2-5 seconds
- Steady-state pattern: 25s wait + 2-5s delay = ~27-30s total

❌ **FAIL if:**
- Requests occur immediately after previous completes (0s delay)
- Pattern doesn't change after multiple empty responses

### Understanding
- **Fast-empty:** Request completes < 1.5s with no events
- **Backoff:** Hook adds 2-5s delay before next request
- **Purpose:** Reduce server load when no activity

---

## 🧪 Test Scenario 7: Event Delivery (Update & Delete)

### Objective
Verify realtime for update and delete operations

### Steps
1. **Setup:**
   - Open Tab A and Tab B
   - Both on Guest Details tab
   - Create a test guest if needed

2. **Update Guest (Tab A):**
   - Click ⋮ menu on any guest
   - Select "View Details"
   - Modify a field (e.g., room number)
   - Save changes

3. **Observe Tab B:**
   - Watch for guest to update

4. **Delete Guest (Tab A):**
   - Click ⋮ menu on the same guest
   - Select "Delete"
   - Confirm deletion

5. **Observe Tab B:**
   - Watch for guest to disappear

### Expected Results
✅ **PASS if:**
- **Update:** Tab B shows updated guest details within 2 seconds
- **Delete:** Tab B removes guest from list within 2 seconds
- No page refresh required
- No visual glitches

❌ **FAIL if:**
- Updates don't appear in Tab B
- Guest remains in Tab B after deletion
- Need manual refresh

---

## 📊 Metrics Validation

### Check Buffer Metrics

1. **Open Terminal:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:4000/v1/guest-checkin/realtime/metrics
   ```

2. **Verify Response:**
   ```json
   {
     "orgs": {
       "total": >= 1,
       "active_last_5m": >= 0
     },
     "events": {
       "published_total": >= number of events created,
       "delivered_total": >= published_total,
       "dropped_total": 0
     },
     "buffers": {
       "total_size": >= 0,
       "avg_per_org": >= 0
     },
     "subscribers": {
       "active_count": >= 1 (if tabs open)
     }
   }
   ```

### Expected Metrics
✅ **PASS if:**
- `dropped_total` = 0
- `delivered_total` >= `published_total`
- `active_count` = number of leader tabs currently open

❌ **FAIL if:**
- `dropped_total` > 0 (events lost)
- `delivered_total` < `published_total` (delivery issues)

---

## 🔍 Backend Logs Verification

### Check Logs During Test

1. **View Encore Logs:**
   - Watch terminal where `encore run` is running

2. **Look for Key Messages:**

**Subscribe Started:**
```
[GuestRealtimeSubscribe][started] orgId=123 userId=456 propertyId=all origin=http://localhost:5173
```

**Event Published:**
```
[GuestRealtimeSubscriber] Event buffered: eventId=... eventType=guest_created orgId=123 propertyId=1 entityId=789
```

**Subscribe Completed:**
```
[GuestRealtimeSubscribe][completed] orgId=123 userId=456 propertyId=all events=1 durationMs=245 origin=http://localhost:5173
```

### Expected Pattern
✅ **PASS if:**
- Subscribe started → Event buffered → Subscribe completed with events=1
- Duration < 500ms when events exist
- Duration ~25000ms when no events (timeout)

---

## 📋 Test Results Summary

### Record Results

| Test Scenario | Status | Notes |
|--------------|--------|-------|
| 1. Multi-Tab Leader Election | ⬜ PASS / ⬜ FAIL | |
| 2. Leader Failover | ⬜ PASS / ⬜ FAIL | |
| 3. Event Delivery (Create) | ⬜ PASS / ⬜ FAIL | |
| 4. Property Filtering | ⬜ PASS / ⬜ FAIL | |
| 5. Logout Broadcast | ⬜ PASS / ⬜ FAIL | |
| 6. Fast-Empty Backoff | ⬜ PASS / ⬜ FAIL | |
| 7. Event Delivery (Update/Delete) | ⬜ PASS / ⬜ FAIL | |
| 8. Metrics Validation | ⬜ PASS / ⬜ FAIL | |
| 9. Backend Logs | ⬜ PASS / ⬜ FAIL | |

### Overall Status
- **All PASS:** ✅ Ready for production
- **1-2 FAIL:** ⚠️ Investigate and fix
- **3+ FAIL:** ❌ Major issues - do not deploy

---

## 🆘 Common Issues & Fixes

### Issue: No realtime updates at all
**Fix:**
1. Check backend is running: `encore run`
2. Check frontend console for errors
3. Verify login token is valid
4. Check CORS settings in `backend/encore.app`

### Issue: "401 Unauthorized" in Network tab
**Fix:**
1. Refresh login token
2. Check localStorage has `accessToken`
3. Verify backend auth is working:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:4000/v1/guest-checkin/list
   ```

### Issue: Events delayed > 5 seconds
**Fix:**
1. Check backend logs for slow queries
2. Verify buffer isn't overflowing (check metrics)
3. Ensure only 1 leader tab is polling

### Issue: Multiple leaders
**Fix:**
1. Check Web Locks API support
2. Try clearing localStorage
3. Try different browser
4. Check for JavaScript errors in console

---

## ✅ Sign-Off

**Tester:** _________________  
**Date:** _________________  
**Environment:** Dev / Staging / Production  
**Overall Result:** PASS / FAIL  
**Notes:**

_______________________________________________________
_______________________________________________________
_______________________________________________________



#!/bin/bash

# Test Script for Audit Logs Real-Time System
# This verifies that the fix is working correctly

echo "🧪 Testing Audit Logs Real-Time System"
echo "======================================"
echo ""

# Get backend URL
BACKEND_URL="${ENCORE_APP_URL:-http://localhost:4000}"
echo "Backend URL: $BACKEND_URL"
echo ""

# Get access token
echo "Please enter your access token:"
read -s ACCESS_TOKEN
echo ""

echo "📊 Test 1: Subscribe to Audit Events (Long-Polling)"
echo "---------------------------------------------------"
echo "Starting long-poll connection..."
echo "Expected: Connection should wait ~25 seconds, then return"
echo ""

START_TIME=$(date +%s)
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$BACKEND_URL/guest-checkin/audit-events/subscribe/v2")

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "Response:"
echo "$RESPONSE"
echo ""
echo "Duration: ${DURATION}s"
echo ""

if [ $DURATION -ge 20 ]; then
  echo "✅ PASS: Long-polling working (waited $DURATION seconds)"
else
  echo "❌ FAIL: Connection completed too quickly ($DURATION seconds)"
  echo "Expected: Should wait ~25 seconds if no events"
fi
echo ""

echo "📊 Test 2: Create Audit Log and Check Real-Time Delivery"
echo "--------------------------------------------------------"
echo "This test requires backend logs. Please:"
echo "1. Open another terminal and run:"
echo "   tail -f encore.log | grep -E 'Audit log created|Event buffered|Events delivered'"
echo ""
echo "2. In your browser:"
echo "   - Open Audit Logs tab"
echo "   - Create a guest check-in"
echo "   - Watch for 'Real audit event received' in console"
echo ""
echo "3. Check backend logs for sequence:"
echo "   ✅ 'Audit log created'"
echo "   ✅ 'Event buffered'"
echo "   ✅ 'Events delivered'"
echo ""
read -p "Press Enter when ready to continue..."

echo ""
echo "📊 Test 3: Filter Debouncing"
echo "----------------------------"
echo "Manual test required:"
echo "1. Open Audit Logs tab in browser"
echo "2. Open DevTools Network tab"
echo "3. Type rapidly in action filter: 'create_checkin'"
echo "4. Count API calls to /listAuditLogs"
echo ""
echo "Expected: Only 1 call after typing stops (500ms delay)"
echo "NOT expected: Multiple calls while typing"
echo ""
read -p "Press Enter when ready to continue..."

echo ""
echo "📊 Test 4: Check Database Load"
echo "------------------------------"
echo "Verifying no COUNT(*) queries on guest_audit_logs..."
echo ""

# This would need database access - skipping for now
echo "⏭️  SKIPPED: Requires database access"
echo "To test manually, run:"
echo "  SELECT COUNT(*) FROM pg_stat_statements"
echo "  WHERE query LIKE '%guest_audit_logs%COUNT%';"
echo ""
echo "Expected: 0 (no COUNT queries)"
echo ""

echo "📊 Test 5: Long-Poll Reconnection"
echo "--------------------------------"
echo "Testing auto-reconnect behavior..."
echo ""
echo "Starting 3 consecutive long-polls:"

for i in 1 2 3; do
  echo "Poll #$i..."
  START=$(date +%s)
  curl -s -m 5 \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$BACKEND_URL/guest-checkin/audit-events/subscribe/v2" > /dev/null
  
  END=$(date +%s)
  DURATION=$((END - START))
  
  if [ $DURATION -ge 3 ]; then
    echo "  ✅ Poll #$i: Waited ${DURATION}s (expected ~5s with -m 5 timeout)"
  else
    echo "  ❌ Poll #$i: Completed too quickly (${DURATION}s)"
  fi
done

echo ""
echo "======================================"
echo "🎉 Testing Complete!"
echo "======================================"
echo ""
echo "Summary:"
echo "--------"
echo "✅ Long-polling: Check if connections wait ~25 seconds"
echo "✅ Real-time delivery: Check backend logs for event flow"
echo "✅ Filter debouncing: Verify in browser DevTools"
echo "✅ No COUNT queries: Verify in database"
echo "✅ Auto-reconnect: Check multiple polls work"
echo ""
echo "Next Steps:"
echo "----------"
echo "1. Review backend logs for 'Event buffered' and 'Events delivered'"
echo "2. Test in browser: Create guest → Audit logs update automatically"
echo "3. Monitor database: Verify no COUNT(*) queries"
echo ""
echo "If all tests pass: 🚀 System is working correctly!"
echo "If any test fails: 📋 Check AUDIT_LOGS_FIX_COMPLETE_V2.md troubleshooting guide"
echo ""


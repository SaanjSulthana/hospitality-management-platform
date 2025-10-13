#!/bin/bash

# Test script to verify guest check-in fix
echo "🧪 Testing Guest Check-in Fix"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="http://localhost:4000"
TEST_TOKEN="your_test_token_here"  # Replace with actual token

echo -e "${YELLOW}Note: Make sure to replace TEST_TOKEN with a valid authentication token${NC}"
echo ""

# Test 1: Indian Guest Check-in
echo "📝 Test 1: Indian Guest Check-in"
echo "--------------------------------"

INDIAN_PAYLOAD='{
  "propertyId": 1,
  "guestType": "indian",
  "fullName": "Rajesh Kumar",
  "email": "rajesh.kumar@example.com",
  "phone": "+919876543210",
  "address": "123 MG Road, Bangalore, Karnataka 560001",
  "aadharNumber": "123456789012",
  "panNumber": "ABCDE1234F",
  "roomNumber": "101",
  "numberOfGuests": 2,
  "expectedCheckoutDate": "2025-10-15"
}'

echo "Payload:"
echo "$INDIAN_PAYLOAD" | jq '.'
echo ""

echo "Making API call..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${API_BASE_URL}/guest-checkin/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -d "$INDIAN_PAYLOAD")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response Body:"
echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Indian Guest Check-in: SUCCESS${NC}"
    CHECKIN_ID=$(echo "$RESPONSE_BODY" | jq -r '.id' 2>/dev/null)
    echo "Check-in ID: $CHECKIN_ID"
else
    echo -e "${RED}❌ Indian Guest Check-in: FAILED${NC}"
fi

echo ""
echo "=============================="
echo ""

# Test 2: Foreign Guest Check-in
echo "📝 Test 2: Foreign Guest Check-in"
echo "----------------------------------"

FOREIGN_PAYLOAD='{
  "propertyId": 1,
  "guestType": "foreign",
  "fullName": "John Smith",
  "email": "john.smith@example.com",
  "phone": "+14155551234",
  "address": "789 Market Street, San Francisco, CA 94102, USA",
  "passportNumber": "US123456789",
  "country": "United States",
  "visaType": "Tourist",
  "visaExpiryDate": "2025-12-31",
  "roomNumber": "205",
  "numberOfGuests": 2,
  "expectedCheckoutDate": "2025-10-20"
}'

echo "Payload:"
echo "$FOREIGN_PAYLOAD" | jq '.'
echo ""

echo "Making API call..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${API_BASE_URL}/guest-checkin/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -d "$FOREIGN_PAYLOAD")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response Body:"
echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Foreign Guest Check-in: SUCCESS${NC}"
    CHECKIN_ID=$(echo "$RESPONSE_BODY" | jq -r '.id' 2>/dev/null)
    echo "Check-in ID: $CHECKIN_ID"
else
    echo -e "${RED}❌ Foreign Guest Check-in: FAILED${NC}"
fi

echo ""
echo "=============================="
echo ""

# Test 3: Validation Error (Missing Aadhar)
echo "📝 Test 3: Validation Error Test (Missing Aadhar)"
echo "------------------------------------------------"

INVALID_PAYLOAD='{
  "propertyId": 1,
  "guestType": "indian",
  "fullName": "Test User",
  "email": "test@example.com",
  "phone": "+919876543212",
  "address": "Test Address"
}'

echo "Payload (Missing Aadhar):"
echo "$INVALID_PAYLOAD" | jq '.'
echo ""

echo "Making API call..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${API_BASE_URL}/guest-checkin/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -d "$INVALID_PAYLOAD")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response Body:"
echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"

if [ "$HTTP_STATUS" = "400" ]; then
    echo -e "${GREEN}✅ Validation Error Test: SUCCESS (Expected 400)${NC}"
else
    echo -e "${RED}❌ Validation Error Test: FAILED (Expected 400, got $HTTP_STATUS)${NC}"
fi

echo ""
echo "=============================="
echo ""

# Test 4: Check Audit Logs
echo "📝 Test 4: Check Recent Audit Logs"
echo "----------------------------------"

echo "Fetching recent audit logs..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "${API_BASE_URL}/guest-checkin/audit-logs?limit=5" \
  -H "Authorization: Bearer ${TEST_TOKEN}")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "HTTP Status: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Audit Logs: SUCCESS${NC}"
    echo "Recent logs:"
    echo "$RESPONSE_BODY" | jq '.logs[] | {timestamp, action_type, guest_name, success}' 2>/dev/null || echo "$RESPONSE_BODY"
else
    echo -e "${RED}❌ Audit Logs: FAILED${NC}"
fi

echo ""
echo "=============================="
echo ""

echo "🎉 Test Summary:"
echo "- Check the results above"
echo "- Green ✅ indicates success"
echo "- Red ❌ indicates failure"
echo ""
echo "📝 Next Steps:"
echo "1. Replace TEST_TOKEN with a valid authentication token"
echo "2. Ensure backend server is running on localhost:4000"
echo "3. Ensure database is accessible and migrations are applied"
echo "4. Run this script to verify the fix"
echo ""
echo "🔍 To check database directly:"
echo "SELECT * FROM guest_checkins ORDER BY created_at DESC LIMIT 5;"
echo "SELECT * FROM guest_audit_logs WHERE action_type = 'create_checkin' ORDER BY timestamp DESC LIMIT 5;"

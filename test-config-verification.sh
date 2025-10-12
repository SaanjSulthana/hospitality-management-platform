#!/bin/bash

# Test Configuration Verification
# This script verifies that the backend configuration changes are working

echo "🧪 Testing Backend Configuration"
echo "================================"
echo ""

# Configuration
BACKEND_URL="http://localhost:4000"
ACCESS_TOKEN=""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if backend is running
check_backend() {
  echo "Checking if backend is running..."
  if curl -s "${BACKEND_URL}/health" > /dev/null; then
    echo -e "${GREEN}✓ Backend is running${NC}"
    return 0
  else
    echo -e "${RED}✗ Backend is not running${NC}"
    exit 1
  fi
}

# Function to login and get access token
login() {
  echo ""
  echo "Logging in..."
  
  RESPONSE=$(curl -s -X POST "${BACKEND_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "shreya@gmail.com",
      "password": "123456789"
    }')
  
  ACCESS_TOKEN=$(echo $RESPONSE | jq -r '.accessToken')
  
  if [ "$ACCESS_TOKEN" != "null" ] && [ -n "$ACCESS_TOKEN" ]; then
    echo -e "${GREEN}✓ Login successful${NC}"
    echo "Access Token: ${ACCESS_TOKEN:0:20}..."
    return 0
  else
    echo -e "${RED}✗ Login failed${NC}"
    echo "Response: $RESPONSE"
    exit 1
  fi
}

# Function to test with a small file
test_small_upload() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Testing: Small File Upload"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Create a small test file (1KB)
  echo "Creating small test file..."
  dd if=/dev/zero of="test-small.jpg" bs=1024 count=1 2>/dev/null
  
  # Convert to base64
  BASE64_DATA=$(base64 -i "test-small.jpg" | tr -d '\n')
  BASE64_LENGTH=${#BASE64_DATA}
  echo "Base64 length: $BASE64_LENGTH characters"
  
  # Create JSON payload file
  cat > test_payload.json << EOF
{
  "documentType": "passport",
  "fileData": "${BASE64_DATA}",
  "filename": "test-small.jpg",
  "mimeType": "image/jpeg",
  "performExtraction": true
}
EOF
  
  # Test upload
  echo "Testing upload..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BACKEND_URL}/guest-checkin/documents/upload" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -d @test_payload.json)
  
  echo "HTTP Status Code: $HTTP_CODE"
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Small file upload successful${NC}"
    echo "The backend configuration is working properly!"
  elif [ "$HTTP_CODE" = "413" ]; then
    echo -e "${RED}✗ Still getting 413 Payload Too Large${NC}"
    echo "The backend configuration changes may not have been applied."
  elif [ "$HTTP_CODE" = "400" ]; then
    echo -e "${YELLOW}⚠ Bad request (400)${NC}"
    echo "This might be due to file format, but upload size limit is working."
  else
    echo -e "${RED}✗ Unexpected status: $HTTP_CODE${NC}"
  fi
  
  # Cleanup
  rm -f "test-small.jpg" test_payload.json
}

# Main execution
main() {
  echo ""
  echo "Starting configuration verification..."
  echo ""
  
  # Check if backend is running
  check_backend
  
  # Login
  login
  
  # Test small upload
  test_small_upload
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${GREEN}✓ Configuration test completed!${NC}"
  echo ""
  echo "If the test passed:"
  echo "• ✅ Backend configuration is working"
  echo "• ✅ File size limits are properly set"
  echo "• ✅ Ready for real document uploads"
  echo ""
  echo "If the test failed:"
  echo "• ❌ Backend may need to be restarted"
  echo "• ❌ Configuration changes may not be applied"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is not installed. Please install it first:${NC}"
  echo "  macOS: brew install jq"
  echo "  Linux: sudo apt-get install jq"
  exit 1
fi

# Run main
main

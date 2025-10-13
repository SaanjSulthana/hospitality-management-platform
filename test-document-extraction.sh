#!/bin/bash

# Test Document Extraction with Test Images
# This script tests the guest check-in document upload and extraction

echo "🧪 Testing Document Extraction System"
echo "======================================"
echo ""

# Configuration
BACKEND_URL="http://localhost:4000"
ACCESS_TOKEN=""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if backend is running
check_backend() {
  echo "Checking if backend is running..."
  if curl -s "${BACKEND_URL}/health" > /dev/null; then
    echo -e "${GREEN}✓ Backend is running${NC}"
    return 0
  else
    echo -e "${RED}✗ Backend is not running. Please start it with 'cd backend && encore run'${NC}"
    exit 1
  fi
}

# Function to login and get access token
login() {
  echo ""
  echo "Logging in..."
  
  # Try to login with user credentials
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

# Function to upload and test document
test_document() {
  local file_path=$1
  local document_type=$2
  local test_name=$3
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Testing: $test_name"
  echo "File: $file_path"
  echo "Document Type: $document_type"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if [ ! -f "$file_path" ]; then
    echo -e "${RED}✗ File not found: $file_path${NC}"
    return 1
  fi
  
  echo "File size: $(ls -lh "$file_path" | awk '{print $5}')"
  
  # Convert image to base64
  echo "Converting image to base64..."
  BASE64_DATA=$(base64 -i "$file_path")
  
  # Get file extension
  EXTENSION="${file_path##*.}"
  MIME_TYPE="image/${EXTENSION}"
  if [ "$EXTENSION" = "jpg" ]; then
    MIME_TYPE="image/jpeg"
  fi
  
  echo "MIME Type: $MIME_TYPE"
  echo "Base64 data length: ${#BASE64_DATA} characters"
  
  # Get filename from path
  FILENAME=$(basename "$file_path")
  
  # Upload document
  echo ""
  echo "Uploading document..."
  RESPONSE=$(curl -s -X POST "${BACKEND_URL}/guest-checkin/documents/upload" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -d "{
      \"documentType\": \"${document_type}\",
      \"fileData\": \"${BASE64_DATA}\",
      \"filename\": \"${FILENAME}\",
      \"mimeType\": \"${MIME_TYPE}\",
      \"performExtraction\": true
    }")
  
  # Check if upload was successful
  SUCCESS=$(echo $RESPONSE | jq -r '.success')
  
  if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Upload successful${NC}"
    
    # Extract and display results
    DOCUMENT_ID=$(echo $RESPONSE | jq -r '.document.id')
    DETECTED_TYPE=$(echo $RESPONSE | jq -r '.extraction.detectedDocumentType // "Not detected"')
    CONFIDENCE=$(echo $RESPONSE | jq -r '.extraction.overallConfidence // 0')
    EXTRACTION_STATUS=$(echo $RESPONSE | jq -r '.extraction.status')
    
    echo ""
    echo "📄 Document Details:"
    echo "  • Document ID: $DOCUMENT_ID"
    echo "  • Detected Type: $DETECTED_TYPE"
    echo "  • Overall Confidence: ${CONFIDENCE}%"
    echo "  • Extraction Status: $EXTRACTION_STATUS"
    
    # Display extracted fields
    echo ""
    echo "📋 Extracted Fields:"
    echo $RESPONSE | jq -r '.extraction.data | to_entries[] | "  • \(.key): \(.value.value) (confidence: \(.value.confidence)%)"'
    
    # Display full JSON for debugging
    echo ""
    echo "Full Response (JSON):"
    echo $RESPONSE | jq '.'
    
    return 0
  else
    echo -e "${RED}✗ Upload failed${NC}"
    echo "Response: $RESPONSE"
    return 1
  fi
}

# Main execution
main() {
  echo ""
  echo "Starting tests..."
  echo ""
  
  # Check if backend is running
  check_backend
  
  # Login
  login
  
  # Test 1: Aadhaar Card
  if [ -f "test-aadhaar.jpg" ] || [ -f "backend/aadhaar-test.jpg" ]; then
    AADHAAR_FILE="test-aadhaar.jpg"
    [ -f "backend/aadhaar-test.jpg" ] && AADHAAR_FILE="backend/aadhaar-test.jpg"
    test_document "$AADHAAR_FILE" "other" "Aadhaar Card Auto-Detection"
  else
    echo -e "${YELLOW}⚠ Aadhaar test image not found${NC}"
  fi
  
  # Test 2: Driving License
  if [ -f "test-driving-license.jpg" ] || [ -f "backend/driving-license-test.jpg" ]; then
    DL_FILE="test-driving-license.jpg"
    [ -f "backend/driving-license-test.jpg" ] && DL_FILE="backend/driving-license-test.jpg"
    test_document "$DL_FILE" "other" "Driving License Auto-Detection"
  else
    echo -e "${YELLOW}⚠ Driving License test image not found${NC}"
  fi
  
  # Test 3: Election Card (Voter ID)
  if [ -f "test-election-card.jpg" ]; then
    test_document "test-election-card.jpg" "other" "Election Card (Voter ID) Auto-Detection"
  else
    echo -e "${YELLOW}⚠ Election Card test image not found${NC}"
  fi
  
  # Test 4: PAN Card
  if [ -f "backend/pan-card-test.jpg" ]; then
    test_document "backend/pan-card-test.jpg" "other" "PAN Card Auto-Detection"
  else
    echo -e "${YELLOW}⚠ PAN Card test image not found${NC}"
  fi
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${GREEN}✓ All tests completed!${NC}"
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


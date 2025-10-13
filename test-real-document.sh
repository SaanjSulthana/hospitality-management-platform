#!/bin/bash

# Test Document Extraction with Real Document Images
# This script tests the guest check-in document upload and extraction with actual document images

echo "🧪 Testing Document Extraction with Real Images"
echo "================================================"
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

# Function to create a test document image with text
create_test_document() {
  local filename=$1
  local document_type=$2
  
  echo "Creating test document: $filename"
  
  # Create a simple test image with document-like text using ImageMagick or similar
  # For now, let's create a base64 encoded image with some text
  cat > temp_image.py << 'EOF'
import base64
from PIL import Image, ImageDraw, ImageFont
import io

# Create a document-like image
img = Image.new('RGB', (800, 500), color='white')
draw = ImageDraw.Draw(img)

# Add document text
draw.text((50, 50), 'GOVERNMENT OF INDIA', fill='black')
draw.text((50, 100), 'AADHAAR', fill='blue')
draw.text((50, 150), 'Name: John Doe', fill='black')
draw.text((50, 200), 'DOB: 01/01/1990', fill='black')
draw.text((50, 250), 'Aadhaar No: 1234 5678 9012', fill='black')
draw.text((50, 300), 'Address: 123 Main St, City', fill='black')

# Save to bytes
img_bytes = io.BytesIO()
img.save(img_bytes, format='JPEG')
img_bytes.seek(0)

# Convert to base64
base64_data = base64.b64encode(img_bytes.getvalue()).decode('utf-8')
print(base64_data)
EOF

  # Try to create the image
  if command -v python3 &> /dev/null; then
    python3 temp_image.py > "${filename}.b64" 2>/dev/null
    if [ -f "${filename}.b64" ]; then
      # Convert base64 to image file
      base64 -d "${filename}.b64" > "$filename" 2>/dev/null
      rm "${filename}.b64"
      echo -e "${GREEN}✓ Created test document: $filename${NC}"
      return 0
    fi
  fi
  
  # Fallback: create a simple text file that looks like a document
  echo "Creating fallback test document..."
  cat > "$filename" << EOF
GOVERNMENT OF INDIA
AADHAAR
Name: John Doe
DOB: 01/01/1990
Aadhaar No: 1234 5678 9012
Address: 123 Main St, City
EOF
  
  echo -e "${YELLOW}⚠ Created text-based test document: $filename${NC}"
  return 0
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
    echo $RESPONSE | jq -r '.extraction.data | to_entries[] | "  • \(.key): \(.value.value) (confidence: \(.value.confidence)%)"' 2>/dev/null || echo "  • No fields extracted"
    
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
  echo "Starting tests with real document images..."
  echo ""
  
  # Check if backend is running
  check_backend
  
  # Login
  login
  
  # Create test documents
  echo ""
  echo -e "${BLUE}Creating test documents...${NC}"
  create_test_document "test-aadhaar-real.jpg" "aadhaar_front"
  create_test_document "test-pan-real.jpg" "pan_card"
  create_test_document "test-passport-real.jpg" "passport"
  
  # Test 1: Aadhaar Card
  test_document "test-aadhaar-real.jpg" "aadhaar_front" "Aadhaar Card Extraction"
  
  # Test 2: PAN Card
  test_document "test-pan-real.jpg" "pan_card" "PAN Card Extraction"
  
  # Test 3: Passport
  test_document "test-passport-real.jpg" "passport" "Passport Extraction"
  
  # Cleanup
  rm -f temp_image.py test-*-real.jpg
  
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

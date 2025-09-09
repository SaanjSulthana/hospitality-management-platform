# Test Plan for Enhanced Task Cards with Reference Images

## Test Environment Setup
- **Frontend**: React + Vite (localhost:5173)
- **Backend**: Encore.js (localhost:4000)
- **Database**: PostgreSQL
- **Browser**: Chrome with DevTools

## Test Categories

### 1. Image Upload Functionality Tests
- [ ] **1.1**: Test drag-and-drop image upload in task cards
- [ ] **1.2**: Test click-to-upload image functionality
- [ ] **1.3**: Test multiple image upload (up to 5 images)
- [ ] **1.4**: Test image file type validation (JPG, PNG, GIF, WebP)
- [ ] **1.5**: Test image size validation (max 5MB per image)
- [ ] **1.6**: Test upload progress indicators
- [ ] **1.7**: Test upload error handling
- [ ] **1.8**: Test image upload during task creation

### 2. Image Display Tests
- [ ] **2.1**: Test image display in task cards
- [ ] **2.2**: Test image thumbnail generation
- [ ] **2.3**: Test image loading states
- [ ] **2.4**: Test broken image fallback
- [ ] **2.5**: Test image aspect ratio preservation
- [ ] **2.6**: Test image counter display (e.g., "2/5")

### 3. Image Modal Tests
- [ ] **3.1**: Test image modal opening on click
- [ ] **3.2**: Test full-screen image display
- [ ] **3.3**: Test modal close functionality
- [ ] **3.4**: Test modal keyboard navigation (ESC key)
- [ ] **3.5**: Test modal responsive design

### 4. Image Management Tests
- [ ] **4.1**: Test image deletion functionality
- [ ] **4.2**: Test delete confirmation
- [ ] **4.3**: Test delete loading states
- [ ] **4.4**: Test delete error handling
- [ ] **4.5**: Test image counter updates after deletion

### 5. Backend API Tests
- [ ] **5.1**: Test image upload API endpoint
- [ ] **5.2**: Test image retrieval API endpoint
- [ ] **5.3**: Test image deletion API endpoint
- [ ] **5.4**: Test image serving endpoint
- [ ] **5.5**: Test API error responses
- [ ] **5.6**: Test authentication for image endpoints

### 6. Database Tests
- [ ] **6.1**: Test image metadata storage
- [ ] **6.2**: Test image file storage
- [ ] **6.3**: Test image-task relationship
- [ ] **6.4**: Test image deletion from database
- [ ] **6.5**: Test database constraints

### 7. UI/UX Tests
- [ ] **7.1**: Test responsive design on mobile
- [ ] **7.2**: Test responsive design on tablet
- [ ] **7.3**: Test responsive design on desktop
- [ ] **7.4**: Test touch interactions on mobile
- [ ] **7.5**: Test hover effects on desktop
- [ ] **7.6**: Test loading states and animations
- [ ] **7.7**: Test error states and messages

### 8. Performance Tests
- [ ] **8.1**: Test image upload performance
- [ ] **8.2**: Test image loading performance
- [ ] **8.3**: Test large image handling
- [ ] **8.4**: Test multiple image upload performance
- [ ] **8.5**: Test memory usage with multiple images

### 9. Security Tests
- [ ] **9.1**: Test file type validation
- [ ] **9.2**: Test file size limits
- [ ] **9.3**: Test malicious file upload prevention
- [ ] **9.4**: Test authentication for image operations
- [ ] **9.5**: Test authorization for image access

### 10. Integration Tests
- [ ] **10.1**: Test task creation with images
- [ ] **10.2**: Test task editing with images
- [ ] **10.3**: Test task deletion with images
- [ ] **10.4**: Test task status updates with images
- [ ] **10.5**: Test task assignment with images

## Test Data
- **Sample Images**: Various formats (JPG, PNG, GIF, WebP)
- **Sample Sizes**: Small (100KB), Medium (1MB), Large (4MB)
- **Sample Tasks**: Different types (maintenance, housekeeping, service)
- **Sample Properties**: Multiple properties for testing

## Test Results Tracking
- **Pass**: ✅
- **Fail**: ❌
- **Skip**: ⏭️
- **Blocked**: 🚫

## Test Execution Log
- **Date**: 2025-01-27
- **Tester**: AI Assistant
- **Environment**: Development
- **Browser**: Chrome DevTools
- **Backend**: Encore.js
- **Database**: PostgreSQL

## Issues Found
- [ ] Issue 1: Description
- [ ] Issue 2: Description
- [ ] Issue 3: Description

## Recommendations
- [ ] Recommendation 1: Description
- [ ] Recommendation 2: Description
- [ ] Recommendation 3: Description

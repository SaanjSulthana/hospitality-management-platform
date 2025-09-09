# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-01-27-enhanced-task-cards/spec.md

## Endpoints

### POST /api/tasks/:id/images

**Purpose:** Upload reference images for a specific task
**Parameters:** 
- taskId (path parameter)
- image file (multipart/form-data)
**Response:** 
```json
{
  "success": true,
  "image": {
    "id": "img_123",
    "filename": "reference_image.jpg",
    "filePath": "/uploads/tasks/img_123.jpg",
    "isPrimary": false
  }
}
```
**Errors:** 400 (Invalid file format), 413 (File too large), 500 (Upload failed)

### GET /api/tasks/:id/images

**Purpose:** Retrieve all images for a specific task
**Parameters:** taskId (path parameter)
**Response:**
```json
{
  "success": true,
  "images": [
    {
      "id": "img_123",
      "filename": "reference_image.jpg",
      "filePath": "/uploads/tasks/img_123.jpg",
      "isPrimary": true,
      "createdAt": "2025-01-27T10:00:00Z"
    }
  ]
}
```

### DELETE /api/tasks/:id/images/:imageId

**Purpose:** Delete a specific image from a task
**Parameters:** taskId and imageId (path parameters)
**Response:**
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```
**Errors:** 404 (Image not found), 500 (Delete failed)

### PUT /api/tasks/:id/images/:imageId/primary

**Purpose:** Set an image as the primary image for a task
**Parameters:** taskId and imageId (path parameters)
**Response:**
```json
{
  "success": true,
  "message": "Primary image updated"
}
```

### GET /api/images/:imageId

**Purpose:** Serve image files for display
**Parameters:** imageId (path parameter)
**Response:** Image file with proper headers
**Errors:** 404 (Image not found)

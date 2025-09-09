# Database Schema

This is the database schema verification for the spec detailed in @.agent-os/specs/2025-01-09-task-image-upload-frontend-fix/spec.md

## Current Database Schema

### task_attachments Table
```sql
CREATE TABLE task_attachments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Verification Requirements

### Upload Verification
After each image upload, verify:
1. **Record Creation**: New record exists in `task_attachments` table
2. **Data Integrity**: All fields are populated correctly (task_id, org_id, file_name, file_url, file_size, mime_type)
3. **File Storage**: Physical file exists at the specified `file_url` path
4. **Task Association**: `task_id` correctly references the target task
5. **Organization Association**: `org_id` matches the authenticated user's organization

### Delete Verification
After each image deletion, verify:
1. **Record Removal**: Record is deleted from `task_attachments` table
2. **File Cleanup**: Physical file is removed from storage
3. **Task Update**: Task's `referenceImages` array is updated to reflect the deletion
4. **No Orphaned Records**: No dangling references remain

### Data Consistency Checks
1. **Frontend-Backend Sync**: Frontend `referenceImages` array matches database records
2. **File Count Accuracy**: Number of images in UI matches database count
3. **Image Metadata**: Displayed image information matches database fields
4. **Error State Handling**: Failed operations don't leave inconsistent state

## Verification Methods

### API Response Validation
- Verify upload API returns correct image ID and metadata
- Verify delete API returns success confirmation
- Check for proper error responses and status codes

### Database Query Verification
```sql
-- Check if image exists after upload
SELECT * FROM task_attachments WHERE id = ? AND task_id = ? AND org_id = ?;

-- Count images for a task
SELECT COUNT(*) FROM task_attachments WHERE task_id = ? AND org_id = ?;

-- Verify image is deleted
SELECT * FROM task_attachments WHERE id = ?; -- Should return no rows
```

### File System Verification
- Verify uploaded files exist in the correct directory structure
- Check file permissions and accessibility
- Confirm deleted files are removed from storage

## Error Scenarios to Test

1. **Upload Failures**: Network errors, file size limits, invalid file types
2. **Delete Failures**: Permission errors, file not found, database constraints
3. **Concurrent Operations**: Multiple users uploading/deleting simultaneously
4. **Partial Failures**: Upload succeeds but database write fails, or vice versa
5. **Authentication Issues**: Expired tokens, insufficient permissions

## Success Criteria

- [ ] All uploads create proper database records
- [ ] All deletions remove database records and files
- [ ] Frontend state always matches database state
- [ ] No orphaned files or database records
- [ ] Error states are properly handled and reported
- [ ] Data consistency is maintained across all operations

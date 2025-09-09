# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-01-27-enhanced-task-cards/spec.md

## Changes

### Tasks Table Modifications

Add new columns to the existing tasks table:

```sql
ALTER TABLE tasks ADD COLUMN reference_images JSON DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN primary_image_id VARCHAR(255) DEFAULT NULL;
```

### New Images Table

Create a new table for storing image metadata:

```sql
CREATE TABLE task_images (
    id VARCHAR(255) PRIMARY KEY,
    task_id INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    INDEX idx_task_id (task_id),
    INDEX idx_primary_image (task_id, is_primary)
);
```

## Specifications

- **reference_images**: JSON array storing image metadata for quick access
- **primary_image_id**: Reference to the main image to display in task cards
- **task_images table**: Separate table for detailed image metadata and file management
- **Foreign Key**: Proper relationship with tasks table with cascade delete
- **Indexes**: Optimized queries for task images and primary image lookups

## Rationale

- **JSON Column**: Allows flexible storage of image metadata without complex joins for basic display
- **Separate Images Table**: Provides detailed file management and supports multiple images per task
- **Primary Image**: Enables quick identification of the main image to display in task cards
- **Cascade Delete**: Ensures image cleanup when tasks are deleted
- **Indexes**: Optimizes performance for common queries involving task images

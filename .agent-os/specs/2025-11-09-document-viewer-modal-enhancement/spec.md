# Spec Requirements Document

> Spec: Document Viewer Modal Enhancement
> Created: 2025-11-09

## Overview

Improve the guest document viewer modal so that staff can inspect uploads with a large centered preview, see smooth skeleton feedback during image fetches, and avoid duplicate action controls.

## User Stories

### Seamless Document Preview

As a front desk staff member, I want the modal to display a large, centered preview of the selected document so that I can quickly validate document legibility without leaving the page.

The preview should occupy the majority of the modal width, maintain aspect ratio, and adapt to fullscreen mode. Controls (zoom, rotate, download, reset) remain accessible without obstructing the image.

### Helpful Loading Feedback

As a staff member opening the modal, I want a shimmering skeleton placeholder while the document image loads so that I know the system is working even on slower connections.

The skeleton should cover the future preview area, transition smoothly to the final image, and support successive document changes within the same modal session.

### Consistent Controls

As an operator reviewing documents, I want a single set of action buttons and state indicators per document so that I am not confused by duplicate “Reset”/“Download” controls.

Ensure the control bar renders once, aligns with the UI style guide, and reuses existing handler logic for zoom, rotation, reset, download, and fullscreen.

## Spec Scope

1. **Preview Layout Redesign** - Rework the modal’s preview container to center the document, expand usable space, and respect fullscreen mode.
2. **Skeleton Loading State** - Introduce a shimmer skeleton that displays while image assets load or switch, with graceful fade to the real preview.
3. **Control Bar Consolidation** - Refactor the modal header/control area to eliminate duplicate action rows and ensure responsive spacing.
4. **Document Rendering Hookup** - Connect actual image URLs (existing or new endpoint) into the preview component with fallback text for unsupported formats.

## Out of Scope

- Implementing new backend endpoints or storage changes for document retrieval.
- Adding new document annotation or editing capabilities.
- Revamping the surrounding Guest Check-in table or document upload workflow.

## Expected Deliverable

1. Modal displays a large centered preview with skeleton shimmer during load, verified in `DocumentViewer`.
2. Single control bar renders per document tab with functioning zoom, rotate, reset, download, and fullscreen actions; no duplicate “Reset/Download” blocks.


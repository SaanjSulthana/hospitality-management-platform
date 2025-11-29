# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-11-09-document-viewer-modal-enhancement/spec.md

## Technical Requirements

- **Preview Container Layout**
  - Update `frontend/components/guest-checkin/DocumentViewer.tsx` so the preview section uses a flex/grid layout that centers the image and expands to `lg:col-span-2` with responsive heights (`h-[70vh]` fullscreen, `h-[60vh]` desktop, `h-80` mobile).
  - Preserve zoom and rotation transforms on the `<img>` element while ensuring `object-contain` keeps aspect ratio.
  - Move fullscreen state to adjust container padding/margins without re-rendering duplicate control rows.

- **Image Rendering**
  - Replace the placeholder block with an `<img>` tag sourcing from `doc.thumbnailUrl` (fallback to signed download URL if missing).
  - Add `onLoad` and `onError` handlers to toggle skeleton visibility and show descriptive fallback text with icon when images cannot render.
  - Prevent layout shift by wrapping the image in a sized container with `position: relative`.

- **Skeleton Loading State**
  - Introduce local state `isImageLoading` keyed by document id (reset whenever `selectedDocId` changes) to manage loading UI.
  - Render a shimmer skeleton using a `div` with `animate-pulse` and gradient background that covers the preview container until the image `onLoad` fires.
  - Ensure skeleton supports consecutive loads when switching tabs by re-triggering state.

- **Control Bar Consolidation**
  - Ensure the control `div` within `CardHeader` renders once per document and remove any redundant wrappers causing duplicate rows.
  - Group buttons inside a responsive `flex` container that stacks vertically on small screens and maintains `gap-2` spacing.
  - Keep existing handlers (`handleZoomIn`, `handleZoomOut`, etc.) but guarantee they reference the current document state after refactor.

- **Accessibility & Feedback**
  - Add `aria-busy` attributes during skeleton display and alt text describing the document type and filename.
  - Display a subtle status badge for verification state near the document title instead of inline icons if consistent with UI rules.
  - Use focus-visible styles on control buttons and ensure keyboard interaction remains functional.

- **State Management**
  - Reset zoom/rotation automatically when switching to a different document tab while preserving manual reset for the same document.
  - Collapse fullscreen mode when modal closes to avoid stale state on reopen.

## External Dependencies (Conditional)

No new external dependencies required; leverage existing Tailwind utility classes and lucide icons for skeleton and status UI.


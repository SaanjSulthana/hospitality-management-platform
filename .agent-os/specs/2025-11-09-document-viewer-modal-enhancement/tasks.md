# Spec Tasks

## Tasks

- [ ] 1. Refine document preview layout in `DocumentViewer`
  - [ ] 1.1 Write component tests covering centered preview, fullscreen toggle, and state reset on tab change
  - [ ] 1.2 Rework preview container to center the image with responsive sizing utilities
  - [ ] 1.3 Adjust zoom/rotation state management to reset when switching documents and exit fullscreen on close
  - [ ] 1.4 Verify all tests pass

- [ ] 2. Replace placeholder with real document rendering and fallbacks
  - [ ] 2.1 Write tests for successful image render, alt text, and error fallback messaging
  - [ ] 2.2 Render actual document image using `thumbnailUrl` or download URL with `object-contain`
  - [ ] 2.3 Handle `onLoad`/`onError` events to flip loading state and show fallback copy
  - [ ] 2.4 Verify all tests pass

- [ ] 3. Implement skeleton shimmer loading experience
  - [ ] 3.1 Write tests asserting skeleton visibility while images load and when switching tabs
  - [ ] 3.2 Introduce per-document loading state and animated skeleton overlay tied to image events
  - [ ] 3.3 Ensure smooth transition from skeleton to image without layout shift
  - [ ] 3.4 Verify all tests pass

- [ ] 4. Consolidate action controls and ensure accessibility
  - [ ] 4.1 Write tests ensuring a single control bar renders with accessible labels and keyboard support
  - [ ] 4.2 Simplify control layout to one responsive flex group with proper spacing and focus styles
  - [ ] 4.3 Add verification status badge and aria attributes during loading
  - [ ] 4.4 Verify all tests pass


























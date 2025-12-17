# App Icons

This folder should contain the following app icons in PNG format:

| File | Size | Usage |
|------|------|-------|
| icon-72x72.png | 72x72 | Android low-density |
| icon-96x96.png | 96x96 | Android medium-density |
| icon-128x128.png | 128x128 | Chrome Web Store |
| icon-144x144.png | 144x144 | Android high-density |
| icon-152x152.png | 152x152 | iOS home screen |
| icon-192x192.png | 192x192 | Android high-density, PWA |
| icon-384x384.png | 384x384 | Android extra-high-density |
| icon-512x512.png | 512x512 | PWA splash, Play Store |

## Generating Icons

You can generate all sizes from a single 512x512 or 1024x1024 source image using:

1. **Online Tools:**
   - https://www.pwabuilder.com/imageGenerator
   - https://realfavicongenerator.net/
   - https://maskable.app/editor

2. **Command Line (ImageMagick):**
   ```bash
   for size in 72 96 128 144 152 192 384 512; do
     convert source-icon.png -resize ${size}x${size} icon-${size}x${size}.png
   done
   ```

## Icon Requirements

- Use a square image (1:1 aspect ratio)
- Ensure the main logo/icon has some padding from edges
- For maskable icons, keep safe zone in center (40% of icon)
- Use PNG format with transparency support
- Minimum recommended source size: 512x512px


/**
 * Generate PWA icons from SVG
 * Run: node scripts/generate-icons.cjs
 * 
 * Requires: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp not found. Installing...');
  require('child_process').execSync('npm install sharp --save-dev', { stdio: 'inherit' });
  sharp = require('sharp');
}

const iconsDir = path.join(__dirname, '../public/icons');
const svgPath = path.join(iconsDir, 'icon.svg');

// Icon configurations
const icons = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-192.png', size: 192, maskable: true },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
];

// Screenshot placeholders (simple colored rectangles)
const screenshots = [
  { name: 'screenshot-wide.png', width: 1280, height: 720 },
  { name: 'screenshot-mobile.png', width: 390, height: 844 },
];

async function generateIcons() {
  console.log('Generating PWA icons...');
  
  // Read SVG
  const svgBuffer = fs.readFileSync(svgPath);
  
  for (const icon of icons) {
    const outputPath = path.join(iconsDir, icon.name);
    
    let pipeline = sharp(svgBuffer)
      .resize(icon.size, icon.size);
    
    // For maskable icons, add extra padding (safe zone is 80% of icon)
    if (icon.maskable) {
      const padding = Math.round(icon.size * 0.1);
      pipeline = sharp(svgBuffer)
        .resize(icon.size - padding * 2, icon.size - padding * 2)
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 59, g: 130, b: 246, alpha: 1 } // #3b82f6
        });
    }
    
    await pipeline.png().toFile(outputPath);
    console.log(`✓ Created ${icon.name}`);
  }
  
  // Generate screenshot placeholders
  for (const screenshot of screenshots) {
    const outputPath = path.join(iconsDir, screenshot.name);
    
    // Create a gradient placeholder
    const svg = `
      <svg width="${screenshot.width}" height="${screenshot.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#3b82f6"/>
            <stop offset="100%" style="stop-color:#1d4ed8"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="${screenshot.width * 0.05}px" fill="white" text-anchor="middle" font-weight="bold">
          Hospitality Management
        </text>
        <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${screenshot.width * 0.03}px" fill="rgba(255,255,255,0.8)" text-anchor="middle">
          Platform Dashboard Preview
        </text>
      </svg>
    `;
    
    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);
    console.log(`✓ Created ${screenshot.name}`);
  }
  
  console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});


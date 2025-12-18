/**
 * Fix for @capacitor-community/http namespace issue
 * 
 * This script adds the required 'namespace' property to the plugin's build.gradle
 * which is required for Android Gradle Plugin 8+
 */

const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@capacitor-community',
  'http',
  'android',
  'build.gradle'
);

const namespace = 'com.getcapacitor.community.http';

try {
  if (fs.existsSync(buildGradlePath)) {
    let content = fs.readFileSync(buildGradlePath, 'utf8');
    
    // Check if namespace is already present
    if (!content.includes('namespace')) {
      // Add namespace after 'android {'
      content = content.replace(
        /android\s*\{/,
        `android {\n    namespace "${namespace}"`
      );
      
      fs.writeFileSync(buildGradlePath, content);
      console.log('✅ Fixed @capacitor-community/http namespace');
    } else {
      console.log('ℹ️ @capacitor-community/http namespace already configured');
    }
  } else {
    console.log('⚠️ @capacitor-community/http not found, skipping fix');
  }
} catch (error) {
  console.error('❌ Error fixing @capacitor-community/http:', error.message);
}


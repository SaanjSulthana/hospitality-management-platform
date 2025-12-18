/**
 * Fix for @capacitor-community/http namespace issue
 * 
 * This script:
 * 1. Adds the required 'namespace' property to the plugin's build.gradle
 * 2. Removes the 'package' attribute from AndroidManifest.xml
 * Both are required for Android Gradle Plugin 8+
 */

const fs = require('fs');
const path = require('path');

const pluginPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@capacitor-community',
  'http',
  'android'
);

const buildGradlePath = path.join(pluginPath, 'build.gradle');
const manifestPath = path.join(pluginPath, 'src', 'main', 'AndroidManifest.xml');

const namespace = 'com.getcapacitor.community.http';

try {
  // Fix 1: Add namespace to build.gradle
  if (fs.existsSync(buildGradlePath)) {
    let content = fs.readFileSync(buildGradlePath, 'utf8');
    
    if (!content.includes('namespace')) {
      content = content.replace(
        /android\s*\{/,
        `android {\n    namespace "${namespace}"`
      );
      fs.writeFileSync(buildGradlePath, content);
      console.log('✅ Fixed @capacitor-community/http build.gradle namespace');
    } else {
      console.log('ℹ️ build.gradle namespace already configured');
    }
  }

  // Fix 2: Remove package attribute from AndroidManifest.xml
  if (fs.existsSync(manifestPath)) {
    let content = fs.readFileSync(manifestPath, 'utf8');
    
    if (content.includes('package=')) {
      content = content.replace(/\s*package="[^"]*"/, '');
      fs.writeFileSync(manifestPath, content);
      console.log('✅ Fixed @capacitor-community/http AndroidManifest.xml');
    } else {
      console.log('ℹ️ AndroidManifest.xml already fixed');
    }
  }
} catch (error) {
  console.error('❌ Error fixing @capacitor-community/http:', error.message);
}


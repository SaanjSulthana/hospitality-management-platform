// Test script to verify static file serving behavior
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_URL = 'http://127.0.0.1:4000/';
const DIST_DIR = './dist';
const EXPECTED_FILES = [
  'index.html',
  'assets/index-C4fA4W7F.css',
  'assets/index-jH4sfVh1.js',
  'favicon.svg'
];

// Test functions
async function testStaticFileServing() {
  console.log('🔍 Testing Static File Serving Behavior');
  console.log('=====================================');
  
  // 1. Check if dist files exist
  console.log('\n1. Checking if dist files exist:');
  for (const file of EXPECTED_FILES) {
    const filePath = path.join(__dirname, '..', DIST_DIR, file);
    const exists = fs.existsSync(filePath);
    const stats = exists ? fs.statSync(filePath) : null;
    console.log(`   ${file}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
    if (exists) {
      console.log(`      Size: ${stats.size} bytes`);
    }
  }
  
  // 2. Test root endpoint
  console.log('\n2. Testing root endpoint:');
  try {
    const response = await makeRequest(TEST_URL);
    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Content-Length: ${response.headers['content-length'] || 'Not set'}`);
    console.log(`   Content-Type: ${response.headers['content-type'] || 'Not set'}`);
    console.log(`   Body length: ${response.body.length} characters`);
    console.log(`   Body preview: ${response.body.substring(0, 100)}...`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // 3. Test specific assets
  console.log('\n3. Testing specific assets:');
  for (const file of EXPECTED_FILES) {
    const url = TEST_URL + file;
    try {
      const response = await makeRequest(url);
      console.log(`   ${file}:`);
      console.log(`      Status: ${response.statusCode}`);
      console.log(`      Content-Length: ${response.headers['content-length'] || 'Not set'}`);
      console.log(`      Content-Type: ${response.headers['content-type'] || 'Not set'}`);
      console.log(`      Body length: ${response.body.length} characters`);
    } catch (error) {
      console.log(`   ${file}: ❌ Error: ${error.message}`);
    }
  }
  
  // 4. Test with different path patterns
  console.log('\n4. Testing different path patterns:');
  const testPaths = ['/', '/index.html', '/assets/', '/assets/index-C4fA4W7F.css'];
  for (const testPath of testPaths) {
    const url = TEST_URL + testPath;
    try {
      const response = await makeRequest(url);
      console.log(`   ${testPath}: Status ${response.statusCode}, Length: ${response.body.length}`);
    } catch (error) {
      console.log(`   ${testPath}: ❌ Error: ${error.message}`);
    }
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Run the test
testStaticFileServing().catch(console.error);

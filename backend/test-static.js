// Simple test for static file serving
import http from 'http';

const testUrl = 'http://127.0.0.1:4000/';

http.get(testUrl, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Content-Type:', res.headers['content-type']);
  console.log('Content-Length:', res.headers['content-length']);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Body length:', data.length);
    console.log('Body preview:', data.substring(0, 100));
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});

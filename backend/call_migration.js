// Simple script to call the migration endpoint
import fetch from 'node-fetch';

async function runMigration() {
  try {
    console.log('Calling migration endpoint...');
    
    // You'll need to replace this with your actual access token
    const response = await fetch('http://localhost:4000/finance/run-migration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add your authorization header here
        // 'Authorization': 'Bearer YOUR_ACCESS_TOKEN'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Migration result:', result);
    } else {
      console.error('Migration failed:', response.status, response.statusText);
      const error = await response.text();
      console.error('Error details:', error);
    }
  } catch (error) {
    console.error('Error calling migration:', error);
  }
}

runMigration();

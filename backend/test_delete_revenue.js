// Simple test script to test delete revenue functionality
const fetch = require('node-fetch');

async function testDeleteRevenue() {
  try {
    // First, let's get a list of revenues to see what we have
    console.log('Testing delete revenue functionality...');
    
    const baseUrl = 'http://localhost:4000';
    
    // You would need to get a valid token first
    const token = 'your-token-here'; // Replace with actual token
    
    // Test the delete revenue endpoint
    const response = await fetch(`${baseUrl}/finance/revenues/1`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Delete revenue successful:', result);
    } else {
      const error = await response.text();
      console.log('Delete revenue failed:', response.status, error);
    }
    
  } catch (error) {
    console.error('Error testing delete revenue:', error);
  }
}

testDeleteRevenue();


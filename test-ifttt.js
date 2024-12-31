// Add this test script to verify IFTTT integration
const fetch = require('node-fetch');

async function testWebhook() {
  const webhookUrl = 'https://berry-thoughtful-citrus.glitch.me/webhook';
  
  // Test cases for different payload formats
  const testCases = [
    // IFTTT format
    {
      value1: "Test tweet from IFTTT",
      value2: "IFTTT Test",
      value3: "Additional data"
    },
    // Direct format
    {
      text: "Test tweet direct format",
      username: "Direct Test"
    },
    // String format
    "Simple test message"
  ];

  for (const payload of testCases) {
    try {
      console.log('\nTesting payload:', payload);
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      console.log('Status:', response.status);
      console.log('Response:', result);
    } catch (error) {
      console.error('Test failed:', error);
    }
  }
}

// Run the tests
console.log('Starting webhook tests...');
testWebhook().then(() => console.log('\nTests completed'));


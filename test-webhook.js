const fetch = require('node-fetch');

async function testWebhook() {
  const webhookUrl = 'https://berry-thoughtful-citrus.glitch.me/webhook';
  
  const tests = [
    // Test 1: IFTTT format (URL-encoded)
    {
      contentType: 'application/x-www-form-urlencoded',
      body: 'value1=Test+tweet+from+IFTTT&value2=IFTTT+Test'
    },
    // Test 2: IFTTT format (plain text)
    {
      contentType: 'text/plain',
      body: 'value1=Test tweet&value2=IFTTT User'
    },
    // Test 3: Raw text
    {
      contentType: 'text/plain',
      body: 'Simple test message'
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\nTesting ${test.contentType}:`);
      console.log('Payload:', test.body);
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': test.contentType,
        },
        body: test.body
      });

      const result = await response.text();
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


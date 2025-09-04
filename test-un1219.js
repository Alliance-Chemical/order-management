// Test the UN1219 lookup
async function test() {
  try {
    const response = await fetch('http://localhost:3000/api/rag/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'what un is 1219'
      })
    });
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
const axios = require('axios');

async function testNegah() {
  console.log('--- Test 3: Negah visual QA API ---');
  try {
    const res = await axios.post('http://localhost:3001/api/v3/negah/execute', {
      maxIterations: 1,
      trigger: 'manual',
      human_input: 'باز کردن مرورگر و تست localhost',
      commands: [{ action: "launch_web", params: { url: "http://localhost:5173" } }]
    });
    console.log('Negah response:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.log('Negah HTTP Error:', err.response.data);
    } else {
      console.error('Negah Error:', err.message);
    }
  }
}

testNegah().catch(console.error);

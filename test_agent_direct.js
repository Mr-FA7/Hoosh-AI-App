const AgentKernel = require('./kernel');

async function runTest() {
  const root = '/Users/mr.fa7/Desktop/test/test-app';
  console.log(`Testing AgentKernel at ${root}`);

  const kernel = new AgentKernel(root, 'http://127.0.0.1:11434');
  await kernel.init();

  // Test 1: Red Theme Modification
  console.log('--- Test 1: Red Theme ---');
  let loopRes = await kernel.executeAutonomousLoop('رنگ تم برنامه رو به قرمز تغییر بده', {
    onEvent: (e) => console.log('Event:', e)
  });
  console.log('Result:', JSON.stringify(loopRes, null, 2));
}

runTest().catch(console.error);

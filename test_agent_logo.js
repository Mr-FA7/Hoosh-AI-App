const AgentKernel = require('./kernel');

async function runTest() {
  const root = '/Users/mr.fa7/Desktop/test/test-app';
  console.log(`Testing AgentKernel Logo Generation at ${root}`);

  const kernel = new AgentKernel(root, 'http://127.0.0.1:11434');
  await kernel.init();

  console.log('--- Test 2: Logo and Background ---');
  let loopRes = await kernel.executeAutonomousLoop('یه لوگو و بک گراند برای برنامه بساز', {
    onEvent: (e) => {
      // Omit spammy status messages for cleaner logs, print key events
      if (e.type !== 'status' && e.type !== 'rescan') {
        console.log('Event:', e);
      }
    }
  });
  console.log('Result:', JSON.stringify(loopRes, null, 2));
}

runTest().catch(console.error);

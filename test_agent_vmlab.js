const axios = require('axios');

async function testVMLab() {
  console.log('--- Test 4: VM Lab creation with ISO ---');
  try {
    const res = await axios.post('http://localhost:3001/api/v3/vm-lab/vbox/create-minimal', {
      name: 'fa7-win2k3-test',
      memoryMb: 2048,
      diskMb: 20480,
      ostype: 'Windows2019_64', // VBox generic Windows 64-bit profile
      isoPath: '/Users/mr.fa7/Desktop/w2k3sp2_3959_usa_x64fre_spcd.iso'
    });
    console.log('VM Lab response:', JSON.stringify(res.data, null, 2));

    // Optional: Try to start it
    if (res.data.ok) {
        console.log('Starting the new VM...');
        const startRes = await axios.post('http://localhost:3001/api/v3/vm-lab/vbox/action', {
            action: 'start',
            name: 'fa7-win2k3-test',
            startMode: 'headless' // Start headless for automated testing
        });
        console.log('Start result:', JSON.stringify(startRes.data, null, 2));
    }

  } catch (err) {
    if (err.response) {
      console.log('VM Lab HTTP Error:', err.response.data);
    } else {
      console.error('VM Lab Error:', err.message);
    }
  }
}

testVMLab().catch(console.error);

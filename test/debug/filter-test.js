// Test different filter combinations to help Agent 2 debug
const http = require('http');

function testAPI(path, description) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'x-user-id': 'alice-user'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`${description}:`);
          console.log(`  - Rooms found: ${parsed.rooms?.length || 0}`);
          if (parsed.rooms?.length > 0) {
            console.log(`  - First room: ${parsed.rooms[0].roomName} (${parsed.rooms[0].siteName}, capacity: ${parsed.rooms[0].capacity})`);
          }
          console.log(`  - Query: ${JSON.stringify(parsed.query)}`);
          resolve(parsed);
        } catch (e) {
          console.log(`${description}: ERROR - ${data}`);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`${description}: Request error - ${err.message}`);
      resolve(null);
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing availability API with different filters...\n');

  // Test 1: No filters (should return all rooms)
  await testAPI('/api/availability', 'TEST 1: No filters');

  // Test 2: High capacity filter (should return 0 rooms)
  await testAPI('/api/availability?capacityMin=10', 'TEST 2: High capacity (>=10)');

  // Test 3: Low capacity filter (should return rooms)
  await testAPI('/api/availability?capacityMin=4', 'TEST 3: Low capacity (>=4)');

  // Test 4: London site filter
  await testAPI('/api/availability?sites=london', 'TEST 4: London site (invalid ID)');

  // Test 5: Future date
  await testAPI('/api/availability?from=2025-09-25&to=2025-09-25', 'TEST 5: Future date');

  // Test 6: Time window
  await testAPI('/api/availability?windowStart=09:00&windowEnd=17:00', 'TEST 6: Time window 9-17');

  console.log('\n=== DIAGNOSIS FOR AGENT 2 ===');
  console.log('If frontend shows no rooms, check these common issues:');
  console.log('1. capacityMin > 8 (our rooms are 6-8 capacity)');
  console.log('2. Invalid site IDs (should be UUIDs, not names)');
  console.log('3. Past dates or restrictive time windows');
  console.log('4. Date format issues (YYYY-MM-DD required)');
}

runTests().catch(console.error);
// Get actual site IDs for Agent 2 frontend debugging
const http = require('http');

function testSitesAPI() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/sites',
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
        console.log('=== SITE IDs FOR FRONTEND ===');
        console.log(`Total sites: ${parsed.sites?.length || 0}\n`);

        if (parsed.sites) {
          parsed.sites.forEach((site, index) => {
            console.log(`${index + 1}. ${site.name}:`);
            console.log(`   ID: ${site.id}`);
            console.log(`   Timezone: ${site.timezone}`);
            console.log(`   Rooms: ${site.rooms?.length || 0}`);
            if (site.rooms?.length > 0) {
              console.log(`   Room capacities: ${site.rooms.map(r => r.capacity).join(', ')}`);
            }
            console.log('');
          });
        }
      } catch (e) {
        console.log('Error parsing sites API:', data);
      }
    });
  });

  req.on('error', (err) => {
    console.log('Sites API error:', err.message);
  });

  req.end();
}

console.log('Getting site IDs and room capacities for Agent 2...\n');
testSitesAPI();
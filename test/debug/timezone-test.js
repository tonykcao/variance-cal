// Test timezone handling for room opening hours
const http = require('http');

function testAvailabilityWithTimezone() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/availability',
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
        console.log('=== TIMEZONE AND HOURS ANALYSIS ===\n');

        if (parsed.rooms && parsed.rooms.length > 0) {
          // Check first few rooms from different sites
          const sampleRooms = parsed.rooms.slice(0, 8);

          sampleRooms.forEach((room) => {
            console.log(`Room: ${room.roomName} (${room.siteName})`);
            console.log(`Timezone: ${room.timezone}`);
            console.log(`Today's slots: ${room.dates[0]?.slots?.length || 0} slots`);

            if (room.dates[0]?.slots) {
              const slots = room.dates[0].slots;
              const availableSlots = slots.filter(s => s.available);

              if (availableSlots.length > 0) {
                const firstSlot = availableSlots[0];
                const lastSlot = availableSlots[availableSlots.length - 1];

                console.log(`Available slots: ${availableSlots.length}`);
                console.log(`First available: ${firstSlot.startUtc} (UTC)`);
                console.log(`Last available: ${lastSlot.startUtc} (UTC)`);

                // Convert to local time for analysis
                const firstLocal = new Date(firstSlot.startUtc);
                const lastLocal = new Date(lastSlot.startUtc);
                console.log(`First local: ${firstLocal.toLocaleString('en-US', {timeZone: room.timezone})}`);
                console.log(`Last local: ${lastLocal.toLocaleString('en-US', {timeZone: room.timezone})}`);
              } else {
                console.log('No available slots found');
              }
            }
            console.log('---');
          });

          console.log('\n=== ANALYSIS FOR AGENT 2 ===');
          console.log('Room hours are stored as UTC but should display in room local timezone.');
          console.log('Expected pattern: 8AM-8PM local time (varies by timezone).');
          console.log('- SF rooms: 8AM-8PM Pacific (UTC+8 in winter, UTC+7 in summer)');
          console.log('- NYC rooms: 8AM-8PM Eastern (UTC+5 in winter, UTC+4 in summer)');
          console.log('- London rooms: 8AM-8PM GMT (UTC+0 in winter, UTC+1 in summer)');
          console.log('- Shanghai rooms: 8AM-8PM China (UTC-8 always)');

        } else {
          console.log('No rooms found in API response');
        }
      } catch (e) {
        console.log('Error parsing availability API:', e.message);
        console.log('Raw response:', data.substring(0, 500));
      }
    });
  });

  req.on('error', (err) => {
    console.log('API request error:', err.message);
  });

  req.end();
}

console.log('Testing timezone handling for Agent 2...\n');
testAvailabilityWithTimezone();
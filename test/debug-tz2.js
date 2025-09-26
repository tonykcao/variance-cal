const { toZonedTime } = require('date-fns-tz');
const { format } = require('date-fns');

function formatInTimezone(utcDate, timezone, formatStr = 'yyyy-MM-dd HH:mm') {
  const zonedDate = toZonedTime(utcDate, timezone);
  return format(zonedDate, formatStr);
}

// Test case 1: 2025-09-24 02:00:00 UTC
const utc1 = new Date('2025-09-24T02:00:00Z');
console.log('[TEST 1] 2025-09-24T02:00:00Z');
console.log('UTC Day:', utc1.getUTCDay(), '(0=Sun, 1=Mon, 2=Tue, 3=Wed)');

const ny1 = formatInTimezone(utc1, 'America/New_York', 'yyyy-MM-dd HH:mm EEEE');
console.log('NY formatted:', ny1);

const sh1 = formatInTimezone(utc1, 'Asia/Shanghai', 'yyyy-MM-dd HH:mm EEEE');
console.log('Shanghai formatted:', sh1);

// Test case 2: 2025-09-23 20:00:00 UTC
console.log('\n[TEST 2] 2025-09-23T20:00:00Z');
const utc2 = new Date('2025-09-23T20:00:00Z');
console.log('UTC Day:', utc2.getUTCDay());

const ny2 = formatInTimezone(utc2, 'America/New_York', 'yyyy-MM-dd HH:mm EEEE');
console.log('NY formatted:', ny2);

const sh2 = formatInTimezone(utc2, 'Asia/Shanghai', 'yyyy-MM-dd HH:mm EEEE');
console.log('Shanghai formatted:', sh2);

// Test case 3: Test the boundary case
console.log('\n[TEST 3] Boundary case 2025-09-24T23:00:00Z and 2025-09-25T01:00:00Z');
const date1 = new Date('2025-09-24T23:00:00Z');
const date2 = new Date('2025-09-25T01:00:00Z');

const la1 = formatInTimezone(date1, 'America/Los_Angeles', 'yyyy-MM-dd HH:mm');
const la2 = formatInTimezone(date2, 'America/Los_Angeles', 'yyyy-MM-dd HH:mm');
console.log('Date1 in LA:', la1);
console.log('Date2 in LA:', la2);

const sh3 = formatInTimezone(date1, 'Asia/Shanghai', 'yyyy-MM-dd HH:mm');
const sh4 = formatInTimezone(date2, 'Asia/Shanghai', 'yyyy-MM-dd HH:mm');
console.log('Date1 in Shanghai:', sh3);
console.log('Date2 in Shanghai:', sh4);
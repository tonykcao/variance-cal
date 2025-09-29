const { toZonedTime } = require("date-fns-tz")

// Test for getDayInTimezone
console.log("[TEST 1] getDayInTimezone")
const utc1 = new Date("2025-09-24T02:00:00Z")
console.log("UTC:", utc1.toISOString(), "Day:", utc1.getDay())

const ny1 = toZonedTime(utc1, "America/New_York")
console.log("NY:", ny1.toString(), "Day:", ny1.getDay())

const sh1 = toZonedTime(utc1, "Asia/Shanghai")
console.log("Shanghai:", sh1.toString(), "Day:", sh1.getDay())

// Test for getWeekdayInTimezone
console.log("\n[TEST 2] getWeekdayInTimezone")
const utc2 = new Date("2025-09-24T12:00:00Z")
console.log("UTC:", utc2.toISOString(), "Day:", utc2.getDay())

const ny2 = toZonedTime(utc2, "America/New_York")
console.log("NY:", ny2.toString(), "Day:", ny2.getDay())

// Test 3
console.log("\n[TEST 3] Timezone day differences")
const utc3 = new Date("2025-09-23T20:00:00Z")
console.log("UTC:", utc3.toISOString(), "Day:", utc3.getDay())

const ny3 = toZonedTime(utc3, "America/New_York")
console.log("NY:", ny3.toString(), "Day:", ny3.getDay())

const sh3 = toZonedTime(utc3, "Asia/Shanghai")
console.log("Shanghai:", sh3.toString(), "Day:", sh3.getDay())

// Test for isSameDayInTimezone
console.log("\n[TEST 4] isSameDayInTimezone")
const date1 = new Date("2025-09-24T23:00:00Z")
const date2 = new Date("2025-09-25T01:00:00Z")

const la1 = toZonedTime(date1, "America/Los_Angeles")
const la2 = toZonedTime(date2, "America/Los_Angeles")
console.log("Date1 in LA:", la1.toString())
console.log("Date2 in LA:", la2.toString())
console.log("Same day?", la1.getDate() === la2.getDate())

const sh4 = toZonedTime(date1, "Asia/Shanghai")
const sh5 = toZonedTime(date2, "Asia/Shanghai")
console.log("Date1 in Shanghai:", sh4.toString())
console.log("Date2 in Shanghai:", sh5.toString())
console.log("Same day?", sh4.getDate() === sh5.getDate())

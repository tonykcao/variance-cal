// Simple API test to debug availability issue
const http = require("http")

// Test availability API
function testAvailabilityAPI() {
  const options = {
    hostname: "localhost",
    port: 3000,
    path: "/api/availability",
    method: "GET",
    headers: {
      "x-user-id": "alice-user",
    },
  }

  const req = http.request(options, res => {
    let data = ""

    res.on("data", chunk => {
      data += chunk
    })

    res.on("end", () => {
      console.log("Status Code:", res.statusCode)
      console.log("Response Headers:", res.headers)
      try {
        const parsed = JSON.parse(data)
        console.log("Response Data:")
        console.log("- Number of rooms:", parsed.rooms?.length || 0)
        if (parsed.rooms?.length > 0) {
          console.log("- First room:", {
            id: parsed.rooms[0].roomId,
            name: parsed.rooms[0].roomName,
            site: parsed.rooms[0].siteName,
            datesCount: parsed.rooms[0].dates?.length || 0,
          })
        }
        console.log("- Query params:", parsed.query)
      } catch (e) {
        console.log("Raw response:", data)
      }
    })
  })

  req.on("error", err => {
    console.log("Request error:", err.message)
  })

  req.end()
}

console.log("Testing availability API...")
testAvailabilityAPI()

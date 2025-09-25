export default function AdminSitesPage() {
  // Mock data for sites
  const sites = [
    { id: "sf", name: "San Francisco", timezone: "America/Los_Angeles", rooms: 5 },
    { id: "ny", name: "New York", timezone: "America/New_York", rooms: 5 },
    { id: "lon", name: "London", timezone: "Europe/London", rooms: 5 },
    { id: "sh", name: "Shanghai", timezone: "Asia/Shanghai", rooms: 5 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sites</h1>
          <p className="text-muted-foreground">Manage office locations and their timezones.</p>
        </div>
        <button className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
          Add Site
        </button>
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 font-medium">Site Name</th>
              <th className="text-left p-4 font-medium">Timezone</th>
              <th className="text-left p-4 font-medium">Rooms</th>
              <th className="text-left p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sites.map(site => (
              <tr key={site.id} className="border-b">
                <td className="p-4 font-medium">{site.name}</td>
                <td className="p-4 text-sm text-muted-foreground">{site.timezone}</td>
                <td className="p-4">{site.rooms} rooms</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button className="text-sm text-primary hover:underline">View Rooms</button>
                    <span className="text-muted-foreground">•</span>
                    <button className="text-sm text-primary hover:underline">Edit</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

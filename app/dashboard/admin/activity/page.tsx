export default function AdminActivityPage() {
  // Mock activity data
  const activities = [
    {
      id: 1,
      action: "BOOKING_CREATED",
      actor: "Alice Johnson",
      entityType: "booking",
      details: "Room: Oak (San Francisco), 10:00 - 11:30 AM",
      timestamp: "2 hours ago",
    },
    {
      id: 2,
      action: "BOOKING_CANCELED",
      actor: "Bob Smith",
      entityType: "booking",
      details: "Room: Hudson (New York), 2:00 - 3:00 PM",
      timestamp: "3 hours ago",
    },
    {
      id: 3,
      action: "ROOM_UPDATED",
      actor: "Ava Chen",
      entityType: "room",
      details: "Thames capacity changed from 6 to 8",
      timestamp: "Yesterday",
    },
  ]

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "BOOKING_CREATED":
        return "bg-green-100 text-green-800"
      case "BOOKING_CANCELED":
        return "bg-red-100 text-red-800"
      case "ROOM_UPDATED":
        return "bg-blue-100 text-blue-800"
      case "SITE_UPDATED":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-muted-foreground">Monitor all system activity and changes.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select className="rounded-md border px-3 py-2 text-sm">
          <option value="">All Entity Types</option>
          <option value="booking">Bookings</option>
          <option value="room">Rooms</option>
          <option value="site">Sites</option>
        </select>
        <select className="rounded-md border px-3 py-2 text-sm">
          <option value="">All Actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="canceled">Canceled</option>
        </select>
        <select className="rounded-md border px-3 py-2 text-sm">
          <option value="">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* Activity List */}
      <div className="rounded-lg border">
        <div className="divide-y">
          {activities.map(activity => (
            <div key={activity.id} className="p-4 hover:bg-accent/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${getActionBadgeColor(activity.action)}`}
                    >
                      {formatAction(activity.action)}
                    </span>
                    <span className="text-sm text-muted-foreground">{activity.entityType}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{activity.actor}</span>
                    <span className="text-muted-foreground"> • {activity.details}</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{activity.timestamp}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AvailabilityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Find Available Rooms</h1>
        <p className="text-muted-foreground">
          Discover and book meeting rooms across all office locations.
        </p>
      </div>

      {/* Filters Section */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Search Filters</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm font-medium">Sites</label>
            <div className="mt-1 text-sm text-muted-foreground">Select office locations</div>
          </div>
          <div>
            <label className="text-sm font-medium">Minimum Capacity</label>
            <div className="mt-1 text-sm text-muted-foreground">Number of attendees</div>
          </div>
          <div>
            <label className="text-sm font-medium">Date</label>
            <div className="mt-1 text-sm text-muted-foreground">Today (default)</div>
          </div>
          <div>
            <label className="text-sm font-medium">Time Window</label>
            <div className="mt-1 text-sm text-muted-foreground">Optional time range</div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="rounded-lg border bg-card">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Available Rooms</h2>
          <p className="text-sm text-muted-foreground">
            Room availability will be displayed here once the backend is connected.
          </p>
        </div>
      </div>
    </div>
  )
}

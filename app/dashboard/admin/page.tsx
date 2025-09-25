import Link from "next/link"
import { Building2, MapPin, Activity } from "lucide-react"

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground">Manage sites, rooms, and monitor system activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/dashboard/admin/sites"
          className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
        >
          <div className="flex items-center space-x-4">
            <MapPin className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Sites</h3>
              <p className="text-sm text-muted-foreground">Manage office locations</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/admin/rooms"
          className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
        >
          <div className="flex items-center space-x-4">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Rooms</h3>
              <p className="text-sm text-muted-foreground">Configure meeting rooms</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/admin/activity"
          className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
        >
          <div className="flex items-center space-x-4">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Activity Log</h3>
              <p className="text-sm text-muted-foreground">View system activity</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MapPin, Globe, Building, Edit, Plus } from "lucide-react"

interface Site {
  id: string
  name: string
  timezone: string
  createdAt: string
  updatedAt: string
  roomCount?: number
  _count?: {
    rooms: number
  }
}

const SUPPORTED_TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific Time (San Francisco)" },
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "Europe/London", label: "GMT (London)" },
  { value: "Asia/Shanghai", label: "China Standard Time (Shanghai)" },
]

export default function AdminSitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    timezone: "",
  })

  useEffect(() => {
    fetchSites()
  }, [])

  const fetchSites = async () => {
    try {
      const response = await fetch("/api/sites")
      if (response.ok) {
        const data = await response.json()
        setSites(data.sites || [])
      }
    } catch (error) {
      console.error("Failed to fetch sites:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchSites()
        setShowCreateDialog(false)
        setFormData({ name: "", timezone: "" })
      } else {
        const data = await response.json()
        alert(`Failed to create site: ${data.error}`)
      }
    } catch (error) {
      console.error("Error creating site:", error)
      alert("Failed to create site")
    }
  }

  const handleEdit = async () => {
    if (!editingSite) return

    try {
      const response = await fetch(`/api/sites/${editingSite.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchSites()
        setShowEditDialog(false)
        setEditingSite(null)
        setFormData({ name: "", timezone: "" })
      } else {
        const data = await response.json()
        alert(`Failed to update site: ${data.error}`)
      }
    } catch (error) {
      console.error("Error updating site:", error)
      alert("Failed to update site")
    }
  }

  const openEditDialog = (site: Site) => {
    setEditingSite(site)
    setFormData({
      name: site.name,
      timezone: site.timezone,
    })
    setShowEditDialog(true)
  }

  const openCreateDialog = () => {
    setFormData({ name: "", timezone: "" })
    setShowCreateDialog(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Sites Management</h1>
          <p className="mt-2 text-sm text-muted-foreground">Loading sites...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-b pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Sites Management</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage office locations and their timezones
          </p>
        </div>
        <Button onClick={openCreateDialog} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Site
        </Button>
      </div>

      <div className="bg-card rounded-lg border">
        {sites.length === 0 ? (
          <div className="p-16 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-card-foreground">No sites configured yet</p>
            <p className="text-sm text-muted-foreground mt-2">Add your first office location to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-semibold text-card-foreground">Site Name</th>
                <th className="text-left p-4 font-semibold text-card-foreground">Timezone</th>
                <th className="text-left p-4 font-semibold text-card-foreground">Rooms</th>
                <th className="text-left p-4 font-semibold text-card-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id} className="border-b border-border/50 hover:bg-accent/50">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-card-foreground">{site.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-card-foreground">{site.timezone}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="text-card-foreground">
                        {site.roomCount || site._count?.rooms || 0} rooms
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-3">
                      <Link
                        href={`/dashboard/admin/rooms?siteId=${site.id}`}
                        className="text-sm text-muted-foreground hover:text-foreground font-medium"
                      >
                        View Rooms
                      </Link>
                      <button
                        onClick={() => openEditDialog(site)}
                        className="text-sm text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Site Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Site</DialogTitle>
            <DialogDescription>
              Add a new office location with its timezone
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Site Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., San Francisco"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a timezone" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formData.name || !formData.timezone}>
              Create Site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Site Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>
              Update site information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Site Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!formData.name || !formData.timezone}>
              Update Site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
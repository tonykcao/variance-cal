"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
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
import { Building, Users, Edit, Plus, ArrowLeft } from "lucide-react"

interface Site {
  id: string
  name: string
  timezone: string
}

interface Room {
  id: string
  siteId: string
  name: string
  capacity: number
  opening: any // JSON object with opening hours
  createdAt: string
  updatedAt: string
  site?: Site
}

const WEEKDAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
]

export default function AdminRoomsPage() {
  const searchParams = useSearchParams()
  const siteId = searchParams.get("siteId")

  const [rooms, setRooms] = useState<Room[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    capacity: 2,
    siteId: siteId || "",
    opening: {
      mon: { open: "08:00", close: "20:00" },
      tue: { open: "08:00", close: "20:00" },
      wed: { open: "08:00", close: "20:00" },
      thu: { open: "08:00", close: "20:00" },
      fri: { open: "08:00", close: "20:00" },
      sat: { open: "08:00", close: "20:00" },
      sun: { open: "08:00", close: "20:00" },
    },
  })

  useEffect(() => {
    fetchData()
  }, [siteId])

  const fetchData = async () => {
    try {
      // Fetch sites
      const sitesResponse = await fetch("/api/sites")
      if (sitesResponse.ok) {
        const sitesData = await sitesResponse.json()
        setSites(sitesData.sites || [])
      }

      // Fetch rooms (filtered by site if siteId is provided)
      const roomsUrl = siteId ? `/api/rooms?siteId=${siteId}` : "/api/rooms"
      const roomsResponse = await fetch(roomsUrl)
      if (roomsResponse.ok) {
        const roomsData = await roomsResponse.json()
        setRooms(roomsData.rooms || [])
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchData()
        setShowCreateDialog(false)
        resetForm()
      } else {
        try {
          const data = await response.json()
          alert(`Failed to create room: ${data.error || 'Unknown error'}`)
        } catch (e) {
          alert('Failed to create room: Invalid response from server')
        }
      }
    } catch (error) {
      console.error("Error creating room:", error)
      alert("Failed to create room")
    }
  }

  const handleEdit = async () => {
    if (!editingRoom) return

    try {
      const response = await fetch('/api/rooms', {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingRoom.id,
          ...formData,
        }),
      })

      if (response.ok) {
        await fetchData()
        setShowEditDialog(false)
        setEditingRoom(null)
        resetForm()
      } else {
        try {
          const data = await response.json()
          alert(`Failed to update room: ${data.error || 'Unknown error'}`)
        } catch (e) {
          alert('Failed to update room: Invalid response from server')
        }
      }
    } catch (error) {
      console.error("Error updating room:", error)
      alert("Failed to update room")
    }
  }

  const openEditDialog = (room: Room) => {
    setEditingRoom(room)
    setFormData({
      name: room.name,
      capacity: room.capacity,
      siteId: room.siteId,
      opening: room.opening || {
        mon: { open: "08:00", close: "20:00" },
        tue: { open: "08:00", close: "20:00" },
        wed: { open: "08:00", close: "20:00" },
        thu: { open: "08:00", close: "20:00" },
        fri: { open: "08:00", close: "20:00" },
        sat: { open: "08:00", close: "20:00" },
        sun: { open: "08:00", close: "20:00" },
      },
    })
    setShowEditDialog(true)
  }

  const openCreateDialog = () => {
    resetForm()
    setShowCreateDialog(true)
  }

  const resetForm = () => {
    setFormData({
      name: "",
      capacity: 2,
      siteId: siteId || "",
      opening: {
        mon: { open: "08:00", close: "20:00" },
        tue: { open: "08:00", close: "20:00" },
        wed: { open: "08:00", close: "20:00" },
        thu: { open: "08:00", close: "20:00" },
        fri: { open: "08:00", close: "20:00" },
        sat: { open: "08:00", close: "20:00" },
        sun: { open: "08:00", close: "20:00" },
      },
    })
  }

  const updateOpeningHours = (day: string, field: "open" | "close", value: string) => {
    setFormData(prev => ({
      ...prev,
      opening: {
        ...prev.opening,
        [day]: {
          ...prev.opening[day],
          [field]: value,
        },
      },
    }))
  }

  const selectedSite = sites.find(s => s.id === siteId)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="border-b border pb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Rooms Management</h1>
          <p className="mt-2 text-sm text-muted-foreground">Loading rooms...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-b border pb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/dashboard/admin/sites"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sites
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {selectedSite ? `${selectedSite.name} - Rooms` : "Rooms Management"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {selectedSite
              ? `Manage rooms in ${selectedSite.name}`
              : "Manage rooms across all sites"}
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="flex items-center gap-2 bg-background hover:bg-secondary border border-input text-foreground"
        >
          <Plus className="h-4 w-4" />
          Add Room
        </Button>
      </div>

      <div className="bg-card rounded-lg border">
        {rooms.length === 0 ? (
          <div className="p-16 text-center">
            <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No rooms configured yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Add your first meeting room to get started
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-semibold text-foreground">Room Name</th>
                <th className="text-left p-4 font-semibold text-foreground">Site</th>
                <th className="text-left p-4 font-semibold text-foreground">Capacity</th>
                <th className="text-left p-4 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room.id} className="border-b hover:bg-background/50">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{room.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-foreground">
                      {room.site?.name || sites.find(s => s.id === room.siteId)?.name}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{room.capacity}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => openEditDialog(room)}
                      className="text-sm text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Room Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-card border text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create New Room</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a new meeting room to your office location
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-96 overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-foreground">
                Room Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Oak Conference Room"
                className="bg-background border-input text-foreground"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capacity" className="text-foreground">
                Capacity
              </Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                value={formData.capacity}
                onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                className="bg-background border-input text-foreground"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="site" className="text-foreground">
                Site
              </Label>
              <Select
                value={formData.siteId}
                onValueChange={value => setFormData({ ...formData, siteId: value })}
              >
                <SelectTrigger className="bg-background border-input text-foreground">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent className="bg-background border-input">
                  {sites.map(site => (
                    <SelectItem key={site.id} value={site.id} className="text-foreground">
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3">
              <Label className="text-foreground">Opening Hours (24-hour format)</Label>
              <div className="space-y-3">
                {WEEKDAYS.map(day => (
                  <div key={day.key} className="flex items-center gap-3">
                    <div className="w-20 text-sm text-muted-foreground">{day.label}</div>
                    <select
                      value={formData.opening[day.key]?.open || "08:00"}
                      onChange={e => updateOpeningHours(day.key, "open", e.target.value)}
                      className="flex h-9 w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                    >
                      {Array.from({ length: 24 }, (_, h) => {
                        const hour = h.toString().padStart(2, "0")
                        return [
                          <option key={`${hour}:00`} value={`${hour}:00`}>
                            {hour}:00
                          </option>,
                          <option key={`${hour}:30`} value={`${hour}:30`}>
                            {hour}:30
                          </option>,
                        ]
                      }).flat()}
                    </select>
                    <span className="text-muted-foreground">to</span>
                    <select
                      value={formData.opening[day.key]?.close || "20:00"}
                      onChange={e => updateOpeningHours(day.key, "close", e.target.value)}
                      className="flex h-9 w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                    >
                      {Array.from({ length: 24 }, (_, h) => {
                        const hour = h.toString().padStart(2, "0")
                        return [
                          <option key={`${hour}:00`} value={`${hour}:00`}>
                            {hour}:00
                          </option>,
                          <option key={`${hour}:30`} value={`${hour}:30`}>
                            {hour}:30
                          </option>,
                        ]
                      }).flat()}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="border-input text-foreground hover:bg-background"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.name || !formData.siteId}
              className="bg-secondary hover:bg-accent text-foreground"
            >
              Create Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Room</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update room information and opening hours
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-96 overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="edit-name" className="text-foreground">
                Room Name
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="bg-background border-input text-foreground"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-capacity" className="text-foreground">
                Capacity
              </Label>
              <Input
                id="edit-capacity"
                type="number"
                min="1"
                value={formData.capacity}
                onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                className="bg-background border-input text-foreground"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-site" className="text-foreground">
                Site
              </Label>
              <Select
                value={formData.siteId}
                onValueChange={value => setFormData({ ...formData, siteId: value })}
              >
                <SelectTrigger className="bg-background border-input text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-input">
                  {sites.map(site => (
                    <SelectItem key={site.id} value={site.id} className="text-foreground">
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3">
              <Label className="text-foreground">Opening Hours (24-hour format)</Label>
              <div className="space-y-3">
                {WEEKDAYS.map(day => (
                  <div key={day.key} className="flex items-center gap-3">
                    <div className="w-20 text-sm text-muted-foreground">{day.label}</div>
                    <select
                      value={formData.opening[day.key]?.open || "08:00"}
                      onChange={e => updateOpeningHours(day.key, "open", e.target.value)}
                      className="flex h-9 w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                    >
                      {Array.from({ length: 24 }, (_, h) => {
                        const hour = h.toString().padStart(2, "0")
                        return [
                          <option key={`${hour}:00`} value={`${hour}:00`}>
                            {hour}:00
                          </option>,
                          <option key={`${hour}:30`} value={`${hour}:30`}>
                            {hour}:30
                          </option>,
                        ]
                      }).flat()}
                    </select>
                    <span className="text-muted-foreground">to</span>
                    <select
                      value={formData.opening[day.key]?.close || "20:00"}
                      onChange={e => updateOpeningHours(day.key, "close", e.target.value)}
                      className="flex h-9 w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                    >
                      {Array.from({ length: 24 }, (_, h) => {
                        const hour = h.toString().padStart(2, "0")
                        return [
                          <option key={`${hour}:00`} value={`${hour}:00`}>
                            {hour}:00
                          </option>,
                          <option key={`${hour}:30`} value={`${hour}:30`}>
                            {hour}:30
                          </option>,
                        ]
                      }).flat()}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              className="border-input text-foreground hover:bg-background"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!formData.name || !formData.siteId}
              className="bg-secondary hover:bg-accent text-foreground"
            >
              Update Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

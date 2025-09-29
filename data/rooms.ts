/**
 * Data access layer for rooms
 */

import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import type { OpeningHours } from "@/core/opening-hours"

export interface RoomWithSite {
  id: string
  name: string
  capacity: number
  opening: OpeningHours
  siteId: string
  site: {
    id: string
    name: string
    timezone: string
  }
}

/**
 * Get all rooms with their sites
 */
export async function getAllRooms(): Promise<RoomWithSite[]> {
  const rooms = await prisma.room.findMany({
    include: {
      site: true,
    },
    orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
  })

  return rooms.map(room => ({
    ...room,
    opening: room.opening as OpeningHours,
  }))
}

/**
 * Get rooms by site IDs
 * @param siteIds - Array of site IDs to filter by
 * @param capacityMin - Minimum capacity required
 */
export async function getRoomsBySites(
  siteIds: string[],
  capacityMin?: number
): Promise<RoomWithSite[]> {
  const where: Prisma.RoomWhereInput = {
    siteId: { in: siteIds },
    ...(capacityMin && { capacity: { gte: capacityMin } }),
  }

  const rooms = await prisma.room.findMany({
    where,
    include: {
      site: true,
    },
    orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
  })

  return rooms.map(room => ({
    ...room,
    opening: room.opening as OpeningHours,
  }))
}

/**
 * Get rooms filtered by capacity
 * @param capacityMin - Minimum capacity required
 */
export async function getRoomsByCapacity(capacityMin: number): Promise<RoomWithSite[]> {
  const rooms = await prisma.room.findMany({
    where: {
      capacity: { gte: capacityMin },
    },
    include: {
      site: true,
    },
    orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
  })

  return rooms.map(room => ({
    ...room,
    opening: room.opening as OpeningHours,
  }))
}

/**
 * Get a single room by ID
 * @param roomId - Room ID
 */
export async function getRoomById(roomId: string): Promise<RoomWithSite | null> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      site: true,
    },
  })

  if (!room) return null

  return {
    ...room,
    opening: room.opening as OpeningHours,
  }
}

/**
 * Get rooms with optional filters
 * @param filters - Optional filters for sites and capacity
 */
export async function getRoomsWithFilters(filters: {
  siteIds?: string[]
  capacityMin?: number
}): Promise<RoomWithSite[]> {
  const where: Prisma.RoomWhereInput = {}

  if (filters.siteIds && filters.siteIds.length > 0) {
    where.siteId = { in: filters.siteIds }
  }

  if (filters.capacityMin) {
    where.capacity = { gte: filters.capacityMin }
  }

  const rooms = await prisma.room.findMany({
    where,
    include: {
      site: true,
    },
    orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
  })

  return rooms.map(room => ({
    ...room,
    opening: room.opening as OpeningHours,
  }))
}

/**
 * Create a new room
 * @param data - Room data
 */
export async function createRoom(data: {
  name: string
  capacity: number
  opening: OpeningHours
  siteId: string
}): Promise<RoomWithSite> {
  const room = await prisma.room.create({
    data: {
      name: data.name,
      capacity: data.capacity,
      opening: data.opening as Prisma.JsonValue,
      siteId: data.siteId,
    },
    include: {
      site: true,
    },
  })

  return {
    ...room,
    opening: room.opening as OpeningHours,
  }
}

/**
 * Update a room
 * @param roomId - Room ID
 * @param data - Updated room data
 */
export async function updateRoom(
  roomId: string,
  data: {
    name?: string
    capacity?: number
    opening?: OpeningHours
  }
): Promise<RoomWithSite | null> {
  try {
    const room = await prisma.room.update({
      where: { id: roomId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.capacity && { capacity: data.capacity }),
        ...(data.opening && { opening: data.opening as Prisma.JsonValue }),
      },
      include: {
        site: true,
      },
    })

    return {
      ...room,
      opening: room.opening as OpeningHours,
    }
  } catch (error) {
    return null
  }
}

/**
 * Individual Site API endpoint
 * GET /api/sites/[id] - Get site details
 * PUT /api/sites/[id] - Update site
 * DELETE /api/sites/[id] - Delete site
 */

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/current-user"
import { updateSiteSchema } from "@/schemas/site"
import { prisma } from "@/lib/db"

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * Get site details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const site = await prisma.site.findUnique({
      where: { id },
      include: {
        _count: {
          select: { rooms: true },
        },
      },
    })

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    return NextResponse.json({
      site: {
        id: site.id,
        name: site.name,
        timezone: site.timezone,
        roomCount: site._count.rooms,
      },
    })
  } catch (error) {
    console.error("Get site error:", error)
    return NextResponse.json({ error: "Failed to fetch site" }, { status: 500 })
  }
}

/**
 * Update a site (admin only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser(request)

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 })
    }

    const body = await request.json()

    // Add the ID from the URL to the body for validation
    const inputWithId = { ...body, id }
    const validationResult = updateSiteSchema.safeParse(inputWithId)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const input = validationResult.data

    // Check if site exists
    const existingSite = await prisma.site.findUnique({
      where: { id },
    })

    if (!existingSite) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    // Check if new name conflicts with another site
    if (input.name && input.name !== existingSite.name) {
      const nameConflict = await prisma.site.findFirst({
        where: {
          name: input.name,
          id: { not: id },
        },
      })

      if (nameConflict) {
        return NextResponse.json({ error: "Site name already exists" }, { status: 409 })
      }
    }

    // Prepare update data
    const updateData: any = {}
    if (input.name) updateData.name = input.name
    if (input.timezone) updateData.timezone = input.timezone

    // Update the site
    const updatedSite = await prisma.site.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { rooms: true },
        },
      },
    })

    // Log the activity
    await prisma.activityLog.create({
      data: {
        actorId: currentUser.id,
        action: "SITE_UPDATED",
        entityType: "site",
        entityId: updatedSite.id,
        metadata: {
          siteName: updatedSite.name,
          timezone: updatedSite.timezone,
          changes: updateData,
        },
      },
    })

    return NextResponse.json({
      site: {
        id: updatedSite.id,
        name: updatedSite.name,
        timezone: updatedSite.timezone,
        roomCount: updatedSite._count.rooms,
      },
    })
  } catch (error) {
    console.error("Update site error:", error)
    return NextResponse.json({ error: "Failed to update site" }, { status: 500 })
  }
}

/**
 * Delete a site (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser(request)

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 })
    }

    // Check if site exists and has rooms
    const existingSite = await prisma.site.findUnique({
      where: { id },
      include: {
        _count: { select: { rooms: true } },
      },
    })

    if (!existingSite) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    if (existingSite._count.rooms > 0) {
      return NextResponse.json(
        { error: "Cannot delete site with existing rooms. Delete rooms first." },
        { status: 409 }
      )
    }

    // Delete the site
    await prisma.site.delete({
      where: { id },
    })

    // Log the activity
    await prisma.activityLog.create({
      data: {
        actorId: currentUser.id,
        action: "SITE_DELETED",
        entityType: "site",
        entityId: id,
        metadata: {
          siteName: existingSite.name,
          timezone: existingSite.timezone,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Site deleted successfully",
    })
  } catch (error) {
    console.error("Delete site error:", error)
    return NextResponse.json({ error: "Failed to delete site" }, { status: 500 })
  }
}

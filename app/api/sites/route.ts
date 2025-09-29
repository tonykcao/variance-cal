/**
 * Sites API endpoint
 * GET /api/sites - List all sites
 * POST /api/sites - Create new site (admin only)
 * PUT /api/sites - Update site (admin only)
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/current-user"
import { createSiteSchema, updateSiteSchema } from "@/schemas/site"

/**
 * Get all sites
 */
export async function GET() {
  try {
    const sites = await prisma.site.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            rooms: true,
          },
        },
      },
    })

    return NextResponse.json({
      sites: sites.map(site => ({
        id: site.id,
        name: site.name,
        timezone: site.timezone,
        roomCount: site._count.rooms,
      })),
    })
  } catch (error) {
    console.error("Sites API error:", error)
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 })
  }
}

/**
 * Create a new site (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 })
    }

    const body = await request.json()
    const validationResult = createSiteSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const input = validationResult.data

    // Check if site name already exists
    const existingSite = await prisma.site.findFirst({
      where: { name: input.name },
    })

    if (existingSite) {
      return NextResponse.json({ error: "Site name already exists" }, { status: 409 })
    }

    // Create the site
    const site = await prisma.site.create({
      data: {
        name: input.name,
        timezone: input.timezone,
      },
    })

    // Log the activity
    await prisma.activityLog.create({
      data: {
        actorId: currentUser.id,
        action: "SITE_CREATED",
        entityType: "site",
        entityId: site.id,
        metadata: {
          siteName: site.name,
          timezone: site.timezone,
        },
      },
    })

    return NextResponse.json({
      site: {
        id: site.id,
        name: site.name,
        timezone: site.timezone,
        roomCount: 0,
      },
    })
  } catch (error) {
    console.error("Create site error:", error)
    return NextResponse.json({ error: "Failed to create site" }, { status: 500 })
  }
}

/**
 * Update a site (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 })
    }

    const body = await request.json()
    const validationResult = updateSiteSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const input = validationResult.data

    // Check if site exists
    const existingSite = await prisma.site.findUnique({
      where: { id: input.id },
    })

    if (!existingSite) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    // Check if new name conflicts with another site
    if (input.name && input.name !== existingSite.name) {
      const nameConflict = await prisma.site.findFirst({
        where: {
          name: input.name,
          id: { not: input.id },
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
      where: { id: input.id },
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

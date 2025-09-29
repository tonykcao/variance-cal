/**
 * Data access layer for sites
 */

import { prisma } from "@/lib/db"

export interface Site {
  id: string
  name: string
  timezone: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Get all sites
 */
export async function getSites(): Promise<Site[]> {
  const sites = await prisma.site.findMany({
    orderBy: {
      name: "asc",
    },
  })

  return sites
}

/**
 * Get site by ID
 * @param siteId - Site ID
 */
export async function getSiteById(siteId: string): Promise<Site | null> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
  })

  return site
}

/**
 * Get sites by IDs
 * @param siteIds - Array of site IDs
 */
export async function getSitesByIds(siteIds: string[]): Promise<Site[]> {
  const sites = await prisma.site.findMany({
    where: {
      id: { in: siteIds },
    },
    orderBy: {
      name: "asc",
    },
  })

  return sites
}

/**
 * Create a new site
 * @param data - Site data
 */
export async function createSite(data: { name: string; timezone: string }): Promise<Site> {
  const site = await prisma.site.create({
    data: {
      name: data.name,
      timezone: data.timezone,
    },
  })

  return site
}

/**
 * Update a site
 * @param siteId - Site ID
 * @param data - Updated site data
 */
export async function updateSite(
  siteId: string,
  data: {
    name?: string
    timezone?: string
  }
): Promise<Site | null> {
  try {
    const site = await prisma.site.update({
      where: { id: siteId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.timezone && { timezone: data.timezone }),
      },
    })

    return site
  } catch (error) {
    return null
  }
}

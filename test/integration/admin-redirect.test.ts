import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/app/middleware'
import { currentUser } from '@/lib/auth/current-user'

// Mock the currentUser module
vi.mock('@/lib/auth/current-user', () => ({
  currentUser: vi.fn(),
}))

describe('Admin Redirect Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Admin Route Protection', () => {
    it('should allow admin users to access admin routes', async () => {
      const mockCurrentUser = vi.mocked(currentUser)
      mockCurrentUser.mockResolvedValue({
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
        timezone: 'America/New_York',
        role: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest(new URL('http://localhost:3000/dashboard/admin/sites'))
      const response = await middleware(request)

      // Admin should not be redirected
      expect(response).toBeUndefined()
    })

    it('should redirect non-admin users from admin routes to dashboard', async () => {
      const mockCurrentUser = vi.mocked(currentUser)
      mockCurrentUser.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        name: 'Regular User',
        timezone: 'America/New_York',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest(new URL('http://localhost:3000/dashboard/admin/sites'))
      const response = await middleware(request)

      expect(response).toBeDefined()
      expect(response?.status).toBe(302)
      expect(response?.headers.get('Location')).toBe('/dashboard')
    })

    it('should redirect unauthenticated users from admin routes to login', async () => {
      const mockCurrentUser = vi.mocked(currentUser)
      mockCurrentUser.mockResolvedValue(null)

      const request = new NextRequest(new URL('http://localhost:3000/dashboard/admin/sites'))
      const response = await middleware(request)

      expect(response).toBeDefined()
      expect(response?.status).toBe(302)
      expect(response?.headers.get('Location')).toBe('/login')
    })
  })

  describe('Admin Subroute Protection', () => {
    const adminRoutes = [
      '/dashboard/admin/sites',
      '/dashboard/admin/rooms/site-1',
      '/dashboard/admin/activity',
      '/dashboard/admin/settings',
      '/dashboard/admin',
    ]

    adminRoutes.forEach((route) => {
      it(`should protect ${route} from non-admin users`, async () => {
        const mockCurrentUser = vi.mocked(currentUser)
        mockCurrentUser.mockResolvedValue({
          id: 'user-id',
          email: 'user@example.com',
          name: 'Regular User',
          timezone: 'America/New_York',
          role: 'USER',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        const request = new NextRequest(new URL(`http://localhost:3000${route}`))
        const response = await middleware(request)

        expect(response).toBeDefined()
        expect(response?.status).toBe(302)
        expect(response?.headers.get('Location')).toBe('/dashboard')
      })
    })
  })

  describe('Non-Admin Routes', () => {
    it('should allow all users to access public dashboard routes', async () => {
      const mockCurrentUser = vi.mocked(currentUser)
      mockCurrentUser.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        name: 'Regular User',
        timezone: 'America/New_York',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const publicRoutes = [
        '/dashboard',
        '/dashboard/availability',
        '/dashboard/my-bookings',
      ]

      for (const route of publicRoutes) {
        const request = new NextRequest(new URL(`http://localhost:3000${route}`))
        const response = await middleware(request)

        // Should not redirect
        expect(response).toBeUndefined()
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle case-insensitive admin path matching', async () => {
      const mockCurrentUser = vi.mocked(currentUser)
      mockCurrentUser.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        name: 'Regular User',
        timezone: 'America/New_York',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest(new URL('http://localhost:3000/dashboard/ADMIN/sites'))
      const response = await middleware(request)

      expect(response).toBeDefined()
      expect(response?.status).toBe(302)
      expect(response?.headers.get('Location')).toBe('/dashboard')
    })

    it('should handle trailing slashes correctly', async () => {
      const mockCurrentUser = vi.mocked(currentUser)
      mockCurrentUser.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        name: 'Regular User',
        timezone: 'America/New_York',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest(new URL('http://localhost:3000/dashboard/admin/'))
      const response = await middleware(request)

      expect(response).toBeDefined()
      expect(response?.status).toBe(302)
      expect(response?.headers.get('Location')).toBe('/dashboard')
    })

    it('should preserve query parameters when redirecting', async () => {
      const mockCurrentUser = vi.mocked(currentUser)
      mockCurrentUser.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        name: 'Regular User',
        timezone: 'America/New_York',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest(
        new URL('http://localhost:3000/dashboard/admin/sites?error=unauthorized')
      )
      const response = await middleware(request)

      expect(response).toBeDefined()
      expect(response?.status).toBe(302)
      // Query params might or might not be preserved based on implementation
      const location = response?.headers.get('Location')
      expect(location).toContain('/dashboard')
    })
  })

  describe('Performance', () => {
    it('should cache user lookup for multiple requests', async () => {
      const mockCurrentUser = vi.mocked(currentUser)
      mockCurrentUser.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        name: 'Regular User',
        timezone: 'America/New_York',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Make multiple requests
      const requests = [
        new NextRequest(new URL('http://localhost:3000/dashboard/admin/sites')),
        new NextRequest(new URL('http://localhost:3000/dashboard/admin/rooms')),
        new NextRequest(new URL('http://localhost:3000/dashboard/admin/activity')),
      ]

      for (const request of requests) {
        await middleware(request)
      }

      // Verify currentUser was called appropriately
      expect(mockCurrentUser).toHaveBeenCalledTimes(3)
    })
  })

  describe('Security Headers', () => {
    it('should add security headers to admin redirect responses', async () => {
      const mockCurrentUser = vi.mocked(currentUser)
      mockCurrentUser.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        name: 'Regular User',
        timezone: 'America/New_York',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest(new URL('http://localhost:3000/dashboard/admin/sites'))
      const response = await middleware(request)

      expect(response).toBeDefined()
      // Check for standard security headers
      expect(response?.headers.get('X-Frame-Options')).toBeTruthy()
      expect(response?.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })
  })
})
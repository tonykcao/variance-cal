/**
 * Validation schemas for Site operations
 */

import { z } from 'zod';

// Supported timezones from the spec
const SUPPORTED_TIMEZONES = [
  'America/Los_Angeles', // San Francisco
  'America/New_York',    // New York
  'Europe/London',       // London
  'Asia/Shanghai',       // Shanghai
] as const;

export const createSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required').max(100, 'Site name too long'),
  timezone: z.enum(SUPPORTED_TIMEZONES, {
    errorMap: () => ({ message: 'Invalid timezone. Must be one of: America/Los_Angeles, America/New_York, Europe/London, Asia/Shanghai' })
  }),
});

export const updateSiteSchema = z.object({
  id: z.string().cuid('Invalid site ID format'),
  name: z.string().min(1, 'Site name is required').max(100, 'Site name too long').optional(),
  timezone: z.enum(SUPPORTED_TIMEZONES, {
    errorMap: () => ({ message: 'Invalid timezone. Must be one of: America/Los_Angeles, America/New_York, Europe/London, Asia/Shanghai' })
  }).optional(),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
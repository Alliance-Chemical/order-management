import { z } from 'zod';

export const JobSchemas = {
  qr_generation: z.object({
    action: z.string(),
    workspaceId: z.string(),
    orderId: z.number(),
    orderNumber: z.string(),
    strategy: z.string().optional(),
    items: z.array(z.any()).default([]),
    containerCount: z.number().optional(),
  }),
  alert: z.object({
    workspaceId: z.string(),
    alertType: z.string(),
  }),
  webhook: z.object({
    url: z.string().url(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('POST'),
    headers: z.record(z.string()).optional(),
    body: z.any().optional(),
  }),
  tag_sync: z.object({
    orderId: z.number(),
    tagIds: z.array(z.number()),
    source: z.string().optional(),
  }),
} as const;

export type JobType = keyof typeof JobSchemas;
export type JobPayload<T extends JobType> = z.infer<typeof JobSchemas[T]>;
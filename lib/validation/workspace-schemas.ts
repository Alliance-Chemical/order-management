/**
 * Zod Validation Schemas for Workspace Operations
 *
 * Provides runtime type validation for API requests and ensures data integrity.
 * Use these schemas at API route boundaries to validate incoming requests.
 */

import { z } from 'zod';

/**
 * Create Workspace Schema
 */
export const createWorkspaceSchema = z.object({
  orderId: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform(Number),
  ]),
  orderNumber: z.string().min(1, 'Order number is required'),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

/**
 * Update Workspace Module State Schema
 */
export const updateModuleStateSchema = z.object({
  module: z.enum(['pre_mix', 'warehouse', 'documents', 'freight']),
  state: z.record(z.unknown()),
});

export type UpdateModuleStateInput = z.infer<typeof updateModuleStateSchema>;

/**
 * Add Note Schema
 */
export const addNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(5000, 'Note too long'),
  author: z.string().optional(),
  type: z.enum(['general', 'warning', 'critical', 'info']).default('general'),
});

export type AddNoteInput = z.infer<typeof addNoteSchema>;

/**
 * Measurement Schema (shared)
 */
const measurementSchema = z.object({
  value: z.number().positive('Measurement must be positive'),
  units: z.string().min(1, 'Units are required'),
});

/**
 * Dimensions Schema (shared)
 */
const dimensionsSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  units: z.enum(['in', 'cm', 'ft']).default('in'),
});

/**
 * Final Measurements Schema
 */
export const finalMeasurementsSchema = z.object({
  weight: measurementSchema.optional(),
  dimensions: dimensionsSchema.optional(),
  palletCount: z.number().int().positive().optional(),
  palletType: z.enum(['standard', 'euro', 'custom']).optional(),
  measuredBy: z.string().min(1, 'Measured by is required'),
  notes: z.string().max(1000).optional(),
  photos: z.array(z.object({
    url: z.string().url(),
    caption: z.string().optional(),
    timestamp: z.string().datetime().optional(),
  })).optional(),
});

export type FinalMeasurementsInput = z.infer<typeof finalMeasurementsSchema>;

/**
 * Pre-Ship Complete Schema
 */
export const preShipCompleteSchema = z.object({
  bolNumber: z.string().min(1, 'BOL number is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  trackingNumber: z.string().optional(),
  freightClass: z.string().optional(),
  measurements: finalMeasurementsSchema.optional(),
  inspectionResults: z.object({
    passed: z.boolean(),
    failedChecks: z.array(z.string()).default([]),
    inspector: z.string().min(1, 'Inspector name is required'),
    notes: z.string().optional(),
  }).optional(),
  scheduledPickupDate: z.string().datetime().optional(),
});

export type PreShipCompleteInput = z.infer<typeof preShipCompleteSchema>;

/**
 * Upload Document Schema
 */
export const uploadDocumentSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  fileType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']),
  fileSize: z.number().max(10 * 1024 * 1024, 'File size must be under 10MB'),
  documentType: z.enum(['bol', 'coa', 'sds', 'invoice', 'packing_slip', 'other']),
  s3Url: z.string().url('Invalid S3 URL'),
  uploadedBy: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

/**
 * Create Alert Schema
 */
export const createAlertSchema = z.object({
  type: z.enum(['info', 'warning', 'error', 'success']),
  title: z.string().min(1, 'Alert title is required').max(200),
  message: z.string().min(1, 'Alert message is required').max(1000),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  actionRequired: z.boolean().default(false),
  actionUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CreateAlertInput = z.infer<typeof createAlertSchema>;

/**
 * QR Code Generation Schema
 */
export const qrCodeGenerationSchema = z.object({
  containerType: z.string().min(1, 'Container type is required'),
  productInfo: z.object({
    sku: z.string().min(1),
    name: z.string().min(1),
    variantTitle: z.string().optional(),
    casNumber: z.string().optional(),
    unNumber: z.string().optional(),
  }),
  quantity: z.number().int().positive().default(1),
  labelSize: z.enum(['4x6', '4x4', '2x2']).default('4x6'),
});

export type QRCodeGenerationInput = z.infer<typeof qrCodeGenerationSchema>;

/**
 * Archive Workspace Schema
 */
export const archiveWorkspaceSchema = z.object({
  reason: z.enum(['completed', 'cancelled', 'on_hold', 'other']),
  notes: z.string().max(500).optional(),
  archivedBy: z.string().min(1, 'Archived by is required'),
});

export type ArchiveWorkspaceInput = z.infer<typeof archiveWorkspaceSchema>;

/**
 * Helper function to validate and parse request body
 *
 * @example
 * ```typescript
 * const body = await request.json();
 * const validated = validateRequest(createWorkspaceSchema, body);
 *
 * if (!validated.success) {
 *   return NextResponse.json(
 *     { error: validated.error },
 *     { status: 400 }
 *   );
 * }
 *
 * const { orderId, orderNumber } = validated.data;
 * ```
 */
export function validateRequest<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: messages };
    }
    return { success: false, error: 'Validation failed' };
  }
}

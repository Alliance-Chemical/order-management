/**
 * Zod Validation Schemas for Inspection Operations
 *
 * Validates inspection submissions, photo uploads, and quality checks.
 */

import { z } from 'zod';

/**
 * Photo Upload Schema
 */
export const photoUploadSchema = z.object({
  url: z.string().url('Invalid photo URL'),
  caption: z.string().max(200).optional(),
  timestamp: z.string().datetime().optional(),
  metadata: z.object({
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    size: z.number().positive().optional(),
    mimeType: z.string().optional(),
  }).optional(),
});

export type PhotoUploadInput = z.infer<typeof photoUploadSchema>;

/**
 * Inspection Check Item Schema
 */
export const inspectionCheckSchema = z.object({
  checkId: z.string().min(1, 'Check ID is required'),
  checkName: z.string().min(1, 'Check name is required'),
  status: z.enum(['passed', 'failed', 'skipped', 'not_applicable']),
  notes: z.string().max(500).optional(),
  photos: z.array(photoUploadSchema).max(10, 'Maximum 10 photos per check').optional(),
  failureReason: z.string().max(500).optional(),
  actionTaken: z.string().max(500).optional(),
});

export type InspectionCheckInput = z.infer<typeof inspectionCheckSchema>;

/**
 * Container Inspection Schema
 */
export const containerInspectionSchema = z.object({
  containerId: z.string().min(1, 'Container ID is required'),
  containerType: z.string().min(1, 'Container type is required'),
  sku: z.string().min(1, 'SKU is required'),
  checks: z.array(inspectionCheckSchema).min(1, 'At least one check is required'),
  overallStatus: z.enum(['passed', 'failed', 'conditional']),
  inspectorName: z.string().min(1, 'Inspector name is required'),
  inspectionDate: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

export type ContainerInspectionInput = z.infer<typeof containerInspectionSchema>;

/**
 * Pre-Mix Inspection Schema
 */
export const preMixInspectionSchema = z.object({
  containers: z.array(containerInspectionSchema).min(1, 'At least one container inspection is required'),
  mixingNotes: z.string().max(2000).optional(),
  batchNumber: z.string().optional(),
  specificGravity: z.number().positive().optional(),
  temperature: z.object({
    value: z.number(),
    units: z.enum(['C', 'F']).default('F'),
  }).optional(),
  photos: z.array(photoUploadSchema).max(20).optional(),
  phase: z.literal('pre_mix'),
});

export type PreMixInspectionInput = z.infer<typeof preMixInspectionSchema>;

/**
 * Pre-Ship Inspection Schema
 */
export const preShipInspectionSchema = z.object({
  containers: z.array(containerInspectionSchema).min(1, 'At least one container inspection is required'),
  palletConfiguration: z.object({
    palletCount: z.number().int().positive(),
    itemsPerPallet: z.number().int().positive(),
    palletType: z.enum(['standard', 'euro', 'custom']).default('standard'),
    stretchWrapped: z.boolean().default(true),
    cornerBoards: z.boolean().default(false),
  }).optional(),
  finalWeight: z.object({
    value: z.number().positive('Weight must be positive'),
    units: z.enum(['lbs', 'kg']).default('lbs'),
  }).optional(),
  finalDimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    units: z.enum(['in', 'cm', 'ft']).default('in'),
  }).optional(),
  readyForPickup: z.boolean().default(false),
  photos: z.array(photoUploadSchema).max(20).optional(),
  phase: z.literal('pre_ship'),
});

export type PreShipInspectionInput = z.infer<typeof preShipInspectionSchema>;

/**
 * Quality Issue Report Schema
 */
export const qualityIssueSchema = z.object({
  issueType: z.enum([
    'contamination',
    'incorrect_product',
    'damaged_container',
    'wrong_quantity',
    'labeling_error',
    'documentation_missing',
    'other',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  affectedContainers: z.array(z.string()).min(1, 'At least one container must be specified'),
  photos: z.array(photoUploadSchema).min(1, 'At least one photo is required').max(10),
  reportedBy: z.string().min(1, 'Reporter name is required'),
  proposedAction: z.enum([
    'reject',
    'rework',
    'accept_with_deviation',
    'quarantine',
    'investigate',
  ]).optional(),
  notes: z.string().max(1000).optional(),
});

export type QualityIssueInput = z.infer<typeof qualityIssueSchema>;

/**
 * Multi-Container Inspection Submission Schema
 */
export const multiContainerInspectionSchema = z.object({
  orderId: z.number().int().positive(),
  phase: z.enum(['pre_mix', 'warehouse', 'pre_ship']),
  inspections: z.array(containerInspectionSchema).min(1).max(100),
  batchMetadata: z.object({
    sessionId: z.string().optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    totalDuration: z.number().positive().optional(), // in seconds
  }).optional(),
});

export type MultiContainerInspectionInput = z.infer<typeof multiContainerInspectionSchema>;

/**
 * Helper function for strict validation
 */
export function validateInspection<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => {
        const path = e.path.join('.');
        return path ? `${path}: ${e.message}` : e.message;
      });
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation failed'] };
  }
}

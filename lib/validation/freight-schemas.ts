/**
 * Zod Validation Schemas for Freight Operations
 *
 * Validates freight booking, quotes, and carrier information.
 */

import { z } from 'zod';

/**
 * Address Schema (shared)
 */
const addressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  address1: z.string().min(1, 'Address is required'),
  address2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'State must be 2 characters').toUpperCase(),
  postalCode: z.string().min(5, 'Postal code is required'),
  country: z.string().length(2, 'Country must be 2 characters').default('US'),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number').optional(),
  email: z.string().email('Invalid email').optional(),
});

/**
 * Freight Item Schema
 */
const freightItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200),
  nmfcCode: z.string().optional(),
  freightClass: z.string().regex(/^[5-9]\d{1,2}$/, 'Invalid freight class (50-500)').optional(),
  weight: z.number().positive('Weight must be positive'),
  weightUnit: z.enum(['lbs', 'kg']).default('lbs'),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(['in', 'cm']).default('in'),
  }),
  quantity: z.number().int().positive().default(1),
  packagingType: z.enum(['pallet', 'crate', 'box', 'drum', 'bag', 'other']).default('pallet'),
  hazmat: z.boolean().default(false),
  hazmatInfo: z.object({
    unNumber: z.string().regex(/^UN\d{4}$/, 'Invalid UN number (e.g., UN1090)'),
    shippingName: z.string().min(1),
    hazardClass: z.string().min(1),
    packingGroup: z.enum(['I', 'II', 'III']),
    emergencyContact: z.string().optional(),
  }).optional(),
});

export type FreightItemInput = z.infer<typeof freightItemSchema>;

/**
 * Freight Quote Request Schema
 */
export const freightQuoteRequestSchema = z.object({
  orderId: z.number().int().positive(),
  shipFrom: addressSchema,
  shipTo: addressSchema,
  items: z.array(freightItemSchema).min(1, 'At least one item is required'),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  accessorials: z.array(z.enum([
    'liftgate_pickup',
    'liftgate_delivery',
    'residential_pickup',
    'residential_delivery',
    'inside_pickup',
    'inside_delivery',
    'limited_access',
    'trade_show',
    'appointment_required',
    'hazmat',
  ])).default([]),
  insuranceValue: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

export type FreightQuoteRequestInput = z.infer<typeof freightQuoteRequestSchema>;

/**
 * Freight Quote Response Schema
 */
export const freightQuoteSchema = z.object({
  quoteId: z.string().min(1),
  carrier: z.object({
    name: z.string().min(1),
    scac: z.string().length(4, 'SCAC must be 4 characters').optional(),
    logo: z.string().url().optional(),
  }),
  serviceLevel: z.string().min(1),
  totalCharge: z.number().positive(),
  baseRate: z.number().positive(),
  fuelSurcharge: z.number().nonnegative(),
  accessorialCharges: z.array(z.object({
    type: z.string(),
    amount: z.number().positive(),
  })).default([]),
  estimatedTransitDays: z.number().int().positive(),
  pickupDate: z.string().datetime(),
  deliveryDate: z.string().datetime(),
  expiresAt: z.string().datetime(),
  currency: z.string().length(3).default('USD'),
});

export type FreightQuoteOutput = z.infer<typeof freightQuoteSchema>;

/**
 * Freight Booking Schema
 */
export const freightBookingSchema = z.object({
  orderId: z.number().int().positive(),
  quoteId: z.string().min(1, 'Quote ID is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  serviceLevel: z.string().min(1),
  totalCost: z.number().positive('Total cost must be positive'),
  bolNumber: z.string().min(1, 'BOL number is required'),
  proNumber: z.string().optional(),
  pickupDate: z.string().datetime(),
  estimatedDeliveryDate: z.string().datetime(),
  specialInstructions: z.string().max(1000).optional(),
  contactInfo: z.object({
    pickupContact: z.string().min(1, 'Pickup contact is required'),
    pickupPhone: z.string().min(1, 'Pickup phone is required'),
    deliveryContact: z.string().min(1, 'Delivery contact is required'),
    deliveryPhone: z.string().min(1, 'Delivery phone is required'),
  }),
  bookedBy: z.string().min(1, 'Booked by is required'),
});

export type FreightBookingInput = z.infer<typeof freightBookingSchema>;

/**
 * Freight Tracking Update Schema
 */
export const freightTrackingSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number is required'),
  status: z.enum([
    'pending_pickup',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'exception',
    'cancelled',
  ]),
  location: z.object({
    city: z.string(),
    state: z.string(),
    country: z.string().default('US'),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
  }).optional(),
  timestamp: z.string().datetime(),
  notes: z.string().max(500).optional(),
  signedBy: z.string().optional(),
  proofOfDelivery: z.string().url().optional(),
});

export type FreightTrackingInput = z.infer<typeof freightTrackingSchema>;

/**
 * Carrier Selection Schema
 */
export const carrierSelectionSchema = z.object({
  orderId: z.number().int().positive(),
  quoteId: z.string().min(1),
  carrierName: z.string().min(1, 'Carrier name is required'),
  scac: z.string().length(4).toUpperCase().optional(),
  estimatedCost: z.number().positive(),
  estimatedTransitDays: z.number().int().positive(),
  selectedBy: z.string().min(1, 'Selected by is required'),
  selectionReason: z.enum([
    'lowest_cost',
    'fastest_transit',
    'preferred_carrier',
    'capacity_available',
    'other',
  ]).default('lowest_cost'),
  notes: z.string().max(500).optional(),
});

export type CarrierSelectionInput = z.infer<typeof carrierSelectionSchema>;

/**
 * Helper function to validate freight data
 */
export function validateFreight<T extends z.ZodType>(
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

/**
 * Freight Classifications schema
 * Single responsibility: NMFC codes and freight class management
 */

import { pgTable, uuid, varchar, text, boolean, decimal, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const freightClassifications = pgTable('freight_classifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  description: text('description').notNull(),
  nmfcCode: varchar('nmfc_code', { length: 20 }),
  freightClass: varchar('freight_class', { length: 10 }).notNull(),
  
  // Hazmat information
  isHazmat: boolean('is_hazmat').default(false),
  hazmatClass: varchar('hazmat_class', { length: 10 }),
  packingGroup: varchar('packing_group', { length: 5 }),
  
  // Packaging requirements
  packagingInstructions: text('packaging_instructions'),
  specialHandling: text('special_handling'),
  
  // Density and dimensional rules
  minDensity: decimal('min_density', { precision: 8, scale: 2 }),
  maxDensity: decimal('max_density', { precision: 8, scale: 2 }),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  descriptionIdx: index('idx_classifications_description').on(table.description),
  nmfcIdx: index('idx_classifications_nmfc').on(table.nmfcCode),
  freightClassIdx: index('idx_classifications_class').on(table.freightClass),
  hazmatIdx: index('idx_classifications_hazmat').on(table.isHazmat),
  uqFreightClassKey: uniqueIndex('uq_freight_class_key').on(
    table.freightClass,
    table.nmfcCode,
    table.description,
  ),
}));

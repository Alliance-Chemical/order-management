/**
 * Chemical Products schema
 * Single responsibility: Chemical product master catalog
 */

import { pgTable, uuid, varchar, text, decimal, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  
  // Physical attributes
  weight: decimal('weight', { precision: 10, scale: 2 }),
  length: decimal('length', { precision: 10, scale: 2 }),
  width: decimal('width', { precision: 10, scale: 2 }),
  height: decimal('height', { precision: 10, scale: 2 }),
  
  // Packaging info
  packagingType: varchar('packaging_type', { length: 50 }),
  unitsPerPackage: integer('units_per_package').default(1),
  unitContainerType: varchar('unit_container_type', { length: 50 }),
  
  // Chemical properties
  isHazardous: boolean('is_hazardous').default(false),
  casNumber: varchar('cas_number', { length: 20 }),
  unNumber: varchar('un_number', { length: 10 }),
  
  // Status
  isActive: boolean('is_active').default(true),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  skuIdx: index('idx_products_sku').on(table.sku),
  nameIdx: index('idx_products_name').on(table.name),
  activeIdx: index('idx_products_active').on(table.isActive),
  hazardousIdx: index('idx_products_hazardous').on(table.isHazardous),
  casIdx: index('idx_products_cas').on(table.casNumber),
}));
import { pgTable, serial, varchar, integer, timestamp, numeric, uuid, text, boolean, jsonb, unique } from 'drizzle-orm/pg-core';

// LOT Numbers table from original database
export const legacyLotNumbers = pgTable('lot_numbers', {
  id: serial('id').primaryKey(),
  productId: varchar('product_id', { length: 255 }).notNull(),
  month: varchar('month', { length: 20 }).notNull(),
  lotNumber: varchar('lot_number', { length: 255 }),
  year: integer('year').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  productTitle: varchar('product_title', { length: 255 }).default('Default Title').notNull(),
  sku: varchar('sku', { length: 255 }),
}, (table) => ({
  uniqueLotNumber: unique('unique_lot_number').on(table.productId, table.month, table.year),
}));

// Label Requests table from original database
export const legacyLabelRequests = pgTable('label_requests', {
  id: serial('id').primaryKey(),
  productId: varchar('product_id', { length: 255 }),
  productName: text('product_name'),
  quantity: integer('quantity'),
  status: varchar('status', { length: 20 }).default('pending'),
  requestedAt: timestamp('requested_at').defaultNow(),
  customRequest: boolean('custom_request').default(false),
  customDetails: text('custom_details'),
  requestedBy: varchar('requested_by', { length: 255 }),
  printedBy: varchar('printed_by', { length: 255 }),
  printedAt: timestamp('printed_at'),
  lotNumber: varchar('lot_number', { length: 255 }),
  variantOption1: varchar('variant_option1', { length: 255 }),
  sku: varchar('sku', { length: 255 }),
  labelType: varchar('label_type', { length: 20 }).default('container'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  urgent: boolean('urgent').default(false), // Added from migration
});

// Batch History table from original database
export const legacyBatchHistory = pgTable('batch_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: timestamp('date', { withTimezone: true }).defaultNow().notNull(),
  chemicalName: varchar('chemical_name', { length: 255 }).notNull(),
  initialConcentration: numeric('initial_concentration', { precision: 10, scale: 2 }).notNull(),
  desiredConcentration: numeric('desired_concentration', { precision: 10, scale: 2 }).notNull(),
  totalVolume: numeric('total_volume', { precision: 10, scale: 3 }).notNull(),
  chemicalAmount: numeric('chemical_amount', { precision: 10, scale: 3 }).notNull(),
  waterAmount: numeric('water_amount', { precision: 10, scale: 3 }).notNull(),
  chemicalWeight: numeric('chemical_weight', { precision: 10, scale: 3 }).notNull(),
  waterWeight: numeric('water_weight', { precision: 10, scale: 3 }).notNull(),
  notes: text('notes').default(''),
  completedBy: varchar('completed_by', { length: 255 }).notNull(),
  batchNumber: varchar('batch_number', { length: 100 }).notNull().unique(),
  methodUsed: varchar('method_used', { length: 10 }).notNull(),
  initialSpecificGravity: numeric('initial_specific_gravity', { precision: 10, scale: 3 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Products table from original database
export const legacyProducts = pgTable('products', {
  id: varchar('id').primaryKey(),
  title: text('title').notNull(),
  pricePerPound: numeric('price_per_pound'),
  specificGravity: numeric('specific_gravity'),
});

// Chemicals table from original database
export const legacyChemicals = pgTable('chemicals', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  concentration: varchar('concentration', { length: 20 }).notNull(),
  minStock: integer('min_stock').notNull(),
  maxStock: integer('max_stock').notNull(),
  currentStock: integer('current_stock').notNull(),
  hazardType: varchar('hazard_type').notNull(), // enum in original: 'corrosive', 'toxic', 'flammable', 'low'
  location: varchar('location', { length: 50 }).default('main'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// COA Documents table from original database
export const legacyCoaDocuments = pgTable('coa_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  standardizedName: varchar('standardized_name', { length: 255 }).notNull(),
  compoundName: varchar('compound_name', { length: 255 }).notNull(),
  casNumber: varchar('cas_number', { length: 50 }),
  batchNumber: varchar('batch_number', { length: 100 }),
  issueDate: timestamp('issue_date'),
  expiryDate: timestamp('expiry_date'),
  manufacturer: varchar('manufacturer', { length: 255 }),
  purityPercentage: numeric('purity_percentage', { precision: 5, scale: 2 }),
  documentType: varchar('document_type', { length: 100 }).default('COA'),
  metadata: jsonb('metadata').default({}).notNull(),
  s3Url: text('s3_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Type exports for TypeScript
export type LegacyLotNumber = typeof legacyLotNumbers.$inferSelect;
export type NewLegacyLotNumber = typeof legacyLotNumbers.$inferInsert;

export type LegacyLabelRequest = typeof legacyLabelRequests.$inferSelect;
export type NewLegacyLabelRequest = typeof legacyLabelRequests.$inferInsert;

export type LegacyBatchHistory = typeof legacyBatchHistory.$inferSelect;
export type NewLegacyBatchHistory = typeof legacyBatchHistory.$inferInsert;

export type LegacyProduct = typeof legacyProducts.$inferSelect;
export type LegacyChemical = typeof legacyChemicals.$inferSelect;
export type LegacyCoaDocument = typeof legacyCoaDocuments.$inferSelect;
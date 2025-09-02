import { pgTable, uuid, bigint, varchar, jsonb, timestamp, integer, boolean, index, decimal, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './qr-workspace';

// Freight Orders - linked to workspaces for unified tracking
export const freightOrders = pgTable('freight_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id), // Link to existing workspace
  
  // Order Identification
  orderId: bigint('order_id', { mode: 'number' }).notNull().unique(), // Same as workspace.orderId
  orderNumber: varchar('order_number', { length: 100 }).notNull(),
  
  // MyCarrier Integration
  myCarrierOrderId: varchar('mycarrier_order_id', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 255 }),
  
  // Freight Details
  carrierName: varchar('carrier_name', { length: 255 }),
  serviceType: varchar('service_type', { length: 100 }),
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }),
  actualCost: decimal('actual_cost', { precision: 10, scale: 2 }),
  
  // Shipping Information
  originAddress: jsonb('origin_address').$type<{
    company?: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  }>(),
  destinationAddress: jsonb('destination_address').$type<{
    company?: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  }>(),
  
  // Package Details
  packageDetails: jsonb('package_details').$type<{
    weight: { value: number; units: string; };
    dimensions: { length: number; width: number; height: number; units: string; };
    packageCount: number;
    description?: string;
  }>(),
  
  // Booking Status
  bookingStatus: varchar('booking_status', { length: 50 }).default('pending'), // pending, booked, shipped, delivered
  bookedAt: timestamp('booked_at'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  
  // AI Decision Data
  aiSuggestions: jsonb('ai_suggestions').$type<any>().default([]),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }),
  decisionSource: varchar('decision_source', { length: 50 }), // 'ai', 'manual', 'hybrid'
  
  // Telemetry
  sessionId: uuid('session_id'),
  telemetryData: jsonb('telemetry_data').$type<any>().default({}),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: varchar('updated_by', { length: 255 }),
  
  // Notes and Special Instructions
  specialInstructions: text('special_instructions'),
  internalNotes: text('internal_notes'),
}, (table) => ({
  workspaceIdIdx: index('idx_freight_workspace_id').on(table.workspaceId),
  orderIdIdx: index('idx_freight_order_id').on(table.orderId),
  bookingStatusIdx: index('idx_freight_booking_status').on(table.bookingStatus),
  carrierIdx: index('idx_freight_carrier').on(table.carrierName),
}));

// Freight Quotes - for storing multiple carrier quotes
export const freightQuotes = pgTable('freight_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  freightOrderId: uuid('freight_order_id').references(() => freightOrders.id),
  
  // Quote Details
  carrierName: varchar('carrier_name', { length: 255 }).notNull(),
  serviceType: varchar('service_type', { length: 100 }),
  quotedCost: decimal('quoted_cost', { precision: 10, scale: 2 }).notNull(),
  transitTime: integer('transit_time'), // in days
  
  // Quote Metadata
  quoteReference: varchar('quote_reference', { length: 255 }),
  validUntil: timestamp('valid_until'),
  
  // MyCarrier Response Data
  rawQuoteData: jsonb('raw_quote_data').$type<any>(),
  
  // Selection Status
  isSelected: boolean('is_selected').default(false),
  selectedAt: timestamp('selected_at'),
  selectedBy: varchar('selected_by', { length: 255 }),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  freightOrderIdIdx: index('idx_quote_freight_order_id').on(table.freightOrderId),
  carrierIdx: index('idx_quote_carrier').on(table.carrierName),
  selectedIdx: index('idx_quote_selected').on(table.isSelected),
}));

// Freight Events - for tracking order lifecycle events
export const freightEvents = pgTable('freight_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  freightOrderId: uuid('freight_order_id').references(() => freightOrders.id),
  
  // Event Details
  eventType: varchar('event_type', { length: 100 }).notNull(), // quote_requested, booked, shipped, delivered, etc.
  eventDescription: varchar('event_description', { length: 500 }),
  
  // Event Data
  eventData: jsonb('event_data').$type<any>().default({}),
  
  // Tracking
  performedBy: varchar('performed_by', { length: 255 }),
  performedAt: timestamp('performed_at').defaultNow(),
  
  // Location (for shipping events)
  location: varchar('location', { length: 255 }),
}, (table) => ({
  freightOrderIdIdx: index('idx_event_freight_order_id').on(table.freightOrderId),
  eventTypeIdx: index('idx_event_type').on(table.eventType),
  performedAtIdx: index('idx_event_performed_at').on(table.performedAt),
}));

// Relations
export const freightOrdersRelations = relations(freightOrders, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [freightOrders.workspaceId],
    references: [workspaces.id],
  }),
  quotes: many(freightQuotes),
  events: many(freightEvents),
}));

export const freightQuotesRelations = relations(freightQuotes, ({ one }) => ({
  freightOrder: one(freightOrders, {
    fields: [freightQuotes.freightOrderId],
    references: [freightOrders.id],
  }),
}));

export const freightEventsRelations = relations(freightEvents, ({ one }) => ({
  freightOrder: one(freightOrders, {
    fields: [freightEvents.freightOrderId],
    references: [freightOrders.id],
  }),
}));

// Chemical Products - master catalog of all chemical products
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

// Freight Classifications - NMFC codes and freight class mappings
export const freightClassifications = pgTable('freight_classifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  description: text('description').notNull(),
  nmfcCode: varchar('nmfc_code', { length: 20 }),
  freightClass: varchar('freight_class', { length: 10 }).notNull(), // 50, 55, 60, 65, 70, 77.5, 85, 92.5, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500
  
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
}));

// Product Freight Links - mapping products to freight classifications
export const productFreightLinks = pgTable('product_freight_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  classificationId: uuid('classification_id').references(() => freightClassifications.id).notNull(),
  
  // Override values for specific product-classification combinations
  overrideFreightClass: varchar('override_freight_class', { length: 10 }),
  overridePackaging: text('override_packaging'),
  
  // Confidence and source tracking
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }),
  linkSource: varchar('link_source', { length: 50 }).default('manual'), // 'manual', 'ai', 'import'
  
  // Approval workflow
  isApproved: boolean('is_approved').default(false),
  approvedBy: varchar('approved_by', { length: 255 }),
  approvedAt: timestamp('approved_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  productIdx: index('idx_product_freight_product').on(table.productId),
  classificationIdx: index('idx_product_freight_classification').on(table.classificationId),
  approvedIdx: index('idx_product_freight_approved').on(table.isApproved),
  sourceIdx: index('idx_product_freight_source').on(table.linkSource),
  // Unique constraint to prevent duplicate links
  uniqueProductClassification: index('idx_product_freight_unique').on(table.productId, table.classificationId),
}));

// Chemical Classification Relations
export const productsRelations = relations(products, ({ many }) => ({
  freightLinks: many(productFreightLinks),
}));

export const freightClassificationsRelations = relations(freightClassifications, ({ many }) => ({
  productLinks: many(productFreightLinks),
}));

export const productFreightLinksRelations = relations(productFreightLinks, ({ one }) => ({
  product: one(products, {
    fields: [productFreightLinks.productId],
    references: [products.id],
  }),
  classification: one(freightClassifications, {
    fields: [productFreightLinks.classificationId],
    references: [freightClassifications.id],
  }),
}));
/**
 * Product-Freight Links schema
 * Single responsibility: Product-classification mapping with approval workflow
 */

import { pgTable, uuid, varchar, text, decimal, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { products } from './chemicalProducts';
import { freightClassifications } from './freightClassifications';

export const productFreightLinks = pgTable('product_freight_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  classificationId: uuid('classification_id').references(() => freightClassifications.id).notNull(),
  
  // Override values for specific product-classification combinations
  overrideFreightClass: varchar('override_freight_class', { length: 10 }),
  overridePackaging: text('override_packaging'),
  
  // Confidence and source tracking
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }),
  linkSource: varchar('link_source', { length: 50 }).default('manual'),
  
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
  // Fixed: use uniqueIndex instead of regular index for constraint
  uniqueProductClassification: uniqueIndex('uq_product_classification').on(table.productId, table.classificationId),
}));
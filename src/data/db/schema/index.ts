/**
 * Freight schema index - consolidates all entities and relations
 * Single responsibility: Export unified schema and relations
 */

import { relations } from 'drizzle-orm';
import { workspaces } from '../../../../lib/db/schema/qr-workspace';

// Export all tables
export { freightOrders } from './freightOrders';
export { freightQuotes } from './freightQuotes';
export { freightEvents } from './freightEvents';
export { products } from './chemicalProducts';
export { freightClassifications } from './freightClassifications';
export { productFreightLinks } from './productFreightLinks';

// Import for relations
import { freightOrders } from './freightOrders';
import { freightQuotes } from './freightQuotes';
import { freightEvents } from './freightEvents';
import { products } from './chemicalProducts';
import { freightClassifications } from './freightClassifications';
import { productFreightLinks } from './productFreightLinks';

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
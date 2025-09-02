import type * as allianceChemicalSchema from "@/app/db/alliancechemical/drizzle/schema";

export type SelectProduct = typeof allianceChemicalSchema.products.$inferSelect;
export type InsertProduct = typeof allianceChemicalSchema.products.$inferInsert;

export type SelectProductFreightLink =
  typeof allianceChemicalSchema.product_freight_links.$inferSelect;
export type InsertProductFreightLink =
  typeof allianceChemicalSchema.product_freight_links.$inferInsert;

export type SelectFreightClassification =
  typeof allianceChemicalSchema.freight_classifications.$inferSelect;
export type InsertFreightClassification =
  typeof allianceChemicalSchema.freight_classifications.$inferInsert;

export type SelectProductFreightLinkage =
  typeof allianceChemicalSchema.product_freight_linkages.$inferSelect;
export type InsertProductFreightLinkage =
  typeof allianceChemicalSchema.product_freight_linkages.$inferInsert;

export type ProductWithClassificationStatus = {
  productId: number;
  sku: string;
  name: string;
  packagingType: string | null;
  unitContainerType: string | null;
  objectId: string | null;
  classificationId: number | null;
  linkId: number | null;
  classificationDescription: string | null;
  freightClass: string | null;
};

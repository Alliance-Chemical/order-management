export interface Product {
  productId: number; // The system-generated identifier for the product. Read Only field.
  sku: string; // Stock Keeping Unit (SKU). A user-defined value for a product to help identify the product. Each product should contain a unique SKU.
  name: string; // Name or description of the product.
  price: number; // The unit price of the product.
  defaultCost: number; // The seller's cost for this product.
  length: number; // The length of the product. Unit of Measurement (UOM) is User Interface (UI)-dependent.
  width: number; // The width of the product. Unit of Measurement (UOM) is User Interface (UI)-dependent.
  height: number; // The height of the product. Unit of Measurement (UOM) is User Interface (UI)-dependent.
  weightOz: number; // The weight of a single item in ounces.
  internalNotes: string; // Seller's private notes for the product.
  fulfillmentSku: string; // Stock Keeping Unit (SKU) for the fulfillment of that product by a 3rd party.
  createDate: string; // The timestamp for when the product record was created in ShipStation's database. Read Only field.
  modifyDate: string; // The timestamp for when the product record was modified in ShipStation. Read Only field.
  active: boolean; // Specifies whether or not the product is an active record.
  productCategory: object; // The Product Category used to organize and report on similar products.
  productType: object; // Specifies which Preset Group the product belongs to.
  warehouseLocation: string; // The warehouse location associated with the product record.
  defaultCarrierCode: string; // The default domestic shipping carrier for this product.
  defaultServiceCode: string; // The default domestic shipping service for this product.
  defaultPackageCode: string; // The default domestic packageType for this product.
  defaultIntlCarrierCode: string; // The default international shipping carrier for this product.
  defaultIntlServiceCode: string; // The default international shipping service for this product.
  defaultIntlPackageCode: string; // The default international packageType for this product.
  defaultConfirmation: string; // The default domestic Confirmation type for this Product.
  defaultIntlConfirmation: string; // The default international Confirmation type for this Product.
  customsDescription: string; // The default customs Description for the product.
  customsValue: number; // The default customs Declared Value for the product.
  customsTariffNo: string; // The default Harmonized Code for the Product.
  customsCountryCode: string; // The default two-letter ISO Origin Country code for the Product.
  noCustoms: boolean; // If true, this product will not be included on international customs forms.
  tags: object; // The ProductTag helps to organize and visually identify products.
}

export interface ProductFilter {
  sku: string; // Returns products that match the specified SKU.
  name?: string; // Optional: Returns products that match the specified product name.
  productCategoryId?: string; // Optional: Returns products that match the specified productCategoryId.
  productTypeId?: string; // Optional: Returns products that match the specified productTypeId.
  tagId?: string; // Optional: Returns products that match the specified tagId.
  startDate?: string; // Optional: Returns products that were created after the specified date.
  endDate?: string; // Optional: Returns products that were created before the specified date.
  sortBy?: "SKU" | "ModifyDate" | "CreateDate"; // Optional: Sorts the order of the response based on the specified value.
  sortDir?: "ASC" | "DESC"; // Optional: Sets the direction of the sort order.
  page?: string; // Optional: Page number.
  pageSize?: string; // Optional: Requested page size. Max value is 500.
  showInactive?: string; // Optional: Specifies whether the list should include inactive products.
}

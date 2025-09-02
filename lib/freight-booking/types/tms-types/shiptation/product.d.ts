type ProductCategory = {
  id: number;
  name: string;
};

type ProductType = {
  id: number;
  name: string;
};

type Tag = {
  id: number;
  name: string;
};

export interface Product {
  productId: number; // Read Only field
  sku: string;
  name: string;
  price: number;
  defaultCost: number;
  length: number;
  width: number;
  height: number;
  weightOz: number;
  internalNotes: string;
  fulfillmentSku: string;
  createDate: string; // Read Only field
  modifyDate: string; // Read Only field
  active: boolean;
  productCategory: ProductCategory;
  productType: ProductType;
  warehouseLocation: string;
  defaultCarrierCode: string;
  defaultServiceCode: string;
  defaultPackageCode: string;
  defaultIntlCarrierCode: string;
  defaultIntlServiceCode: string;
  defaultIntlPackageCode: string;
  defaultConfirmation: string;
  defaultIntlConfirmation: string;
  customsDescription: string;
  customsValue: number;
  customsTariffNo: string;
  customsCountryCode: string;
  noCustoms: boolean;
  tags: Tag[];
}

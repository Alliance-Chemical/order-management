export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  image: string | null;
  variants: ShopifyProductVariant[];
}

export interface ShopifyProductVariant {
  id: number;
  sku: string;
  price: string;
  image: string | null;
}

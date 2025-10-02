export interface SSOption extends Record<string, unknown> {
  name?: string;
  value?: string;
}

export interface SSWeight extends Record<string, unknown> {
  value?: number;
  units?: string;
}

export interface SSAddress extends Record<string, unknown> {
  name?: string;
  company?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  residential?: boolean;
}

export interface SSItem extends Record<string, unknown> {
  imageUrl?: string;
  name?: string;
  sku?: string;
  quantity?: number;
  unitPrice?: number;
  weight?: SSWeight;
  options?: SSOption[];
  orderItemId?: string;
  customFields?: Array<{ name?: string; value?: string }>;
}

export interface SSOrder extends Record<string, unknown> {
  orderId?: number;
  orderNumber?: string;
  orderStatus?: string;
  orderDate?: string;
  customerEmail?: string;
  customerNotes?: string;
  internalNotes?: string;
  billTo?: SSAddress;
  shipTo?: SSAddress;
  items?: SSItem[];
  tagIds?: number[];
  weight?: SSWeight;
  total?: number;
}

export interface ContainerType {
  id: string;
  containerMaterial: string;
  containerType: string | null;
  capacity: string | null;
  capacityUnit: string;
  length: string | null;
  width: string | null;
  height: string | null;
  emptyWeight: string | null;
  maxGrossWeight: string | null;
  freightClass: string | null;
  nmfcCode: string | null;
  unRating: string | null;
  hazmatApproved: boolean;
  isStackable: boolean;
  maxStackHeight: number | null;
  isReusable: boolean;
  requiresLiner: boolean;
  notes: string | null;
  isActive: boolean;
}

export interface Variant {
  id: string;
  title: string;
  sku: string;
  price?: string;
  option1?: string;
  containerType?: ContainerType | null;
}

export interface Product {
  id: string;
  title: string;
  variants: Variant[];
}

export interface EditingContainer {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  containerType?: ContainerType | null;
}

export interface VariantWithProduct extends Variant {
  productTitle: string;
  productId: string;
}

export interface ContainerEditForm {
  containerMaterial: string;
  containerType: string;
  capacity: string;
  capacityUnit: string;
  length: string;
  width: string;
  height: string;
  emptyWeight: string;
  maxGrossWeight: string;
  freightClass: string;
  nmfcCode: string;
  unRating: string;
  hazmatApproved: boolean;
  isStackable: boolean;
  maxStackHeight: number;
  isReusable: boolean;
  requiresLiner: boolean;
  notes: string;
}

export interface ContainerStats {
  totalVariants: number;
  configured: number;
  metalContainers: number;
  polyContainers: number;
}
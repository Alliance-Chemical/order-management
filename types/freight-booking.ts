// Freight Booking Type Definitions

export interface ShipStationOrder {
  orderId: number;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  billTo: {
    name: string;
    company: string;
    street1: string;
    city: string;
    state: string;
    postalCode: string;
  };
  shipTo: {
    name: string;
    company: string;
    street1: string;
    city: string;
    state: string;
    postalCode: string;
  };
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    weight: { value: number; units: string };
  }>;
  orderTotal: number;
  shippingAmount: number;
  orderDate: string;
  orderStatus: string;
}

export interface FreightClassification {
  nmfcCode: string;
  freightClass: string;
  isHazmat: boolean;
  hazmatClass?: string;
  unNumber?: string;
  packingGroup?: string;
  properShippingName?: string;
  nmfcSub?: string;
  description?: string;
}

export interface ClassifiedItem {
  sku: string;
  classification: FreightClassification | null;
}

export interface FreightBookingData {
  selectedOrder: ShipStationOrder | null;
  carrierName: string;
  serviceType: string;
  estimatedCost: number;
  specialInstructions: string;
  classifiedItems: ClassifiedItem[];
  hazmatAnalysis: any;
}

export type BookingStep = 'selection' | 'classification' | 'hazmat-analysis' | 'confirmation';

export interface HazmatOverride {
  isHazmat?: boolean;
  unNumber?: string;
  hazardClass?: string;
  packingGroup?: string;
  properShippingName?: string;
  persist?: boolean;
}

export interface NmfcOverride {
  nmfcCode?: string;
  nmfcSub?: string;
  freightClass?: string;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
}

export interface NmfcSuggestion {
  label: string;
  nmfcCode?: string;
  nmfcSub?: string;
  freightClass?: string;
  confidence?: number;
  source?: string;
  error?: boolean;
  loading?: boolean;
}

export interface ManualClassificationInput {
  freightClass: string;
  nmfcCode: string;
  nmfcSub: string;
  description: string;
  saving?: boolean;
  error?: string | null;
  successMessage?: string;
  hazmatData?: {
    unNumber: string | null;
    hazardClass: string | null;
    packingGroup: string | null;
    properShippingName: string | null;
    isHazmat: boolean;
  };
}

export interface ValidationErrors {
  unNumber?: string;
  hazardClass?: string;
  packingGroup?: string;
  properShippingName?: string;
}
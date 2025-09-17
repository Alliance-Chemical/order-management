// MyCarrier API response types based on the documentation

export interface MyCarrierOrderResponse {
  data: {
    createdAt: string;
    orderId: string;
    quoteId: string;
    referenceId: string;
    shipmentId: string;
    statusHistories: StatusHistory[];
    updatedAt: string;
  };
  errors: unknown;
  statusCode: number;
}

export interface StatusHistory {
  dateTime: string;
  logs: LogEntry[] | null;
  status: string;
}

export interface LogEntry {
  message: string;
  type: "error" | "warning" | "info";
}

export interface ShipmentUpdatePayload {
  ShipmentId: string;
  QuoteId: number;
  QuoteReferenceId: string;
  CustomerBOLNumber: string;
  PONumber: string;
  ReferenceNumber: string;
  PickupNumber: string;
  EstimatedDeliveryDate: string;
  CarrierCode: string;
  CarrierName: string;
  TotalCost: string;
  LaneType: string;
  CarrierPRONumber: string;
  CarrierPRONumberWithCheckDigit: string;
  IsPrimaryProNumber: string;
  PickupDate: string;
  FreightChargeAddressId: string;
  CarrierId: string;
  TransitTime: string;
  ActualPickupDate: string;
  UpdatedDeliveryDate: string;
  CarrierDeliveryDate: string;
  CheckDigit: string;
  LastTrackingDate: string;
  ActivityDateTime: string;
  StatusId: string;
  IsStatusException: string;
  ShipmentSystemId: string;
  TrackingStatusId: string;
  TrackingStatusDescription: string;
  TrackingHistoryQuantity: string;
  IsUnspecified: string;
  IsRemoved: string;
  IsCanceled: string;
  CustomerId: string;
  ServiceType: string;
  TrackingHistory: string;
  CapacityQuoteNumber: string;
  SecurityKey: string;
  BOLLink: string;
  LabelLink: string;
  BookedDate: string;
  IconLogo: string;
  TotalShipmentWeight: number;
  ShipmentPriceDetails: ShipmentPriceDetail[];
  ShipperInfo: AddressInfo;
  ConsegneeInfo: AddressInfo;
  CarrierInfo: CarrierInfo;
  IsLateDelivery: boolean;
  IsUnspecifiedTracking: boolean;
  DataHistories: Array<Record<string, unknown>>;
}

export interface ShipmentPriceDetail {
  ShipmentPriceDetailId: string;
  Description: string;
  Amount: string;
}

export interface AddressInfo {
  CompanyName: string;
  City: string;
  State: string;
  Zip: string;
  Country: string;
}

export interface CarrierInfo {
  CarrierContactInfo: {
    Phone: string;
  };
  CarrierName: string;
}

export interface WebhookPayload {
  Message: string;
  Payload: ShipmentUpdatePayload;
}

// Status mappings from MyCarrier documentation
export const SHIPMENT_STATUS_MAP = {
  "0": "booked",
  "1": "picked_up",
  "2": "in_transit",
  "3": "out_for_delivery",
  "4": "delivered",
} as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUS_MAP)[keyof typeof SHIPMENT_STATUS_MAP];

// For the dashboard table
export interface DashboardOrderRow {
  referenceId: string;
  destination: string;
  pickupDate: string;
  carrier: string | null;
  status:
    | "ordercreated"
    | "orderprocessing"
    | "booked"
    | "picked_up"
    | "in_transit"
    | "out_for_delivery"
    | "delivered";
  shipmentId?: string;
  totalCost?: string;
}

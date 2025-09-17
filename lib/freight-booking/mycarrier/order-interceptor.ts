import { MyCarrierAPIClient } from "./api-client";
import type {
  MyCarrierOrderPayload,
  MyCarrierOrderQuoteUnit,
  MyCarrierOrderResponse,
  MyCarrierOrderQuoteCommodity,
} from "./api-client";

interface ShipstationAddress {
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  name?: string | null;
  company?: string | null;
  phone?: string | null;
}

interface ShipstationItemWeight {
  value?: number | null;
}

interface ShipstationItem {
  sku?: string | null;
  name?: string | null;
  quantity?: number | string | null;
  weight?: ShipstationItemWeight | null;
  freightClass?: string | null;
  hazmat?: boolean;
  hazmatId?: string | null;
  hazmatName?: string | null;
  hazmatClass?: string | null;
  packingGroup?: string | null;
}

interface ShipstationOrder {
  orderId?: number | string | null;
  orderNumber?: string | null;
  customerEmail?: string | null;
  shipFrom?: ShipstationAddress | null;
  shipTo?: ShipstationAddress | null;
  billTo?: ShipstationAddress | null;
  items?: ShipstationItem[];
}

interface CarrierSelection {
  mode?: string | null;
  carrier?: string | null;
  service?: string | null;
}

interface NmfcOverride {
  nmfcCode?: string;
  nmfcSub?: string;
  freightClass?: string;
}

interface HazmatOverrideInput {
  isHazmat?: boolean | null;
  unNumber?: string | null;
  hazardClass?: string | null;
  packingGroup?: string | null;
  properShippingName?: string | null;
  persist?: boolean;
}

interface FreightUserOverrides {
  instructions?: string;
  autoDispatch?: boolean;
  residential?: boolean;
  insidePickup?: boolean;
  liftgatePickup?: boolean;
  protectFromFreeze?: boolean;
  notifyBeforeDelivery?: boolean;
  liftgateDelivery?: boolean;
  insideDelivery?: boolean;
  deliveryAppointment?: boolean;
  freightClass?: string;
  nmfcCode?: string;
  nmfcSub?: string;
  nmfcBySku?: Record<string, NmfcOverride>;
  hazmat?: HazmatOverrideInput;
  hazmatBySku?: Record<string, HazmatOverrideInput>;
}

type EnrichedShipstationItem = ShipstationItem & {
  nmfc?: string;
  freightClass?: string | null;
  hazmat?: boolean;
  hazmatId?: string | null;
  hazmatName?: string | null;
  hazmatClass?: string | null;
  packingGroup?: string | null;
};

type CapturedOrderPayload = MyCarrierOrderPayload & {
  sessionId: string;
  timestamp: string;
  result?: MyCarrierOrderResponse;
  proNumber?: string | null;
};

const splitName = (fullName?: string | null): [string | undefined, string | undefined] => {
  if (!fullName) return [undefined, undefined];
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return [undefined, undefined];
  const [first, ...rest] = parts;
  return [first || undefined, rest.length ? rest.join(' ') : undefined];
};

// Wrapper class that intercepts orders being sent to MyCarrier
// and captures them for AI learning before forwarding
export class MyCarrierOrderInterceptor extends MyCarrierAPIClient {
  private captureEndpoint: string;

  constructor(useProduction = true) {
    super(useProduction);
    this.captureEndpoint = "/api/freight-booking/capture-order";
  }

  async createOrderWithCapture(
    orderData: MyCarrierOrderPayload,
    sessionId?: string,
  ): Promise<MyCarrierOrderResponse> {
    try {
      const enrichedOrder: CapturedOrderPayload = {
        ...orderData,
        sessionId: sessionId ?? `session-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };

      // Capture order for AI learning (fire and forget)
      void this.captureOrder(enrichedOrder).catch((error) => {
        console.error("Failed to capture order for AI learning:", error);
        // Don't block order placement if capture fails
      });

      // Place the actual order with MyCarrier
      const result = await this.createOrder(orderData);

      // If successful, capture the result too
      if (result.isSuccess) {
        void this.captureOrderResult({
          ...enrichedOrder,
          result,
          proNumber: result.proNumber ?? enrichedOrder.proNumber ?? null,
        }).catch((error) => {
          console.error("Failed to capture order result:", error);
        });
      }

      return result;
    } catch (error) {
      console.error("Error creating order with capture:", error);
      throw error;
    }
  }

  private async captureOrder(orderData: CapturedOrderPayload): Promise<void> {
    try {
      await fetch(this.captureEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });
    } catch (error) {
      console.error("Error capturing order:", error);
    }
  }

  private async captureOrderResult(orderData: CapturedOrderPayload): Promise<void> {
    try {
      await fetch(this.captureEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...orderData,
          eventType: "order_confirmed",
        }),
      });
    } catch (error) {
      console.error("Error capturing order result:", error);
    }
  }

  // Helper to build order from UI selections
  static buildOrderFromFreightSelection(
    shipstationOrder: ShipstationOrder,
    carrierSelection: CarrierSelection,
    userOverrides: FreightUserOverrides = {},
  ): MyCarrierOrderPayload {
    const [originFirstName, originLastName] = splitName(
      shipstationOrder.shipFrom?.name,
    );
    const [destinationFirstName, destinationLastName] = splitName(
      shipstationOrder.shipTo?.name,
    );

    const quoteUnits: MyCarrierOrderQuoteUnit[] =
      shipstationOrder.items?.map((item): MyCarrierOrderQuoteUnit => {
        const quantity = item.quantity ?? 1;
        const commodityPieces =
          typeof quantity === "string" ? quantity : quantity.toString();

        const commodityWeightValue = item.weight?.value ?? 100;
        const commodityWeight = commodityWeightValue.toString();

        const commodity: MyCarrierOrderQuoteCommodity = {
          productID: item.sku ?? undefined,
          commodityDescription: item.name ?? undefined,
          commodityPieces,
          commodityWeight,
          commodityClass:
            userOverrides.freightClass ?? item.freightClass ?? "85",
          commodityHazMat: item.hazmat ? "YES" : "NO",
          hazmatIDNumber: item.hazmatId ?? undefined,
          hazmatProperShippingName: item.hazmatName ?? undefined,
          hazmatHazardClass: item.hazmatClass ?? undefined,
          hazmatPackingGroup: item.packingGroup ?? undefined,
          ...(userOverrides.nmfcCode || userOverrides.nmfcSub
            ? {
                nmfc: `${
                  userOverrides.nmfcCode ?? ""
                }${userOverrides.nmfcSub ? `-${userOverrides.nmfcSub}` : ""}`,
              }
            : {}),
        };

        return {
          shippingUnitType: "Pallet",
          shippingUnitCount: "1",
          unitStackable: "NO",
          quoteCommodities: [commodity],
        };
      }) ?? [];

    return {
      quoteReferenceID: shipstationOrder.orderNumber || `order-${Date.now()}`,
      serviceType: carrierSelection.mode || "LTL",
      pickupDate: new Date().toLocaleDateString("en-US"),
      paymentDirection: "Prepaid",
      carrier: carrierSelection.carrier,
      carrierService: carrierSelection.service || "Standard",
      specialInstructions: userOverrides.instructions || "",
      readyToDispatch: userOverrides.autoDispatch ? "YES" : "NO",

      originStop: {
        companyName: "Alliance Chemical",
        streetLine1:
          shipstationOrder.shipFrom?.street1 || "598 Virginia Street",
        city: shipstationOrder.shipFrom?.city || "River Grove",
        state: shipstationOrder.shipFrom?.state || "IL",
        zip: shipstationOrder.shipFrom?.postalCode || "60171",
        country: "USA",
        locationType: "Business",
        contactFirstName: originFirstName || "Warehouse",
        contactLastName: originLastName || "Manager",
        contactPhone: shipstationOrder.shipFrom?.phone || "(555) 555-1234",
      },

      destinationStop: {
        companyName:
          shipstationOrder.shipTo?.company || shipstationOrder.shipTo?.name,
        streetLine1: shipstationOrder.shipTo?.street1,
        streetLine2: shipstationOrder.shipTo?.street2,
        city: shipstationOrder.shipTo?.city,
        state: shipstationOrder.shipTo?.state,
        zip: shipstationOrder.shipTo?.postalCode,
        country: shipstationOrder.shipTo?.country === "CA" ? "CAN" : "USA",
        locationType: userOverrides.residential ? "Residential" : "Business",
        contactFirstName: destinationFirstName,
        contactLastName: destinationLastName,
        contactEmail: shipstationOrder.customerEmail,
        contactPhone: shipstationOrder.shipTo?.phone,
      },

      originAccessorials: {
        insidePickup: userOverrides.insidePickup ? "YES" : "NO",
        liftgatePickup: userOverrides.liftgatePickup ? "YES" : "NO",
        protectFromFreeze: userOverrides.protectFromFreeze ? "YES" : "NO",
      },

      destinationAccessorials: {
        notifyBeforeDelivery: userOverrides.notifyBeforeDelivery ? "YES" : "NO",
        liftgateDelivery: userOverrides.liftgateDelivery ? "YES" : "NO",
        insideDelivery: userOverrides.insideDelivery ? "YES" : "NO",
        deliveryAppointment: userOverrides.deliveryAppointment ? "YES" : "NO",
      },

      quoteUnits,
    };
  }

  // Async variant that auto-applies saved classification (freight class/NMFC) per SKU
  static async buildOrderFromFreightSelectionWithSavedClass(
    shipstationOrder: ShipstationOrder,
    carrierSelection: CarrierSelection,
    userOverrides: FreightUserOverrides = {},
  ): Promise<MyCarrierOrderPayload> {
    const { getApprovedClassificationBySku } = await import('../product-classification');
    const { getCfrHazmatBySku } = await import('../cfr-hazmat');
    const { getHazmatOverrideBySku } = await import('../hazmat-override');
    const nmfcBySku: Record<string, NmfcOverride> = userOverrides.nmfcBySku || {};

    const itemsWithClass = await Promise.all(
      (shipstationOrder.items || []).map(async (item): Promise<EnrichedShipstationItem> => {
        const saved = item?.sku ? await getApprovedClassificationBySku(item.sku) : null;
        const override = item?.sku ? await getHazmatOverrideBySku(item.sku) : null;
        const cfr = item?.sku ? await getCfrHazmatBySku(item.sku) : null;

        const lineOverride: HazmatOverrideInput = item?.sku
          ? userOverrides.hazmatBySku?.[item.sku] ?? {}
          : {};
        const lineNmfc: NmfcOverride = item?.sku ? nmfcBySku[item.sku] ?? {} : {};
        const globalOverride: HazmatOverrideInput = userOverrides.hazmat ?? {};
        const hazmatYes = (
          (typeof lineOverride.isHazmat === 'boolean' ? lineOverride.isHazmat : null) ??
          (typeof globalOverride.isHazmat === 'boolean' ? globalOverride.isHazmat : null) ??
          override?.isHazmat ??
          cfr?.isHazmat ??
          saved?.isHazmat ??
          item.hazmat
        ) || false;

        const unNumber =
          lineOverride.unNumber ??
          globalOverride.unNumber ??
          override?.unNumber ??
          cfr?.unNumber ??
          saved?.unNumber ??
          item.hazmatId;
        const hazardClass =
          lineOverride.hazardClass ??
          globalOverride.hazardClass ??
          override?.hazardClass ??
          cfr?.hazardClass ??
          saved?.hazmatClass ??
          item.hazmatClass;
        const packingGroup =
          lineOverride.packingGroup ??
          globalOverride.packingGroup ??
          override?.packingGroup ??
          cfr?.packingGroup ??
          saved?.packingGroup ??
          item.packingGroup;
        const properShippingName =
          lineOverride.properShippingName ??
          globalOverride.properShippingName ??
          override?.properShippingName ??
          cfr?.properShippingName ??
          item.hazmatName;

        // Build NMFC string with precedence: per-line override > saved > derived (flagged)
        let nmfc: string | undefined = undefined;
        if (lineNmfc?.nmfcCode) {
          nmfc = `${lineNmfc.nmfcCode}${lineNmfc.nmfcSub ? '-' + lineNmfc.nmfcSub : ''}`;
        } else {
          nmfc = saved?.nmfcCode || undefined;
        }

        // Optional helper: Derive NMFC sub from Packing Group only when explicitly enabled.
        // Disabled by default because NMFC sub meaning varies by item (e.g., density brackets in 43940).
        if (process.env.NMFC_DERIVE_SUB_FROM_PG === '1' || process.env.NMFC_DERIVE_SUB_FROM_PG === 'true') {
          if (nmfc && !nmfc.includes('-')) {
            const pgUpper = (packingGroup || '').toString().trim().toUpperCase();
            const sub = pgUpper === 'I' ? '1' : pgUpper === 'II' ? '2' : pgUpper === 'III' ? '3' : undefined;
            if (sub) nmfc = `${nmfc}-${sub}`;
          }
        }

        return {
          ...item,
          freightClass: lineNmfc?.freightClass || userOverrides.freightClass || saved?.freightClass || item.freightClass,
          nmfc,
          hazmat: hazmatYes,
          hazmatId: unNumber,
          hazmatName: properShippingName,
          hazmatClass: hazardClass,
          packingGroup: packingGroup,
        };
      })
    );

    const order = MyCarrierOrderInterceptor.buildOrderFromFreightSelection(
      { ...shipstationOrder, items: itemsWithClass },
      carrierSelection,
      userOverrides,
    );

    // Also propagate NMFC string if available
    order.quoteUnits = order.quoteUnits.map((unit, idx) => {
      const firstCommodity = unit.quoteCommodities[0];
      const sourceItem = itemsWithClass[idx];
      if (firstCommodity && sourceItem?.nmfc && !firstCommodity.nmfc) {
        firstCommodity.nmfc = sourceItem.nmfc;
      }
      return unit;
    });

    return order;
  }
}

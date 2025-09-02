import { MyCarrierAPIClient } from "./api-client";

// Wrapper class that intercepts orders being sent to MyCarrier
// and captures them for AI learning before forwarding
export class MyCarrierOrderInterceptor extends MyCarrierAPIClient {
  private captureEndpoint: string;

  constructor(useProduction = true) {
    super(useProduction);
    this.captureEndpoint = "/api/freight-booking/capture-order";
  }

  async createOrderWithCapture(
    orderData: any,
    sessionId?: string,
  ): Promise<any> {
    try {
      // Add session ID for tracking
      const enrichedOrder = {
        ...orderData,
        sessionId: sessionId || `session-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };

      // Capture order for AI learning (fire and forget)
      this.captureOrder(enrichedOrder).catch((error) => {
        console.error("Failed to capture order for AI learning:", error);
        // Don't block order placement if capture fails
      });

      // Place the actual order with MyCarrier
      const result = await this.createOrder(orderData);

      // If successful, capture the result too
      if (result.isSuccess) {
        this.captureOrderResult({
          ...enrichedOrder,
          result,
          proNumber: result.proNumber || orderData.proNumber,
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

  private async captureOrder(orderData: any): Promise<void> {
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

  private async captureOrderResult(orderData: any): Promise<void> {
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
    shipstationOrder: any,
    carrierSelection: any,
    userOverrides: any = {},
  ) {
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
        contactFirstName:
          shipstationOrder.shipFrom?.name?.split(" ")[0] || "Warehouse",
        contactLastName:
          shipstationOrder.shipFrom?.name?.split(" ")[1] || "Manager",
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
        contactFirstName: shipstationOrder.shipTo?.name?.split(" ")[0],
        contactLastName: shipstationOrder.shipTo?.name?.split(" ")[1],
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

      quoteUnits:
        shipstationOrder.items?.map((item: any) => ({
          shippingUnitType: "Pallet",
          shippingUnitCount: "1",
          unitStackable: "NO",
          quoteCommodities: [
            {
              productID: item.sku,
              commodityDescription: item.name,
              commodityPieces: item.quantity.toString(),
              commodityWeight: item.weight?.value?.toString() || "100",
              commodityClass: userOverrides.freightClass || item.freightClass || "85",
              commodityHazMat: item.hazmat ? "YES" : "NO",
              hazmatIDNumber: item.hazmatId,
              hazmatProperShippingName: item.hazmatName,
              hazmatHazardClass: item.hazmatClass,
              hazmatPackingGroup: item.packingGroup,
              // Optional: pass NMFC as freeform if provided (MyCarrier may accept or ignore unknown keys)
              ...(userOverrides.nmfcCode || userOverrides.nmfcSub
                ? { nmfc: `${userOverrides.nmfcCode || ""}${userOverrides.nmfcSub ? '-' + userOverrides.nmfcSub : ''}` }
                : {}),
            },
          ],
        })) || [],
    };
  }

  // Async variant that auto-applies saved classification (freight class/NMFC) per SKU
  static async buildOrderFromFreightSelectionWithSavedClass(
    shipstationOrder: any,
    carrierSelection: any,
    userOverrides: any = {},
  ) {
    const { getApprovedClassificationBySku } = await import('../product-classification');
    const { getCfrHazmatBySku } = await import('../cfr-hazmat');
    const { getHazmatOverrideBySku } = await import('../hazmat-override');
    const nmfcBySku: Record<string, any> = userOverrides?.nmfcBySku || {};

    const itemsWithClass = await Promise.all(
      (shipstationOrder.items || []).map(async (item: any) => {
        const saved = item?.sku ? await getApprovedClassificationBySku(item.sku) : null;
        const override = item?.sku ? await getHazmatOverrideBySku(item.sku) : null;
        const cfr = item?.sku ? await getCfrHazmatBySku(item.sku) : null;

        const lineOvr = (userOverrides?.hazmatBySku && item?.sku) ? (userOverrides.hazmatBySku[item.sku] || {}) : {};
        const lineNmfc = (item?.sku && nmfcBySku[item.sku]) ? nmfcBySku[item.sku] : {};
        const globalOvr = userOverrides?.hazmat || {};
        const hazmatYes = (
          (typeof lineOvr.isHazmat === 'boolean' ? lineOvr.isHazmat : null) ??
          (typeof globalOvr.isHazmat === 'boolean' ? globalOvr.isHazmat : null) ??
          override?.isHazmat ??
          cfr?.isHazmat ??
          saved?.isHazmat ??
          item.hazmat
        ) || false;

        const unNumber = (lineOvr.unNumber ?? globalOvr.unNumber) ?? override?.unNumber ?? cfr?.unNumber ?? saved?.unNumber ?? item.hazmatId;
        const hazardClass = (lineOvr.hazardClass ?? globalOvr.hazardClass) ?? override?.hazardClass ?? cfr?.hazardClass ?? saved?.hazmatClass ?? item.hazmatClass;
        const packingGroup = (lineOvr.packingGroup ?? globalOvr.packingGroup) ?? override?.packingGroup ?? cfr?.packingGroup ?? saved?.packingGroup ?? item.packingGroup;
        const properShippingName = (lineOvr.properShippingName ?? globalOvr.properShippingName) ?? override?.properShippingName ?? cfr?.properShippingName ?? item.hazmatName;

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
    order.quoteUnits = (order.quoteUnits || []).map((unit: any, idx: number) => {
      const first = unit.quoteCommodities?.[0];
      const src = itemsWithClass[idx];
      if (first && src?.nmfc && !first.nmfc) {
        first.nmfc = src.nmfc;
      }
      return unit;
    });

    return order;
  }
}

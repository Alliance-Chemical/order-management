import { MyCarrierAPIClient } from "./api-client";

// Wrapper class that intercepts orders being sent to MyCarrier
// and captures them for AI learning before forwarding
export class MyCarrierOrderInterceptor extends MyCarrierAPIClient {
  private captureEndpoint: string;

  constructor(useProduction = true) {
    super(useProduction);
    this.captureEndpoint = "/api/capture-order";
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
}

import { z } from "zod";
import { KVCache } from "@/lib/cache/kv-cache";

// MyCarrier API response schemas based on provided documentation
export const MyCarrierShipmentSchema = z.object({
  proNumber: z.string(),
  pickupNumber: z.string().optional(),
  scac: z.string(),
  mode: z.enum(["LTL", "TL", "PARCEL"]),
  status: z.string(),
  pickupDate: z.string(),
  deliveryDate: z.string().optional(),
  origin: z.object({
    name: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default("USA"),
  }),
  destination: z.object({
    name: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default("USA"),
  }),
  items: z.array(
    z.object({
      description: z.string(),
      pieces: z.number(),
      weight: z.number(),
      class: z.string().optional(),
      nmfc: z.string().optional(),
      hazmat: z.boolean().default(false),
      dimensions: z
        .object({
          length: z.number(),
          width: z.number(),
          height: z.number(),
        })
        .optional(),
    }),
  ),
  charges: z.object({
    lineHaul: z.number(),
    fuelSurcharge: z.number(),
    accessorials: z.array(
      z.object({
        code: z.string(),
        description: z.string(),
        amount: z.number(),
      }),
    ),
    total: z.number(),
  }),
  carrier: z.object({
    name: z.string(),
    scac: z.string(),
    serviceType: z.string(),
  }),
  references: z
    .array(
      z.object({
        type: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
});

export type MyCarrierShipment = z.infer<typeof MyCarrierShipmentSchema>;

export class MyCarrierAPIClient {
  private baseUrl: string;
  private apiKey: string;
  private username: string;
  private useProduction: boolean;

  constructor(useProduction = true) {
    this.useProduction = useProduction;
    if (useProduction) {
      this.baseUrl =
        process.env.MYCARRIER_BASE_PRODUCTION_URL ||
        "https://order-public-api.api.mycarriertms.com";
      this.apiKey = process.env.MYCARRIER_API_KEY_PRODUCTION || "";
      this.username = process.env.MYCARRIER_USERNAME_PRODUCTION || "";
    } else {
      this.baseUrl =
        process.env.MYCARRIER_BASE_SANDBOX_URL ||
        "https://order-public-api.sandbox.mycarriertms.com";
      this.apiKey = process.env.MYCARRIER_API_KEY_SANDBOX || "";
      this.username = process.env.MYCARRIER_USERNAME_SANDBOX || "";
    }
  }

  private getAuthHeaders() {
    // Edge-safe Basic Auth encoding
    const toBase64 = (s: string) =>
      typeof (globalThis as any).btoa === 'function'
        ? (globalThis as any).btoa(s)
        : Buffer.from(s, 'utf8').toString('base64');

    const basicAuth = toBase64(`${this.username}:${this.apiKey}`);
    return {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async testConnection(): Promise<boolean> {
    const cacheKey = `mycarrier:health:${this.useProduction ? 'prod' : 'sandbox'}`;
    
    // Cache health check results for 5 minutes
    const cached = await KVCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/Health`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      const isHealthy = response.ok;
      await KVCache.set(cacheKey, isHealthy, 300); // 5 minutes TTL
      return isHealthy;
    } catch (error) {
      console.error("Error testing MyCarrier connection:", error);
      await KVCache.set(cacheKey, false, 60); // Cache failures for 1 minute
      return false;
    }
  }

  // Note: MyCarrier API is for creating orders, not fetching historical shipments
  // We'll need to get historical data from a different source or database
  async createOrder(orderData: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/Orders`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          orders: [orderData],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Response:", errorText);
        throw new Error(
          `MyCarrier API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  }

  // For now, return mock historical data until we can get actual historical shipments
  async getShipmentHistory(
    startDate: Date,
    endDate: Date,
    limit = 1000,
  ): Promise<MyCarrierShipment[]> {
    console.log(
      `Note: MyCarrier API is for order placement, not historical data retrieval`,
    );
    console.log(
      `Would need to fetch historical shipments from ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`,
    );

    // Return empty array for now - we'll need to get historical data from another source
    return [];
  }

  async getShipmentDetails(proNumber: string): Promise<MyCarrierShipment> {
    const cacheKey = `mycarrier:shipment:${proNumber}`;
    
    // Cache shipment details for 24 hours
    const cached = await KVCache.get(cacheKey);
    if (cached) {
      return MyCarrierShipmentSchema.parse(cached);
    }

    try {
      const response = await fetch(`${this.baseUrl}/shipments/${proNumber}`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(
          `MyCarrier API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const shipment = MyCarrierShipmentSchema.parse(data);
      
      // Cache for 24 hours
      await KVCache.set(cacheKey, shipment, 86400);
      
      return shipment;
    } catch (error) {
      console.error(`Error fetching shipment ${proNumber}:`, error);
      throw error;
    }
  }

  // Paginated fetch for large date ranges
  async *getShipmentHistoryPaginated(
    startDate: Date,
    endDate: Date,
    pageSize = 100,
  ): AsyncGenerator<MyCarrierShipment[], void, unknown> {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        limit: pageSize.toString(),
        offset: offset.toString(),
        includeCharges: "true",
        includeItems: "true",
      });

      try {
        const response = await fetch(`${this.baseUrl}/shipments?${params}`, {
          method: "GET",
          headers: this.getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error(
            `MyCarrier API error: ${response.status} ${response.statusText}`,
          );
        }

        const data = await response.json();
        const shipments = z
          .array(MyCarrierShipmentSchema)
          .parse(data.shipments || []);

        if (shipments.length === 0) {
          hasMore = false;
        } else {
          yield shipments;
          offset += pageSize;

          // Check if there are more pages
          hasMore = data.hasMore || shipments.length === pageSize;
        }
      } catch (error) {
        console.error(`Error fetching page at offset ${offset}:`, error);
        throw error;
      }
    }
  }

  // Helper to format shipment for embedding
  formatShipmentForEmbedding(shipment: MyCarrierShipment): string {
    const items = shipment.items
      .map(
        (item) =>
          `${item.pieces}x ${item.description} (${item.weight}lbs${item.class ? `, Class ${item.class}` : ""}${item.hazmat ? ", HAZMAT" : ""})`,
      )
      .join("; ");

    const accessorials = shipment.charges.accessorials
      .map((a) => a.code)
      .join(", ");

    return `
      Mode: ${shipment.mode}
      Carrier: ${shipment.carrier.name} (${shipment.carrier.scac})
      Service: ${shipment.carrier.serviceType}
      Route: ${shipment.origin.city}, ${shipment.origin.state} to ${shipment.destination.city}, ${shipment.destination.state}
      Items: ${items}
      Total Weight: ${shipment.items.reduce((sum, item) => sum + item.weight, 0)} lbs
      Total Pieces: ${shipment.items.reduce((sum, item) => sum + item.pieces, 0)}
      Accessorials: ${accessorials || "None"}
      Total Cost: $${shipment.charges.total}
      Status: ${shipment.status}
    `
      .trim()
      .replace(/\s+/g, " ");
  }
}

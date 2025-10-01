import { withTimeout } from '@/lib/utils/timeout';

export interface ShipStationOrderItem extends Record<string, unknown> {
  lineItemKey?: string;
  sku?: string;
  quantity?: number;
}

export interface ShipStationOrder extends Record<string, unknown> {
  orderId: number;
  orderKey?: string;
  orderNumber?: string;
  items?: ShipStationOrderItem[];
  tagIds?: number[];
  internalNotes?: string;
}

interface ShipStationOrderSearchResponse {
  orders: ShipStationOrder[];
}

export class ShipStationClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string = 'https://ssapi.shipstation.com';
  private defaultTimeout: number = 5000; // 5 second timeout

  constructor() {
    // Trim any whitespace from environment variables
    this.apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
    this.apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private async makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`ShipStation API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get order by ID with timeout
   * Returns null if order not found, timeout, or error
   */
  async getOrder(orderId: number, timeoutMs?: number): Promise<ShipStationOrder | null> {
    try {
      const result = await withTimeout(
        async () => {
          // ShipStation's /orders/{orderId} endpoint returns the full order including items
          const order = await this.makeRequest<ShipStationOrder>(`/orders/${orderId}`);

          // If items are missing, try fetching via search endpoint which includes items
          if (!order.items || order.items.length === 0) {
            console.log(`Order ${orderId} missing items, fetching via search endpoint`);
            const searchResponse = await this.makeRequest<ShipStationOrderSearchResponse>(
              `/orders?orderId=${orderId}`
            );
            if (searchResponse.orders.length > 0) {
              return searchResponse.orders[0];
            }
          }

          return order;
        },
        {
          timeoutMs: timeoutMs ?? this.defaultTimeout,
          errorMessage: `ShipStation getOrder(${orderId}) timed out`,
        }
      );

      return result;
    } catch (error) {
      console.error(`ShipStation getOrder(${orderId}) failed:`, error);
      return null;
    }
  }

  /**
   * Get order by order number with timeout
   * Returns null if order not found, timeout, or error
   */
  async getOrderByNumber(orderNumber: string, timeoutMs?: number): Promise<ShipStationOrder | null> {
    try {
      const result = await withTimeout(
        async () => {
          const response = await this.makeRequest<ShipStationOrderSearchResponse>(
            `/orders?orderNumber=${encodeURIComponent(orderNumber)}`
          );
          return response.orders[0] ?? null;
        },
        {
          timeoutMs: timeoutMs ?? this.defaultTimeout,
          errorMessage: `ShipStation getOrderByNumber(${orderNumber}) timed out`,
        }
      );

      return result;
    } catch (error) {
      console.error(`ShipStation getOrderByNumber(${orderNumber}) failed:`, error);
      return null;
    }
  }

  async updateOrderTags(orderId: number, tags: number[]): Promise<ShipStationOrder> {
    return this.makeRequest<ShipStationOrder>(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ tagIds: tags }),
    });
  }

  async addOrderTag(orderId: number, tagId: number): Promise<ShipStationOrder> {
    const order = await this.getOrder(orderId);
    const currentTags = Array.isArray(order.tagIds) ? order.tagIds : [];
    if (!currentTags.includes(tagId)) {
      return this.updateOrderTags(orderId, [...currentTags, tagId]);
    }
    return order;
  }

  async removeOrderTag(orderId: number, tagId: number): Promise<ShipStationOrder> {
    const order = await this.getOrder(orderId);
    const currentTags = Array.isArray(order.tagIds) ? order.tagIds : [];
    const newTags = currentTags.filter((t) => t !== tagId);
    if (newTags.length !== currentTags.length) {
      return this.updateOrderTags(orderId, newTags);
    }
    return order;
  }

  /**
   * Append text to internalNotes for an order (with timestamp)
   */
  async appendInternalNotes(orderId: number, note: string): Promise<ShipStationOrder> {
    const order = await this.getOrder(orderId);
    const ts = new Date().toISOString();
    const existing = typeof order.internalNotes === 'string' ? order.internalNotes : '';
    const separator = existing ? '\n' : '';
    const newNotes = `${existing}${separator}[${ts}] ${note}`.slice(0, 4000); // ShipStation limits

    return this.makeRequest<ShipStationOrder>(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ internalNotes: newNotes }),
    });
  }
}

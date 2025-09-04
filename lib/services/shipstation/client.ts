export class ShipStationClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string = 'https://ssapi.shipstation.com';

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
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`ShipStation API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getOrder(orderId: number): Promise<any> {
    // ShipStation's /orders/{orderId} endpoint returns the full order including items
    const order = await this.makeRequest(`/orders/${orderId}`);
    
    // If items are missing, try fetching via search endpoint which includes items
    if (!order.items || order.items.length === 0) {
      console.log(`Order ${orderId} missing items, fetching via search endpoint`);
      const searchResponse = await this.makeRequest<{ orders: any[] }>(
        `/orders?orderId=${orderId}`
      );
      if (searchResponse.orders && searchResponse.orders.length > 0) {
        return searchResponse.orders[0];
      }
    }
    
    return order;
  }

  async getOrderByNumber(orderNumber: string): Promise<any> {
    const response = await this.makeRequest<{ orders: any[] }>(
      `/orders?orderNumber=${encodeURIComponent(orderNumber)}`
    );
    return response.orders[0] || null;
  }

  async updateOrderTags(orderId: number, tags: number[]): Promise<any> {
    return this.makeRequest(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ tagIds: tags }),
    });
  }

  async addOrderTag(orderId: number, tagId: number): Promise<any> {
    const order = await this.getOrder(orderId);
    const currentTags = order.tagIds || [];
    if (!currentTags.includes(tagId)) {
      return this.updateOrderTags(orderId, [...currentTags, tagId]);
    }
    return order;
  }

  async removeOrderTag(orderId: number, tagId: number): Promise<any> {
    const order = await this.getOrder(orderId);
    const currentTags = order.tagIds || [];
    const newTags = currentTags.filter((t: number) => t !== tagId);
    if (newTags.length !== currentTags.length) {
      return this.updateOrderTags(orderId, newTags);
    }
    return order;
  }

  /**
   * Append text to internalNotes for an order (with timestamp)
   */
  async appendInternalNotes(orderId: number, note: string): Promise<any> {
    const order = await this.getOrder(orderId);
    const ts = new Date().toISOString();
    const existing: string = order.internalNotes || '';
    const separator = existing ? '\n' : '';
    const newNotes = `${existing}${separator}[${ts}] ${note}`.slice(0, 4000); // ShipStation limits

    return this.makeRequest(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ internalNotes: newNotes }),
    });
  }
}

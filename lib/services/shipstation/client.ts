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
    return this.makeRequest(`/orders/${orderId}`);
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
}
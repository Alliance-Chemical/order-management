const axios = require('axios');

// Test webhook endpoint
const WEBHOOK_URL = 'http://localhost:3000/api/shipstation/webhook';

// Sample ShipStation webhook payload
const testPayload = {
  resource_url: "https://ssapi.shipstation.com/orders/456996810",
  resource_type: "ORDER_NOTIFY",
  order_id: 456996810,
  order_number: "TEST-001",
  order_status: "awaiting_shipment",
  order_date: new Date().toISOString(),
  ship_date: null,
  tracking_number: null,
  carrier: null,
  service_code: null,
  ship_to: {
    name: "John Doe",
    company: "Alliance Test Co",
    street1: "123 Test St",
    city: "Houston",
    state: "TX",
    postal_code: "77001",
    country: "US",
    phone: "555-0123"
  },
  items: [
    {
      order_item_id: "item_001",
      sku: "CHEM-001",
      name: "Test Chemical Product",
      quantity: 5,
      unit_price: 49.99,
      weight: {
        value: 10,
        units: "pounds"
      }
    },
    {
      order_item_id: "item_002", 
      sku: "CHEM-002",
      name: "Another Test Product",
      quantity: 3,
      unit_price: 75.00,
      weight: {
        value: 15,
        units: "pounds"
      }
    }
  ],
  customer_email: "test@example.com",
  customer_notes: "Please handle with care",
  internal_notes: "Priority customer",
  gift: false,
  gift_message: null,
  requested_shipping_service: "FedEx Ground",
  package_code: "package",
  confirmation: "delivery",
  insurance_options: {
    provider: "carrier",
    insure_shipment: true,
    insured_value: 324.95
  },
  international_options: {},
  advanced_options: {
    warehouse_id: 12345,
    non_machinable: false,
    saturday_delivery: false,
    contains_alcohol: false,
    custom_field1: "Custom Value 1",
    custom_field2: "Custom Value 2",
    custom_field3: null
  },
  weight: {
    value: 25,
    units: "pounds"
  },
  dimensions: {
    length: 12,
    width: 8,
    height: 6,
    units: "inches"
  }
};

async function testWebhook() {
  console.log('Testing ShipStation webhook...\n');
  console.log('Webhook URL:', WEBHOOK_URL);
  console.log('Order ID:', testPayload.order_id);
  console.log('Order Number:', testPayload.order_number);
  console.log('\nSending webhook payload...\n');
  
  try {
    const response = await axios.post(WEBHOOK_URL, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-shipstation-event': 'order_notify',
        'x-api-key': process.env.API_KEY || 'test-api-key'
      }
    });
    
    console.log('✅ Webhook Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    // Test fetching the created workspace
    if (response.data.workspace) {
      console.log('\n📋 Testing workspace fetch...');
      const workspaceResponse = await axios.get(
        `http://localhost:3000/api/workspace/${testPayload.order_id}`,
        {
          headers: {
            'x-api-key': process.env.API_KEY || 'test-api-key'
          }
        }
      );
      
      console.log('✅ Workspace Retrieved:');
      console.log('Order ID:', workspaceResponse.data.orderId);
      console.log('Status:', workspaceResponse.data.status);
      console.log('Items:', workspaceResponse.data.shipstationData.items?.length);
    }
    
  } catch (error) {
    console.error('❌ Webhook Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testWebhook();
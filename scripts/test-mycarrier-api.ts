#!/usr/bin/env npx tsx
import { config } from 'dotenv';

config({ path: '.env.local' });

async function testMyCarrierAPI() {
  console.log('🔧 Testing MyCarrier API Connection...\n');
  
  // Check environment variables
  const useProduction = false; // Start with sandbox
  const baseUrl = useProduction 
    ? (process.env.MYCARRIER_BASE_PRODUCTION_URL || "https://order-public-api.api.mycarriertms.com")
    : (process.env.MYCARRIER_BASE_SANDBOX_URL || "https://order-public-api.sandbox.mycarriertms.com");
  
  const username = useProduction
    ? process.env.MYCARRIER_USERNAME_PRODUCTION
    : process.env.MYCARRIER_USERNAME_SANDBOX;
    
  const apiKey = useProduction
    ? process.env.MYCARRIER_API_KEY_PRODUCTION
    : process.env.MYCARRIER_API_KEY_SANDBOX;
  
  console.log('Configuration:');
  console.log(`  Environment: ${useProduction ? 'PRODUCTION' : 'SANDBOX'}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Username: ${username ? '✅ Set' : '❌ Missing'}`);
  console.log(`  API Key: ${apiKey ? '✅ Set' : '❌ Missing'}`);
  
  if (!username || !apiKey) {
    console.error('\n❌ Missing credentials!');
    console.log('\nPlease set the following in your .env.local:');
    console.log('  MYCARRIER_USERNAME_SANDBOX=your_username');
    console.log('  MYCARRIER_API_KEY_SANDBOX=your_password');
    return;
  }
  
  // Test basic connection
  console.log('\n📡 Testing API connection...');
  
  try {
    const basicAuth = Buffer.from(`${username}:${apiKey}`).toString('base64');
    
    // Try health endpoint first
    const healthResponse = await fetch(`${baseUrl}/api/Health`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json',
      },
    });
    
    console.log(`Health check status: ${healthResponse.status} ${healthResponse.statusText}`);
    
    if (healthResponse.ok) {
      console.log('✅ Health check passed!');
    } else {
      console.log('⚠️  Health endpoint not available or requires different auth');
    }
    
    // Test creating a minimal order
    console.log('\n📦 Testing order creation endpoint...');
    
    const testOrder = {
      orders: [{
        orderNumber: `TEST-${Date.now()}`,
        customerName: 'Test Customer',
        shipFrom: {
          name: 'Alliance Chemical',
          address: '598 Virginia Street',
          city: 'River Grove',
          state: 'IL',
          postalCode: '60171',
          country: 'US',
        },
        shipTo: {
          name: 'Test Destination',
          address: '123 Main St',
          city: 'Charlotte',
          state: 'NC',
          postalCode: '28202',
          country: 'US',
        },
        items: [{
          sku: 'TEST-SKU',
          description: 'Test Product',
          quantity: 1,
          weight: 100,
          class: '85',
        }],
        serviceType: 'LTL',
        carrier: 'SAIA',
      }]
    };
    
    const orderResponse = await fetch(`${baseUrl}/api/Orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(testOrder),
    });
    
    console.log(`Order creation status: ${orderResponse.status} ${orderResponse.statusText}`);
    
    if (orderResponse.ok) {
      const result = await orderResponse.json();
      console.log('✅ Order creation endpoint works!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      const errorText = await orderResponse.text();
      console.log('❌ Order creation failed');
      console.log('Error response:', errorText);
      
      if (orderResponse.status === 401) {
        console.log('\n⚠️  Authentication failed. Check your credentials.');
      } else if (orderResponse.status === 400) {
        console.log('\n⚠️  Bad request. The order format may need adjustment.');
      }
    }
    
  } catch (error) {
    console.error('❌ Connection error:', error);
    console.log('\nPossible issues:');
    console.log('1. Network connectivity');
    console.log('2. Incorrect API URL');
    console.log('3. CORS issues (if running from browser)');
  }
  
  console.log('\n📋 Next steps:');
  console.log('1. Ensure credentials are correct in .env.local');
  console.log('2. Check with MyCarrier for API access and permissions');
  console.log('3. Review their API documentation for required fields');
  console.log('4. Once working, run: npx tsx scripts/book-pending-freight-orders.ts');
}

// Run the test
testMyCarrierAPI();
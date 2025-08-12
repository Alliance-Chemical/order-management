// Using built-in fetch (Node 18+)

const API_URL = 'http://localhost:3002';
const ORDER_ID = 457695665; // Test order

async function assignSource(requestId: number) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_URL}/api/workspace/${ORDER_ID}/assign-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineItemId: 'test-item-1',
        productName: 'Test Chemical',
        workflowType: 'pump_and_fill',
        sourceContainerId: 'TEST-CONTAINER-001',
        sourceContainerName: 'Test Chemical - 275 Gal Tote',
        mode: 'add'
      })
    });
    
    const result = await response.json();
    const duration = Date.now() - startTime;
    
    console.log(`[Request ${requestId}] Completed in ${duration}ms:`, result.success ? '✅ SUCCESS' : '❌ FAILED', result.message || result.error);
    
    return { requestId, success: result.success, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Request ${requestId}] Error in ${duration}ms:`, error);
    return { requestId, success: false, duration, error };
  }
}

async function testRaceCondition() {
  console.log('🏁 Starting race condition test...');
  console.log('Attempting to create the same source QR code 5 times concurrently...\n');
  
  // First, create a workspace if it doesn't exist
  await fetch(`${API_URL}/api/freight-orders/poll`);
  
  // Small delay to ensure workspace is ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Launch 5 concurrent requests to assign the same source
  const promises = Array.from({ length: 5 }, (_, i) => assignSource(i + 1));
  
  const results = await Promise.all(promises);
  
  console.log('\n📊 Results Summary:');
  console.log('-------------------');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Average time: ${Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length)}ms`);
  
  if (successful === 5) {
    console.log('\n✨ PERFECT! All requests succeeded, meaning the race condition was properly handled.');
    console.log('The database constraint prevented duplicates, and the error handling worked correctly.');
  } else if (successful > 0 && failed === 0) {
    console.log('\n⚠️  Some requests may have been deduplicated at the application level.');
  } else {
    console.log('\n❌ Some requests failed unexpectedly. Check the logs for details.');
  }
  
  // Now check how many QR codes were actually created
  console.log('\n🔍 Checking database for duplicate QRs...');
  const qrResponse = await fetch(`${API_URL}/api/workspace/${ORDER_ID}/qrcodes`);
  const qrData = await qrResponse.json();
  
  if (qrData.success) {
    const sourceQRs = qrData.qrCodes.filter((qr: any) => 
      qr.qrType === 'source' && 
      qr.encodedData?.sourceContainerId === 'TEST-CONTAINER-001'
    );
    
    console.log(`Found ${sourceQRs.length} source QR(s) for TEST-CONTAINER-001`);
    
    if (sourceQRs.length === 1) {
      console.log('✅ SUCCESS! Only one QR code was created despite concurrent requests.');
    } else if (sourceQRs.length > 1) {
      console.log('❌ FAILURE! Multiple QR codes were created - race condition not prevented!');
    }
  }
}

testRaceCondition().catch(console.error);
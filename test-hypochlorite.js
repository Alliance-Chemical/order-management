const { classifyWithRAG } = require('./lib/hazmat/classify.js');

async function test() {
  console.log('Testing Sodium Hypochlorite classification...\n');
  
  const testCases = [
    { sku: '1N-BMY1-7NF6', name: 'SODIUM HYPOCHLORITE 12.5% - 5 GALLON PAIL' },
    { sku: 'TEST-001', name: 'Sodium Hypochlorite 8%' },
    { sku: 'TEST-002', name: 'Sodium Hypochlorite 25%' },
    { sku: 'TEST-003', name: 'Bleach Solution 15%' },
  ];
  
  for (const test of testCases) {
    console.log(`\nTesting: ${test.name}`);
    console.log('=' . repeat(50));
    
    try {
      const result = await classifyWithRAG(test.sku, test.name);
      console.log('UN Number:', result.un_number || 'N/A');
      console.log('Proper Shipping Name:', result.proper_shipping_name || 'N/A');
      console.log('Hazard Class:', result.hazard_class || 'N/A');
      console.log('Packing Group:', result.packing_group || 'N/A');
      console.log('Confidence:', (result.confidence * 100).toFixed(1) + '%');
      console.log('Source:', result.source);
      console.log('Explanation:', result.explanation || 'N/A');
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

test().catch(console.error);
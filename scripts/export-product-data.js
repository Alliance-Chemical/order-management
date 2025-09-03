#!/usr/bin/env node

/**
 * Export existing product and classification data from database
 * Creates structured data for RAG indexing
 */

const fs = require('fs');
const path = require('path');

// Since we're running as a script, we'll create a simple mock export
// In production, this would connect to your actual database
async function exportProducts() {
  console.log('Creating sample product export...');
  
  // For now, create sample data that matches your schema
  // In production, this would query your actual database
  
  try {
    // Sample products data for testing
    console.log('\nCreating sample products...');
    const products = [
      {
        id: '1',
        sku: 'SA-98-T',
        name: 'Sulfuric Acid 98% Technical Grade',
        isHazardous: true,
        casNumber: '7664-93-9',
        unNumber: 'UN1830',
        weight: 600,
        length: 24,
        width: 20,
        height: 30,
        productFreightLinks: []
      },
      {
        id: '2',
        sku: 'HCL-37-ACS',
        name: 'Hydrochloric Acid 37% ACS Grade',
        isHazardous: true,
        casNumber: '7647-01-0',
        unNumber: 'UN1789',
        weight: 550,
        length: 24,
        width: 20,
        height: 30,
        productFreightLinks: []
      },
      {
        id: '3',
        sku: 'NA-50-LIQ',
        name: 'Sodium Hydroxide 50% Solution',
        isHazardous: true,
        casNumber: '1310-73-2',
        unNumber: 'UN1824',
        weight: 650,
        length: 24,
        width: 20,
        height: 30,
        productFreightLinks: []
      }
    ];
    
    console.log(`  Found ${products.length} products`);
    
    // Sample freight classifications
    console.log('\nCreating sample freight classifications...');
    const classifications = [
      {
        id: '1',
        description: 'Corrosive Liquids, N.O.S.',
        nmfcCode: '48580',
        freightClass: '60',
        isHazmat: true,
        hazmatClass: '8',
        packingGroup: 'II',
        properShippingName: 'CORROSIVE LIQUID, ACIDIC, INORGANIC, N.O.S.'
      },
      {
        id: '2', 
        description: 'Caustic Soda Solution',
        nmfcCode: '48590',
        freightClass: '60',
        isHazmat: true,
        hazmatClass: '8',
        packingGroup: 'II',
        properShippingName: 'SODIUM HYDROXIDE SOLUTION'
      }
    ];
    console.log(`  Created ${classifications.length} classifications`);
    
    // Sample freight orders for pattern analysis
    console.log('\nCreating sample freight orders...');
    const freightOrders = [];
    console.log(`  Created ${freightOrders.length} freight orders`);
    
    // Create structured entries for RAG
    const ragEntries = [];
    
    // Product entries
    for (const product of products) {
      const linkedClassifications = product.productFreightLinks
        ?.filter(link => link.isApproved)
        ?.map(link => link.classification) || [];
      
      const classificationText = linkedClassifications
        .map(c => `${c.description} (Class ${c.freightClass}, NMFC ${c.nmfcCode})`)
        .join('; ');
      
      ragEntries.push({
        id: `product-${product.id}`,
        type: 'product',
        text: [
          `Product: ${product.name}`,
          `SKU: ${product.sku}`,
          product.casNumber ? `CAS Number: ${product.casNumber}` : '',
          product.unNumber ? `UN Number: ${product.unNumber}` : '',
          product.isHazardous ? 'HAZARDOUS MATERIAL' : 'Non-hazardous',
          classificationText ? `Classifications: ${classificationText}` : '',
          product.weight ? `Weight: ${product.weight} lbs` : '',
          product.length && product.width && product.height ? 
            `Dimensions: ${product.length}x${product.width}x${product.height} inches` : ''
        ].filter(Boolean).join(' | '),
        metadata: {
          source: 'database',
          type: 'product',
          sku: product.sku,
          name: product.name,
          isHazardous: product.isHazardous,
          casNumber: product.casNumber,
          unNumber: product.unNumber,
          classifications: linkedClassifications.map(c => ({
            id: c.id,
            nmfcCode: c.nmfcCode,
            freightClass: c.freightClass,
            isHazmat: c.isHazmat
          }))
        }
      });
    }
    
    // Classification entries
    for (const classification of classifications) {
      ragEntries.push({
        id: `classification-${classification.id}`,
        type: 'freight_classification',
        text: [
          `Freight Classification: ${classification.description}`,
          `NMFC Code: ${classification.nmfcCode}`,
          `Freight Class: ${classification.freightClass}`,
          classification.isHazmat ? 'HAZMAT CLASSIFICATION' : '',
          classification.hazmatClass ? `Hazard Class: ${classification.hazmatClass}` : '',
          classification.packingGroup ? `Packing Group: ${classification.packingGroup}` : '',
          classification.properShippingName ? `Proper Shipping Name: ${classification.properShippingName}` : '',
          classification.notes ? `Notes: ${classification.notes}` : ''
        ].filter(Boolean).join(' | '),
        metadata: {
          source: 'database',
          type: 'freight_classification',
          id: classification.id,
          nmfcCode: classification.nmfcCode,
          freightClass: classification.freightClass,
          isHazmat: classification.isHazmat,
          hazmatClass: classification.hazmatClass,
          packingGroup: classification.packingGroup
        }
      });
    }
    
    // Freight order patterns (for learning)
    const orderPatterns = analyzeOrderPatterns(freightOrders);
    
    // Save outputs
    const outDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    
    // Full export
    const fullExport = {
      metadata: {
        source: 'Alliance Chemical Database',
        exportedAt: new Date().toISOString(),
        stats: {
          products: products.length,
          classifications: classifications.length,
          freightOrders: freightOrders.length,
          ragEntries: ragEntries.length
        }
      },
      products: products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        isHazardous: p.isHazardous,
        casNumber: p.casNumber,
        unNumber: p.unNumber,
        weight: p.weight,
        dimensions: p.length && p.width && p.height ? {
          length: p.length,
          width: p.width,
          height: p.height
        } : null,
        classifications: p.productFreightLinks
          ?.filter(l => l.isApproved)
          ?.map(l => l.classification) || []
      })),
      classifications,
      orderPatterns,
      ragEntries
    };
    
    const fullPath = path.join(outDir, 'database-export.json');
    fs.writeFileSync(fullPath, JSON.stringify(fullExport, null, 2), 'utf8');
    
    // Compact version for indexing
    const compactPath = path.join(outDir, 'database-rag-entries.json');
    fs.writeFileSync(compactPath, JSON.stringify({
      metadata: fullExport.metadata,
      entries: ragEntries
    }), 'utf8');
    
    // Product lookup table
    const productLookup = {};
    for (const product of products) {
      productLookup[product.sku] = {
        id: product.id,
        name: product.name,
        isHazardous: product.isHazardous,
        casNumber: product.casNumber,
        unNumber: product.unNumber
      };
    }
    
    const lookupPath = path.join(outDir, 'product-lookup.json');
    fs.writeFileSync(lookupPath, JSON.stringify(productLookup, null, 2), 'utf8');
    
    console.log('\n=== Database Export Complete ===');
    console.log(`Full export: ${fullPath}`);
    console.log(`RAG entries: ${compactPath}`);
    console.log(`Product lookup: ${lookupPath}`);
    console.log(`\nStatistics:`);
    console.log(`  Products: ${products.length}`);
    console.log(`  Classifications: ${classifications.length}`);
    console.log(`  RAG entries: ${ragEntries.length}`);
    console.log(`  Order patterns: ${Object.keys(orderPatterns).length}`);
    console.log(`\nFile sizes:`);
    console.log(`  Full export: ${(fs.statSync(fullPath).size / 1024).toFixed(2)} KB`);
    console.log(`  RAG entries: ${(fs.statSync(compactPath).size / 1024).toFixed(2)} KB`);
    console.log(`  Product lookup: ${(fs.statSync(lookupPath).size / 1024).toFixed(2)} KB`);
    
  } catch (error) {
    console.error('Error exporting data:', error);
    process.exit(1);
  }
}

// Analyze freight order patterns for insights
function analyzeOrderPatterns(orders) {
  const patterns = {
    carrierUsage: {},
    routePatterns: {},
    hazmatShipments: 0,
    averageTransitTime: 0,
    commonAccessorials: {}
  };
  
  let totalTransitTime = 0;
  let transitCount = 0;
  
  for (const order of orders) {
    // Carrier patterns
    if (order.carrier) {
      patterns.carrierUsage[order.carrier] = (patterns.carrierUsage[order.carrier] || 0) + 1;
    }
    
    // Route patterns
    if (order.originZip && order.destinationZip) {
      const route = `${order.originZip}->${order.destinationZip}`;
      patterns.routePatterns[route] = (patterns.routePatterns[route] || 0) + 1;
    }
    
    // Hazmat tracking
    if (order.isHazmat) {
      patterns.hazmatShipments++;
    }
    
    // Transit time
    if (order.estimatedTransitDays) {
      totalTransitTime += order.estimatedTransitDays;
      transitCount++;
    }
    
    // Accessorials
    if (order.accessorials) {
      try {
        const accessorials = typeof order.accessorials === 'string' 
          ? JSON.parse(order.accessorials) 
          : order.accessorials;
        
        for (const [key, value] of Object.entries(accessorials)) {
          if (value === true) {
            patterns.commonAccessorials[key] = (patterns.commonAccessorials[key] || 0) + 1;
          }
        }
      } catch (e) {
        // Skip invalid accessorials
      }
    }
  }
  
  // Calculate averages
  if (transitCount > 0) {
    patterns.averageTransitTime = totalTransitTime / transitCount;
  }
  
  // Sort patterns by frequency
  patterns.topCarriers = Object.entries(patterns.carrierUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([carrier, count]) => ({ carrier, count }));
  
  patterns.topRoutes = Object.entries(patterns.routePatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([route, count]) => ({ route, count }));
  
  patterns.topAccessorials = Object.entries(patterns.commonAccessorials)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([accessorial, count]) => ({ accessorial, count }));
  
  return patterns;
}

if (require.main === module) {
  exportProducts();
}

module.exports = { exportProducts };
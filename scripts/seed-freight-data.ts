#!/usr/bin/env npx tsx
/**
 * Seed script for freight classifications and products
 * Run with: npx tsx scripts/seed-freight-data.ts
 */

import { getDb } from '@/src/data/db/client';
import { freightClassifications, products, productFreightLinks } from '@/lib/db/schema/freight';
import { v4 as uuid } from 'uuid';

const db = getDb();

async function seedFreightData() {
  console.log('🚀 Starting freight data seed...');

  try {
    // Create sample freight classifications
    const classifications = [
      {
        id: uuid(),
        description: 'Chemical Compounds - Non-Hazardous',
        nmfcCode: '48580',
        freightClass: '55',
        isHazmat: false,
        hazmatClass: null,
        unNumber: null,
        packingGroup: null,
        properShippingName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid(),
        description: 'Petroleum Products - Class 3 Flammable',
        nmfcCode: '48520',
        freightClass: '60',
        isHazmat: true,
        hazmatClass: '3',
        unNumber: 'UN1268',
        packingGroup: 'II',
        properShippingName: 'Petroleum Distillates, N.O.S.',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid(),
        description: 'Sulfuric Acid - Class 8 Corrosive',
        nmfcCode: '48510',
        freightClass: '60',
        isHazmat: true,
        hazmatClass: '8',
        unNumber: 'UN1830',
        packingGroup: 'II',
        properShippingName: 'Sulfuric Acid',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid(),
        description: 'Laboratory Reagents - Mixed',
        nmfcCode: '48590',
        freightClass: '70',
        isHazmat: false,
        hazmatClass: null,
        unNumber: null,
        packingGroup: null,
        properShippingName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid(),
        description: 'Acetone - Class 3 Flammable',
        nmfcCode: '48515',
        freightClass: '55',
        isHazmat: true,
        hazmatClass: '3',
        unNumber: 'UN1090',
        packingGroup: 'II',
        properShippingName: 'Acetone',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    console.log('📦 Inserting freight classifications...');
    await db.insert(freightClassifications).values(classifications);

    // Create sample products
    const sampleProducts = [
      {
        id: uuid(),
        sku: 'CHEM001',
        name: 'Petroleum Ether, Technical Grade',
        description: 'High purity petroleum ether for laboratory use',
        isHazardous: true,
        casNumber: '8032-32-4',
        unNumber: 'UN1268',
        packagingType: 'Glass Bottle',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid(),
        sku: 'CHEM002',
        name: 'Sulfuric Acid Solution 98%',
        description: 'Concentrated sulfuric acid for industrial use',
        isHazardous: true,
        casNumber: '7664-93-9',
        unNumber: 'UN1830',
        packagingType: 'Plastic Container',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid(),
        sku: 'LAB003',
        name: 'Sodium Chloride ACS Grade',
        description: 'Pure sodium chloride for analytical chemistry',
        isHazardous: false,
        casNumber: '7647-14-5',
        unNumber: null,
        packagingType: 'Plastic Bottle',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid(),
        sku: 'SOLV004',
        name: 'Acetone HPLC Grade',
        description: 'High purity acetone for chromatography',
        isHazardous: true,
        casNumber: '67-64-1',
        unNumber: 'UN1090',
        packagingType: 'Glass Bottle',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid(),
        sku: 'PKG005',
        name: 'Standard Packaging Material',
        description: 'Non-hazardous packaging supplies',
        isHazardous: false,
        casNumber: null,
        unNumber: null,
        packagingType: 'Box',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    console.log('🧪 Inserting chemical products...');
    await db.insert(products).values(sampleProducts);

    // Create product-classification links
    const links = [
      {
        id: uuid(),
        productId: sampleProducts[0].id, // Petroleum Ether
        classificationId: classifications[1].id, // Petroleum Products Class 3
        isApproved: true,
        approvedBy: 'System Admin',
        approvedAt: new Date(),
        notes: 'Auto-approved: Matches UN number and hazard class',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid(),
        productId: sampleProducts[1].id, // Sulfuric Acid
        classificationId: classifications[2].id, // Sulfuric Acid Class 8
        isApproved: true,
        approvedBy: 'System Admin',
        approvedAt: new Date(),
        notes: 'Auto-approved: Exact match for sulfuric acid',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid(),
        productId: sampleProducts[2].id, // Sodium Chloride
        classificationId: classifications[0].id, // Non-Hazardous Chemicals
        isApproved: true,
        approvedBy: 'System Admin',
        approvedAt: new Date(),
        notes: 'Auto-approved: Non-hazardous laboratory reagent',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuid(),
        productId: sampleProducts[3].id, // Acetone
        classificationId: classifications[4].id, // Acetone Class 3
        isApproved: false,
        approvedBy: null,
        approvedAt: null,
        notes: 'Pending DOT compliance review',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    console.log('🔗 Creating product-classification links...');
    await db.insert(productFreightLinks).values(links);

    console.log('\n✅ Freight data seeded successfully!');
    console.log(`   - ${classifications.length} freight classifications`);
    console.log(`   - ${sampleProducts.length} chemical products`);
    console.log(`   - ${links.length} product-classification links`);
    console.log(`   - ${links.filter(l => l.isApproved).length} approved links`);
    console.log(`   - ${links.filter(l => !l.isApproved).length} pending approval`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding freight data:', error);
    process.exit(1);
  }
}

seedFreightData().catch(console.error);
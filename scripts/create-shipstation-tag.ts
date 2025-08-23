#!/usr/bin/env node

import { config } from 'dotenv';
import path from 'path';

// Load .env.local file
config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkShipStationTag(tagName: string) {
  const apiKey = process.env.SHIPSTATION_API_KEY?.trim();
  const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim();

  if (!apiKey || !apiSecret) {
    console.error('❌ Missing SHIPSTATION_API_KEY or SHIPSTATION_API_SECRET in .env.local');
    process.exit(1);
  }

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  
  try {
    console.log(`🔍 Checking for ShipStation tag: "${tagName}"...`);
    
    // Check if tag already exists
    const listResponse = await fetch('https://ssapi.shipstation.com/accounts/listtags', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to fetch existing tags: ${listResponse.status}`);
    }

    const existingTags = await listResponse.json();
    const existing = existingTags.find((t: any) => 
      t.name.toLowerCase() === tagName.toLowerCase()
    );

    if (existing) {
      console.log(`✅ Tag already exists: "${existing.name}" (ID: ${existing.tagId})`);
      return existing.tagId;
    }

    // Tag doesn't exist - provide instructions
    console.log(`\n⚠️  Tag "${tagName}" not found.`);
    console.log(`\n📝 Please create the tag manually in ShipStation:`);
    console.log(`   1. Log in to ShipStation`);
    console.log(`   2. Go to Settings > Store Setup > Order Tags`);
    console.log(`   3. Click "Add Tag"`);
    console.log(`   4. Enter tag name: "${tagName}"`);
    console.log(`   5. Choose a color (suggested: Orange #FFA500 for "staged")`);
    console.log(`   6. Click "Save"`);
    console.log(`\nThen run 'npx tsx scripts/fetch-shipstation-tags.ts' to get the new tag ID.`);
    return null;
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

async function main() {
  console.log('Checking for required workflow tags...\n');
  
  // Check for FreightStaged tag
  const stagedId = await checkShipStationTag('FreightStaged');
  
  console.log('\n═══════════════════════════════════════\n');
  
  if (stagedId) {
    console.log('📝 Add these to your .env.local:');
    console.log(`FREIGHT_STAGED_TAG_ID=${stagedId}`);
    console.log(`FREIGHT_READY_TAG_ID=44123  # Existing "Freight Order Ready" tag`);
    console.log(`READY_TO_SHIP_TAG=19845     # Default ready to ship tag`);
  } else {
    console.log('After creating the "FreightStaged" tag, add these to your .env.local:');
    console.log(`FREIGHT_STAGED_TAG_ID=<tag_id_from_shipstation>`);
    console.log(`FREIGHT_READY_TAG_ID=44123  # Existing "Freight Order Ready" tag`);
    console.log(`READY_TO_SHIP_TAG=19845     # Default ready to ship tag`);
  }
}

// Run the script
main();
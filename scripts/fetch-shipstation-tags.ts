#!/usr/bin/env node

import { config } from 'dotenv';
import path from 'path';

// Load .env.local file
config({ path: path.resolve(process.cwd(), '.env.local') });

async function fetchShipStationTags() {
  const apiKey = process.env.SHIPSTATION_API_KEY?.trim();
  const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim();

  if (!apiKey || !apiSecret) {
    console.error('❌ Missing SHIPSTATION_API_KEY or SHIPSTATION_API_SECRET in .env.local');
    process.exit(1);
  }

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  
  try {
    console.log('🔍 Fetching ShipStation tags...\n');
    
    const response = await fetch('https://ssapi.shipstation.com/accounts/listtags', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`ShipStation API error: ${response.status} ${response.statusText}`);
    }

    const tags = await response.json();
    
    console.log('📋 Available ShipStation Tags:\n');
    console.log('═══════════════════════════════════════');
    
    // Sort tags by name for easier reading
    const sortedTags = tags.sort((a: any, b: any) => 
      a.name.localeCompare(b.name)
    );
    
    sortedTags.forEach((tag: any) => {
      console.log(`  ID: ${tag.tagId.toString().padEnd(10)} Name: ${tag.name}`);
      if (tag.color) {
        console.log(`  ${' '.repeat(14)}Color: ${tag.color}`);
      }
    });
    
    console.log('\n═══════════════════════════════════════');
    
    // Look for specific tags we need
    console.log('\n🎯 Looking for workflow tags:\n');
    
    const freightTags = tags.filter((tag: any) => 
      tag.name.toLowerCase().includes('freight') ||
      tag.name.toLowerCase().includes('booked') ||
      tag.name.toLowerCase().includes('ready')
    );
    
    if (freightTags.length > 0) {
      console.log('Found relevant tags:');
      freightTags.forEach((tag: any) => {
        console.log(`  - ${tag.name} (ID: ${tag.tagId})`);
      });
      
      console.log('\n📝 Suggested environment variables:');
      
      const bookedTag = tags.find((t: any) => 
        t.name.toLowerCase().includes('booked') || 
        t.name.toLowerCase() === 'freightbooked'
      );
      
      const readyTag = tags.find((t: any) => 
        t.name.toLowerCase().includes('ready') || 
        t.name.toLowerCase() === 'freightorderready' ||
        t.name.toLowerCase() === 'freight order ready'
      );
      
      if (bookedTag) {
        console.log(`  FREIGHT_BOOKED_TAG_ID=${bookedTag.tagId}`);
      } else {
        console.log('  FREIGHT_BOOKED_TAG_ID=<not found - confirm the "Freight Booked" tag exists>');
      }
      
      if (readyTag) {
        console.log(`  FREIGHT_READY_TAG_ID=${readyTag.tagId}`);
      } else {
        console.log('  FREIGHT_READY_TAG_ID=<not found - may need to create "FreightOrderReady" tag>');
      }
    } else {
      console.log('No freight-related tags found. You may need to create them in ShipStation.');
      console.log('\nSuggested tags to create:');
      console.log('  - "Freight Booked" - for orders with locked planning');
      console.log('  - "FreightOrderReady" - for orders that passed pre-ship inspection');
    }
    
    // Also show the ready to ship tag if it exists
    const readyToShipTag = tags.find((t: any) => 
      t.name.toLowerCase() === 'ready to ship' ||
      t.name.toLowerCase() === 'readytoship'
    );
    
    if (readyToShipTag) {
      console.log(`\n  READY_TO_SHIP_TAG=${readyToShipTag.tagId} (existing)`);
    }
    
  } catch (error) {
    console.error('❌ Error fetching tags:', error);
    process.exit(1);
  }
}

// Run the script
fetchShipStationTags();

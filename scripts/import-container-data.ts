import { db } from '@/lib/db';
import { containerTypes } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

interface ExcelRow {
  chemical: string;
  Drum: 'Metal' | 'Poly';
  Pail: 'Metal' | 'Poly';
}

interface ShopifyVariant {
  id: string;
  title: string;
  sku: string;
  option1?: string;
}

interface ShopifyProduct {
  id: string;
  title: string;
  variants: ShopifyVariant[];
}

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || 'your-store.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';

async function fetchShopifyProducts(): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = [];
  let hasNextPage = true;
  let pageInfo = '';
  
  while (hasNextPage) {
    const url = pageInfo 
      ? `https://${SHOPIFY_STORE_URL}/admin/api/2024-01/products.json?page_info=${pageInfo}`
      : `https://${SHOPIFY_STORE_URL}/admin/api/2024-01/products.json?limit=250`;
    
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    allProducts.push(...data.products);
    
    // Check for pagination
    const linkHeader = response.headers.get('Link');
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const matches = linkHeader.match(/page_info=([^>]+)>; rel="next"/);
      pageInfo = matches ? matches[1] : '';
      hasNextPage = true;
    } else {
      hasNextPage = false;
    }
  }
  
  return allProducts;
}

function matchProductToExcelData(productTitle: string, variantTitle: string, excelData: ExcelRow[]): ExcelRow | null {
  // Try exact match first
  let match = excelData.find(row => 
    row.chemical.toLowerCase() === productTitle.toLowerCase() ||
    row.chemical.toLowerCase() === variantTitle.toLowerCase()
  );
  
  if (match) return match;
  
  // Try partial match
  match = excelData.find(row => 
    productTitle.toLowerCase().includes(row.chemical.toLowerCase()) ||
    row.chemical.toLowerCase().includes(productTitle.toLowerCase())
  );
  
  if (match) return match;
  
  // Try variant title match
  match = excelData.find(row => 
    variantTitle.toLowerCase().includes(row.chemical.toLowerCase()) ||
    row.chemical.toLowerCase().includes(variantTitle.toLowerCase())
  );
  
  return match ?? null;
}

function determineContainerTypeFromVariant(variantTitle: string, option1?: string): 'drum' | 'pail' | 'unknown' {
  const text = `${variantTitle} ${option1 || ''}`.toLowerCase();
  
  if (text.includes('drum')) return 'drum';
  if (text.includes('pail')) return 'pail';
  if (text.includes('gallon')) {
    // Determine by size
    const sizeMatch = text.match(/(\d+)\s*gallon/);
    if (sizeMatch) {
      const size = parseInt(sizeMatch[1]);
      return size >= 30 ? 'drum' : 'pail'; // 30+ gallons typically drums
    }
  }
  
  return 'unknown';
}

export async function importContainerData() {
  console.log('Starting container data import...');
  
  try {
    // Read Excel file
    const filePath = '/home/andre/my-app/Chemical Container Type.xlsx';
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const excelData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Loaded ${excelData.length} records from Excel file`);
    
    // Fetch Shopify products
    const shopifyProducts = await fetchShopifyProducts();
    console.log(`Fetched ${shopifyProducts.length} products from Shopify`);
    
    let processedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Process each Shopify variant
    for (const product of shopifyProducts) {
      for (const variant of product.variants) {
        processedCount++;
        
        // Find matching Excel data
        const excelMatch = matchProductToExcelData(product.title, variant.title, excelData);
        
        if (!excelMatch) {
          skippedCount++;
          console.log(`No match found for: ${product.title} - ${variant.title}`);
          continue;
        }
        
        // Determine container type
        const containerTypeStr = determineContainerTypeFromVariant(variant.title, variant.option1);
        if (containerTypeStr === 'unknown') {
          skippedCount++;
          console.log(`Unknown container type for: ${product.title} - ${variant.title}`);
          continue;
        }
        
        // Get material from Excel data
        const material = containerTypeStr === 'drum' 
          ? excelMatch.Drum.toLowerCase() as 'metal' | 'poly'
          : excelMatch.Pail.toLowerCase() as 'metal' | 'poly';
        
        // Check if container type already exists
        const existing = await db.select()
          .from(containerTypes)
          .where(eq(containerTypes.shopifyVariantId, variant.id));
        
        if (existing.length > 0) {
          // Update existing
          await db.update(containerTypes)
            .set({
              containerMaterial: material,
              containerType: containerTypeStr,
              updatedAt: new Date(),
              updatedBy: 'excel-import',
            })
            .where(eq(containerTypes.id, existing[0].id));
          
          updatedCount++;
          console.log(`Updated: ${product.title} - ${variant.title} (${material} ${containerTypeStr})`);
        } else {
          // Create new
          await db.insert(containerTypes).values({
            shopifyProductId: product.id,
            shopifyVariantId: variant.id,
            shopifyTitle: product.title,
            shopifyVariantTitle: variant.title,
            shopifySku: variant.sku,
            containerMaterial: material,
            containerType: containerTypeStr,
            isActive: true,
            createdBy: 'excel-import',
            updatedBy: 'excel-import',
          });
          
          createdCount++;
          console.log(`Created: ${product.title} - ${variant.title} (${material} ${containerTypeStr})`);
        }
      }
    }
    
    console.log('\n=== Import Summary ===');
    console.log(`Total variants processed: ${processedCount}`);
    console.log(`Created: ${createdCount}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (no match): ${skippedCount}`);
    console.log('Import completed successfully!');
    
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  }
}

// Run the import if this script is called directly
if (require.main === module) {
  importContainerData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}

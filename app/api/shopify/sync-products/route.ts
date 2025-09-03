import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { qrCodes } from '@/lib/db/schema/qr-workspace';
import { QRGenerator } from '@/src/services/qr/qrGenerator';
import { eq } from 'drizzle-orm';

const qrGenerator = new QRGenerator();

// Shopify API configuration
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || 'your-store.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';

interface ShopifyProduct {
  id: string;
  title: string;
  variants: ShopifyVariant[];
  product_type?: string;
  vendor?: string;
  tags?: string;
}

interface ShopifyVariant {
  id: string;
  product_id: string;
  title: string;
  sku: string;
  barcode?: string;
  inventory_quantity?: number;
  weight?: number;
  weight_unit?: string;
  option1?: string;
  option2?: string;
  option3?: string;
}

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

function generateSourceContainerShortCode(variantId: string): string {
  // Generate a unique short code for source containers
  const prefix = 'SC'; // Source Container
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[SHOPIFY SYNC] Starting product sync...');
    
    // Fetch all products from Shopify
    const products = await fetchShopifyProducts();
    console.log(`[SHOPIFY SYNC] Fetched ${products.length} products from Shopify`);
    
    let totalVariants = 0;
    let newQRCodes = 0;
    
    // Process each product and its variants
    for (const product of products) {
      for (const variant of product.variants) {
        totalVariants++;
        
        // Generate a unique short code for this variant
        const shortCode = generateSourceContainerShortCode(variant.id.toString());
        
        // Check if QR code already exists for this variant
        const existingQR = await db.query.qrCodes.findFirst({
          where: eq(qrCodes.qrCode, `QR-SC-${variant.id}`),
        });
        
        if (!existingQR) {
          const qrData = {
            type: 'source_container' as const,
            shopifyVariantId: variant.id.toString(),
            shopifyProductId: product.id.toString(),
            productTitle: product.title,
            variantTitle: variant.title,
            sku: variant.sku,
            timestamp: new Date().toISOString(),
          };
          
          // Create QR code record only
          await db.insert(qrCodes).values({
            qrType: 'source_container',
            qrCode: `QR-SC-${variant.id}`,
            shortCode: shortCode,
            orderId: 0, // Source containers don't have order IDs
            encodedData: qrData,
            qrUrl: `${process.env.NEXT_PUBLIC_APP_URL}/source-container/${shortCode}`,
            isActive: true,
          });
          
          newQRCodes++;
          console.log(`[SHOPIFY SYNC] Created QR code for variant: ${variant.sku} - ${shortCode}`);
        }
      }
    }
    
    console.log(`[SHOPIFY SYNC] Sync complete. Total variants: ${totalVariants}, New QR Codes: ${newQRCodes}`);
    
    return NextResponse.json({
      success: true,
      summary: {
        totalProducts: products.length,
        totalVariants,
        newQRCodes,
        message: 'Products fetched and QR codes generated (source containers table not implemented yet)'
      },
    });
  } catch (error) {
    console.error('[SHOPIFY SYNC] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Shopify products' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve products from Shopify
export async function GET(request: NextRequest) {
  try {
    console.log('[SHOPIFY SYNC] Fetching products from Shopify API...');
    
    // Fetch products directly from Shopify
    const products = await fetchShopifyProducts();
    
    // Transform products to a simpler format for the UI
    const simplifiedProducts = products.map(product => ({
      id: product.id,
      title: product.title,
      handle: product.product_type || product.title.toLowerCase().replace(/\s+/g, '-'),
      variants: product.variants.map(v => ({
        id: v.id,
        title: v.title,
        sku: v.sku,
        size: v.option1 || ''
      }))
    }));
    
    console.log(`[SHOPIFY SYNC] Successfully fetched ${simplifiedProducts.length} products`);
    
    return NextResponse.json({
      success: true,
      products: simplifiedProducts,
    });
  } catch (error) {
    console.error('[SHOPIFY SYNC] Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products from Shopify' },
      { status: 500 }
    );
  }
}

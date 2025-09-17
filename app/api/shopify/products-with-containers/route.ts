import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { containerTypes } from '@/lib/db/schema/qr-workspace';

export const runtime = 'edge';

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
  price?: string;
}

interface ProductWithContainer {
  id: string;
  title: string;
  variants: VariantWithContainer[];
}

interface VariantWithContainer {
  id: string;
  title: string;
  sku: string;
  price?: string;
  option1?: string;
  containerType?: {
    id: string;
    containerMaterial: string;
    containerType: string | null;
    capacity: string | null;
    capacityUnit: string;
    length: string | null;
    width: string | null;
    height: string | null;
    emptyWeight: string | null;
    maxGrossWeight: string | null;
    freightClass: string | null;
    nmfcCode: string | null;
    unRating: string | null;
    hazmatApproved: boolean;
    isStackable: boolean;
    maxStackHeight: number | null;
    isReusable: boolean;
    requiresLiner: boolean;
    notes: string | null;
    isActive: boolean;
  } | null;
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

export async function GET(_request: NextRequest) {
  try {
    console.log('[SHOPIFY CONTAINERS] Fetching products with container data...');
    
    // Fetch products from Shopify
    const products = await fetchShopifyProducts();
    console.log(`[SHOPIFY CONTAINERS] Fetched ${products.length} products from Shopify`);
    
    // Get all container types from database
    const existingContainerTypes = await db.select().from(containerTypes);
    console.log(`[SHOPIFY CONTAINERS] Found ${existingContainerTypes.length} existing container types`);
    
    // Create lookup map for container types
    const containerTypesMap = new Map(
      existingContainerTypes.map(ct => [ct.shopifyVariantId, ct])
    );
    
    // Transform products to include container data
    const productsWithContainers: ProductWithContainer[] = products.map(product => ({
      id: product.id,
      title: product.title,
      variants: product.variants.map(variant => {
        const containerType = containerTypesMap.get(variant.id);
        return {
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          price: variant.price,
          option1: variant.option1,
          containerType: containerType ? {
            id: containerType.id,
            containerMaterial: containerType.containerMaterial,
            containerType: containerType.containerType,
            capacity: containerType.capacity,
            capacityUnit: containerType.capacityUnit || 'gallons',
            length: containerType.length,
            width: containerType.width,
            height: containerType.height,
            emptyWeight: containerType.emptyWeight,
            maxGrossWeight: containerType.maxGrossWeight,
            freightClass: containerType.freightClass,
            nmfcCode: containerType.nmfcCode,
            unRating: containerType.unRating,
            hazmatApproved: containerType.hazmatApproved || false,
            isStackable: containerType.isStackable || true,
            maxStackHeight: containerType.maxStackHeight,
            isReusable: containerType.isReusable || true,
            requiresLiner: containerType.requiresLiner || false,
            notes: containerType.notes,
            isActive: containerType.isActive || true,
          } : null
        };
      })
    }));
    
    console.log(`[SHOPIFY CONTAINERS] Processed ${productsWithContainers.length} products with container data`);
    
    return NextResponse.json({
      success: true,
      products: productsWithContainers,
      totalProducts: productsWithContainers.length,
      totalVariants: productsWithContainers.reduce((sum, p) => sum + p.variants.length, 0),
      variantsWithContainers: productsWithContainers.reduce((sum, p) => 
        sum + p.variants.filter(v => v.containerType).length, 0
      ),
    });
  } catch (error) {
    console.error('[SHOPIFY CONTAINERS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products with container data' },
      { status: 500 }
    );
  }
}

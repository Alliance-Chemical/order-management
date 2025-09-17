import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chemicals } from '@/lib/db/schema/qr-workspace';
import { eq, ilike, or, and } from 'drizzle-orm';

type ShopifyProduct = {
  id: number;
  title: string;
  variants: Array<{ sku?: string | null }>;
};

type ChemicalUpdate = Partial<typeof chemicals.$inferInsert>;

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const includeShopify = searchParams.get('includeShopify') === 'true';
    const searchTerm = searchParams.get('search');
    const grade = searchParams.get('grade');
    const gradeCategory = searchParams.get('gradeCategory');
    const activeOnly = searchParams.get('activeOnly') !== 'false'; // Default to true
    
    // Build query conditions
    const conditions = [];
    
    if (activeOnly) {
      conditions.push(eq(chemicals.isActive, true));
    }
    
    if (searchTerm) {
      conditions.push(
        or(
          ilike(chemicals.name, `%${searchTerm}%`),
          ilike(chemicals.shopifyTitle, `%${searchTerm}%`)
        )
      );
    }
    
    if (grade) {
      conditions.push(eq(chemicals.grade, grade));
    }
    
    if (gradeCategory) {
      conditions.push(eq(chemicals.gradeCategory, gradeCategory));
    }
    
    // Fetch chemicals from database
    const dbChemicals = await db
      .select()
      .from(chemicals)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(chemicals.name);
    
    // Format response
    const formattedChemicals = dbChemicals.map(chem => ({
      id: chem.id,
      name: chem.name,
      alternateNames: chem.alternateNames || [],
      specificGravity: parseFloat(chem.specificGravity),
      initialConcentration: parseFloat(chem.initialConcentration),
      method: chem.method as 'vv' | 'wv' | 'ww',
      grade: chem.grade,
      gradeCategory: chem.gradeCategory,
      hazardClass: chem.hazardClass,
      ppeSuggestion: chem.ppeSuggestion,
      shopifyProductId: chem.shopifyProductId,
      shopifyTitle: chem.shopifyTitle,
      shopifySKU: chem.shopifySKU,
      isActive: chem.isActive,
      notes: chem.notes
    }));
    
    // Optionally fetch and link Shopify products
    if (includeShopify) {
      const shopifyApiKey = process.env.SHOPIFY_API_KEY;
      const shopifyApiSecret = process.env.SHOPIFY_API_SECRET;
      const shopifyDomain = process.env.SHOPIFY_DOMAIN || 'alliance-chemical.myshopify.com';
      
      if (shopifyApiKey && shopifyApiSecret) {
        try {
          const shopifyResponse = await fetch(
            `https://${shopifyDomain}/admin/api/2024-01/products.json?limit=250`,
            {
              headers: {
                'Authorization': `Basic ${Buffer.from(`${shopifyApiKey}:${shopifyApiSecret}`).toString('base64')}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (shopifyResponse.ok) {
            const shopifyData = await shopifyResponse.json() as { products?: ShopifyProduct[] };
            const shopifyProducts = shopifyData.products ?? [];
            
            // Match chemicals with Shopify products
            for (const chemical of formattedChemicals) {
              if (!chemical.shopifyProductId) {
                // Try to find matching Shopify product
                const matchingProduct = shopifyProducts.find((product) => {
                  const title = product.title.toLowerCase();
                  const chemName = chemical.name.toLowerCase();
                  
                  // Direct match
                  if (title === chemName) return true;
                  
                  // Check if title contains the chemical name (without percentage)
                  const baseChemName = chemName.split('%')[0].trim();
                  if (title.includes(baseChemName)) {
                    // Also check if percentages match
                    const chemPercent = chemical.name.match(/(\d+\.?\d*)%/);
                    const titlePercent = title.match(/(\d+\.?\d*)%/);
                    if (chemPercent && titlePercent) {
                      return chemPercent[1] === titlePercent[1];
                    }
                    return true;
                  }
                  
                  return false;
                });
                
                if (matchingProduct) {
                  chemical.shopifyProductId = matchingProduct.id.toString();
                  chemical.shopifyTitle = matchingProduct.title;
                  chemical.shopifySKU = matchingProduct.variants[0]?.sku || '';
                  
                  // Optionally update the database with the Shopify info
                  await db
                    .update(chemicals)
                    .set({
                      shopifyProductId: chemical.shopifyProductId,
                      shopifyTitle: chemical.shopifyTitle,
                      shopifySKU: chemical.shopifySKU
                    })
                    .where(eq(chemicals.id, chemical.id));
                }
              }
            }
          }
        } catch (shopifyError) {
          console.error('Error fetching Shopify products:', shopifyError);
          // Continue without Shopify data
        }
      }
    }
    
    return NextResponse.json({ 
      chemicals: formattedChemicals,
      total: formattedChemicals.length 
    });
  } catch (error) {
    console.error('Error fetching chemicals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chemicals' },
      { status: 500 }
    );
  }
}

// POST endpoint to add a new chemical
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.specificGravity || !body.initialConcentration || !body.method) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Insert new chemical
    const [newChemical] = await db
      .insert(chemicals)
      .values({
        name: body.name,
        alternateNames: body.alternateNames || [],
        specificGravity: body.specificGravity.toString(),
        initialConcentration: body.initialConcentration.toString(),
        method: body.method,
        grade: body.grade,
        gradeCategory: body.gradeCategory,
        hazardClass: body.hazardClass,
        ppeSuggestion: body.ppeSuggestion,
        shopifyProductId: body.shopifyProductId,
        shopifyTitle: body.shopifyTitle,
        shopifySKU: body.shopifySKU,
        isActive: body.isActive !== false,
        notes: body.notes
      })
      .returning();
    
    return NextResponse.json({ 
      success: true,
      chemical: newChemical 
    });
  } catch (error) {
    console.error('Error creating chemical:', error);
    return NextResponse.json(
      { error: 'Failed to create chemical' },
      { status: 500 }
    );
  }
}

// PATCH endpoint to update a chemical
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Chemical ID is required' },
        { status: 400 }
      );
    }
    
    // Build update object
    const updateData: ChemicalUpdate = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.alternateNames !== undefined) updateData.alternateNames = body.alternateNames;
    if (body.specificGravity !== undefined) updateData.specificGravity = body.specificGravity.toString();
    if (body.initialConcentration !== undefined) updateData.initialConcentration = body.initialConcentration.toString();
    if (body.method !== undefined) updateData.method = body.method;
    if (body.grade !== undefined) updateData.grade = body.grade;
    if (body.gradeCategory !== undefined) updateData.gradeCategory = body.gradeCategory;
    if (body.hazardClass !== undefined) updateData.hazardClass = body.hazardClass;
    if (body.ppeSuggestion !== undefined) updateData.ppeSuggestion = body.ppeSuggestion;
    if (body.shopifyProductId !== undefined) updateData.shopifyProductId = body.shopifyProductId;
    if (body.shopifyTitle !== undefined) updateData.shopifyTitle = body.shopifyTitle;
    if (body.shopifySKU !== undefined) updateData.shopifySKU = body.shopifySKU;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.notes !== undefined) updateData.notes = body.notes;
    
    updateData.updatedAt = new Date();
    
    // Update chemical
    const [updatedChemical] = await db
      .update(chemicals)
      .set(updateData)
      .where(eq(chemicals.id, body.id))
      .returning();
    
    if (!updatedChemical) {
      return NextResponse.json(
        { error: 'Chemical not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      chemical: updatedChemical 
    });
  } catch (error) {
    console.error('Error updating chemical:', error);
    return NextResponse.json(
      { error: 'Failed to update chemical' },
      { status: 500 }
    );
  }
}

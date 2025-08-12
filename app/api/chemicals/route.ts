import { NextRequest, NextResponse } from 'next/server';

export interface ChemicalData {
  id: string;
  name: string;
  specificGravity: number;
  initialConcentration: number;
  method: 'vv' | 'wv' | 'ww';
  hazardClass?: string;
  ppeSuggestion?: string;
  shopifyProductId?: string;
  shopifyTitle?: string;
  shopifySKU?: string;
}

// Comprehensive chemical database with all Alliance Chemical products
const chemicalDatabase: ChemicalData[] = [
  // Acids
  {
    id: 'acetic-100',
    name: 'Acetic Acid 100%',
    specificGravity: 1.049,
    initialConcentration: 100.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron'
  },
  {
    id: 'citric-50',
    name: 'Citric Acid 50%',
    specificGravity: 1.24,
    initialConcentration: 50.0,
    method: 'ww',
    hazardClass: 'Irritant',
    ppeSuggestion: 'Chemical resistant gloves, safety glasses'
  },
  {
    id: 'formic-85',
    name: 'Formic Acid 85%',
    specificGravity: 1.20,
    initialConcentration: 85.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron'
  },
  {
    id: 'hydrochloric-31',
    name: 'Hydrochloric Acid 31%',
    specificGravity: 1.15,
    initialConcentration: 31.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator'
  },
  {
    id: 'hydrochloric-35',
    name: 'Hydrochloric Acid 35%',
    specificGravity: 1.18,
    initialConcentration: 35.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator'
  },
  {
    id: 'hydrofluosilicic-23',
    name: 'Hydrofluosilicic Acid 23%',
    specificGravity: 1.19,
    initialConcentration: 23.0,
    method: 'ww',
    hazardClass: 'Corrosive, Toxic',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant suit, respirator'
  },
  {
    id: 'lactic-88',
    name: 'Lactic Acid 88%',
    specificGravity: 1.21,
    initialConcentration: 88.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield'
  },
  {
    id: 'nitric-42',
    name: 'Nitric Acid 42%',
    specificGravity: 1.26,
    initialConcentration: 42.0,
    method: 'ww',
    hazardClass: 'Corrosive, Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator'
  },
  {
    id: 'nitric-65',
    name: 'Nitric Acid 65%',
    specificGravity: 1.40,
    initialConcentration: 65.0,
    method: 'ww',
    hazardClass: 'Corrosive, Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator'
  },
  {
    id: 'peracetic-15',
    name: 'Peracetic Acid 15%',
    specificGravity: 1.11,
    initialConcentration: 15.0,
    method: 'ww',
    hazardClass: 'Corrosive, Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, respirator'
  },
  {
    id: 'phosphoric-75',
    name: 'Phosphoric Acid 75%',
    specificGravity: 1.58,
    initialConcentration: 75.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron'
  },
  {
    id: 'phosphoric-85',
    name: 'Phosphoric Acid 85%',
    specificGravity: 1.685,
    initialConcentration: 85.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron'
  },
  {
    id: 'sulfuric-50',
    name: 'Sulfuric Acid 50%',
    specificGravity: 1.40,
    initialConcentration: 50.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron'
  },
  {
    id: 'sulfuric-66',
    name: 'Sulfuric Acid 66%',
    specificGravity: 1.58,
    initialConcentration: 66.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron'
  },
  {
    id: 'sulfuric-93',
    name: 'Sulfuric Acid 93%',
    specificGravity: 1.84,
    initialConcentration: 93.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant suit, respirator'
  },
  {
    id: 'sulfuric-98',
    name: 'Sulfuric Acid 98%',
    specificGravity: 1.84,
    initialConcentration: 98.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant suit, respirator'
  },

  // Bases/Alkalis
  {
    id: 'ammonium-hydroxide-29',
    name: 'Ammonium Hydroxide 29%',
    specificGravity: 0.897,
    initialConcentration: 29.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, respirator'
  },
  {
    id: 'potassium-hydroxide-45',
    name: 'Potassium Hydroxide 45%',
    specificGravity: 1.45,
    initialConcentration: 45.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, caustic resistant apron'
  },
  {
    id: 'sodium-hydroxide-25',
    name: 'Sodium Hydroxide 25%',
    specificGravity: 1.28,
    initialConcentration: 25.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, caustic resistant apron'
  },
  {
    id: 'sodium-hydroxide-50',
    name: 'Sodium Hydroxide 50%',
    specificGravity: 1.54,
    initialConcentration: 50.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, caustic resistant apron'
  },

  // Chlorine/Bleach Products
  {
    id: 'calcium-hypochlorite-65',
    name: 'Calcium Hypochlorite 65%',
    specificGravity: 2.35,
    initialConcentration: 65.0,
    method: 'ww',
    hazardClass: 'Oxidizer, Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, respirator'
  },
  {
    id: 'sodium-hypochlorite-12.5',
    name: 'Sodium Hypochlorite 12.5%',
    specificGravity: 1.21,
    initialConcentration: 12.5,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical safety glasses, face shield, gloves, complete body suit'
  },

  // Peroxides
  {
    id: 'hydrogen-peroxide-3',
    name: 'Hydrogen Peroxide 3%',
    specificGravity: 1.01,
    initialConcentration: 3.0,
    method: 'ww',
    hazardClass: 'Oxidizer',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'hydrogen-peroxide-35',
    name: 'Hydrogen Peroxide 35%',
    specificGravity: 1.13,
    initialConcentration: 35.0,
    method: 'ww',
    hazardClass: 'Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield'
  },
  {
    id: 'hydrogen-peroxide-50',
    name: 'Hydrogen Peroxide 50%',
    specificGravity: 1.20,
    initialConcentration: 50.0,
    method: 'ww',
    hazardClass: 'Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, chemical resistant suit'
  },

  // Salts and Coagulants
  {
    id: 'aluminum-chloride-28',
    name: 'Aluminum Chloride 28%',
    specificGravity: 1.28,
    initialConcentration: 28.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles'
  },
  {
    id: 'aluminum-sulfate-48',
    name: 'Aluminum Sulfate 48%',
    specificGravity: 1.335,
    initialConcentration: 48.0,
    method: 'ww',
    hazardClass: 'Corrosive, Irritant',
    ppeSuggestion: 'Closed goggles, chemical resistant gloves, work clothing'
  },
  {
    id: 'calcium-chloride-35',
    name: 'Calcium Chloride 35%',
    specificGravity: 1.35,
    initialConcentration: 35.0,
    method: 'ww',
    hazardClass: 'Irritant',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'ferric-chloride-40',
    name: 'Ferric Chloride 40%',
    specificGravity: 1.37,
    initialConcentration: 40.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical splash goggles, rubber gloves, rubber boots, rubber apron'
  },
  {
    id: 'ferric-sulfate-50',
    name: 'Ferric Sulfate 50%',
    specificGravity: 1.50,
    initialConcentration: 50.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, protective clothing'
  },
  {
    id: 'ferrous-sulfate-20',
    name: 'Ferrous Sulfate 20%',
    specificGravity: 1.20,
    initialConcentration: 20.0,
    method: 'ww',
    hazardClass: 'Irritant',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'magnesium-chloride-30',
    name: 'Magnesium Chloride 30%',
    specificGravity: 1.26,
    initialConcentration: 30.0,
    method: 'ww',
    hazardClass: 'Irritant',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'magnesium-sulfate-20',
    name: 'Magnesium Sulfate 20%',
    specificGravity: 1.20,
    initialConcentration: 20.0,
    method: 'ww',
    hazardClass: 'Generally Safe',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'poly-aluminum-chloride-10',
    name: 'Poly Aluminum Chloride 10%',
    specificGravity: 1.20,
    initialConcentration: 10.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles'
  },
  {
    id: 'potassium-chloride-20',
    name: 'Potassium Chloride 20%',
    specificGravity: 1.13,
    initialConcentration: 20.0,
    method: 'ww',
    hazardClass: 'Generally Safe',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'sodium-bicarbonate-8',
    name: 'Sodium Bicarbonate 8%',
    specificGravity: 1.06,
    initialConcentration: 8.0,
    method: 'ww',
    hazardClass: 'Generally Safe',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'sodium-bisulfate-30',
    name: 'Sodium Bisulfate 30%',
    specificGravity: 1.26,
    initialConcentration: 30.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles'
  },
  {
    id: 'sodium-bisulfite-38',
    name: 'Sodium Bisulfite 38%',
    specificGravity: 1.36,
    initialConcentration: 38.0,
    method: 'ww',
    hazardClass: 'Irritant',
    ppeSuggestion: 'Safety glasses, gloves, adequate ventilation'
  },
  {
    id: 'sodium-carbonate-15',
    name: 'Sodium Carbonate 15%',
    specificGravity: 1.16,
    initialConcentration: 15.0,
    method: 'ww',
    hazardClass: 'Irritant',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'sodium-chloride-26',
    name: 'Sodium Chloride 26%',
    specificGravity: 1.20,
    initialConcentration: 26.0,
    method: 'ww',
    hazardClass: 'Generally Safe',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'sodium-metabisulfite-25',
    name: 'Sodium Metabisulfite 25%',
    specificGravity: 1.23,
    initialConcentration: 25.0,
    method: 'ww',
    hazardClass: 'Irritant',
    ppeSuggestion: 'Safety glasses, gloves, adequate ventilation'
  },
  {
    id: 'sodium-silicate-40',
    name: 'Sodium Silicate 40%',
    specificGravity: 1.38,
    initialConcentration: 40.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles'
  },
  {
    id: 'sodium-sulfate-20',
    name: 'Sodium Sulfate 20%',
    specificGravity: 1.15,
    initialConcentration: 20.0,
    method: 'ww',
    hazardClass: 'Generally Safe',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'zinc-chloride-50',
    name: 'Zinc Chloride 50%',
    specificGravity: 1.50,
    initialConcentration: 50.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield'
  },
  {
    id: 'zinc-sulfate-20',
    name: 'Zinc Sulfate 20%',
    specificGravity: 1.20,
    initialConcentration: 20.0,
    method: 'ww',
    hazardClass: 'Irritant',
    ppeSuggestion: 'Safety glasses, gloves'
  },

  // Solvents and Alcohols
  {
    id: 'ethanol-70',
    name: 'Ethanol 70%',
    specificGravity: 0.87,
    initialConcentration: 70.0,
    method: 'vv',
    hazardClass: 'Flammable',
    ppeSuggestion: 'Safety glasses, gloves, adequate ventilation'
  },
  {
    id: 'ethanol-95',
    name: 'Ethanol 95%',
    specificGravity: 0.81,
    initialConcentration: 95.0,
    method: 'vv',
    hazardClass: 'Flammable',
    ppeSuggestion: 'Safety glasses, gloves, adequate ventilation'
  },
  {
    id: 'denatured-ethanol-200',
    name: 'Denatured Ethanol 200 Proof',
    specificGravity: 0.789,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Flammable, Toxic',
    ppeSuggestion: 'Chemical resistant gloves, goggles, respirator'
  },
  {
    id: 'isopropyl-alcohol-70',
    name: 'Isopropyl Alcohol 70%',
    specificGravity: 0.87,
    initialConcentration: 70.0,
    method: 'vv',
    hazardClass: 'Flammable',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'isopropyl-alcohol-99',
    name: 'Isopropyl Alcohol 99.9%',
    specificGravity: 0.785,
    initialConcentration: 99.9,
    method: 'vv',
    hazardClass: 'Flammable',
    ppeSuggestion: 'Chemical resistant gloves, safety glasses'
  },
  {
    id: 'methanol-100',
    name: 'Methanol 100%',
    specificGravity: 0.791,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Flammable, Toxic',
    ppeSuggestion: 'Chemical resistant gloves, goggles, respirator'
  },

  // Glycols and Glycerin
  {
    id: 'ethylene-glycol-100',
    name: 'Ethylene Glycol 100%',
    specificGravity: 1.113,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Toxic',
    ppeSuggestion: 'Chemical resistant gloves, safety glasses'
  },
  {
    id: 'glycerin-99.7',
    name: 'Glycerin 99.7%',
    specificGravity: 1.26,
    initialConcentration: 99.7,
    method: 'vv',
    hazardClass: 'Generally Safe',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'propylene-glycol-100',
    name: 'Propylene Glycol 100%',
    specificGravity: 1.038,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Mild Irritant',
    ppeSuggestion: 'Chemical safety glasses, nitrile gloves'
  },

  // Amines and Organic Chemicals
  {
    id: 'diethanolamine-99',
    name: 'Diethanolamine 99%',
    specificGravity: 1.09,
    initialConcentration: 99.0,
    method: 'ww',
    hazardClass: 'Corrosive, Toxic',
    ppeSuggestion: 'Chemical resistant gloves, goggles, respirator'
  },
  {
    id: 'monoethanolamine-100',
    name: 'Monoethanolamine 100%',
    specificGravity: 1.012,
    initialConcentration: 100.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield'
  },
  {
    id: 'triethanolamine-99',
    name: 'Triethanolamine 99%',
    specificGravity: 1.12,
    initialConcentration: 99.0,
    method: 'ww',
    hazardClass: 'Irritant',
    ppeSuggestion: 'Chemical resistant gloves, goggles'
  },
  {
    id: 'urea-46',
    name: 'Urea 46%',
    specificGravity: 1.32,
    initialConcentration: 46.0,
    method: 'ww',
    hazardClass: 'Generally Safe',
    ppeSuggestion: 'Safety glasses, gloves'
  },

  // Specialty Chemicals
  {
    id: 'antifoam-100',
    name: 'Antifoam 100%',
    specificGravity: 0.98,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Generally Safe',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'biocide-20',
    name: 'Biocide 20%',
    specificGravity: 1.05,
    initialConcentration: 20.0,
    method: 'ww',
    hazardClass: 'Toxic',
    ppeSuggestion: 'Chemical resistant gloves, goggles, respirator'
  },
  {
    id: 'formaldehyde-37',
    name: 'Formaldehyde 37%',
    specificGravity: 1.08,
    initialConcentration: 37.0,
    method: 'ww',
    hazardClass: 'Toxic, Carcinogen',
    ppeSuggestion: 'Chemical resistant gloves, goggles, respirator, full protective suit'
  },
  {
    id: 'glutaraldehyde-50',
    name: 'Glutaraldehyde 50%',
    specificGravity: 1.13,
    initialConcentration: 50.0,
    method: 'ww',
    hazardClass: 'Toxic, Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, respirator'
  },
  {
    id: 'mineral-oil-100',
    name: 'Mineral Oil 100%',
    specificGravity: 0.84,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Generally Safe',
    ppeSuggestion: 'Safety glasses, gloves'
  },
  {
    id: 'sodium-lauryl-sulfate-30',
    name: 'Sodium Lauryl Sulfate 30%',
    specificGravity: 1.05,
    initialConcentration: 30.0,
    method: 'ww',
    hazardClass: 'Irritant',
    ppeSuggestion: 'Safety glasses, gloves, dust mask if powder'
  },

  // Essential Oils and Natural Products
  {
    id: 'd-limonene-100',
    name: 'D-Limonene 100%',
    specificGravity: 0.84,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Flammable, Irritant',
    ppeSuggestion: 'Safety glasses, gloves, adequate ventilation'
  },
  {
    id: 'pine-oil-100',
    name: 'Pine Oil 100%',
    specificGravity: 0.93,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Flammable, Irritant',
    ppeSuggestion: 'Safety glasses, gloves, adequate ventilation'
  },
  {
    id: 'tea-tree-oil-100',
    name: 'Tea Tree Oil 100%',
    specificGravity: 0.89,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Irritant',
    ppeSuggestion: 'Safety glasses, gloves'
  }
];

export async function GET(request: NextRequest) {
  try {
    // Check if we should fetch Shopify products to link
    const includeShopify = request.nextUrl.searchParams.get('includeShopify') === 'true';
    
    let chemicals = [...chemicalDatabase];
    
    if (includeShopify) {
      // Fetch Shopify products
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
            const shopifyData = await shopifyResponse.json();
            const shopifyProducts = shopifyData.products || [];
            
            // Match chemicals with Shopify products
            chemicals = chemicals.map(chemical => {
              // Try to find matching Shopify product
              const matchingProduct = shopifyProducts.find((product: any) => {
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
                return {
                  ...chemical,
                  shopifyProductId: matchingProduct.id.toString(),
                  shopifyTitle: matchingProduct.title,
                  shopifySKU: matchingProduct.variants[0]?.sku || '',
                };
              }
              
              return chemical;
            });
          }
        } catch (shopifyError) {
          console.error('Error fetching Shopify products:', shopifyError);
          // Continue without Shopify data
        }
      }
    }
    
    // Sort chemicals alphabetically
    chemicals.sort((a, b) => a.name.localeCompare(b.name));
    
    return NextResponse.json({ 
      chemicals,
      total: chemicals.length 
    });
  } catch (error) {
    console.error('Error fetching chemicals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chemicals' },
      { status: 500 }
    );
  }
}
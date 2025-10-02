import { NextRequest, NextResponse } from 'next/server';
import { getEdgeSql } from '@/lib/db/neon-edge';
import { classifyWithRAG } from '@/lib/hazmat/classify';
import { classifyWithEnhancedRAG, type Classification } from '@/lib/hazmat/classify-enhanced';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Feature flag to enable database RAG
const USE_DATABASE_RAG = process.env.USE_DATABASE_RAG === 'true' || true; // Default to true

interface ClassificationRequest {
  sku: string;
  productName: string;
}

type ExistingClassificationRow = {
  sku: string | null;
  name: string | null;
  is_hazardous: boolean | null;
  un_number: string | null;
  classification_description: string | null;
  nmfc_code: string | null;
  freight_class: string | null;
  is_hazmat: boolean | null;
  hazmat_class: string | null;
  packing_group: string | null;
};

function extractRows<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === 'object' && value !== null && 'rows' in value) {
    const rows = (value as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as T[];
    }
  }
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const body: ClassificationRequest = await request.json();
    const { sku, productName } = body;

    if (!sku || !productName) {
      return NextResponse.json({
        success: false,
        error: 'SKU and product name are required'
      }, { status: 400 });
    }

    // First, try to find existing classification in database
    const sql = getEdgeSql();
    
    try {
      // Check if product already has a classification
      const result = await sql`
        SELECT
           p.sku, p.name, p.is_hazardous, p.un_number,
           fc.description as classification_description,
           fc.nmfc_code, fc.freight_class, fc.is_hazmat,
           fc.hazmat_class, fc.packing_group
         FROM products p
         JOIN product_freight_links pfl ON p.id = pfl.product_id
         JOIN freight_classifications fc ON pfl.classification_id = fc.id
         WHERE p.sku = ${sku} AND pfl.is_approved = true
      `;
      const existingLinks = extractRows<ExistingClassificationRow>(result);

      if (existingLinks.length > 0) {
        const existing = existingLinks[0];
        return NextResponse.json({
          success: true,
          un_number: existing.un_number || 'UN1830', // Default if not set
          proper_shipping_name: existing.name || existing.classification_description,
          hazard_class: existing.hazmat_class,
          packing_group: existing.packing_group,
          confidence: 1.0,
          source: 'database',
          sku,
          productName
        });
      }
    } catch (dbError) {
      console.warn('Database lookup failed, falling back to RAG:', dbError);
    }

    // Use enhanced RAG with database if enabled, otherwise fallback to JSON
    let suggestion: Classification;
    if (USE_DATABASE_RAG) {
      try {
        suggestion = await classifyWithEnhancedRAG(sku, productName, {
          preferDatabase: true,
          enableTelemetry: true
        });
      } catch (error) {
        console.error('Enhanced RAG failed, falling back to JSON:', error);
        suggestion = await classifyWithRAG(sku, productName);
      }
    } else {
      suggestion = await classifyWithRAG(sku, productName);
    }

    return NextResponse.json({
      success: true,
      ...suggestion,
      sku,
      productName,
    });

  } catch (error) {
    console.error('Hazmat classification API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to classify product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// RAG logic moved to lib/hazmat/classify.ts for reuse by scripts and routes

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Hazmat classification API is operational',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}

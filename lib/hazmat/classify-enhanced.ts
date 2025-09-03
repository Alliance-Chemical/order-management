/**
 * Enhanced hazmat classification with database RAG primary and JSON fallback
 */

import { classifyWithDatabaseRAG } from '@/lib/services/rag/database-rag';
import { classifyWithRAG as classifyWithJSONRAG } from './classify';

export type Classification = {
  un_number: string | null;
  proper_shipping_name: string | null;
  hazard_class: string | null;
  packing_group: 'I' | 'II' | 'III' | 'NONE' | null;
  labels?: string;
  erg_guide?: string | null;
  citations?: any[];
  confidence: number;
  source: string;
  explanation?: string;
  exemption_reason?: string;
  packaging?: any;
  quantity_limitations?: any;
  vessel_stowage?: any;
  special_provisions?: any;
  // Telemetry
  searchMethod?: 'database' | 'json' | 'hybrid';
  searchTimeMs?: number;
};

/**
 * Main classification function with database RAG and JSON fallback
 */
export async function classifyWithEnhancedRAG(
  sku: string | null,
  productName: string,
  options: {
    preferDatabase?: boolean;
    enableTelemetry?: boolean;
  } = {}
): Promise<Classification> {
  const { 
    preferDatabase = true, 
    enableTelemetry = true 
  } = options;
  
  const startTime = Date.now();
  let result: Classification;
  let searchMethod: 'database' | 'json' | 'hybrid' = 'database';
  
  // Try database RAG first (if preferred and available)
  if (preferDatabase) {
    try {
      console.log(`🔍 Searching database RAG for: ${productName}`);
      result = await classifyWithDatabaseRAG(sku, productName);
      
      // If database gives low confidence, try JSON as well
      if (result.confidence < 0.5) {
        console.log(`📊 Low confidence (${result.confidence}), trying JSON fallback...`);
        const jsonResult = await classifyWithJSONRAG(sku, productName);
        
        // Use the better result
        if (jsonResult.confidence > result.confidence) {
          result = jsonResult;
          searchMethod = 'json';
        } else {
          searchMethod = 'hybrid';
        }
      }
    } catch (error) {
      console.warn('❌ Database RAG failed, falling back to JSON:', error);
      
      // Fallback to JSON
      try {
        result = await classifyWithJSONRAG(sku, productName);
        searchMethod = 'json';
      } catch (jsonError) {
        console.error('❌ Both RAG methods failed:', jsonError);
        
        // Return empty result
        return {
          un_number: null,
          proper_shipping_name: null,
          hazard_class: null,
          packing_group: null,
          confidence: 0,
          source: 'error',
          explanation: 'Classification failed - both database and JSON RAG encountered errors',
          searchMethod: 'database',
          searchTimeMs: Date.now() - startTime
        };
      }
    }
  } else {
    // Use JSON RAG directly
    result = await classifyWithJSONRAG(sku, productName);
    searchMethod = 'json';
  }
  
  // Add telemetry if enabled
  if (enableTelemetry) {
    result.searchMethod = searchMethod;
    result.searchTimeMs = Date.now() - startTime;
    
    // Log performance metrics
    console.log(`✅ Classification complete:
      Product: ${productName}
      Method: ${searchMethod}
      Time: ${result.searchTimeMs}ms
      Confidence: ${Math.round(result.confidence * 100)}%
      Result: ${result.un_number || 'Non-regulated'}`);
  }
  
  return result;
}

/**
 * Batch classify multiple products efficiently
 */
export async function batchClassify(
  products: Array<{ sku: string; name: string }>,
  options: {
    concurrency?: number;
    preferDatabase?: boolean;
  } = {}
): Promise<Map<string, Classification>> {
  const { concurrency = 5, preferDatabase = true } = options;
  const results = new Map<string, Classification>();
  
  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < products.length; i += concurrency) {
    const batch = products.slice(i, i + concurrency);
    
    const batchResults = await Promise.all(
      batch.map(async (product) => {
        try {
          const classification = await classifyWithEnhancedRAG(
            product.sku,
            product.name,
            { preferDatabase }
          );
          return { sku: product.sku, classification };
        } catch (error) {
          console.error(`Failed to classify ${product.sku}:`, error);
          return {
            sku: product.sku,
            classification: {
              un_number: null,
              proper_shipping_name: null,
              hazard_class: null,
              packing_group: null,
              confidence: 0,
              source: 'error',
              explanation: 'Classification failed'
            }
          };
        }
      })
    );
    
    // Store results
    batchResults.forEach(({ sku, classification }) => {
      results.set(sku, classification);
    });
    
    // Log progress
    console.log(`Batch classified ${Math.min(i + concurrency, products.length)}/${products.length} products`);
  }
  
  return results;
}

/**
 * Get classification confidence score based on multiple factors
 */
export function getConfidenceScore(classification: Classification): {
  score: number;
  factors: Record<string, number>;
} {
  const factors: Record<string, number> = {
    base: classification.confidence,
    source: 0,
    completeness: 0,
    verification: 0
  };
  
  // Source quality
  if (classification.source.includes('verified')) {
    factors.source = 1.0;
  } else if (classification.source.includes('database')) {
    factors.source = 0.8;
  } else if (classification.source.includes('cfr')) {
    factors.source = 0.7;
  } else if (classification.source.includes('historical')) {
    factors.source = 0.6;
  } else {
    factors.source = 0.4;
  }
  
  // Completeness
  let complete = 0;
  if (classification.un_number) complete++;
  if (classification.proper_shipping_name) complete++;
  if (classification.hazard_class) complete++;
  if (classification.packing_group) complete++;
  factors.completeness = complete / 4;
  
  // Verification (if ERG guide exists)
  if (classification.erg_guide) {
    factors.verification = 1.0;
  }
  
  // Calculate weighted score
  const score = (
    factors.base * 0.4 +
    factors.source * 0.3 +
    factors.completeness * 0.2 +
    factors.verification * 0.1
  );
  
  return { score, factors };
}

/**
 * Validate classification against DOT requirements
 */
export function validateClassification(classification: Classification): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if it's marked as non-regulated
  if (classification.exemption_reason) {
    return { isValid: true, errors, warnings };
  }
  
  // Validate hazmat requirements
  if (classification.un_number) {
    // UN number format
    if (!/^UN\d{4}$/.test(classification.un_number)) {
      errors.push(`Invalid UN number format: ${classification.un_number}`);
    }
    
    // Required fields for hazmat
    if (!classification.hazard_class) {
      errors.push('Hazard class is required for hazmat shipments');
    }
    
    if (!classification.proper_shipping_name) {
      errors.push('Proper shipping name is required for hazmat shipments');
    }
    
    // Validate hazard class
    const validClasses = ['1', '2', '3', '4.1', '4.2', '4.3', '5.1', '5.2', '6.1', '6.2', '7', '8', '9'];
    if (classification.hazard_class && !validClasses.includes(classification.hazard_class)) {
      warnings.push(`Unusual hazard class: ${classification.hazard_class}`);
    }
    
    // Validate packing group
    if (classification.packing_group) {
      const validPG = ['I', 'II', 'III', 'NONE'];
      if (!validPG.includes(classification.packing_group)) {
        errors.push(`Invalid packing group: ${classification.packing_group}`);
      }
    }
  }
  
  // Low confidence warning
  if (classification.confidence < 0.5) {
    warnings.push(`Low confidence classification (${Math.round(classification.confidence * 100)}%)`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
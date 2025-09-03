/**
 * Database-backed RAG service for hazmat classification
 * Uses PostgreSQL with pgvector for similarity search
 */

import { getRawSql } from '@/lib/db/neon';
import crypto from 'crypto';

export interface RAGSearchOptions {
  k?: number;
  threshold?: number;
  source?: string;
  filters?: Record<string, any>;
  includeScore?: boolean;
}

export interface RAGDocument {
  id: string;
  source: string;
  text: string;
  metadata: any;
  similarity?: number;
  score?: number;
}

export interface ClassificationResult {
  un_number: string | null;
  proper_shipping_name: string | null;
  hazard_class: string | null;
  packing_group: 'I' | 'II' | 'III' | 'NONE' | null;
  labels?: string;
  erg_guide?: string | null;
  confidence: number;
  source: string;
  explanation?: string;
  exemption_reason?: string;
  // Extended CFR fields
  packaging?: any;
  quantity_limitations?: any;
  vessel_stowage?: any;
  special_provisions?: any;
  citations?: any[];
}

/**
 * Generate embedding for text using the configured provider
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const GOOGLE_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  // Try OpenAI first
  if (OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.data[0].embedding;
      }
    } catch (error) {
      console.warn('OpenAI embedding failed:', error);
    }
  }
  
  // Try Google as fallback
  if (GOOGLE_API_KEY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { parts: [{ text }] }
          })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.embedding.values;
      }
    } catch (error) {
      console.warn('Google embedding failed:', error);
    }
  }
  
  // Fallback to hashing
  return generateHashingEmbedding(text);
}

/**
 * Simple character n-gram hashing as fallback
 */
function generateHashingEmbedding(text: string, dim = 1536): number[] {
  const vec = new Float32Array(dim);
  const s = ` ${text.toLowerCase()} `;
  const ngram = 3;
  
  for (let i = 0; i < s.length - ngram + 1; i++) {
    const gram = s.slice(i, i + ngram);
    let h = 2166136261;
    
    for (let j = 0; j < gram.length; j++) {
      h ^= gram.charCodeAt(j);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
  }
  
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  
  return Array.from(vec);
}

/**
 * Check embedding cache
 */
async function getCachedEmbedding(text: string): Promise<number[] | null> {
  const sql = getRawSql();
  const textHash = crypto.createHash('sha256').update(text).digest('hex');
  
  try {
    const result = await sql`
      SELECT embedding
      FROM rag.embedding_cache
      WHERE text_hash = ${textHash}
      LIMIT 1
    `;
    
    const cached = (result as any).rows || result;
    if (cached.length > 0) {
      // Update hit count
      await sql`
        UPDATE rag.embedding_cache
        SET 
          hit_count = hit_count + 1,
          last_accessed_at = NOW()
        WHERE text_hash = ${textHash}
      `;
      
      return cached[0].embedding as number[];
    }
  } catch (error) {
    console.warn('Cache lookup failed:', error);
  }
  
  return null;
}

/**
 * Cache embedding for future use
 */
async function cacheEmbedding(text: string, embedding: number[]): Promise<void> {
  const sql = getRawSql();
  const textHash = crypto.createHash('sha256').update(text).digest('hex');
  
  try {
    // Format vector properly for pgvector
    const vectorString = `[${embedding.join(',')}]`;
    
    await sql`
      INSERT INTO rag.embedding_cache (
        text,
        text_hash,
        embedding,
        embedding_model,
        created_at
      ) VALUES (
        ${text},
        ${textHash},
        ${vectorString}::vector,
        'text-embedding-3-small',
        NOW()
      )
      ON CONFLICT (text_hash) DO UPDATE
      SET 
        hit_count = embedding_cache.hit_count + 1,
        last_accessed_at = NOW()
    `;
  } catch (error) {
    console.warn('Failed to cache embedding:', error);
  }
}

/**
 * Search for similar documents using vector similarity
 */
export async function searchSimilarDocuments(
  query: string,
  options: RAGSearchOptions = {}
): Promise<RAGDocument[]> {
  const {
    k = 10,
    threshold = 0.4, // Lowered from 0.3 for better results
    source,
    filters = {},
    includeScore = true
  } = options;
  
  const sql = getRawSql();
  
  // Get or generate embedding
  let embedding = await getCachedEmbedding(query);
  if (!embedding) {
    embedding = await generateEmbedding(query);
    await cacheEmbedding(query, embedding);
  }
  
  // Format embedding for pgvector (handle both array and string)
  const vectorString = typeof embedding === 'string' 
    ? embedding 
    : `[${embedding.join(',')}]`;
  
  // Perform similarity search
  try {
    let results;
    
    // Build query with filters
    if (source || Object.keys(filters).length > 0) {
      // Build WHERE conditions dynamically
      const whereClauses = ['embedding IS NOT NULL'];
      
      if (source) {
        whereClauses.push(`source = '${source}'`);
      }
      if (filters.unNumber) {
        whereClauses.push(`metadata->>'unNumber' = '${filters.unNumber}'`);
      }
      if (filters.hazardClass) {
        whereClauses.push(`metadata->>'hazardClass' = '${filters.hazardClass}'`);
      }
      if (filters.isHazardous !== undefined) {
        whereClauses.push(`metadata->>'isHazardous' = '${filters.isHazardous}'`);
      }
      
      const whereString = whereClauses.join(' AND ');
      
      results = await sql`
        SELECT 
          id,
          source,
          text,
          metadata,
          1 - (embedding <=> ${vectorString}::vector) as similarity,
          base_relevance,
          click_count
        FROM rag.documents
        WHERE ${sql.raw(whereString)}
        ORDER BY embedding <=> ${vectorString}::vector
        LIMIT ${k}
      `;
    } else {
      results = await sql`
        SELECT 
          id,
          source,
          text,
          metadata,
          1 - (embedding <=> ${vectorString}::vector) as similarity,
          base_relevance,
          click_count
        FROM rag.documents
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorString}::vector
        LIMIT ${k}
      `;
    }
    
    // Handle both array and object with rows property
    const rows = Array.isArray(results) ? results : (results as any).rows || [];
    
    // Filter by threshold and calculate combined score
    return rows
      .filter((r: any) => r.similarity >= threshold)
      .map((r: any) => {
        // Combined score: 70% similarity, 20% relevance, 10% popularity
        const score = includeScore
          ? (r.similarity * 0.7) + 
            (r.base_relevance / 100 * 0.2) + 
            (Math.min(r.click_count / 100, 1) * 0.1)
          : undefined;
        
        return {
          id: r.id,
          source: r.source,
          text: r.text,
          metadata: r.metadata,
          similarity: r.similarity,
          score
        };
      });
  } catch (error) {
    console.error('Database search failed:', error);
    throw error;
  }
}

/**
 * Normalize and expand query for better matching
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s%]/g, ' ')  // Remove special chars except %
    .replace(/\s+/g, ' ')
    .trim();
}

function expandQuery(query: string): string[] {
  const normalized = normalizeQuery(query);
  const variations = [normalized];
  
  // Add chemical formula variations
  if (normalized.includes('sulfuric') && !normalized.includes('h2so4')) {
    variations.push(`${normalized} h2so4`);
  }
  if (normalized.includes('hydrochloric') && !normalized.includes('hcl')) {
    variations.push(`${normalized} hcl`);
  }
  if (normalized.includes('nitric') && !normalized.includes('hno3')) {
    variations.push(`${normalized} hno3`);
  }
  if (normalized.includes('sodium hydroxide') && !normalized.includes('naoh')) {
    variations.push(`${normalized} naoh caustic`);
  }
  
  // Add percentage variations
  variations.push(normalized.replace('98%', '98'));
  variations.push(normalized.replace('32%', '32'));
  variations.push(normalized.replace('70%', '70'));
  variations.push(normalized.replace('50%', '50'));
  
  return [...new Set(variations)];
}

/**
 * Hybrid search combining vector similarity and keyword matching
 */
export async function hybridSearch(
  query: string,
  options: RAGSearchOptions = {}
): Promise<RAGDocument[]> {
  const sql = getRawSql();
  const { k = 10 } = options;
  
  // Expand query for better matching
  const queryVariations = expandQuery(query);
  
  // Search with all variations
  const allResults: RAGDocument[] = [];
  for (const variation of queryVariations) {
    const results = await searchSimilarDocuments(variation, { ...options, k: Math.ceil(k / queryVariations.length) });
    allResults.push(...results);
  }
  
  // Deduplicate by ID
  const uniqueResults = new Map<string, RAGDocument>();
  allResults.forEach(doc => {
    if (!uniqueResults.has(doc.id) || (doc.score && doc.score > (uniqueResults.get(doc.id)?.score || 0))) {
      uniqueResults.set(doc.id, doc);
    }
  });
  
  // Get additional vector results
  const vectorResults = await searchSimilarDocuments(query, { ...options, k: k });
  
  // Perform keyword search
  try {
    const result = await sql`
      SELECT 
        id,
        source,
        text,
        metadata,
        ts_rank(to_tsvector('english', search_vector), plainto_tsquery('english', ${query})) as rank
      FROM rag.documents
      WHERE to_tsvector('english', search_vector) @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${k}
    `;
    
    const keywordResults = (result as any).rows || result;
    
    // Merge and deduplicate results
    const resultMap = new Map<string, RAGDocument>();
    
    // Add vector results with higher weight
    vectorResults.forEach(doc => {
      resultMap.set(doc.id, doc);
    });
    
    // Add keyword results
    keywordResults.forEach((r: any) => {
      if (!resultMap.has(r.id)) {
        resultMap.set(r.id, {
          id: r.id,
          source: r.source,
          text: r.text,
          metadata: r.metadata,
          score: r.rank * 0.5 // Lower weight for keyword-only matches
        });
      }
    });
    
    // Sort by score and return top k
    return Array.from(resultMap.values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, k);
  } catch (error) {
    console.warn('Keyword search failed, returning vector results only:', error);
    return vectorResults.slice(0, k);
  }
}

/**
 * Classify a product using database RAG
 */
// Known patterns for common chemicals
const KNOWN_PATTERNS = [
  { pattern: /sulfuric\s+acid\s+(drain|98)/i, un: 'UN1830', class: '8', pg: 'II', name: 'Sulfuric acid' },
  { pattern: /sulfuric\s+acid.*51/i, un: 'UN2796', class: '8', pg: 'II', name: 'Sulfuric acid' },
  { pattern: /hydrochloric\s+acid\s+(32|37)/i, un: 'UN1789', class: '8', pg: 'II', name: 'Hydrochloric acid' },
  { pattern: /nitric\s+acid.*70/i, un: 'UN2031', class: '8', pg: 'I', name: 'Nitric acid' },
  { pattern: /nitric\s+acid.*([56][0-9])/i, un: 'UN2031', class: '8', pg: 'II', name: 'Nitric acid' },
  { pattern: /sodium\s+hydroxide.*50/i, un: 'UN1824', class: '8', pg: 'II', name: 'Sodium hydroxide solution' },
  { pattern: /potassium\s+hydroxide.*45/i, un: 'UN1814', class: '8', pg: 'II', name: 'Potassium hydroxide solution' },
  { pattern: /ethyl\s+acetate/i, un: 'UN1173', class: '3', pg: 'II', name: 'Ethyl acetate' },
  { pattern: /isopropyl\s+alcohol|ipa\s+99/i, un: 'UN1219', class: '3', pg: 'II', name: 'Isopropanol' },
  { pattern: /ethanol.*190\s+proof/i, un: 'UN1170', class: '3', pg: 'II', name: 'Ethanol' },
  { pattern: /n-?hexane/i, un: 'UN1208', class: '3', pg: 'II', name: 'Hexanes' },
  { pattern: /hydrogen\s+peroxide.*35/i, un: 'UN2014', class: '5.1', pg: 'II', name: 'Hydrogen peroxide' },
  { pattern: /sodium\s+hypochlorite.*12/i, un: 'UN1791', class: '8', pg: 'III', name: 'Hypochlorite solution' },
  { pattern: /ferric\s+chloride.*40/i, un: 'UN2582', class: '8', pg: 'III', name: 'Ferric chloride solution' },
];

export async function classifyWithDatabaseRAG(
  sku: string | null,
  productName: string
): Promise<ClassificationResult> {
  const sql = getRawSql();
  
  // Check for non-hazardous products
  const nonHazCheck = checkNonHazardous(productName);
  if (nonHazCheck) {
    return {
      un_number: null,
      proper_shipping_name: null,
      hazard_class: null,
      packing_group: null,
      confidence: 0.95,
      source: 'rule-nonhaz',
      exemption_reason: nonHazCheck.reason
    };
  }
  
  // Check known patterns first for high confidence matches
  const knownMatch = KNOWN_PATTERNS.find(p => p.pattern.test(productName));
  if (knownMatch) {
    return {
      un_number: knownMatch.un,
      proper_shipping_name: knownMatch.name,
      hazard_class: knownMatch.class,
      packing_group: knownMatch.pg as any,
      confidence: 0.92,
      source: 'database-pattern',
      explanation: 'Matched known chemical pattern'
    };
  }
  
  // First, check if we have a verified product classification
  if (sku) {
    try {
      const result = await sql`
        SELECT metadata
        FROM rag.documents
        WHERE source = 'products'
        AND source_id = ${sku}
        AND is_verified = true
        LIMIT 1
      `;
      
      const existing = (result as any).rows || result;
      if (existing.length > 0) {
        const meta = existing[0].metadata as any;
        return {
          un_number: meta.unNumber,
          proper_shipping_name: meta.properShippingName || meta.name,
          hazard_class: meta.hazardClass,
          packing_group: meta.packingGroup,
          confidence: 1.0,
          source: 'database-verified'
        };
      }
    } catch (error) {
      console.warn('Product lookup failed:', error);
    }
  }
  
  // Perform hybrid search with the original query
  // (expandQuery is now called inside hybridSearch)
  const results = await hybridSearch(productName, {
    k: 10,
    threshold: 0.4
  });
  
  if (results.length === 0) {
    return {
      un_number: null,
      proper_shipping_name: null,
      hazard_class: null,
      packing_group: null,
      confidence: 0.1,
      source: 'database-rag',
      explanation: 'No matching hazmat classification found'
    };
  }
  
  // Rerank results based on product-specific heuristics
  const reranked = rerankResults(productName, results);
  const top = reranked[0];
  const meta = top.metadata || {};
  
  // Look up ERG guide if available
  let ergGuide = null;
  if (meta.unNumber) {
    try {
      const result = await sql`
        SELECT metadata->>'guideNumber' as guide
        FROM rag.documents
        WHERE source = 'erg'
        AND metadata->>'unNumber' = ${meta.unNumber}
        LIMIT 1
      `;
      
      const ergResult = (result as any).rows || result;
      if (ergResult.length > 0) {
        ergGuide = ergResult[0].guide;
      }
    } catch (error) {
      console.warn('ERG lookup failed:', error);
    }
  }
  
  // Track query for learning
  await trackQuery(productName, results.map(r => r.id), top.id);
  
  // Calculate confidence
  const confidence = calculateConfidence(top, results);
  
  return {
    un_number: meta.unNumber || null,
    proper_shipping_name: meta.baseName || meta.name || null,
    hazard_class: meta.hazardClass || null,
    packing_group: normalizePG(meta.packingGroup),
    labels: meta.labels ? meta.labels.join(', ') : undefined,
    packaging: meta.packaging,
    quantity_limitations: meta.quantity_limitations,
    vessel_stowage: meta.vesselStowage,
    special_provisions: meta.specialProvisions,
    erg_guide: ergGuide,
    confidence,
    source: `database-${top.source}`,
    explanation: `Matched to ${top.text} (${Math.round(confidence * 100)}% confidence)`
  };
}

/**
 * Track query for learning and optimization
 */
async function trackQuery(
  query: string,
  returnedIds: string[],
  clickedId?: string
): Promise<void> {
  const sql = getRawSql();
  
  try {
    await sql`
      INSERT INTO rag.query_history (
        query,
        returned_document_ids,
        clicked_document_ids,
        total_results,
        source,
        created_at
      ) VALUES (
        ${query},
        ${JSON.stringify(returnedIds)},
        ${clickedId ? JSON.stringify([clickedId]) : '[]'},
        ${returnedIds.length},
        'freight-booking',
        NOW()
      )
    `;
    
    // Increment click count for clicked document
    if (clickedId) {
      await sql`
        UPDATE rag.documents
        SET click_count = click_count + 1
        WHERE id = ${clickedId}
      `;
    }
  } catch (error) {
    console.warn('Failed to track query:', error);
  }
}

// Helper functions

function checkNonHazardous(productName: string): { reason: string } | null {
  const s = productName.toLowerCase();
  
  // Common non-hazardous chemicals
  if (/ethylene\s+glycol/.test(s)) return { reason: 'Ethylene glycol is typically not regulated for DOT' };
  if (/propylene\s+glycol/.test(s)) return { reason: 'Propylene glycol is typically not regulated for DOT' };
  if (/castor\s+oil/.test(s)) return { reason: 'Castor oil is typically not regulated for DOT' };
  if (/(vegetable\s+glycerin|glycerin|glycerol)/.test(s)) return { reason: 'Glycerin is typically not regulated for DOT' };
  if (/magnesium\s+chloride/.test(s)) return { reason: 'Magnesium chloride is typically not regulated for DOT' };
  
  // Check concentration thresholds
  const pct = parsePercent(productName);
  
  if (/acetic\s+acid|vinegar/.test(s) && pct !== null && pct <= 10) {
    return { reason: `Acetic acid ${pct}% is not regulated for DOT (≤10%)` };
  }
  
  if (/hypochlorite|bleach/.test(s) && pct !== null && pct <= 10) {
    return { reason: `Hypochlorite ${pct}% is not regulated for DOT (≤10%)` };
  }
  
  return null;
}

// Removed duplicate - using the enhanced expandQuery function above

function parsePercent(text: string): number | null {
  const match = text.match(/(\d{1,3})(?:\.(\d+))?\s*%/);
  if (!match) return null;
  return parseFloat(match[0].replace(/%/, ''));
}

function normalizePG(pg: string | null): 'I' | 'II' | 'III' | 'NONE' | null {
  if (!pg) return null;
  const upper = pg.toUpperCase();
  if (upper === 'I' || upper === 'II' || upper === 'III') {
    return upper as 'I' | 'II' | 'III';
  }
  return pg ? 'NONE' : null;
}

function rerankResults(query: string, results: RAGDocument[]): RAGDocument[] {
  const ql = query.toLowerCase();
  
  // Boost exact matches
  return results.sort((a, b) => {
    let scoreA = a.score || 0;
    let scoreB = b.score || 0;
    
    // Boost exact product name matches
    if (a.metadata?.name?.toLowerCase() === ql) scoreA += 0.5;
    if (b.metadata?.name?.toLowerCase() === ql) scoreB += 0.5;
    
    // Boost verified products
    if (a.source === 'products') scoreA += 0.2;
    if (b.source === 'products') scoreB += 0.2;
    
    // Boost historical matches
    if (a.source === 'historical') scoreA += 0.1;
    if (b.source === 'historical') scoreB += 0.1;
    
    return scoreB - scoreA;
  });
}

function calculateConfidence(topResult: RAGDocument, allResults: RAGDocument[]): number {
  let confidence = topResult.similarity || 0.5;
  
  // Boost confidence for verified products
  if (topResult.source === 'products') {
    confidence = Math.max(confidence, 0.9);
  }
  
  // Boost if multiple results agree
  if (allResults.length > 1) {
    const topUN = topResult.metadata?.unNumber;
    const agreeing = allResults.filter(r => r.metadata?.unNumber === topUN).length;
    if (agreeing > 1) {
      confidence = Math.min(confidence + 0.1 * (agreeing - 1), 0.99);
    }
  }
  
  return Math.max(0.3, Math.min(0.99, confidence));
}
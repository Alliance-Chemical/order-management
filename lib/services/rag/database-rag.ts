/**
 * Database-backed RAG service for hazmat classification
 * Uses PostgreSQL with pgvector for similarity search
 */

import { getRawSql } from '@/lib/db/neon';

export interface HazardMetadata extends Record<string, unknown> {
  unNumber?: string;
  baseName?: string;
  name?: string;
  properShippingName?: string;
  hazardClass?: string;
  packingGroup?: string;
  labels?: string[];
  packaging?: Record<string, unknown>;
  quantity_limitations?: Record<string, unknown>;
  vesselStowage?: Record<string, unknown>;
  specialProvisions?: Record<string, unknown>;
  vessel_stowage?: Record<string, unknown>;
  items?: unknown[];
  sourceContainerId?: unknown;
  containerNumber?: number;
  type?: string;
  isSource?: boolean;
}

export interface RAGSearchFilters extends Record<string, unknown> {
  unNumber?: string;
}

export interface RAGSearchOptions {
  k?: number;
  threshold?: number;
  source?: string;
  filters?: RAGSearchFilters;
  includeScore?: boolean;
}

interface KnownPattern {
  pattern: RegExp;
  un: string;
  class: string;
  pg: 'I' | 'II' | 'III';
  name: string;
}

export interface RAGDocument {
  id: string;
  source: string;
  text: string;
  metadata: HazardMetadata;
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
  packaging?: Record<string, unknown>;
  quantity_limitations?: Record<string, unknown>;
  vessel_stowage?: Record<string, unknown>;
  special_provisions?: Record<string, unknown>;
  citations?: unknown[];
}

function toRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as T[];
    }
  }
  return [];
}

function ensureHazardMetadata(meta: unknown): HazardMetadata {
  return (meta && typeof meta === 'object') ? (meta as HazardMetadata) : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
  // Use Web Crypto API for edge runtime compatibility
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const textHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  try {
    const result = await sql`
      SELECT embedding
      FROM rag.embedding_cache
      WHERE text_hash = ${textHash}
      LIMIT 1
    `;
    
    const cached = toRows<{ embedding: number[] }>(result);
    if (cached.length > 0) {
      // Update hit count
      await sql`
        UPDATE rag.embedding_cache
        SET 
          hit_count = hit_count + 1,
          last_accessed_at = NOW()
        WHERE text_hash = ${textHash}
      `;
      
      return cached[0].embedding;
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
  // Use Web Crypto API for edge runtime compatibility
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const textHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
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
    filters,
    includeScore = true
  } = options;
  
  const sql = getRawSql();
  const unNumberFilter = typeof filters?.unNumber === 'string' ? filters.unNumber : undefined;
  const hasOtherFilters = Boolean(
    filters && Object.keys(filters).some((key) => key !== 'unNumber')
  );
  
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
    if (source || unNumberFilter || hasOtherFilters) {
      // Build query with proper parameterization to avoid sql.raw
      if (source && unNumberFilter) {
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
            AND source = ${source}
            AND metadata->>'unNumber' = ${unNumberFilter}
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT ${k}
        `;
      } else if (source) {
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
            AND source = ${source}
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT ${k}
        `;
      } else if (unNumberFilter) {
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
            AND metadata->>'unNumber' = ${unNumberFilter}
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT ${k}
        `;
      } else {
        // General filter case
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
    const vectorRows = toRows<{
      id: string;
      source: string;
      text: string;
      metadata: HazardMetadata | null;
      similarity: number | null;
      base_relevance: number | null;
      click_count: number | null;
    }>(results);
    
    // Filter by threshold and calculate combined score
    return vectorRows
      .filter((row) => (row.similarity ?? 0) >= threshold)
      .map((row) => {
        // Combined score: 70% similarity, 20% relevance, 10% popularity
        const similarity = row.similarity ?? 0;
        const baseRelevance = row.base_relevance ?? 0;
        const clickCount = row.click_count ?? 0;
        const score = includeScore
          ? (similarity * 0.7) + 
            (baseRelevance / 100 * 0.2) + 
            (Math.min(clickCount / 100, 1) * 0.1)
          : undefined;
        
        return {
          id: row.id,
          source: row.source,
          text: row.text,
          metadata: ensureHazardMetadata(row.metadata),
          similarity,
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
  
  // Strip container size from query for chemical matching
  const chemicalOnly = normalized
    .replace(/\d+\s*(gallon|gal|lb|pound|drum|container|bottle|jug|quart|liter|ml|kg|oz)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (chemicalOnly !== normalized && chemicalOnly.length > 2) {
    variations.unshift(chemicalOnly); // Prioritize chemical name without size
  }
  
  // Chemical-specific expansions
  const chemicalExpansions: Record<string, string[]> = {
    'kerosene': ['kerosene', 'k1 fuel', 'k-1 fuel', 'kerosine'],
    'acetone': ['acetone', '2-propanone', 'dimethyl ketone'],
    'isopropanol': ['isopropanol', 'isopropyl alcohol', 'ipa', '2-propanol'],
    'petroleum ether': ['petroleum ether', 'petroleum spirits', 'ligroin'],
    'mineral spirits': ['mineral spirits', 'white spirit', 'petroleum spirits'],
    'sulfuric acid': ['sulfuric acid', 'h2so4', 'battery acid', 'drain cleaner'],
    'hydrochloric acid': ['hydrochloric acid', 'hcl', 'muriatic acid'],
    'nitric acid': ['nitric acid', 'hno3', 'aqua fortis'],
    'sodium hydroxide': ['sodium hydroxide', 'naoh', 'caustic soda', 'lye'],
    'ammonia': ['ammonia', 'ammonium hydroxide', 'ammonia solution'],
    'methanol': ['methanol', 'methyl alcohol', 'wood alcohol'],
    'ethanol': ['ethanol', 'ethyl alcohol', 'denatured alcohol'],
    'toluene': ['toluene', 'methylbenzene', 'toluol'],
    'xylene': ['xylene', 'xylol', 'dimethylbenzene']
  };
  
  // Apply chemical expansions
  for (const [key, expansions] of Object.entries(chemicalExpansions)) {
    if (normalized.includes(key) || chemicalOnly.includes(key)) {
      // Add expanded variations
      expansions.forEach(expansion => {
        // Replace the key with each expansion
        if (chemicalOnly.includes(key)) {
          variations.push(chemicalOnly.replace(key, expansion));
        }
        // Also add just the expansion term for broader matching
        variations.push(expansion);
      });
    }
  }
  
  // Add percentage variations
  const percentages = normalized.match(/\d+\s*%?/g);
  if (percentages) {
    percentages.forEach(pct => {
      variations.push(normalized.replace(pct, pct.replace('%', '')));
    });
  }
  
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
    
    const keywordResults = toRows<{
      id: string;
      source: string;
      text: string;
      metadata: HazardMetadata | null;
      rank: number | null;
    }>(result);
    
    // Merge and deduplicate results
    const resultMap = new Map<string, RAGDocument>();
    
    // Add vector results with higher weight
    vectorResults.forEach(doc => {
      resultMap.set(doc.id, doc);
    });
    
    // Add keyword results
    keywordResults.forEach((row) => {
      if (!resultMap.has(row.id)) {
        const metadata = ensureHazardMetadata(row.metadata);
        const rank = row.rank ?? 0;
        resultMap.set(row.id, {
          id: row.id,
          source: row.source,
          text: row.text,
          metadata,
          score: rank * 0.5 // Lower weight for keyword-only matches
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
// Known patterns for common chemicals - comprehensive list for Alliance Chemical products
export const KNOWN_PATTERNS: KnownPattern[] = [
  // Flammable Liquids - Class 3
  { pattern: /kerosene|k-?1\s+fuel/i, un: 'UN1223', class: '3', pg: 'III', name: 'Kerosene' },
  { pattern: /acetone/i, un: 'UN1090', class: '3', pg: 'II', name: 'Acetone' },
  { pattern: /toluene/i, un: 'UN1294', class: '3', pg: 'II', name: 'Toluene' },
  { pattern: /xylene|xylol/i, un: 'UN1307', class: '3', pg: 'III', name: 'Xylenes' },
  { pattern: /methanol|methyl\s+alcohol/i, un: 'UN1230', class: '3', pg: 'II', name: 'Methanol' },
  { pattern: /ethanol.*190\s+proof|denatured.*190/i, un: 'UN1170', class: '3', pg: 'II', name: 'Ethanol' },
  { pattern: /denatured.*200|alcohol.*200\s+proof/i, un: 'UN1987', class: '3', pg: 'II', name: 'Alcohols, n.o.s.' },
  { pattern: /isopropyl\s+alcohol|isopropanol|ipa\s+(70|91|99)/i, un: 'UN1219', class: '3', pg: 'II', name: 'Isopropanol' },
  { pattern: /petroleum\s+ether/i, un: 'UN1268', class: '3', pg: 'I', name: 'Petroleum distillates, n.o.s.' },
  { pattern: /mineral\s+spirits?|white\s+spirits?/i, un: 'UN1268', class: '3', pg: 'III', name: 'Petroleum distillates, n.o.s.' },
  { pattern: /vm.?p\s+naphtha/i, un: 'UN1268', class: '3', pg: 'II', name: 'Petroleum distillates, n.o.s.' },
  { pattern: /hexane|n-?hexane/i, un: 'UN1208', class: '3', pg: 'II', name: 'Hexanes' },
  { pattern: /heptane|n-?heptane/i, un: 'UN1206', class: '3', pg: 'II', name: 'Heptanes' },
  { pattern: /cyclohexanone/i, un: 'UN1915', class: '3', pg: 'III', name: 'Cyclohexanone' },
  { pattern: /mek|methyl\s+ethyl\s+ketone/i, un: 'UN1193', class: '3', pg: 'II', name: 'Ethyl methyl ketone' },
  { pattern: /mibk|methyl\s+isobutyl\s+ketone/i, un: 'UN1245', class: '3', pg: 'II', name: 'Methyl isobutyl ketone' },
  { pattern: /mnak|methyl\s+n-?amyl\s+ketone/i, un: 'UN1110', class: '3', pg: 'III', name: 'n-Amyl methyl ketone' },
  { pattern: /mpk|methyl\s+n-?propyl\s+ketone/i, un: 'UN1249', class: '3', pg: 'II', name: 'Methyl propyl ketone' },
  { pattern: /ethyl\s+acetate/i, un: 'UN1173', class: '3', pg: 'II', name: 'Ethyl acetate' },
  { pattern: /n-?butyl\s+acetate/i, un: 'UN1123', class: '3', pg: 'III', name: 'Butyl acetates' },
  { pattern: /isopropyl\s+acetate/i, un: 'UN1220', class: '3', pg: 'II', name: 'Isopropyl acetate' },
  { pattern: /amyl\s+acetate/i, un: 'UN1104', class: '3', pg: 'III', name: 'Amyl acetates' },
  { pattern: /tert-?butyl\s+acetate|tba/i, un: 'UN1123', class: '3', pg: 'II', name: 'Butyl acetates' },
  { pattern: /d-?limonene/i, un: 'UN2052', class: '3', pg: 'III', name: 'Dipentene' },
  { pattern: /glycol\s+ether\s+ee/i, un: 'UN1171', class: '3', pg: 'III', name: 'Ethylene glycol monoethyl ether' },
  { pattern: /isobutyl\s+alcohol/i, un: 'UN1212', class: '3', pg: 'III', name: 'Isobutanol' },
  { pattern: /n-?propyl\s+alcohol/i, un: 'UN1274', class: '3', pg: 'II', name: 'n-Propanol' },
  { pattern: /n-?butyl\s+alcohol|n-?butanol/i, un: 'UN1120', class: '3', pg: 'III', name: 'Butanols' },
  
  // Acids - Class 8
  { pattern: /sulfuric\s+acid.*9[38]|drain\s+hammer/i, un: 'UN1830', class: '8', pg: 'II', name: 'Sulfuric acid' },
  { pattern: /sulfuric\s+acid.*(37|50|51|70)/i, un: 'UN2796', class: '8', pg: 'II', name: 'Sulfuric acid' },
  { pattern: /sulfuric\s+acid.*30/i, un: 'UN2796', class: '8', pg: 'II', name: 'Sulfuric acid' },
  { pattern: /battery\s+acid|sulfuric.*37/i, un: 'UN2796', class: '8', pg: 'II', name: 'Battery fluid, acid' },
  { pattern: /hydrochloric\s+acid.*(31|32|37)/i, un: 'UN1789', class: '8', pg: 'II', name: 'Hydrochloric acid' },
  { pattern: /hydrochloric\s+acid.*(15|20)/i, un: 'UN1789', class: '8', pg: 'III', name: 'Hydrochloric acid' },
  { pattern: /hydrochloric\s+acid.*5/i, un: 'UN1789', class: '8', pg: 'III', name: 'Hydrochloric acid' },
  { pattern: /nitric\s+acid.*70/i, un: 'UN2031', class: '8', pg: 'I', name: 'Nitric acid' },
  { pattern: /nitric\s+acid.*(6[0-9]|5[0-9])/i, un: 'UN2031', class: '8', pg: 'II', name: 'Nitric acid' },
  { pattern: /nitric\s+acid.*(40|25|20)/i, un: 'UN2031', class: '8', pg: 'II', name: 'Nitric acid' },
  { pattern: /nitric\s+acid.*5(?!\d)/i, un: 'UN2031', class: '8', pg: 'II', name: 'Nitric acid' },
  { pattern: /phosphoric\s+acid.*(75|85)/i, un: 'UN1805', class: '8', pg: 'III', name: 'Phosphoric acid' },
  { pattern: /phosphoric\s+acid.*30/i, un: 'UN1805', class: '8', pg: 'III', name: 'Phosphoric acid' },
  { pattern: /acetic\s+acid.*glacial|glacial\s+acetic/i, un: 'UN2789', class: '8', pg: 'II', name: 'Acetic acid, glacial' },
  { pattern: /acetic\s+acid.*(50|75)/i, un: 'UN2790', class: '8', pg: 'II', name: 'Acetic acid solution' },
  { pattern: /acetic\s+acid.*30/i, un: 'UN2790', class: '8', pg: 'III', name: 'Acetic acid solution' },
  { pattern: /vinegar.*(30|50|75)/i, un: 'UN2790', class: '8', pg: 'II', name: 'Acetic acid solution' },
  { pattern: /hydrofluorosilicic\s+acid|hfs/i, un: 'UN1778', class: '8', pg: 'II', name: 'Fluorosilicic acid' },
  
  // Bases - Class 8
  { pattern: /sodium\s+hydroxide.*50|caustic.*50/i, un: 'UN1824', class: '8', pg: 'II', name: 'Sodium hydroxide solution' },
  { pattern: /sodium\s+hydroxide.*25|caustic.*25/i, un: 'UN1824', class: '8', pg: 'III', name: 'Sodium hydroxide solution' },
  { pattern: /sodium\s+hydroxide\s+flakes?|lye\s+flakes?|caustic\s+soda\s+flakes?/i, un: 'UN1823', class: '8', pg: 'II', name: 'Sodium hydroxide, solid' },
  { pattern: /potassium\s+hydroxide.*45|koh.*solution/i, un: 'UN1814', class: '8', pg: 'II', name: 'Potassium hydroxide solution' },
  { pattern: /potassium\s+hydroxide\s+flakes?|koh\s+flakes?/i, un: 'UN1813', class: '8', pg: 'II', name: 'Potassium hydroxide, solid' },
  { pattern: /ammonium\s+hydroxide|ammonia.*solution.*29/i, un: 'UN2672', class: '8', pg: 'III', name: 'Ammonia solution' },
  
  // Oxidizers - Class 5.1
  { pattern: /hydrogen\s+peroxide.*(30|35)/i, un: 'UN2014', class: '5.1', pg: 'II', name: 'Hydrogen peroxide' },
  { pattern: /hydrogen\s+peroxide.*(25|20)/i, un: 'UN2984', class: '5.1', pg: 'III', name: 'Hydrogen peroxide' },
  { pattern: /hydrogen\s+peroxide.*(10|12|15)/i, un: 'UN2984', class: '5.1', pg: 'III', name: 'Hydrogen peroxide' },
  { pattern: /sodium\s+hypochlorite.*12/i, un: 'UN1791', class: '8', pg: 'III', name: 'Hypochlorite solution' },
  { pattern: /sodium\s+hypochlorite.*5/i, un: 'UN1791', class: '8', pg: 'III', name: 'Hypochlorite solution' },
  
  // Other corrosives - Class 8
  { pattern: /ferric\s+chloride.*40/i, un: 'UN2582', class: '8', pg: 'III', name: 'Ferric chloride solution' },
  { pattern: /monoethanolamine|mea\s/i, un: 'UN2491', class: '8', pg: 'III', name: 'Ethanolamine' },
  { pattern: /aluminum\s+sulfate.*50/i, un: 'UN3264', class: '8', pg: 'III', name: 'Corrosive liquid, acidic, inorganic, n.o.s.' },
  
  // Toxic - Class 6.1
  { pattern: /perchloroethylene|perc|pce/i, un: 'UN1897', class: '6.1', pg: 'III', name: 'Tetrachloroethylene' },
  { pattern: /trichloroethylene|tce/i, un: 'UN1710', class: '6.1', pg: 'III', name: 'Trichloroethylene' },
  { pattern: /oxalic\s+acid/i, un: 'UN3261', class: '8', pg: 'III', name: 'Corrosive solid, acidic, organic, n.o.s.' },
  
  // Environmentally hazardous
  { pattern: /sodium\s+dichromate/i, un: 'UN3288', class: '6.1', pg: 'II', name: 'Toxic solid, inorganic, n.o.s.' },
  { pattern: /cadmium\s+oxide/i, un: 'UN2570', class: '6.1', pg: 'I', name: 'Cadmium compound' },
  { pattern: /ammonium\s+bifluoride/i, un: 'UN1727', class: '8', pg: 'II', name: 'Ammonium hydrogendifluoride, solid' },
];

export async function classifyWithDatabaseRAG(
  sku: string | null,
  productName: string
): Promise<ClassificationResult> {
  const sql = getRawSql();
  
  // Check if this is a direct UN number query
  const unMatch = productName.match(/^UN\s?(\d{4})$/i);
  if (unMatch) {
    const unNumber = `UN${unMatch[1]}`;
    // Find in patterns
    const pattern = KNOWN_PATTERNS.find(p => p.un === unNumber);
    if (pattern) {
      return {
        un_number: pattern.un,
        proper_shipping_name: pattern.name,
        hazard_class: pattern.class,
        packing_group: pattern.pg,
        confidence: 0.95,
        source: 'pattern-un-lookup',
        explanation: `Direct UN number lookup: ${pattern.name}`
      };
    }
  }
  
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
      packing_group: knownMatch.pg,
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
      
      const existing = toRows<{ metadata: HazardMetadata | null }>(result);
      if (existing.length > 0) {
        const meta = ensureHazardMetadata(existing[0].metadata);
        const properName = typeof meta.properShippingName === 'string'
          ? meta.properShippingName
          : typeof meta.name === 'string'
            ? meta.name
            : null;
        return {
          un_number: typeof meta.unNumber === 'string' ? meta.unNumber : null,
          proper_shipping_name: properName,
          hazard_class: typeof meta.hazardClass === 'string' ? meta.hazardClass : null,
          packing_group: normalizePG(typeof meta.packingGroup === 'string' ? meta.packingGroup : null),
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
  const meta = ensureHazardMetadata(top.metadata);
  
  // Look up ERG guide if available
  let ergGuide = null;
  if (typeof meta.unNumber === 'string' && meta.unNumber) {
    try {
      const result = await sql`
        SELECT metadata->>'guideNumber' as guide
        FROM rag.documents
        WHERE source = 'erg'
        AND metadata->>'unNumber' = ${meta.unNumber}
        LIMIT 1
      `;
      
      const ergRows = toRows<{ guide: string | null }>(result);
      if (ergRows.length > 0 && ergRows[0].guide) {
        ergGuide = ergRows[0].guide;
      }
    } catch (error) {
      console.warn('ERG lookup failed:', error);
    }
  }
  
  // Track query for learning
  await trackQuery(productName, results.map(r => r.id), top.id);
  
  // Calculate confidence
  const confidence = calculateConfidence(top, results);
  
  const baseName = typeof meta.baseName === 'string' ? meta.baseName : undefined;
  const name = typeof meta.name === 'string' ? meta.name : undefined;
  const labels = Array.isArray(meta.labels) ? meta.labels.filter((label): label is string => typeof label === 'string') : undefined;
  const packaging = isRecord(meta.packaging) ? meta.packaging : undefined;
  const quantityLimitations = isRecord(meta.quantity_limitations) ? meta.quantity_limitations : undefined;
  const vesselStowage = isRecord(meta.vesselStowage) ? meta.vesselStowage : undefined;
  const specialProvisions = isRecord(meta.specialProvisions) ? meta.specialProvisions : undefined;

  return {
    un_number: typeof meta.unNumber === 'string' ? meta.unNumber : null,
    proper_shipping_name: baseName || name || null,
    hazard_class: typeof meta.hazardClass === 'string' ? meta.hazardClass : null,
    packing_group: normalizePG(typeof meta.packingGroup === 'string' ? meta.packingGroup : null),
    labels: labels ? labels.join(', ') : undefined,
    packaging,
    quantity_limitations: quantityLimitations,
    vessel_stowage: vesselStowage,
    special_provisions: specialProvisions,
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
  
  // Extract chemical name without size/container info
  const chemicalName = ql
    .replace(/\d+\s*(gallon|gal|lb|pound|drum|container|bottle|jug|quart|liter|ml|kg|oz)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return results.sort((a, b) => {
    let scoreA = a.score || a.similarity || 0;
    let scoreB = b.score || b.similarity || 0;
    
    // MASSIVE boost for exact chemical name match
    const aName = (a.metadata?.name || a.metadata?.baseName || a.text || '').toLowerCase();
    const bName = (b.metadata?.name || b.metadata?.baseName || b.text || '').toLowerCase();
    
    // Check for chemical name match (without container size)
    if (chemicalName && chemicalName.length > 2) {
      if (aName.includes(chemicalName)) scoreA += 0.8;
      if (bName.includes(chemicalName)) scoreB += 0.8;
      
      // Extra boost for exact match
      if (aName === chemicalName) scoreA += 0.3;
      if (bName === chemicalName) scoreB += 0.3;
    }
    
    // Penalize wrong chemicals based on context
    if (chemicalName.includes('kerosene')) {
      // Penalize petroleum products that aren't kerosene
      if (aName.includes('petroleum ether')) scoreA -= 0.5;
      if (bName.includes('petroleum ether')) scoreB -= 0.5;
      if (aName.includes('mineral spirits')) scoreA -= 0.3;
      if (bName.includes('mineral spirits')) scoreB -= 0.3;
    }
    
    // Boost exact full query match
    if (aName === ql) scoreA += 0.5;
    if (bName === ql) scoreB += 0.5;
    
    // Boost verified products
    if (a.source === 'products') scoreA += 0.2;
    if (b.source === 'products') scoreB += 0.2;
    
    // Boost CFR/HMT sources for regulatory data
    if (a.source === 'cfr' || a.source === 'hmt') scoreA += 0.15;
    if (b.source === 'cfr' || b.source === 'hmt') scoreB += 0.15;
    
    // Boost historical matches slightly
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

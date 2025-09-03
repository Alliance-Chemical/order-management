/**
 * Hybrid Search Implementation
 * Combines semantic similarity with BM25 keyword matching for better accuracy
 */

import { ProcessedQuery } from './query-processor';

// BM25 parameters
const BM25_K1 = 1.2; // Term frequency saturation
const BM25_B = 0.75; // Length normalization

export interface Document {
  id: string;
  source: string;
  text: string;
  embedding: number[];
  metadata: any;
  tokens?: string[];
  length?: number;
}

export interface SearchResult extends Document {
  semanticScore: number;
  keywordScore: number;
  hybridScore: number;
  highlights?: string[];
}

/**
 * Sliding Window Implementation for Context
 * Creates overlapping chunks for better context preservation
 */
export class SlidingWindow {
  private windowSize: number;
  private overlapSize: number;
  private maxWindows: number;

  constructor(windowSize = 512, overlapSize = 128, maxWindows = 10) {
    this.windowSize = windowSize;
    this.overlapSize = overlapSize;
    this.maxWindows = maxWindows;
  }

  /**
   * Create sliding windows from text
   */
  createWindows(text: string): string[] {
    const words = text.split(/\s+/);
    const windows: string[] = [];
    
    if (words.length <= this.windowSize) {
      return [text];
    }

    const step = this.windowSize - this.overlapSize;
    for (let i = 0; i < words.length && windows.length < this.maxWindows; i += step) {
      const window = words.slice(i, i + this.windowSize).join(' ');
      windows.push(window);
      
      // Stop if we've reached the end
      if (i + this.windowSize >= words.length) break;
    }

    return windows;
  }

  /**
   * Create context windows around matches
   */
  createContextWindows(text: string, matchPositions: number[], contextSize = 256): string[] {
    const words = text.split(/\s+/);
    const windows: string[] = [];
    const processedRanges = new Set<string>();

    for (const pos of matchPositions) {
      const start = Math.max(0, pos - contextSize);
      const end = Math.min(words.length, pos + contextSize);
      const rangeKey = `${start}-${end}`;

      if (!processedRanges.has(rangeKey)) {
        processedRanges.add(rangeKey);
        const window = words.slice(start, end).join(' ');
        windows.push(window);
      }
    }

    return windows;
  }

  /**
   * Merge overlapping windows
   */
  mergeWindows(windows: string[]): string {
    if (windows.length === 0) return '';
    if (windows.length === 1) return windows[0];

    // Find overlaps and merge
    let merged = windows[0];
    for (let i = 1; i < windows.length; i++) {
      const overlap = this.findOverlap(merged, windows[i]);
      if (overlap > 20) { // Minimum overlap threshold
        // Merge with overlap
        const words1 = merged.split(/\s+/);
        const words2 = windows[i].split(/\s+/);
        const mergePoint = words1.length - overlap;
        merged = [...words1.slice(0, mergePoint), ...words2].join(' ');
      } else {
        // Concatenate with separator
        merged += ' [...] ' + windows[i];
      }
    }

    return merged;
  }

  private findOverlap(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    for (let overlap = Math.min(words1.length, words2.length); overlap > 0; overlap--) {
      const end1 = words1.slice(-overlap).join(' ');
      const start2 = words2.slice(0, overlap).join(' ');
      if (end1 === start2) {
        return overlap;
      }
    }
    
    return 0;
  }
}

/**
 * BM25 Implementation for keyword scoring
 */
export class BM25 {
  private documents: Document[];
  private idf: Map<string, number>;
  private avgDocLength: number;
  private docFreq: Map<string, number>;

  constructor(documents: Document[]) {
    this.documents = documents;
    this.buildIndex();
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  private buildIndex() {
    this.docFreq = new Map();
    let totalLength = 0;

    // Calculate document frequencies
    for (const doc of this.documents) {
      const tokens = this.tokenize(doc.text);
      doc.tokens = tokens;
      doc.length = tokens.length;
      totalLength += tokens.length;

      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        this.docFreq.set(token, (this.docFreq.get(token) || 0) + 1);
      }
    }

    this.avgDocLength = totalLength / this.documents.length;

    // Calculate IDF scores
    this.idf = new Map();
    const N = this.documents.length;
    for (const [token, df] of this.docFreq.entries()) {
      this.idf.set(token, Math.log((N - df + 0.5) / (df + 0.5)));
    }
  }

  score(query: string, document: Document): number {
    const queryTokens = this.tokenize(query);
    const docTokens = document.tokens || this.tokenize(document.text);
    const docLength = document.length || docTokens.length;

    // Calculate term frequencies
    const tf = new Map<string, number>();
    for (const token of docTokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    // Calculate BM25 score
    let score = 0;
    for (const qToken of queryTokens) {
      const termFreq = tf.get(qToken) || 0;
      const idfScore = this.idf.get(qToken) || 0;
      
      const numerator = termFreq * (BM25_K1 + 1);
      const denominator = termFreq + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / this.avgDocLength));
      
      score += idfScore * (numerator / denominator);
    }

    return score;
  }

  /**
   * Find keyword match positions for highlighting
   */
  findMatchPositions(query: string, text: string): number[] {
    const queryTokens = this.tokenize(query);
    const textTokens = this.tokenize(text);
    const positions: number[] = [];

    for (let i = 0; i < textTokens.length; i++) {
      if (queryTokens.includes(textTokens[i])) {
        positions.push(i);
      }
    }

    return positions;
  }
}

/**
 * Hybrid Search Engine
 */
export class HybridSearch {
  private bm25: BM25;
  private slidingWindow: SlidingWindow;
  private semanticWeight: number;
  private keywordWeight: number;

  constructor(
    documents: Document[],
    semanticWeight = 0.7,
    keywordWeight = 0.3
  ) {
    this.bm25 = new BM25(documents);
    this.slidingWindow = new SlidingWindow();
    this.semanticWeight = semanticWeight;
    this.keywordWeight = keywordWeight;
  }

  /**
   * Perform hybrid search
   */
  search(
    query: ProcessedQuery,
    documents: Document[],
    queryEmbedding: number[],
    options: {
      limit?: number;
      minScore?: number;
      useWindowing?: boolean;
      boostExactMatch?: boolean;
    } = {}
  ): SearchResult[] {
    const {
      limit = 10,
      minScore = 0.2,
      useWindowing = true,
      boostExactMatch = true
    } = options;

    // Calculate scores for each document
    const results: SearchResult[] = documents.map(doc => {
      // Semantic similarity score
      const semanticScore = this.cosineSimilarity(queryEmbedding, doc.embedding);

      // BM25 keyword score
      const keywordScore = this.bm25.score(query.normalized, doc);

      // Normalize scores to 0-1 range
      const normalizedKeywordScore = Math.min(keywordScore / 10, 1); // BM25 scores can be >1

      // Calculate hybrid score
      let hybridScore = (this.semanticWeight * semanticScore) + 
                       (this.keywordWeight * normalizedKeywordScore);

      // Apply boosts for exact matches
      if (boostExactMatch) {
        hybridScore = this.applyExactMatchBoost(query, doc, hybridScore);
      }

      // Find keyword positions for context windows
      const matchPositions = this.bm25.findMatchPositions(query.normalized, doc.text);

      return {
        ...doc,
        semanticScore,
        keywordScore: normalizedKeywordScore,
        hybridScore,
        highlights: useWindowing ? 
          this.slidingWindow.createContextWindows(doc.text, matchPositions) : 
          undefined
      };
    });

    // Filter and sort results
    return results
      .filter(r => r.hybridScore >= minScore)
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, limit);
  }

  /**
   * Apply boost for exact entity matches
   */
  private applyExactMatchBoost(
    query: ProcessedQuery, 
    doc: Document, 
    baseScore: number
  ): number {
    let boost = 1.0;

    // Boost for UN number matches
    if (query.entities.unNumbers.length > 0 && doc.metadata?.unNumber) {
      if (query.entities.unNumbers.includes(doc.metadata.unNumber)) {
        boost *= 1.5;
      }
    }

    // Boost for CAS number matches
    if (query.entities.casNumbers.length > 0 && doc.metadata?.casNumber) {
      if (query.entities.casNumbers.includes(doc.metadata.casNumber)) {
        boost *= 1.4;
      }
    }

    // Boost for CFR section matches
    if (query.entities.cfrSections.length > 0 && doc.metadata?.section) {
      if (query.entities.cfrSections.includes(doc.metadata.section)) {
        boost *= 1.3;
      }
    }

    // Boost for matching freight class
    if (query.entities.freightClasses.length > 0 && doc.metadata?.freightClass) {
      if (query.entities.freightClasses.includes(doc.metadata.freightClass)) {
        boost *= 1.3;
      }
    }

    // Boost for source relevance based on intent
    boost *= this.getSourceBoost(query.intent, doc.source);

    return Math.min(baseScore * boost, 1.0); // Cap at 1.0
  }

  /**
   * Get source-specific boost based on query intent
   */
  private getSourceBoost(intent: string, source: string): number {
    const boostMap: Record<string, Record<string, number>> = {
      'classification': {
        'hmt': 1.3,
        'products': 1.2,
        'cfr': 1.1,
        'erg': 0.9
      },
      'emergency_response': {
        'erg': 1.5,
        'cfr': 1.1,
        'hmt': 1.0,
        'products': 0.8
      },
      'shipping_requirements': {
        'cfr': 1.4,
        'hmt': 1.2,
        'products': 1.0,
        'erg': 0.8
      },
      'product_lookup': {
        'products': 1.5,
        'hmt': 1.1,
        'cfr': 0.9,
        'erg': 0.8
      }
    };

    return boostMap[intent]?.[source] || 1.0;
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Create optimized context for LLM
   */
  createContext(results: SearchResult[], maxTokens = 4000): string {
    const windows: string[] = [];
    let currentTokens = 0;
    const avgTokensPerChar = 0.25; // Approximate

    for (const result of results) {
      if (result.highlights && result.highlights.length > 0) {
        // Use highlighted context windows
        const merged = this.slidingWindow.mergeWindows(result.highlights);
        const estimatedTokens = merged.length * avgTokensPerChar;
        
        if (currentTokens + estimatedTokens <= maxTokens) {
          windows.push(`[${result.source}${result.metadata?.section ? ` §${result.metadata.section}` : ''}]\n${merged}`);
          currentTokens += estimatedTokens;
        }
      } else {
        // Use full text with truncation
        const truncated = result.text.substring(0, Math.floor((maxTokens - currentTokens) / avgTokensPerChar));
        windows.push(`[${result.source}]\n${truncated}`);
        currentTokens += truncated.length * avgTokensPerChar;
      }

      if (currentTokens >= maxTokens * 0.9) break; // Leave some buffer
    }

    return windows.join('\n\n---\n\n');
  }
}

export default HybridSearch;
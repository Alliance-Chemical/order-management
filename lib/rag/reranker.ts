/**
 * Re-ranking Layer for RAG System
 * Implements cross-encoder style re-ranking for better accuracy
 */

import { SearchResult } from './hybrid-search';
import { ProcessedQuery } from './query-processor';

export interface RerankedResult extends SearchResult {
  rerankerScore: number;
  finalScore: number;
  explanation?: string;
  relevanceFeatures?: Record<string, number>;
}

/**
 * Feature extraction for re-ranking
 */
export class FeatureExtractor {
  /**
   * Extract relevance features for a query-document pair
   */
  static extractFeatures(
    query: ProcessedQuery,
    result: SearchResult
  ): Record<string, number> {
    const features: Record<string, number> = {};
    const text = result.text.toLowerCase();
    const queryText = query.normalized;

    // Text overlap features
    features.exactMatch = text.includes(queryText) ? 1 : 0;
    features.wordOverlap = this.calculateWordOverlap(queryText, text);
    features.ngramOverlap = this.calculateNgramOverlap(queryText, text, 2);
    features.trigramOverlap = this.calculateNgramOverlap(queryText, text, 3);

    // Entity matching features
    features.unNumberMatch = this.entityMatchScore(
      query.entities.unNumbers,
      result.metadata?.unNumber ? [result.metadata.unNumber] : []
    );
    features.casNumberMatch = this.entityMatchScore(
      query.entities.casNumbers,
      result.metadata?.casNumber ? [result.metadata.casNumber] : []
    );
    features.hazardClassMatch = this.entityMatchScore(
      query.entities.hazardClasses,
      result.metadata?.hazardClass ? [result.metadata.hazardClass] : []
    );
    features.packingGroupMatch = this.entityMatchScore(
      query.entities.packingGroups,
      result.metadata?.packingGroup ? [result.metadata.packingGroup] : []
    );

    // Source-specific features
    features.sourceRelevance = this.getSourceRelevance(query.intent, result.source);
    features.isRegulation = result.source === 'cfr' ? 1 : 0;
    features.isHazmatTable = result.source === 'hmt' ? 1 : 0;
    features.isEmergencyGuide = result.source === 'erg' ? 1 : 0;
    features.isProduct = result.source === 'products' ? 1 : 0;

    // Metadata quality features
    features.hasMetadata = result.metadata ? 1 : 0;
    features.metadataCompleteness = this.calculateMetadataCompleteness(result.metadata);

    // Query intent alignment
    features.intentAlignment = this.calculateIntentAlignment(query, result);

    // Length and position features
    features.documentLength = Math.min(text.length / 1000, 1); // Normalized
    features.queryTermDensity = this.calculateTermDensity(query.keywords, text);
    features.queryTermProximity = this.calculateTermProximity(query.keywords, text);

    // Semantic features (from hybrid search)
    features.semanticScore = result.semanticScore;
    features.keywordScore = result.keywordScore;
    features.hybridScore = result.hybridScore;

    // Chemical-specific features
    if (query.context?.needsHazmatData) {
      features.hasHazmatInfo = this.hasHazmatIndicators(text) ? 1 : 0;
      features.hasEmergencyInfo = this.hasEmergencyIndicators(text) ? 1 : 0;
    }

    // Freight-specific features
    if (query.context?.isFreightBooking) {
      features.hasFreightClass = result.metadata?.freightClass ? 1 : 0;
      features.hasNMFCCode = result.metadata?.nmfcCode ? 1 : 0;
      features.hasShippingInfo = this.hasShippingIndicators(text) ? 1 : 0;
    }

    return features;
  }

  private static calculateWordOverlap(query: string, text: string): number {
    const queryWords = new Set(query.split(/\s+/));
    const textWords = new Set(text.split(/\s+/));
    let overlap = 0;

    for (const word of queryWords) {
      if (textWords.has(word)) overlap++;
    }

    return queryWords.size > 0 ? overlap / queryWords.size : 0;
  }

  private static calculateNgramOverlap(query: string, text: string, n: number): number {
    const queryNgrams = this.getNgrams(query, n);
    const textNgrams = this.getNgrams(text, n);
    let overlap = 0;

    for (const ngram of queryNgrams) {
      if (textNgrams.has(ngram)) overlap++;
    }

    return queryNgrams.size > 0 ? overlap / queryNgrams.size : 0;
  }

  private static getNgrams(text: string, n: number): Set<string> {
    const words = text.split(/\s+/);
    const ngrams = new Set<string>();

    for (let i = 0; i <= words.length - n; i++) {
      ngrams.add(words.slice(i, i + n).join(' '));
    }

    return ngrams;
  }

  private static entityMatchScore(queryEntities: string[], docEntities: string[]): number {
    if (queryEntities.length === 0) return 0;
    let matches = 0;

    for (const entity of queryEntities) {
      if (docEntities.includes(entity)) matches++;
    }

    return matches / queryEntities.length;
  }

  private static getSourceRelevance(intent: string, source: string): number {
    const relevanceMap: Record<string, Record<string, number>> = {
      'classification': { 'hmt': 1.0, 'products': 0.8, 'cfr': 0.7, 'erg': 0.3 },
      'emergency_response': { 'erg': 1.0, 'cfr': 0.6, 'hmt': 0.5, 'products': 0.3 },
      'shipping_requirements': { 'cfr': 1.0, 'hmt': 0.8, 'products': 0.5, 'erg': 0.3 },
      'packaging': { 'cfr': 1.0, 'hmt': 0.7, 'products': 0.5, 'erg': 0.2 },
      'documentation': { 'cfr': 1.0, 'hmt': 0.6, 'products': 0.4, 'erg': 0.2 },
      'compliance': { 'cfr': 1.0, 'hmt': 0.7, 'products': 0.4, 'erg': 0.3 },
      'product_lookup': { 'products': 1.0, 'hmt': 0.7, 'cfr': 0.4, 'erg': 0.3 },
      'general': { 'cfr': 0.6, 'hmt': 0.6, 'products': 0.6, 'erg': 0.6 }
    };

    return relevanceMap[intent]?.[source] || 0.5;
  }

  private static calculateMetadataCompleteness(metadata: any): number {
    if (!metadata) return 0;
    
    const importantFields = [
      'unNumber', 'casNumber', 'hazardClass', 'packingGroup',
      'section', 'nmfcCode', 'freightClass', 'name'
    ];
    
    let present = 0;
    for (const field of importantFields) {
      if (metadata[field]) present++;
    }
    
    return present / importantFields.length;
  }

  private static calculateIntentAlignment(query: ProcessedQuery, result: SearchResult): number {
    const text = result.text.toLowerCase();
    
    switch (query.intent) {
      case 'emergency_response':
        return this.hasEmergencyIndicators(text) ? 1.0 : 0.3;
      case 'shipping_requirements':
        return this.hasShippingIndicators(text) ? 1.0 : 0.3;
      case 'classification':
        return this.hasClassificationIndicators(text) ? 1.0 : 0.3;
      default:
        return 0.5;
    }
  }

  private static calculateTermDensity(keywords: string[], text: string): number {
    const textWords = text.toLowerCase().split(/\s+/);
    let occurrences = 0;

    for (const keyword of keywords) {
      occurrences += textWords.filter(w => w === keyword.toLowerCase()).length;
    }

    return Math.min(occurrences / textWords.length, 1);
  }

  private static calculateTermProximity(keywords: string[], text: string): number {
    if (keywords.length < 2) return 0;
    
    const textWords = text.toLowerCase().split(/\s+/);
    const positions: Record<string, number[]> = {};

    // Find positions of each keyword
    for (const keyword of keywords) {
      positions[keyword] = [];
      textWords.forEach((word, idx) => {
        if (word === keyword.toLowerCase()) {
          positions[keyword].push(idx);
        }
      });
    }

    // Calculate minimum distance between any two different keywords
    let minDistance = textWords.length;
    const keywordList = Object.keys(positions);

    for (let i = 0; i < keywordList.length - 1; i++) {
      for (let j = i + 1; j < keywordList.length; j++) {
        for (const pos1 of positions[keywordList[i]]) {
          for (const pos2 of positions[keywordList[j]]) {
            minDistance = Math.min(minDistance, Math.abs(pos1 - pos2));
          }
        }
      }
    }

    // Normalize: closer = higher score
    return minDistance === textWords.length ? 0 : 1 - (minDistance / textWords.length);
  }

  private static hasHazmatIndicators(text: string): boolean {
    const indicators = [
      'hazard', 'dangerous', 'class', 'division', 'packing group',
      'un number', 'proper shipping name', 'hazmat', 'subsidiary risk'
    ];
    return indicators.some(ind => text.includes(ind));
  }

  private static hasEmergencyIndicators(text: string): boolean {
    const indicators = [
      'emergency', 'spill', 'leak', 'fire', 'explosion', 'evacuate',
      'first aid', 'response', 'cleanup', 'contain', 'neutralize'
    ];
    return indicators.some(ind => text.includes(ind));
  }

  private static hasShippingIndicators(text: string): boolean {
    const indicators = [
      'ship', 'transport', 'freight', 'carrier', 'package', 'label',
      'placard', 'manifest', 'documentation', 'consignment'
    ];
    return indicators.some(ind => text.includes(ind));
  }

  private static hasClassificationIndicators(text: string): boolean {
    const indicators = [
      'classify', 'classification', 'hazard class', 'packing group',
      'nmfc', 'freight class', 'commodity', 'identification'
    ];
    return indicators.some(ind => text.includes(ind));
  }
}

/**
 * Neural Re-ranker (simulated with weighted features)
 */
export class Reranker {
  private featureWeights: Record<string, number>;

  constructor(featureWeights?: Record<string, number>) {
    // Default weights (would be learned in a real ML model)
    this.featureWeights = featureWeights || {
      exactMatch: 2.0,
      wordOverlap: 1.5,
      ngramOverlap: 1.2,
      trigramOverlap: 1.1,
      unNumberMatch: 3.0,
      casNumberMatch: 2.5,
      hazardClassMatch: 2.0,
      packingGroupMatch: 1.8,
      sourceRelevance: 1.5,
      isRegulation: 1.2,
      isHazmatTable: 1.3,
      isEmergencyGuide: 1.1,
      isProduct: 1.0,
      hasMetadata: 1.1,
      metadataCompleteness: 1.3,
      intentAlignment: 1.8,
      documentLength: 0.5,
      queryTermDensity: 1.4,
      queryTermProximity: 1.6,
      semanticScore: 1.5,
      keywordScore: 1.3,
      hybridScore: 1.4,
      hasHazmatInfo: 1.2,
      hasEmergencyInfo: 1.2,
      hasFreightClass: 1.3,
      hasNMFCCode: 1.3,
      hasShippingInfo: 1.1
    };
  }

  /**
   * Re-rank search results
   */
  rerank(
    query: ProcessedQuery,
    results: SearchResult[],
    options: {
      topK?: number;
      threshold?: number;
      explainScores?: boolean;
    } = {}
  ): RerankedResult[] {
    const {
      topK = 10,
      threshold = 0.3,
      explainScores = false
    } = options;

    // Extract features and calculate scores for each result
    const rerankedResults: RerankedResult[] = results.map(result => {
      const features = FeatureExtractor.extractFeatures(query, result);
      const rerankerScore = this.calculateScore(features);
      
      // Combine with original score
      const finalScore = (rerankerScore * 0.6) + (result.hybridScore * 0.4);

      return {
        ...result,
        rerankerScore,
        finalScore,
        relevanceFeatures: explainScores ? features : undefined,
        explanation: explainScores ? this.explainScore(features) : undefined
      };
    });

    // Sort by final score and filter
    return rerankedResults
      .filter(r => r.finalScore >= threshold)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, topK);
  }

  /**
   * Calculate weighted score from features
   */
  private calculateScore(features: Record<string, number>): number {
    let score = 0;
    let totalWeight = 0;

    for (const [feature, value] of Object.entries(features)) {
      const weight = this.featureWeights[feature] || 0;
      score += value * weight;
      totalWeight += weight;
    }

    // Normalize to 0-1 range
    return totalWeight > 0 ? Math.min(score / totalWeight, 1) : 0;
  }

  /**
   * Generate explanation for the score
   */
  private explainScore(features: Record<string, number>): string {
    const importantFeatures: Array<[string, number]> = [];

    for (const [feature, value] of Object.entries(features)) {
      const weight = this.featureWeights[feature] || 0;
      const contribution = value * weight;
      if (contribution > 0.1) {
        importantFeatures.push([feature, contribution]);
      }
    }

    importantFeatures.sort((a, b) => b[1] - a[1]);

    const topFeatures = importantFeatures.slice(0, 5);
    return `Top factors: ${topFeatures
      .map(([f, c]) => `${f}(${c.toFixed(2)})`)
      .join(', ')}`;
  }

  /**
   * Adaptive re-ranking based on user feedback
   */
  adaptWeights(
    query: ProcessedQuery,
    clickedResult: RerankedResult,
    notClickedResults: RerankedResult[],
    learningRate = 0.1
  ) {
    // Extract features for clicked result
    const clickedFeatures = FeatureExtractor.extractFeatures(query, clickedResult);

    // Calculate average features for non-clicked results
    const avgNonClickedFeatures: Record<string, number> = {};
    for (const result of notClickedResults) {
      const features = FeatureExtractor.extractFeatures(query, result);
      for (const [key, value] of Object.entries(features)) {
        avgNonClickedFeatures[key] = (avgNonClickedFeatures[key] || 0) + value / notClickedResults.length;
      }
    }

    // Update weights based on difference
    for (const feature in this.featureWeights) {
      const clickedValue = clickedFeatures[feature] || 0;
      const avgNonClickedValue = avgNonClickedFeatures[feature] || 0;
      const diff = clickedValue - avgNonClickedValue;
      
      // Increase weight for features that distinguish clicked from non-clicked
      this.featureWeights[feature] += learningRate * diff;
      
      // Keep weights positive
      this.featureWeights[feature] = Math.max(0, this.featureWeights[feature]);
    }
  }
}

export default Reranker;
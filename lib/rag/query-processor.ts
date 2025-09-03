/**
 * Advanced Query Processor for RAG System
 * Handles entity extraction, query expansion, and intent detection
 */

// Entity extraction patterns
const ENTITY_PATTERNS = {
  unNumber: /\bUN\s*(\d{4})\b/gi,
  casNumber: /\b(\d{1,7}-\d{2}-\d)\b/g,
  packingGroup: /\bpacking\s+group\s+(I{1,3})\b/gi,
  hazardClass: /\b(class|division)\s+([1-9](?:\.\d)?)\b/gi,
  nmfcCode: /\bNMFC\s*(\d{5,6})\b/gi,
  freightClass: /\bclass\s+(50|55|60|65|70|77\.5|85|92\.5|100|110|125|150|175|200|250|300|400|500)\b/gi,
  ergGuide: /\bguide\s+(\d{3})\b/gi,
  cfr49: /\b(?:49\s+CFR\s+)?(?:§\s*)?(\d{3}\.\d+)\b/gi,
  chemicalName: /\b(acid|hydroxide|chloride|sulfate|nitrate|oxide|peroxide|carbonate|phosphate)\b/gi,
  quantity: /\b(\d+(?:\.\d+)?)\s*(kg|g|mg|lb|oz|L|mL|gal)\b/gi,
  temperature: /\b(-?\d+(?:\.\d+)?)\s*°?\s*([CF])\b/gi,
  percentage: /\b(\d+(?:\.\d+)?)\s*%/gi
};

// Domain-specific synonyms and expansions
const QUERY_EXPANSIONS = {
  // Chemical synonyms
  'sulfuric acid': ['H2SO4', 'oil of vitriol', 'battery acid', 'UN1830'],
  'hydrochloric acid': ['HCl', 'muriatic acid', 'UN1789'],
  'sodium hydroxide': ['NaOH', 'caustic soda', 'lye', 'UN1823', 'UN1824'],
  'nitric acid': ['HNO3', 'aqua fortis', 'UN2031'],
  
  // Shipping terms
  'shipping': ['transportation', 'transport', 'freight', 'shipment'],
  'requirements': ['regulations', 'rules', 'requirements', 'compliance'],
  'emergency': ['spill', 'accident', 'incident', 'response', 'ERG'],
  'classification': ['class', 'category', 'hazard class', 'division'],
  'packaging': ['packing', 'container', 'package', 'drum', 'tote', 'IBC'],
  
  // Regulatory terms
  'DOT': ['Department of Transportation', '49 CFR', 'HMR'],
  'hazmat': ['hazardous material', 'dangerous goods', 'DG'],
  'placard': ['label', 'marking', 'sign', 'placard'],
  'manifest': ['shipping paper', 'BOL', 'bill of lading'],
  
  // Modal terms
  'highway': ['road', 'truck', 'motor carrier', 'Part 177'],
  'rail': ['train', 'railroad', 'Part 174'],
  'air': ['aircraft', 'aviation', 'IATA', 'Part 175'],
  'vessel': ['ship', 'marine', 'water', 'Part 176']
};

// Query intent categories
export enum QueryIntent {
  CLASSIFICATION = 'classification',
  EMERGENCY_RESPONSE = 'emergency_response',
  SHIPPING_REQUIREMENTS = 'shipping_requirements',
  PACKAGING = 'packaging',
  DOCUMENTATION = 'documentation',
  COMPLIANCE = 'compliance',
  PRODUCT_LOOKUP = 'product_lookup',
  GENERAL = 'general'
}

// Intent detection patterns
const INTENT_PATTERNS = {
  [QueryIntent.CLASSIFICATION]: /\b(classify|classification|class|hazard|category|nmfc|freight class)\b/i,
  [QueryIntent.EMERGENCY_RESPONSE]: /\b(emergency|spill|leak|accident|response|erg|guide|cleanup|contain)\b/i,
  [QueryIntent.SHIPPING_REQUIREMENTS]: /\b(ship|transport|requirements|regulations|rules|allowed|prohibited)\b/i,
  [QueryIntent.PACKAGING]: /\b(package|packing|container|drum|tote|ibc|bulk|non-bulk)\b/i,
  [QueryIntent.DOCUMENTATION]: /\b(document|paper|manifest|bol|label|placard|marking|declaration)\b/i,
  [QueryIntent.COMPLIANCE]: /\b(comply|compliance|violation|requirement|regulation|legal|dot|cfr)\b/i,
  [QueryIntent.PRODUCT_LOOKUP]: /\b(product|sku|cas|un\d{4}|lookup|find|search)\b/i
};

export interface ExtractedEntities {
  unNumbers: string[];
  casNumbers: string[];
  packingGroups: string[];
  hazardClasses: string[];
  nmfcCodes: string[];
  freightClasses: string[];
  ergGuides: string[];
  cfrSections: string[];
  chemicals: string[];
  quantities: Array<{ value: number; unit: string }>;
  temperatures: Array<{ value: number; unit: string }>;
  percentages: number[];
  [key: string]: any;
}

export interface ProcessedQuery {
  original: string;
  normalized: string;
  entities: ExtractedEntities;
  intent: QueryIntent;
  expandedTerms: string[];
  keywords: string[];
  isStructured: boolean;
  confidence: number;
  context: {
    isFreightBooking?: boolean;
    needsHazmatData?: boolean;
    requiresClassification?: boolean;
    needsEmergencyInfo?: boolean;
  };
}

export class QueryProcessor {
  /**
   * Extract entities from query text
   */
  static extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {
      unNumbers: [],
      casNumbers: [],
      packingGroups: [],
      hazardClasses: [],
      nmfcCodes: [],
      freightClasses: [],
      ergGuides: [],
      cfrSections: [],
      chemicals: [],
      quantities: [],
      temperatures: [],
      percentages: []
    };

    // Extract UN numbers
    const unMatches = query.matchAll(ENTITY_PATTERNS.unNumber);
    for (const match of unMatches) {
      entities.unNumbers.push(`UN${match[1]}`);
    }

    // Extract CAS numbers
    const casMatches = query.matchAll(ENTITY_PATTERNS.casNumber);
    for (const match of casMatches) {
      entities.casNumbers.push(match[1]);
    }

    // Extract packing groups
    const pgMatches = query.matchAll(ENTITY_PATTERNS.packingGroup);
    for (const match of pgMatches) {
      entities.packingGroups.push(match[1].toUpperCase());
    }

    // Extract hazard classes
    const hcMatches = query.matchAll(ENTITY_PATTERNS.hazardClass);
    for (const match of hcMatches) {
      entities.hazardClasses.push(match[2]);
    }

    // Extract NMFC codes
    const nmfcMatches = query.matchAll(ENTITY_PATTERNS.nmfcCode);
    for (const match of nmfcMatches) {
      entities.nmfcCodes.push(match[1]);
    }

    // Extract freight classes
    const fcMatches = query.matchAll(ENTITY_PATTERNS.freightClass);
    for (const match of fcMatches) {
      entities.freightClasses.push(match[1]);
    }

    // Extract ERG guides
    const ergMatches = query.matchAll(ENTITY_PATTERNS.ergGuide);
    for (const match of ergMatches) {
      entities.ergGuides.push(match[1]);
    }

    // Extract CFR sections
    const cfrMatches = query.matchAll(ENTITY_PATTERNS.cfr49);
    for (const match of cfrMatches) {
      entities.cfrSections.push(match[1]);
    }

    // Extract chemical names
    const chemMatches = query.matchAll(ENTITY_PATTERNS.chemicalName);
    for (const match of chemMatches) {
      entities.chemicals.push(match[1].toLowerCase());
    }

    // Extract quantities
    const qtyMatches = query.matchAll(ENTITY_PATTERNS.quantity);
    for (const match of qtyMatches) {
      entities.quantities.push({
        value: parseFloat(match[1]),
        unit: match[2]
      });
    }

    // Extract temperatures
    const tempMatches = query.matchAll(ENTITY_PATTERNS.temperature);
    for (const match of tempMatches) {
      entities.temperatures.push({
        value: parseFloat(match[1]),
        unit: match[2]
      });
    }

    // Extract percentages
    const pctMatches = query.matchAll(ENTITY_PATTERNS.percentage);
    for (const match of pctMatches) {
      entities.percentages.push(parseFloat(match[1]));
    }

    return entities;
  }

  /**
   * Detect query intent
   */
  static detectIntent(query: string): QueryIntent {
    const lowerQuery = query.toLowerCase();
    let bestIntent = QueryIntent.GENERAL;
    let maxScore = 0;

    for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
      const matches = lowerQuery.match(pattern);
      if (matches && matches.length > maxScore) {
        maxScore = matches.length;
        bestIntent = intent as QueryIntent;
      }
    }

    return bestIntent;
  }

  /**
   * Expand query with synonyms and related terms
   */
  static expandQuery(query: string): string[] {
    const expanded = new Set<string>();
    const lowerQuery = query.toLowerCase();

    // Add original query
    expanded.add(query);

    // Check each expansion rule
    for (const [term, synonyms] of Object.entries(QUERY_EXPANSIONS)) {
      if (lowerQuery.includes(term.toLowerCase())) {
        synonyms.forEach(syn => expanded.add(syn));
      }
    }

    // Add individual words as keywords
    const words = query.split(/\s+/).filter(w => w.length > 2);
    words.forEach(word => expanded.add(word));

    return Array.from(expanded);
  }

  /**
   * Normalize query text
   */
  static normalize(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s\d-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if query is structured (contains specific entities)
   */
  static isStructuredQuery(entities: ExtractedEntities): boolean {
    return (
      entities.unNumbers.length > 0 ||
      entities.casNumbers.length > 0 ||
      entities.nmfcCodes.length > 0 ||
      entities.cfrSections.length > 0
    );
  }

  /**
   * Process a query comprehensively
   */
  static process(query: string, context?: any): ProcessedQuery {
    const entities = this.extractEntities(query);
    const intent = this.detectIntent(query);
    const expandedTerms = this.expandQuery(query);
    const normalized = this.normalize(query);
    const isStructured = this.isStructuredQuery(entities);

    // Calculate confidence based on entity extraction and intent clarity
    let confidence = 0.5;
    if (isStructured) confidence += 0.3;
    if (intent !== QueryIntent.GENERAL) confidence += 0.2;

    // Determine context flags for freight booking integration
    const processedContext = {
      isFreightBooking: intent === QueryIntent.CLASSIFICATION || 
                        entities.nmfcCodes.length > 0 ||
                        entities.freightClasses.length > 0,
      needsHazmatData: entities.unNumbers.length > 0 || 
                       entities.hazardClasses.length > 0 ||
                       query.toLowerCase().includes('hazmat'),
      requiresClassification: intent === QueryIntent.CLASSIFICATION ||
                             entities.chemicals.length > 0,
      needsEmergencyInfo: intent === QueryIntent.EMERGENCY_RESPONSE ||
                         entities.ergGuides.length > 0,
      ...context
    };

    // Extract keywords (non-stopwords)
    const stopwords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by']);
    const keywords = normalized
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopwords.has(word));

    return {
      original: query,
      normalized,
      entities,
      intent,
      expandedTerms,
      keywords,
      isStructured,
      confidence,
      context: processedContext
    };
  }

  /**
   * Generate a search-optimized query for RAG
   */
  static generateSearchQuery(processed: ProcessedQuery): string {
    const parts: string[] = [];

    // Add UN numbers with high priority
    if (processed.entities.unNumbers.length > 0) {
      parts.push(processed.entities.unNumbers.join(' '));
    }

    // Add chemical names
    if (processed.entities.chemicals.length > 0) {
      parts.push(processed.entities.chemicals.join(' '));
    }

    // Add intent-specific terms
    switch (processed.intent) {
      case QueryIntent.EMERGENCY_RESPONSE:
        parts.push('emergency response guide ERG spill cleanup');
        break;
      case QueryIntent.SHIPPING_REQUIREMENTS:
        parts.push('shipping requirements transportation regulations');
        break;
      case QueryIntent.CLASSIFICATION:
        parts.push('classification hazard class packing group');
        break;
      case QueryIntent.PACKAGING:
        parts.push('packaging requirements container specifications');
        break;
    }

    // Add key terms from original query
    parts.push(...processed.keywords.slice(0, 5));

    return parts.join(' ');
  }
}

// Export for use in freight booking and RAG search
export default QueryProcessor;
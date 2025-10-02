import { getEdgeSql } from "@/lib/db/neon-edge";
import { openaiEmbedding, openaiChat } from '@/lib/services/ai/openai-service'

export interface FreightDecisionContext {
  orderId: string;
  items: Array<{
    sku: string;
    quantity: number;
    description?: string;
  }>;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  destination: {
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  origin: {
    city: string;
    state: string;
    zip: string;
  };
  requestedDate?: Date;
  specialRequirements?: string[];
}

export interface FreightDecision {
  recommendation: {
    containers: FreightContainerRecommendation[];
    carrier: string;
    carrierService: string;
    accessorials: string[];
    estimatedCost: number;
    estimatedTransitDays: number;
    addressType: FreightAddressType;
  };
  confidence: number;
  reasoning: string;
  similarShipments: Array<{
    referenceId: string;
    similarity: number;
    outcome: string;
  }>;
  alternatives?: AlternativeRecommendation[];
}

type FreightAddressType = "Business" | "Residential" | "Limited Access";

interface FreightContainerRecommendation {
  type: string;
  count: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  estimatedWeight: number;
}

interface HistoricalShipmentContainer {
  type?: string | null;
  count?: number | null;
  dimensions?: {
    length?: number | null;
    width?: number | null;
    height?: number | null;
  } | null;
  weight?: number | null;
}

interface HistoricalShipment {
  reference_id: string;
  similarity?: number;
  carrier: string;
  actual_cost: number;
  transit_days: number;
  on_time_delivery?: boolean;
  accessorials?: Record<string, boolean> | null;
  containers?: HistoricalShipmentContainer[] | null;
  destination_state?: string;
  origin_state?: string;
  destination_city?: string;
  origin_city?: string;
  customer_name?: string;
}

interface ContainerPattern {
  count: number;
  dimensions: Array<HistoricalShipmentContainer["dimensions"]>;
  weights: number[];
  avgDimensions: {
    length: number;
    width: number;
    height: number;
  };
  avgWeight: number;
}

type ContainerPatternMap = Record<string, ContainerPattern>;

interface ShipmentPatterns {
  carrierCounts: Record<string, number>;
  mostCommonCarrier: string;
  carrierUsageRate: number;
  avgCost: number;
  minCost: number;
  maxCost: number;
  avgTransitDays: number;
  commonAccessorials: string[];
  containerPatterns: ContainerPatternMap;
  successRate: number;
  dataPoints: number;
}

interface ConfidenceFactors {
  dataSufficiency?: "high" | "medium" | "low";
  patternStrength?: "high" | "medium" | "low";
  riskFactors?: string[];
}

type AlternativeRecommendation = Record<string, unknown> & {
  type: string;
  reasoning: string;
  estimatedCost?: number;
};

interface AIRecommendation {
  containers?: FreightContainerRecommendation[];
  carrier?: string;
  carrierService?: string;
  accessorials?: string[];
  estimatedCost?: number;
  estimatedTransitDays?: number;
  addressType?: FreightAddressType;
  reasoning?: string;
  confidenceFactors?: ConfidenceFactors;
}

export class FreightDecisionEngineV2 {
  private embeddingCache = new Map<string, number[]>();

  // Generate embedding using Google's best model
  async generateContextEmbedding(
    context: FreightDecisionContext,
  ): Promise<number[]> {
    const contextText = this.createContextText(context);

    // Check cache first
    if (this.embeddingCache.has(contextText)) {
      return this.embeddingCache.get(contextText)!;
    }

    try {
      const embedding = await openaiEmbedding(contextText)
      this.embeddingCache.set(contextText, embedding)
      return embedding
    } catch (error) {
      console.error("OpenAI embedding failed, trying fallback:", error)
      return this.fallbackEmbedding(contextText)
    }
  }

  // Fallback embedding options
  private async fallbackEmbedding(text: string): Promise<number[]> {
    // Option 1: Try Voyage AI (best on MTEB leaderboard)
    if (process.env.VOYAGE_API_KEY) {
      try {
        const response = await fetch("https://api.voyageai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: text,
            model: "voyage-large-2", // Best performing model
          }),
        });

        const data = await response.json();
        return data.data[0].embedding;
      } catch (error) {
        console.error("Voyage AI fallback failed:", error);
      }
    }

    // Option 2: Try Cohere
    if (process.env.COHERE_API_KEY) {
      try {
        const response = await fetch("https://api.cohere.ai/v1/embed", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            texts: [text],
            model: "embed-english-v3.0",
            input_type: "search_document",
          }),
        });

        const data = await response.json();
        return data.embeddings[0];
      } catch (error) {
        console.error("Cohere fallback failed:", error);
      }
    }

    // Final fallback: Use a hash-based approach (not ideal but keeps system running)
    return this.hashBasedEmbedding(text, 1536);
  }

  // Simple hash-based embedding as last resort
  private hashBasedEmbedding(text: string, dimensions: number): number[] {
    const embedding = new Array(dimensions).fill(0);

    // Create a deterministic embedding based on text content
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = (charCode * (i + 1)) % dimensions;
      embedding[index] = (embedding[index] + charCode / 255) / 2;
    }

    // Normalize
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    return embedding.map((val) => val / magnitude);
  }

  // Create optimized text representation for embedding
  private createContextText(context: FreightDecisionContext): string {
    // Structure the text to maximize embedding quality
    const parts = [
      // Route is most important for similarity
      `Route: ${context.origin.city} ${context.origin.state} to ${context.destination.city} ${context.destination.state}`,

      // SKUs and quantities
      `Products: ${context.items.map((i) => `${i.quantity} ${i.sku} ${i.description || ""}`).join(", ")}`,

      // Customer info for pattern matching
      `Customer: ${context.customer.id} ${context.customer.name}`,

      // Address details for accessorial determination
      `Delivery: ${context.destination.address} ${context.destination.zip}`,

      // Total quantity for size estimation
      `Total items: ${context.items.reduce((sum, i) => sum + i.quantity, 0)}`,
    ];

    if (context.specialRequirements?.length) {
      parts.push(`Special: ${context.specialRequirements.join(" ")}`);
    }

    return parts.join(" | ");
  }

  // Find similar shipments using vector search
  async findSimilarShipments(
    context: FreightDecisionContext,
    limit: number = 10,
  ): Promise<HistoricalShipment[]> {
    // Check if database is available
    if (!process.env.ANDRE_DATABASE_URL) {
      console.warn("Database not available, returning mock data for build");
      return [];
    }

    try {
      const contextEmbedding = await this.generateContextEmbedding(context);
      
      // Format embedding as PostgreSQL array string
      const embeddingString = `[${contextEmbedding.join(',')}]`;

      // Use pgvector for similarity search with OpenAI's 1536-dimension embeddings
      const sql = getEdgeSql();
      const results = await sql`
        WITH semantic_search AS (
          SELECT 
            *,
            1 - (embedding <=> ${embeddingString}::vector(1536)) as similarity
          FROM mycarrier_historical_shipments
          WHERE 
            -- Pre-filter for efficiency
            destination_state = ${context.destination.state}
            AND origin_state = ${context.origin.state}
          ORDER BY embedding <=> ${embeddingString}::vector(1536)
          LIMIT ${limit * 2}
        )
        SELECT * FROM semantic_search
        WHERE similarity > 0.7  -- Only return highly similar results
        ORDER BY similarity DESC
        LIMIT ${limit}
      ` as HistoricalShipment[];
      return results ?? [];
    } catch (error) {
      console.error("Vector search failed, falling back to keyword search:", error);
      return this.keywordOnlySearch(context, limit);
    }
  }

  // Keyword-only search fallback when vector search fails
  private async keywordOnlySearch(
    context: FreightDecisionContext,
    limit: number,
  ): Promise<HistoricalShipment[]> {
    // Check if database is available
    if (!process.env.DATABASE_URL) {
      return [];
    }

    try {
      // Simple keyword-based search without vector operations
      const sql = getEdgeSql();
      const results = await sql`
        SELECT * 
        FROM mycarrier_historical_shipments
        WHERE 
          destination_state = ${context.destination.state}
          AND origin_state = ${context.origin.state}
          AND (
            destination_city ILIKE ${`%${context.destination.city}%`}
            OR customer_name ILIKE ${`%${context.customer.name}%`}
            OR searchable_text ILIKE ${`%${context.items[0]?.sku || ""}%`}
          )
        ORDER BY order_date DESC
        LIMIT ${limit}
      ` as HistoricalShipment[];
      return results ?? [];
    } catch (error) {
      console.error("Keyword search also failed:", error);
      return [];
    }
  }

  // Hybrid search combining vector and keyword search
  private async hybridSearch(
    context: FreightDecisionContext,
    embedding: number[],
    limit: number,
  ): Promise<HistoricalShipment[]> {
    // Check if database is available
    if (!process.env.DATABASE_URL) {
      return [];
    }

    try {
      // Format embedding as PostgreSQL array string
      const embeddingString = `[${embedding.join(',')}]`;

      // Combine semantic and keyword search for best results
      const sql = getEdgeSql();
      const results = await sql`
        WITH keyword_matches AS (
          SELECT *, 
                 0.5 as keyword_score  -- Base score for keyword matches
          FROM mycarrier_historical_shipments
          WHERE 
            destination_state = ${context.destination.state}
            AND origin_state = ${context.origin.state}
            AND (
              destination_city ILIKE ${`%${context.destination.city}%`}
              OR customer_name ILIKE ${`%${context.customer.name}%`}
              OR searchable_text ILIKE ${`%${context.items[0]?.sku || ""}%`}
            )
          LIMIT 50
        ),
        semantic_matches AS (
          SELECT *,
                 1 - (embedding <=> ${embeddingString}::vector(1536)) as semantic_score
          FROM mycarrier_historical_shipments
          WHERE 
            destination_state = ${context.destination.state}
            AND origin_state = ${context.origin.state}
          ORDER BY embedding <=> ${embeddingString}::vector(1536)
          LIMIT 50
        ),
        combined AS (
          SELECT DISTINCT ON (reference_id) *,
                 COALESCE(km.keyword_score, 0) * 0.3 + 
                 COALESCE(sm.semantic_score, 0) * 0.7 as combined_score
          FROM keyword_matches km
          FULL OUTER JOIN semantic_matches sm USING (reference_id)
        )
        SELECT * FROM combined
        ORDER BY combined_score DESC
        LIMIT ${limit}
      ` as HistoricalShipment[];
      return results ?? [];
    } catch (error) {
      console.error("Hybrid search failed, falling back to keyword only:", error);
      return this.keywordOnlySearch(context, limit);
    }
  }

  // Generate decision using OpenAI with RAG context
  async makeDecision(
    context: FreightDecisionContext,
  ): Promise<FreightDecision> {
    try {
      // Step 1: Find similar historical shipments
      const similarShipments = await this.findSimilarShipments(context, 20);

      // Step 2: Analyze patterns
      const patterns = this.analyzePatterns(similarShipments);

      // Step 3: Generate decision with OpenAI
      const decision = await this.generateDecisionWithAI(
        context,
        similarShipments,
        patterns,
      );

      return decision;
    } catch (error) {
      console.error("Error in makeDecision, returning fallback:", error);
      
      // Return a safe fallback decision
      return this.fallbackDecision(
        context,
        this.getDefaultPatterns(),
        []
      );
    }
  }

  // Use OpenAI for decision generation
  private async generateDecisionWithAI(
    context: FreightDecisionContext,
    similarShipments: HistoricalShipment[],
    patterns: ShipmentPatterns,
  ): Promise<FreightDecision> {
    const prompt = `
You are a freight booking expert. Analyze the historical shipping data and recommend optimal freight configuration.

CURRENT ORDER:
${JSON.stringify(context, null, 2)}

HISTORICAL PATTERNS (${similarShipments.length} similar shipments):
- Most common carrier: ${patterns.mostCommonCarrier} (used ${patterns.carrierUsageRate}% of time)
- Average cost: $${patterns.avgCost.toFixed(2)}
- Cost range: $${patterns.minCost} - $${patterns.maxCost}
- Average transit: ${patterns.avgTransitDays.toFixed(1)} days
- On-time rate: ${(patterns.successRate * 100).toFixed(1)}%
- Common accessorials: ${patterns.commonAccessorials.join(", ") || "None"}

TOP 5 MOST SIMILAR SHIPMENTS:
${similarShipments
  .slice(0, 5)
  .map(
    (s, i) => `
${i + 1}. Reference: ${s.reference_id} (${((s.similarity ?? 0.85) * 100).toFixed(1)}% similar)
   Route: ${s.origin_city ?? "Unknown"}, ${s.origin_state ?? ""} → ${s.destination_city ?? "Unknown"}, ${s.destination_state ?? ""}
   Carrier: ${s.carrier} | Cost: $${s.actual_cost} | Transit: ${s.transit_days} days
   Containers: ${JSON.stringify(s.containers ?? [])}
   Performance: ${s.on_time_delivery ? "✓ On-time" : "✗ Delayed"}
`,
  )
  .join("\n")}

CONTAINER PATTERNS:
${Object.entries(patterns.containerPatterns)
  .map(
    ([type, data]) =>
      `- ${type}: Used ${data.count} times, Avg dims: ${data.avgDimensions.length}x${data.avgDimensions.width}x${data.avgDimensions.height}, Avg weight: ${data.avgWeight}lbs`,
  )
  .join("\n")}

Based on this data, provide your recommendation in JSON format with the following structure:
{
  "containers": [...],
  "carrier": "...",
  "carrierService": "...",
  "accessorials": [...],
  "estimatedCost": number,
  "estimatedTransitDays": number,
  "addressType": "Business|Residential|Limited Access",
  "reasoning": "Detailed explanation",
  "confidenceFactors": {
    "dataSufficiency": "high|medium|low",
    "patternStrength": "high|medium|low",
    "riskFactors": []
  }
}
`;

    try {
      const text = await openaiChat([
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }],
        },
      ], {
        maxTokens: 900,
      })

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("No JSON found in OpenAI response")
      }

      const aiDecision = JSON.parse(jsonMatch[0]) as AIRecommendation;

      return {
        recommendation: {
          containers:
            aiDecision.containers || this.getDefaultContainers(patterns),
          carrier: aiDecision.carrier || patterns.mostCommonCarrier,
          carrierService: aiDecision.carrierService || "Standard",
          accessorials:
            aiDecision.accessorials || patterns.commonAccessorials,
          estimatedCost: aiDecision.estimatedCost || patterns.avgCost,
          estimatedTransitDays:
            aiDecision.estimatedTransitDays || patterns.avgTransitDays,
          addressType: aiDecision.addressType || "Business",
        },
        confidence: this.calculateConfidence(
          similarShipments,
          patterns,
          aiDecision.confidenceFactors,
        ),
        reasoning:
          aiDecision.reasoning ||
          this.generateReasoning(patterns, similarShipments),
        similarShipments: similarShipments.slice(0, 5).map((s) => ({
          referenceId: s.reference_id,
          similarity: s.similarity || 0.85,
          outcome: s.on_time_delivery ? "successful" : "delayed",
        })),
        alternatives: this.generateAlternatives(patterns, aiDecision),
      };
    } catch (error) {
      console.error("OpenAI decision generation failed:", error);
      return this.fallbackDecision(context, patterns, similarShipments);
    }
  }

  // Enhanced pattern analysis
  private analyzePatterns(shipments: HistoricalShipment[]): ShipmentPatterns {
    if (shipments.length === 0) {
      return this.getDefaultPatterns();
    }

    // Carrier analysis with usage rate
    const carrierCounts = shipments.reduce(
      (acc, s) => {
        acc[s.carrier] = (acc[s.carrier] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const sortedCarriers = Object.entries(carrierCounts).sort(
      (a, b) => b[1] - a[1],
    );

    const mostCommonCarrier = sortedCarriers[0]?.[0] || "SAIA";
    const carrierUsageRate = (
      (sortedCarriers[0]?.[1] ?? 0) / shipments.length
    ) * 100;

    // Cost analysis with ranges
    const costs = shipments
      .map((s) => Number(s.actual_cost))
      .filter((c) => Number.isFinite(c) && c > 0);
    const avgCost =
      costs.reduce((sum, c) => sum + c, 0) / (costs.length || 1);
    const minCost = costs.length ? Math.min(...costs) : 0;
    const maxCost = costs.length ? Math.max(...costs) : 0;

    // Transit time analysis
    const transitDays = shipments
      .map((s) => Number(s.transit_days))
      .filter((t) => Number.isFinite(t) && t > 0);
    const avgTransitDays =
      transitDays.reduce((sum, t) => sum + t, 0) / (transitDays.length || 1);

    // Accessorial frequency analysis
    const accessorialCounts: Record<string, number> = {};
    shipments.forEach((s) => {
      if (s.accessorials) {
        Object.entries(s.accessorials).forEach(([key, value]) => {
          if (value === true) {
            accessorialCounts[key] = (accessorialCounts[key] || 0) + 1;
          }
        });
      }
    });

    const commonAccessorials = Object.entries(accessorialCounts)
      .filter(([, count]) => count > shipments.length * 0.3)
      .map(([key]) => key);

    // Container pattern analysis
    const containerPatterns = this.analyzeContainerPatterns(shipments);

    // Success metrics
    const successRate =
      shipments.filter((s) => s.on_time_delivery).length / shipments.length;

    return {
      carrierCounts,
      mostCommonCarrier,
      carrierUsageRate,
      avgCost,
      minCost,
      maxCost,
      avgTransitDays,
      commonAccessorials,
      containerPatterns,
      successRate,
      dataPoints: shipments.length,
    };
  }

  // Detailed container pattern analysis
  private analyzeContainerPatterns(shipments: HistoricalShipment[]): ContainerPatternMap {
    const patterns: ContainerPatternMap = {};

    shipments.forEach((shipment) => {
      if (shipment.containers && Array.isArray(shipment.containers)) {
        shipment.containers.forEach((container) => {
          const type = container.type || "pallet";
          if (!patterns[type]) {
            patterns[type] = {
              count: 0,
              dimensions: [],
              weights: [],
              avgDimensions: { length: 0, width: 0, height: 0 },
              avgWeight: 0,
            };
          }

          patterns[type].count++;
          patterns[type].dimensions.push(container.dimensions || {});
          patterns[type].weights.push(container.weight ?? 0);
        });
      }
    });

    // Calculate averages
    Object.keys(patterns).forEach((type) => {
      const p = patterns[type];
      if (p.dimensions.length > 0) {
        const safeLength = p.dimensions.length || 1;
        p.avgDimensions = {
          length:
            p.dimensions.reduce(
              (sum: number, dimensions) => sum + (dimensions?.length ?? 48),
              0,
            ) / safeLength,
          width:
            p.dimensions.reduce(
              (sum: number, dimensions) => sum + (dimensions?.width ?? 40),
              0,
            ) / safeLength,
          height:
            p.dimensions.reduce(
              (sum: number, dimensions) => sum + (dimensions?.height ?? 48),
              0,
            ) / safeLength,
        };
        p.avgWeight =
          p.weights.reduce((sum: number, weight) => sum + weight, 0) /
          p.weights.length;
      }
    });

    return patterns;
  }

  // Enhanced confidence calculation
  private calculateConfidence(
    similarShipments: HistoricalShipment[],
    patterns: ShipmentPatterns,
    confidenceFactors?: ConfidenceFactors,
  ): number {
    let confidence = 0;

    // Data sufficiency (30% weight)
    const dataSufficiency = Math.min(patterns.dataPoints / 10, 1) * 0.3;
    confidence += dataSufficiency;

    // Pattern strength (30% weight)
    const avgSimilarity =
      similarShipments
        .slice(0, 5)
        .reduce((sum, s) => sum + (s.similarity || 0.5), 0) /
      Math.min(5, similarShipments.length);
    confidence += avgSimilarity * 0.3;

    // Historical success rate (30% weight)
    confidence += (patterns.successRate || 0.5) * 0.3;

    // Consistency bonus (10% weight)
    if (patterns.carrierUsageRate > 70) {
      confidence += 0.1; // Consistent carrier usage
    }

    // Apply confidence factors from AI if available
    if (confidenceFactors) {
      if (confidenceFactors.dataSufficiency === "low") confidence *= 0.8;
      if (confidenceFactors.patternStrength === "low") confidence *= 0.8;
      if (confidenceFactors.riskFactors?.length && confidenceFactors.riskFactors.length > 0) confidence *= 0.9;
    }

    return Math.min(confidence, 0.95);
  }

  // Generate alternative recommendations
  private generateAlternatives(
    patterns: ShipmentPatterns,
    primaryDecision: AIRecommendation,
  ): AlternativeRecommendation[] {
    const alternatives: AlternativeRecommendation[] = [];

    // Alternative carrier if available
    const carriers = Object.entries(patterns.carrierCounts || {})
      .sort(([, a], [, b]) => b - a)
      .slice(1, 3);

    carriers.forEach(([carrier]) => {
      alternatives.push({
        type: "alternative_carrier",
        carrier,
        estimatedCost: patterns.avgCost * 1.05,
        reasoning: `Alternative carrier option with similar performance`,
      });
    });

    // Economy option
    if (primaryDecision.accessorials && primaryDecision.accessorials.length > 0) {
      alternatives.push({
        type: "economy",
        accessorials: [],
        estimatedCost: patterns.avgCost * 0.85,
        reasoning: "Economy option without accessorial services",
      });
    }

    return alternatives;
  }

  // Fallback methods
  private getDefaultPatterns(): ShipmentPatterns {
    return {
      carrierCounts: { SAIA: 1 },
      mostCommonCarrier: "SAIA",
      carrierUsageRate: 0,
      avgCost: 500,
      minCost: 400,
      maxCost: 600,
      avgTransitDays: 3,
      commonAccessorials: [],
      containerPatterns: {
        pallet: {
          count: 1,
          dimensions: [],
          weights: [],
          avgDimensions: { length: 48, width: 40, height: 48 },
          avgWeight: 1500,
        },
      },
      successRate: 0.9,
      dataPoints: 0,
    };
  }

  private getDefaultContainers(
    patterns: ShipmentPatterns,
  ): FreightContainerRecommendation[] {
    const mostUsed = Object.entries(patterns.containerPatterns || {}).sort(
      ([, a], [, b]) => b.count - a.count,
    )[0];

    if (!mostUsed) {
      return [
        {
          type: "pallet",
          count: 1,
          dimensions: { length: 48, width: 40, height: 48 },
          estimatedWeight: 1500,
        },
      ];
    }

    const [type, pattern] = mostUsed;
    return [
      {
        type,
        count: 1,
        dimensions: pattern.avgDimensions,
        estimatedWeight: pattern.avgWeight,
      },
    ];
  }

  private generateReasoning(
    patterns: ShipmentPatterns,
    similarShipments: HistoricalShipment[],
  ): string {
    const reasons = [];

    if (similarShipments.length > 0) {
      reasons.push(
        `Based on ${similarShipments.length} similar historical shipments`,
      );
    }

    if (patterns.successRate > 0.9) {
      reasons.push(
        `${(patterns.successRate * 100).toFixed(0)}% on-time delivery rate`,
      );
    }

    reasons.push(
      `${patterns.mostCommonCarrier} selected based on ${patterns.carrierUsageRate}% usage rate`,
    );

    if (patterns.avgTransitDays) {
      reasons.push(
        `Expected transit: ${patterns.avgTransitDays.toFixed(1)} days`,
      );
    }

    return reasons.join(". ");
  }

  private fallbackDecision(
    context: FreightDecisionContext,
    patterns: ShipmentPatterns,
    similarShipments: HistoricalShipment[],
  ): FreightDecision {
    return {
      recommendation: {
        containers: this.getDefaultContainers(patterns),
        carrier: patterns.mostCommonCarrier,
        carrierService: "Standard",
        accessorials: patterns.commonAccessorials,
        estimatedCost: patterns.avgCost,
        estimatedTransitDays: Math.ceil(patterns.avgTransitDays),
        addressType: "Business",
      },
      confidence: this.calculateConfidence(similarShipments, patterns),
      reasoning: this.generateReasoning(patterns, similarShipments),
      similarShipments: similarShipments.slice(0, 5).map((s) => ({
        referenceId: s.reference_id,
        similarity: s.similarity || 0.85,
        outcome: s.on_time_delivery ? "successful" : "delayed",
      })),
    };
  }
}

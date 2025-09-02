import { getEdgeSql } from "@/lib/db/neon-edge";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

// For embeddings, we'll use Google's text-embedding-004 model
// Dimensions: 768 (more efficient than OpenAI's 1536)
const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

// For decision generation, use Gemini Pro
const geminiPro = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

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
    containers: Array<{
      type: string;
      count: number;
      dimensions: { length: number; width: number; height: number };
      estimatedWeight: number;
    }>;
    carrier: string;
    carrierService: string;
    accessorials: string[];
    estimatedCost: number;
    estimatedTransitDays: number;
    addressType: "Business" | "Residential" | "Limited Access";
  };
  confidence: number;
  reasoning: string;
  similarShipments: Array<{
    referenceId: string;
    similarity: number;
    outcome: string;
  }>;
  alternatives?: any[];
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
      // Google's text-embedding-004 is currently one of the best
      // 768 dimensions, highly performant
      const result = await embeddingModel.embedContent(contextText);
      const embedding = result.embedding.values;

      // Cache the result
      this.embeddingCache.set(contextText, embedding);

      return embedding;
    } catch (error) {
      console.error("Google embedding failed, trying fallback:", error);

      // Fallback to Voyage AI or Cohere if you have API keys
      // Otherwise use a local model
      return this.fallbackEmbedding(contextText);
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
    return this.hashBasedEmbedding(text, 768);
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
  ): Promise<any[]> {
    // Check if database is available
    if (!db || !process.env.ANDRE_DATABASE_URL) {
      console.warn("Database not available, returning mock data for build");
      return [];
    }

    try {
      const contextEmbedding = await this.generateContextEmbedding(context);
      
      // Format embedding as PostgreSQL array string
      const embeddingString = `[${contextEmbedding.join(',')}]`;

      // Use pgvector for similarity search with Google's 768-dimension embeddings
      const sql = getEdgeSql();
      const results = await sql`
        WITH semantic_search AS (
          SELECT 
            *,
            1 - (embedding <=> ${embeddingString}::vector(768)) as similarity
          FROM mycarrier_historical_shipments
          WHERE 
            -- Pre-filter for efficiency
            destination_state = ${context.destination.state}
            AND origin_state = ${context.origin.state}
          ORDER BY embedding <=> ${embeddingString}::vector(768)
          LIMIT ${limit * 2}
        )
        SELECT * FROM semantic_search
        WHERE similarity > 0.7  -- Only return highly similar results
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;
      return results || [];
    } catch (error) {
      console.error("Vector search failed, falling back to keyword search:", error);
      return this.keywordOnlySearch(context, limit);
    }
  }

  // Keyword-only search fallback when vector search fails
  private async keywordOnlySearch(
    context: FreightDecisionContext,
    limit: number,
  ): Promise<any[]> {
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
      `;
      return results || [];
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
  ): Promise<any[]> {
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
                 1 - (embedding <=> ${embeddingString}::vector(768)) as semantic_score
          FROM mycarrier_historical_shipments
          WHERE 
            destination_state = ${context.destination.state}
            AND origin_state = ${context.origin.state}
          ORDER BY embedding <=> ${embeddingString}::vector(768)
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
      `;
      return results || [];
    } catch (error) {
      console.error("Hybrid search failed, falling back to keyword only:", error);
      return this.keywordOnlySearch(context, limit);
    }
  }

  // Generate decision using Gemini with RAG context
  async makeDecision(
    context: FreightDecisionContext,
  ): Promise<FreightDecision> {
    try {
      // Step 1: Find similar historical shipments
      const similarShipments = await this.findSimilarShipments(context, 20);

      // Step 2: Analyze patterns
      const patterns = this.analyzePatterns(similarShipments);

      // Step 3: Generate decision with Gemini
      const decision = await this.generateDecisionWithGemini(
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

  // Use Gemini for decision generation
  private async generateDecisionWithGemini(
    context: FreightDecisionContext,
    similarShipments: any[],
    patterns: any,
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
${i + 1}. Reference: ${s.reference_id} (${(s.similarity * 100).toFixed(1)}% similar)
   Route: ${s.origin_city}, ${s.origin_state} → ${s.destination_city}, ${s.destination_state}
   Carrier: ${s.carrier} | Cost: $${s.actual_cost} | Transit: ${s.transit_days} days
   Containers: ${JSON.stringify(s.containers)}
   Performance: ${s.on_time_delivery ? "✓ On-time" : "✗ Delayed"}
`,
  )
  .join("\n")}

CONTAINER PATTERNS:
${Object.entries(patterns.containerPatterns)
  .map(
    ([type, data]: any) =>
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
      const result = await geminiPro.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in Gemini response");
      }

      const geminiDecision = JSON.parse(jsonMatch[0]);

      return {
        recommendation: {
          containers:
            geminiDecision.containers || this.getDefaultContainers(patterns),
          carrier: geminiDecision.carrier || patterns.mostCommonCarrier,
          carrierService: geminiDecision.carrierService || "Standard",
          accessorials:
            geminiDecision.accessorials || patterns.commonAccessorials,
          estimatedCost: geminiDecision.estimatedCost || patterns.avgCost,
          estimatedTransitDays:
            geminiDecision.estimatedTransitDays || patterns.avgTransitDays,
          addressType: geminiDecision.addressType || "Business",
        },
        confidence: this.calculateConfidence(
          similarShipments,
          patterns,
          geminiDecision.confidenceFactors,
        ),
        reasoning:
          geminiDecision.reasoning ||
          this.generateReasoning(patterns, similarShipments),
        similarShipments: similarShipments.slice(0, 5).map((s) => ({
          referenceId: s.reference_id,
          similarity: s.similarity || 0.85,
          outcome: s.on_time_delivery ? "successful" : "delayed",
        })),
        alternatives: this.generateAlternatives(patterns, geminiDecision),
      };
    } catch (error) {
      console.error("Gemini decision generation failed:", error);
      return this.fallbackDecision(context, patterns, similarShipments);
    }
  }

  // Enhanced pattern analysis
  private analyzePatterns(shipments: any[]): any {
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
      ([, a], [, b]) => (b as number) - (a as number),
    );

    const mostCommonCarrier = sortedCarriers[0]?.[0] || "SAIA";
    const carrierUsageRate = (
      (((sortedCarriers[0]?.[1] as number) || 0) / shipments.length) *
      100
    ).toFixed(0);

    // Cost analysis with ranges
    const costs = shipments.map((s) => s.actual_cost).filter((c) => c > 0);
    const avgCost = costs.reduce((sum, c) => sum + c, 0) / costs.length;
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);

    // Transit time analysis
    const transitDays = shipments
      .map((s) => s.transit_days)
      .filter((t) => t > 0);
    const avgTransitDays =
      transitDays.reduce((sum, t) => sum + t, 0) / transitDays.length;

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
  private analyzeContainerPatterns(shipments: any[]): Record<string, any> {
    const patterns: Record<string, any> = {};

    shipments.forEach((s) => {
      if (s.containers && Array.isArray(s.containers)) {
        s.containers.forEach((c: any) => {
          const type = c.type || "pallet";
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
          patterns[type].dimensions.push(c.dimensions || {});
          patterns[type].weights.push(c.weight || 0);
        });
      }
    });

    // Calculate averages
    Object.keys(patterns).forEach((type) => {
      const p = patterns[type];
      if (p.dimensions.length > 0) {
        p.avgDimensions = {
          length:
            p.dimensions.reduce(
              (sum: number, d: any) => sum + (d.length || 48),
              0,
            ) / p.dimensions.length,
          width:
            p.dimensions.reduce(
              (sum: number, d: any) => sum + (d.width || 40),
              0,
            ) / p.dimensions.length,
          height:
            p.dimensions.reduce(
              (sum: number, d: any) => sum + (d.height || 48),
              0,
            ) / p.dimensions.length,
        };
        p.avgWeight =
          p.weights.reduce((sum: number, w: number) => sum + w, 0) /
          p.weights.length;
      }
    });

    return patterns;
  }

  // Enhanced confidence calculation
  private calculateConfidence(
    similarShipments: any[],
    patterns: any,
    confidenceFactors?: any,
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

    // Apply confidence factors from Gemini if available
    if (confidenceFactors) {
      if (confidenceFactors.dataSufficiency === "low") confidence *= 0.8;
      if (confidenceFactors.patternStrength === "low") confidence *= 0.8;
      if (confidenceFactors.riskFactors?.length > 0) confidence *= 0.9;
    }

    return Math.min(confidence, 0.95);
  }

  // Generate alternative recommendations
  private generateAlternatives(patterns: any, primaryDecision: any): any[] {
    const alternatives = [];

    // Alternative carrier if available
    const carriers = Object.entries(patterns.carrierCounts || {})
      .sort(([, a]: any, [, b]: any) => b - a)
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
    if (primaryDecision.accessorials?.length > 0) {
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
  private getDefaultPatterns(): any {
    return {
      mostCommonCarrier: "SAIA",
      carrierUsageRate: "0",
      avgCost: 500,
      minCost: 400,
      maxCost: 600,
      avgTransitDays: 3,
      commonAccessorials: [],
      containerPatterns: {
        pallet: {
          count: 1,
          avgDimensions: { length: 48, width: 40, height: 48 },
          avgWeight: 1500,
        },
      },
      successRate: 0.9,
      dataPoints: 0,
    };
  }

  private getDefaultContainers(patterns: any): any[] {
    const mostUsed = Object.entries(patterns.containerPatterns || {}).sort(
      ([, a]: any, [, b]: any) => b.count - a.count,
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

    const [type, pattern]: any = mostUsed;
    return [
      {
        type,
        count: 1,
        dimensions: pattern.avgDimensions,
        estimatedWeight: pattern.avgWeight,
      },
    ];
  }

  private generateReasoning(patterns: any, similarShipments: any[]): string {
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
    patterns: any,
    similarShipments: any[],
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

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import QueryProcessor, { QueryIntent } from '@/lib/rag/query-processor';
import HybridSearch, { Document, SlidingWindow } from '@/lib/rag/hybrid-search';
import Reranker from '@/lib/rag/reranker';

// Use Node.js runtime for file access
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache for index and search components
let ragIndex: any = null;
let hybridSearch: HybridSearch | null = null;
let reranker: Reranker | null = null;

/**
 * Load and initialize RAG components
 */
async function initializeComponents() {
  if (ragIndex && hybridSearch && reranker) {
    return { ragIndex, hybridSearch, reranker };
  }

  // Load index
  const indexPath = path.join(process.cwd(), 'data', 'rag-index-comprehensive.json');
  
  if (!fs.existsSync(indexPath)) {
    throw new Error('RAG index not found. Please run: npm run rag:pipeline');
  }
  
  console.log('Loading RAG index...');
  const indexData = fs.readFileSync(indexPath, 'utf8');
  ragIndex = JSON.parse(indexData);
  
  console.log(`Loaded ${ragIndex.documents.length} documents`);
  
  // Initialize hybrid search
  hybridSearch = new HybridSearch(
    ragIndex.documents,
    0.7, // semantic weight
    0.3  // keyword weight
  );
  
  // Initialize reranker
  reranker = new Reranker();
  
  return { ragIndex, hybridSearch, reranker };
}

/**
 * Generate embedding using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    // Fallback to hash-based embedding
    const { hashingVector } = require('../../../../lib/rag/embeddings');
    return hashingVector(text, ragIndex?.dimensions || 512);
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-3-small'
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding failed, using fallback:', error);
    const { hashingVector } = require('../../../../lib/rag/embeddings');
    return hashingVector(text, ragIndex?.dimensions || 512);
  }
}

/**
 * Advanced search with all enhancements
 */
async function performAdvancedSearch(
  query: string,
  options: {
    limit?: number;
    sources?: string[];
    minScore?: number;
    useReranking?: boolean;
    useWindowing?: boolean;
    explainScores?: boolean;
    context?: any;
  } = {}
) {
  const {
    limit = 10,
    sources = ['hmt', 'cfr', 'erg', 'products'],
    minScore = 0.2,
    useReranking = true,
    useWindowing = true,
    explainScores = false,
    context = {}
  } = options;

  // Initialize components
  const { ragIndex, hybridSearch, reranker } = await initializeComponents();

  // Process query
  const processedQuery = QueryProcessor.process(query, context);
  
  // Generate search query (with expansions)
  const searchQuery = QueryProcessor.generateSearchQuery(processedQuery);
  
  // Generate embedding for the search query
  const queryEmbedding = await generateEmbedding(searchQuery);

  // Filter documents by source
  const filteredDocs = ragIndex.documents.filter((doc: Document) => 
    sources.includes(doc.source)
  );

  // Perform hybrid search
  const searchResults = hybridSearch.search(
    processedQuery,
    filteredDocs,
    queryEmbedding,
    {
      limit: useReranking ? limit * 3 : limit, // Get more for re-ranking
      minScore,
      useWindowing,
      boostExactMatch: true
    }
  );

  // Apply re-ranking if enabled
  let finalResults = searchResults;
  if (useReranking && searchResults.length > 0) {
    finalResults = reranker.rerank(
      processedQuery,
      searchResults,
      {
        topK: limit,
        threshold: minScore,
        explainScores
      }
    );
  }

  // Create optimized context for LLM
  const context_text = hybridSearch.createContext(finalResults, 4000);

  return {
    query: processedQuery,
    results: finalResults,
    context: context_text,
    stats: {
      totalMatches: searchResults.length,
      reranked: useReranking,
      topScore: finalResults[0]?.finalScore || finalResults[0]?.hybridScore || 0,
      processingTime: Date.now() // Will be calculated by caller
    }
  };
}

/**
 * POST endpoint for advanced search
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { 
      query, 
      limit, 
      sources, 
      minScore, 
      useReranking,
      useWindowing,
      explainScores,
      context 
    } = body;
    
    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'Query is required'
      }, { status: 400 });
    }

    // Perform advanced search
    const searchResult = await performAdvancedSearch(query, {
      limit,
      sources,
      minScore,
      useReranking,
      useWindowing,
      explainScores,
      context
    });

    // Calculate processing time
    searchResult.stats.processingTime = Date.now() - startTime;

    // Format response
    const formattedResults = searchResult.results.map((result: any) => ({
      id: result.id,
      source: result.source,
      text: result.text.substring(0, 200) + '...',
      metadata: result.metadata,
      scores: {
        semantic: result.semanticScore?.toFixed(3),
        keyword: result.keywordScore?.toFixed(3),
        hybrid: result.hybridScore?.toFixed(3),
        reranker: result.rerankerScore?.toFixed(3),
        final: (result.finalScore || result.hybridScore)?.toFixed(3)
      },
      highlights: result.highlights?.slice(0, 2), // Include first 2 context windows
      explanation: result.explanation,
      features: result.relevanceFeatures
    }));

    // Generate insights
    const insights = generateInsights(searchResult);

    return NextResponse.json({
      success: true,
      query: {
        original: searchResult.query.original,
        normalized: searchResult.query.normalized,
        intent: searchResult.query.intent,
        entities: searchResult.query.entities,
        expandedTerms: searchResult.query.expandedTerms.slice(0, 10),
        confidence: searchResult.query.confidence
      },
      results: formattedResults,
      context: searchResult.context,
      insights,
      stats: searchResult.stats
    });
    
  } catch (error) {
    console.error('Advanced search error:', error);
    return NextResponse.json({
      success: false,
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Generate insights from search results
 */
function generateInsights(searchResult: any): any {
  const insights: any = {
    summary: [],
    recommendations: [],
    warnings: []
  };

  const query = searchResult.query;
  const results = searchResult.results;

  // Intent-based insights
  switch (query.intent) {
    case QueryIntent.EMERGENCY_RESPONSE:
      if (results.some((r: any) => r.source === 'erg')) {
        insights.summary.push('Found emergency response guidance');
      } else {
        insights.recommendations.push('Consider checking ERG guides for emergency procedures');
      }
      break;
    
    case QueryIntent.CLASSIFICATION:
      if (query.entities.unNumbers.length > 0) {
        insights.summary.push(`Classification found for ${query.entities.unNumbers.join(', ')}`);
      }
      if (!results.some((r: any) => r.metadata?.freightClass)) {
        insights.recommendations.push('May need to determine freight class for shipping');
      }
      break;
    
    case QueryIntent.SHIPPING_REQUIREMENTS:
      if (!results.some((r: any) => r.source === 'cfr')) {
        insights.warnings.push('No specific CFR regulations found - verify compliance requirements');
      }
      break;
  }

  // Entity-based insights
  if (query.entities.unNumbers.length > 0) {
    const foundUN = results.some((r: any) => 
      query.entities.unNumbers.includes(r.metadata?.unNumber)
    );
    if (foundUN) {
      insights.summary.push('Exact UN number match found');
    } else {
      insights.warnings.push('No exact match for specified UN number');
    }
  }

  // Hazmat insights
  if (query.context?.needsHazmatData) {
    const hasHazmat = results.some((r: any) => 
      r.metadata?.isHazardous || r.metadata?.hazardClass
    );
    if (hasHazmat) {
      insights.summary.push('Hazardous material information available');
      insights.recommendations.push('Ensure proper placarding and documentation');
    }
  }

  // Freight booking insights
  if (query.context?.isFreightBooking) {
    const hasFreightInfo = results.some((r: any) => 
      r.metadata?.freightClass || r.metadata?.nmfcCode
    );
    if (hasFreightInfo) {
      insights.summary.push('Freight classification data found');
    } else {
      insights.recommendations.push('Manual freight classification may be required');
    }
  }

  // Score-based insights
  const topScore = results[0]?.finalScore || results[0]?.hybridScore || 0;
  if (topScore < 0.5) {
    insights.warnings.push('Low confidence results - consider refining your query');
  } else if (topScore > 0.8) {
    insights.summary.push('High confidence match found');
  }

  // Source diversity
  const sources = new Set(results.map((r: any) => r.source));
  if (sources.size >= 3) {
    insights.summary.push('Information from multiple authoritative sources');
  }

  return insights;
}

/**
 * GET endpoint for API info and health check
 */
export async function GET() {
  try {
    const { ragIndex } = await initializeComponents();
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    return NextResponse.json({
      success: true,
      message: 'Advanced RAG Search API',
      version: '2.0',
      features: {
        queryProcessing: {
          entityExtraction: true,
          intentDetection: true,
          queryExpansion: true,
          structuredQueries: true
        },
        search: {
          hybrid: true,
          semanticSearch: true,
          bm25Keyword: true,
          slidingWindow: true,
          exactMatchBoost: true
        },
        reranking: {
          enabled: true,
          featureExtraction: true,
          crossEncoder: 'simulated',
          explainableScores: true,
          adaptiveLearning: true
        },
        context: {
          slidingWindows: true,
          smartChunking: true,
          deduplication: true,
          maxTokenManagement: true
        }
      },
      index: {
        loaded: true,
        documents: ragIndex.documents.length,
        model: ragIndex.model,
        dimensions: ragIndex.dimensions,
        sources: ragIndex.stats.sources
      },
      openai: {
        configured: hasApiKey,
        embeddingModel: 'text-embedding-3-small',
        fallback: 'hash-based embeddings'
      },
      performance: {
        caching: true,
        lazyLoading: true,
        incrementalSearch: false,
        approximateNN: false // Could add FAISS/Annoy later
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Advanced RAG API not ready',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}
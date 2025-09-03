import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Use edge runtime for fast response
export const runtime = 'nodejs'; // Need Node.js for file system access
export const dynamic = 'force-dynamic';

// Load index on first request (cached in memory)
let ragIndex: any = null;

async function loadIndex() {
  if (ragIndex) return ragIndex;
  
  const indexPath = path.join(process.cwd(), 'data', 'rag-index-comprehensive.json');
  
  if (!fs.existsSync(indexPath)) {
    throw new Error('RAG index not found. Please run: npm run rag:pipeline');
  }
  
  const indexData = fs.readFileSync(indexPath, 'utf8');
  ragIndex = JSON.parse(indexData);
  
  console.log(`Loaded RAG index: ${ragIndex.documents.length} documents`);
  return ragIndex;
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
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

// Generate embedding for query
async function generateQueryEmbedding(query: string): Promise<number[]> {
  // Check if we have OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    // Fallback to hash-based embedding
    const { hashingVector } = require('../../../../lib/rag/embeddings');
    return hashingVector(query, 512);
  }
  
  // Use OpenAI embeddings
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        input: query,
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
    return hashingVector(query, 512);
  }
}

// Search the index
async function searchIndex(
  query: string,
  options: {
    limit?: number;
    sources?: string[];
    minScore?: number;
    context?: any;
  } = {}
) {
  const {
    limit = 10,
    sources = ['hmt', 'cfr', 'erg', 'products'],
    minScore = 0.3,
    context = {}
  } = options;
  
  // Load index
  const index = await loadIndex();
  
  // Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(query);
  
  // Calculate similarities for all documents
  const results = index.documents
    .filter((doc: any) => sources.includes(doc.source))
    .map((doc: any) => ({
      ...doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding)
    }))
    .filter((doc: any) => doc.score >= minScore)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit);
  
  // Group results by source for better organization
  const groupedResults = {
    hmt: results.filter((r: any) => r.source === 'hmt'),
    cfr: results.filter((r: any) => r.source === 'cfr'),
    erg: results.filter((r: any) => r.source === 'erg'),
    products: results.filter((r: any) => r.source === 'products')
  };
  
  // Apply context-specific filtering if provided
  if (context.unNumber) {
    // Boost results matching the UN number
    results.forEach((result: any) => {
      if (result.metadata?.unNumber === context.unNumber) {
        result.score *= 1.5; // Boost score by 50%
      }
    });
    results.sort((a: any, b: any) => b.score - a.score);
  }
  
  if (context.mode) {
    // Filter CFR results by transportation mode
    const modeMap: any = {
      'highway': '177',
      'rail': '174',
      'air': '175',
      'vessel': '176'
    };
    
    const relevantPart = modeMap[context.mode.toLowerCase()];
    if (relevantPart) {
      results.forEach((result: any) => {
        if (result.source === 'cfr' && result.metadata?.part === relevantPart) {
          result.score *= 1.3; // Boost mode-specific regulations
        }
      });
      results.sort((a: any, b: any) => b.score - a.score);
    }
  }
  
  return {
    query,
    results: results.slice(0, limit),
    grouped: groupedResults,
    stats: {
      totalMatches: results.length,
      topScore: results[0]?.score || 0,
      sources: Object.fromEntries(
        Object.entries(groupedResults).map(([source, docs]: [string, any]) => 
          [source, docs.length]
        )
      )
    }
  };
}

// POST endpoint for search
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit, sources, minScore, context } = body;
    
    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'Query is required'
      }, { status: 400 });
    }
    
    const searchResults = await searchIndex(query, {
      limit,
      sources,
      minScore,
      context
    });
    
    // Format response for easy consumption
    const formattedResults = searchResults.results.map((result: any) => ({
      id: result.id,
      source: result.source,
      score: result.score.toFixed(3),
      text: result.text.substring(0, 200) + '...',
      metadata: result.metadata
    }));
    
    return NextResponse.json({
      success: true,
      query: searchResults.query,
      results: formattedResults,
      summary: generateSummary(searchResults),
      stats: searchResults.stats
    });
    
  } catch (error) {
    console.error('RAG search error:', error);
    return NextResponse.json({
      success: false,
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Generate a helpful summary of results
function generateSummary(searchResults: any): any {
  const summary: any = {
    regulations: [],
    emergency: [],
    products: [],
    hazmat: []
  };
  
  // Extract key information from top results
  searchResults.results.slice(0, 5).forEach((result: any) => {
    switch (result.source) {
      case 'cfr':
        summary.regulations.push({
          section: result.metadata?.section,
          subject: result.metadata?.subject,
          relevance: result.score
        });
        break;
      
      case 'erg':
        summary.emergency.push({
          type: result.metadata?.type,
          guideNumber: result.metadata?.guideNumber,
          unNumber: result.metadata?.unNumber,
          relevance: result.score
        });
        break;
      
      case 'products':
        summary.products.push({
          sku: result.metadata?.sku,
          name: result.metadata?.name,
          isHazardous: result.metadata?.isHazardous,
          relevance: result.score
        });
        break;
      
      case 'hmt':
        summary.hazmat.push({
          unNumber: result.metadata?.unNumber,
          name: result.metadata?.name,
          hazardClass: result.metadata?.hazardClass,
          packingGroup: result.metadata?.packingGroup,
          relevance: result.score
        });
        break;
    }
  });
  
  return summary;
}

// GET endpoint for health check
export async function GET() {
  try {
    // Try to load index to check if it exists
    const index = await loadIndex();
    
    return NextResponse.json({
      success: true,
      message: 'RAG search API is operational',
      version: '2.0',
      index: {
        loaded: true,
        documents: index.documents.length,
        model: index.model,
        dimensions: index.dimensions,
        sources: index.stats.sources
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'RAG index not found',
      error: error instanceof Error ? error.message : 'Unknown error',
      help: 'Please run: npm run rag:pipeline'
    }, { status: 503 });
  }
}
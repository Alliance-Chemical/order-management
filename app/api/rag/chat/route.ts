import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Use Node.js runtime for file access
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Load RAG index (cached in memory)
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

// Calculate cosine similarity
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

// Generate embedding for query using OpenAI
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    // Fallback to hash-based embedding
    const { hashingVector } = require('../../../../lib/rag/embeddings');
    return hashingVector(query, 512);
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
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

// Search the RAG index
async function searchRAG(query: string, limit: number = 5) {
  const index = await loadIndex();
  const queryEmbedding = await generateQueryEmbedding(query);
  
  // Find most relevant documents
  const results = index.documents
    .map((doc: any) => ({
      ...doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding)
    }))
    .filter((doc: any) => doc.score > 0.2)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit);
  
  return results;
}

// Generate chat response using GPT-5 nano with RAG context
async function generateChatResponse(
  message: string,
  ragContext: any[],
  conversationHistory?: any[]
) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return {
      error: 'OpenAI API key not configured',
      fallback: 'Please set OPENAI_API_KEY in your environment variables'
    };
  }
  
  // Build context from RAG results
  const context = ragContext.map((doc, i) => 
    `[Source ${i+1}: ${doc.source}${doc.metadata?.section ? ` §${doc.metadata.section}` : ''}]\n${doc.text}`
  ).join('\n\n');
  
  // Build the prompt
  const systemPrompt = `You are an expert hazmat shipping assistant with access to comprehensive regulations and guidelines.
You help with chemical shipping, DOT compliance, emergency response, and freight classification.

Use the following context from regulations and guidelines to answer questions accurately:

${context}

Important guidelines:
- Always cite specific regulation sections when applicable
- For hazmat questions, include UN numbers, packing groups, and hazard classes
- For emergency response, reference ERG guide numbers
- Be concise but thorough
- If the context doesn't contain enough information, say so clearly`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(conversationHistory || []),
    { role: 'user', content: message }
  ];
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5-nano', // Ultra fast and only $0.05 per 1M input tokens!
        messages,
        temperature: 0.3, // Lower temperature for factual responses
        max_tokens: 2000, // GPT-5 nano supports up to 128K output tokens
        stream: false
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    return {
      response: data.choices[0].message.content,
      usage: data.usage,
      model: data.model,
      sources: ragContext.map(doc => ({
        source: doc.source,
        score: doc.score.toFixed(3),
        snippet: doc.text.substring(0, 100) + '...',
        metadata: doc.metadata
      }))
    };
  } catch (error) {
    console.error('Chat generation failed:', error);
    return {
      error: 'Failed to generate response',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// POST endpoint for chat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history, ragLimit = 5 } = body;
    
    if (!message) {
      return NextResponse.json({
        success: false,
        error: 'Message is required'
      }, { status: 400 });
    }
    
    // Search RAG for relevant context
    console.log(`Searching RAG for: "${message}"`);
    const ragResults = await searchRAG(message, ragLimit);
    
    if (ragResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No relevant context found in knowledge base',
        suggestion: 'Try asking about specific chemicals, UN numbers, or regulations'
      }, { status: 404 });
    }
    
    // Generate chat response with context
    console.log(`Found ${ragResults.length} relevant documents, generating response...`);
    const chatResponse = await generateChatResponse(message, ragResults, history);
    
    if ('error' in chatResponse) {
      return NextResponse.json({
        success: false,
        ...chatResponse
      }, { status: 500 });
    }
    
    // Calculate approximate cost with GPT-5 nano pricing
    const costEstimate = chatResponse.usage ? {
      promptTokens: chatResponse.usage.prompt_tokens,
      completionTokens: chatResponse.usage.completion_tokens,
      totalTokens: chatResponse.usage.total_tokens,
      // GPT-5 nano: $0.05 per 1M input, $0.40 per 1M output
      estimatedCost: `$${((chatResponse.usage.prompt_tokens * 0.05 + chatResponse.usage.completion_tokens * 0.40) / 1000000).toFixed(6)}`
    } : null;
    
    return NextResponse.json({
      success: true,
      message,
      response: chatResponse.response,
      sources: chatResponse.sources,
      model: chatResponse.model,
      usage: costEstimate
    });
    
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Chat request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint for health check
export async function GET() {
  try {
    const index = await loadIndex();
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    return NextResponse.json({
      success: true,
      message: 'RAG Chat API is operational',
      version: '1.0',
      model: 'gpt-5-nano',
      ragIndex: {
        loaded: true,
        documents: index.documents.length,
        embeddingModel: index.model
      },
      openai: {
        configured: hasApiKey,
        embeddingModel: 'text-embedding-3-small',
        chatModel: 'gpt-5-nano'
      },
      pricing: {
        embedding: '$0.02 per 1M tokens',
        chat: {
          input: '$0.05 per 1M tokens (80% cheaper than GPT-4o-mini!)',
          output: '$0.40 per 1M tokens',
          comparison: 'GPT-5 nano is 3x cheaper on input than GPT-4o-mini'
        }
      },
      features: {
        contextWindow: 400000,
        maxOutput: 128000,
        knowledgeCutoff: 'May 31, 2024',
        streaming: true,
        functionCalling: true,
        structuredOutputs: true
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'RAG Chat API not ready',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getRawSql } from '@/lib/db/neon';

type RagMetadata = Record<string, unknown> & {
  baseName?: string;
  name?: string;
  section?: string;
  hazardClass?: string;
  packingGroup?: string;
  labels?: string;
  ergGuide?: string;
  unNumber?: string;
};

type RagDocumentRow = {
  id: string;
  source: string;
  text: string;
  metadata: RagMetadata | null;
  score?: number;
};

type ChatRole = 'system' | 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: string;
}

interface ChatResponseSuccess {
  response: string;
  usage: ChatUsage;
  model: string;
  sources: Array<{
    source: string;
    score: string;
    snippet: string;
    metadata: RagMetadata | null;
  }>;
}

interface ChatResponseError {
  error: string;
  fallback?: string;
  details?: string;
}

type ChatResponse = ChatResponseSuccess | ChatResponseError;

interface ChatRequestBody {
  message: string;
  history?: ChatMessage[];
  model?: string;
  ragLimit?: number;
}

function extractRows<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === 'object' && value !== null && 'rows' in value) {
    const rows = (value as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as T[];
    }
  }
  return [];
}

// Use Edge runtime for better performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Search the database RAG for general queries
async function searchDatabaseRAG(query: string, limit: number = 5): Promise<RagDocumentRow[]> {
  const sql = getRawSql();
  
  // Check if this is a UN number query
  const unMatch = query.match(/(?:UN\s?)?([0-9]{4})\b/i);
  if (unMatch) {
    const unNumber = `UN${unMatch[1]}`;
    console.log(`Searching for UN number: ${unNumber}`);
    
    try {
      // Search for UN number in metadata
      const result = await sql`
        SELECT
          id,
          source,
          text,
          metadata,
          1.0 as score
        FROM rag.documents
        WHERE
          metadata->>'unNumber' = ${unNumber} OR
          text ILIKE ${'%' + unNumber + '%'} OR
          text ILIKE ${'%' + unMatch[1] + '%'}
        ORDER BY
          CASE
            WHEN metadata->>'unNumber' = ${unNumber} THEN 0
            WHEN text ILIKE ${'%' + unNumber + '%'} THEN 1
            ELSE 2
          END
        LIMIT ${limit}
      `;
      
      const rows = extractRows<RagDocumentRow>(result);
      if (rows.length > 0) {
        return rows;
      }
    } catch (error) {
      console.error('UN number search failed:', error);
    }
  }
  
  try {
    // First, try to generate embedding for the query
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      // Fallback to text search if no API key
      const result = await sql`
        SELECT
          id,
          source,
          text,
          metadata,
          1.0 as score
        FROM rag.documents
        WHERE
          text ILIKE ${'%' + query + '%'} OR
          search_vector @@ plainto_tsquery('english', ${query})
        ORDER BY 
          CASE 
            WHEN text ILIKE ${'%' + query + '%'} THEN 0
            ELSE 1
          END,
          ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC
        LIMIT ${limit}
      `;
      
      return extractRows<RagDocumentRow>(result);
    }
    
    // Generate embedding
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: query.toLowerCase(),
        model: 'text-embedding-3-small'
      })
    });
    
    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
    }
    
    const embeddingData = await embeddingResponse.json() as {
      data: Array<{ embedding: number[] }>;
    };
    const embedding = embeddingData.data[0]?.embedding ?? [];

    // Search using vector similarity
    const result = await sql`
      SELECT
        id,
        source,
        text,
        metadata,
        1 - (embedding <=> ${'[' + embedding.join(',') + ']'}::vector) as score
      FROM rag.documents
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${'[' + embedding.join(',') + ']'}::vector
      LIMIT ${limit}
    `;
    
    const rows = extractRows<RagDocumentRow>(result);
    return rows.filter((row) => (row.score ?? 0) > 0.4); // Use proven threshold
    
  } catch (error) {
    console.error('Database RAG search error:', error);

    // Fallback to text search
    const result = await sql`
      SELECT
        id,
        source,
        text,
        metadata,
        1.0 as score
      FROM rag.documents
      WHERE
        text ILIKE ${'%' + query + '%'} OR
        search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY 
        CASE 
          WHEN text ILIKE ${'%' + query + '%'} THEN 0
          ELSE 1
        END,
        ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC
      LIMIT ${limit}
    `;
    
    return extractRows<RagDocumentRow>(result);
  }
}

// Generate chat response using GPT-5 nano with RAG context
async function generateChatResponse(
  message: string,
  ragContext: RagDocumentRow[],
  conversationHistory: ChatMessage[] = [],
  modelOverride?: string
): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return {
      error: 'OpenAI API key not configured',
      fallback: 'Please set OPENAI_API_KEY in your environment variables'
    };
  }
  
  // Use LLM_MODEL env variable or fallback to the specified model
  const model = process.env.LLM_MODEL || modelOverride || 'gpt-5-nano-2025-08-07';
  console.log(`Using model: ${model}`);
  
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
- If the context doesn't contain enough information, say so clearly
- Format your responses with proper markdown for better readability`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
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
        model: model,
        messages,
        max_completion_tokens: 2000,
        temperature: 0.7,
        stream: false
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${error}`);
      
      // If the model doesn't exist, try fallback
      if (response.status === 404 && model !== 'gpt-4o-mini') {
        console.log('Model not found, falling back to gpt-4o-mini');
        return generateChatResponse(message, ragContext, conversationHistory, 'gpt-4o-mini');
      }
      
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
      model: string;
    };
    
    // Calculate cost based on model
    let inputCost = 0;
    let outputCost = 0;
    
    if (model.includes('gpt-5-nano')) {
      // GPT-5 nano pricing: $0.05 per 1M input, $0.40 per 1M output
      inputCost = (data.usage.prompt_tokens * 0.05) / 1000000;
      outputCost = (data.usage.completion_tokens * 0.40) / 1000000;
    } else if (model.includes('gpt-4o-mini')) {
      // GPT-4o-mini pricing: $0.15 per 1M input, $0.60 per 1M output
      inputCost = (data.usage.prompt_tokens * 0.15) / 1000000;
      outputCost = (data.usage.completion_tokens * 0.60) / 1000000;
    } else if (model.includes('gpt-4')) {
      // GPT-4 pricing: $30 per 1M input, $60 per 1M output
      inputCost = (data.usage.prompt_tokens * 30) / 1000000;
      outputCost = (data.usage.completion_tokens * 60) / 1000000;
    }
    
    const totalCost = inputCost + outputCost;
    
    return {
      response: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
        estimatedCost: `$${totalCost.toFixed(6)}`
      },
      model: data.model,
      sources: ragContext.map((doc) => ({
        source: doc.source,
        score: (doc.score ?? 0).toFixed(3),
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
    const body = (await request.json()) as ChatRequestBody;
    const { message, history = [], model: requestModel, ragLimit = 5 } = body;
    
    if (!message) {
      return NextResponse.json({
        success: false,
        error: 'Message is required'
      }, { status: 400 });
    }
    
    // Check if this is a UN number lookup query
    const unLookupMatch = message.match(/(?:what\s+(?:un|UN)\s+is\s+)?(?:UN\s?)?(\d{4})\b/i);
    if (unLookupMatch && !message.toLowerCase().includes('class')) {
      const unNumber = `UN${unLookupMatch[1]}`;
      console.log(`Looking up UN number: ${unNumber}`);
      
      // First try database search
      const ragResults = await searchDatabaseRAG(unNumber, 3);
      
      if (ragResults.length > 0) {
        const topResult = ragResults[0];
        const metadata = topResult.metadata || {};
        
        // Format response based on found data
        const response = `## ${unNumber}\n\n` +
          `**${metadata.baseName || metadata.name || topResult.text}**\n\n` +
          (metadata.hazardClass ? `• **Hazard Class:** ${metadata.hazardClass}\n` : '') +
          (metadata.packingGroup ? `• **Packing Group:** ${metadata.packingGroup}\n` : '') +
          (metadata.labels ? `• **Labels:** ${metadata.labels}\n` : '') +
          (metadata.ergGuide ? `• **ERG Guide:** ${metadata.ergGuide}\n` : '');
        
        return NextResponse.json({
          success: true,
          message,
          response,
          sources: [{
            source: topResult.source,
            score: (topResult.score ?? 1).toFixed(3),
            snippet: topResult.text.substring(0, 100) + '...',
            metadata
          }],
          model: 'database-rag',
          usage: { totalTokens: 0, estimatedCost: '$0.000000' }
        });
      }
    }
    
    // Check if this is a specific chemical classification query
    const chemicalMatch = message.match(/(?:classify|what is|what un is|un number for|hazmat for)\s+(.+?)(?:\?|$)/i);
    
    if (chemicalMatch) {
      const productName = chemicalMatch[1].trim();
      console.log(`Classifying chemical: "${productName}"`);
      
      // Search for the chemical in our RAG database
      const ragResults = await searchDatabaseRAG(productName, 3);
      
      if (ragResults.length > 0) {
        const topResult = ragResults[0];
        const metadata = topResult.metadata || {};
        
        const response = `## Classification for ${productName}\n\n` +
          (metadata.unNumber ? `**${metadata.unNumber}** - ${metadata.name || productName}\n\n` : '') +
          (metadata.hazardClass ? `• **Hazard Class:** ${metadata.hazardClass}\n` : '') +
          (metadata.packingGroup ? `• **Packing Group:** ${metadata.packingGroup}\n` : '') +
          (metadata.labels ? `• **Labels Required:** ${metadata.labels}\n` : '') +
          (metadata.ergGuide ? `• **ERG Guide:** ${metadata.ergGuide}\n` : '') +
          '\n*Classification based on hazmat database*';
        
        return NextResponse.json({
          success: true,
          message,
          response,
          sources: [{
            source: topResult.source,
            score: (topResult.score ?? 1).toFixed(3),
            snippet: topResult.text.substring(0, 100) + '...',
            metadata
          }],
          model: 'database-rag',
          usage: { totalTokens: 0, estimatedCost: '$0.000000' }
        });
      }
    }
    
    // For general queries, search the RAG database
    console.log(`Searching database RAG for: "${message}"`);
    const ragResults = await searchDatabaseRAG(message, ragLimit);
    
    if (ragResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No relevant context found in knowledge base',
        suggestion: 'Try asking about specific chemicals, UN numbers, or regulations'
      }, { status: 404 });
    }
    
    // Generate chat response with context
    console.log(`Found ${ragResults.length} relevant documents, generating response...`);
    const chatResponse = await generateChatResponse(message, ragResults, history, requestModel);
    
    if ('error' in chatResponse) {
      return NextResponse.json({
        success: false,
        ...chatResponse
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message,
      response: chatResponse.response,
      sources: chatResponse.sources,
      model: chatResponse.model,
      usage: chatResponse.usage
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
    const sql = getRawSql();
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    const configuredModel = process.env.LLM_MODEL || 'gpt-5-nano-2025-08-07';
    
    const countResult = await sql`
      SELECT COUNT(*) as count FROM rag.documents
    `;
    const countRows = extractRows<{ count: string }>(countResult);
    const documentCount = Number(countRows[0]?.count ?? 0);
    
    return NextResponse.json({
      success: true,
      message: 'Hazmat Chatworld API is operational',
      version: '1.0',
      model: `database-rag + ${configuredModel}`,
      configuredModel: configuredModel,
      database: {
        connected: true,
        documents: documentCount,
        embeddingModel: 'text-embedding-3-small (1536 dimensions)'
      },
      openai: {
        configured: hasApiKey,
        embeddingModel: 'text-embedding-3-small',
        chatModel: configuredModel
      },
      pricing: {
        embedding: '$0.02 per 1M tokens',
        chat: {
          'gpt-5-nano': {
            input: '$0.05 per 1M tokens',
            output: '$0.40 per 1M tokens',
            note: '80% cheaper than GPT-4o-mini on input!'
          },
          'gpt-4o-mini': {
            input: '$0.15 per 1M tokens',
            output: '$0.60 per 1M tokens'
          }
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
      message: 'Hazmat Chatworld API not ready',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Database connection may be unavailable'
    }, { status: 503 });
  }
}

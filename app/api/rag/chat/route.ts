import { NextRequest, NextResponse } from 'next/server';
import { classifyWithDatabaseRAG } from '@/lib/services/rag/database-rag';
import { getRawSql } from '@/lib/db/neon';

// Use Edge runtime for better performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Search the database RAG for general queries
async function searchDatabaseRAG(query: string, limit: number = 5) {
  const sql = getRawSql();
  
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
      
      return (result as any).rows || result;
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
    
    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;
    
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
    
    const rows = (result as any).rows || result;
    return rows.filter((r: any) => r.score > 0.4); // Use our proven threshold
    
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
    
    return (result as any).rows || result;
  }
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
        max_completion_tokens: 2000, // GPT-5 nano supports up to 128K output tokens
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
    
    // First, check if this is a specific chemical classification query
    const chemicalMatch = message.match(/(?:classify|what is|un number for|hazmat for)\s+(.+?)(?:\?|$)/i);
    
    if (chemicalMatch) {
      // Use our high-accuracy classification for specific chemicals
      const productName = chemicalMatch[1].trim();
      console.log(`Classifying chemical: "${productName}"`);
      
      try {
        const classification = await classifyWithDatabaseRAG('QUERY', productName);
        
        // Format as chat response
        const response = classification.un_number
          ? `${productName} is classified as:\n\n` +
            `**${classification.un_number}** - ${classification.proper_shipping_name || productName}\n\n` +
            `• **Hazard Class:** ${classification.hazard_class}\n` +
            (classification.packing_group ? `• **Packing Group:** ${classification.packing_group}\n` : '') +
            (classification.labels ? `• **Labels Required:** ${classification.labels}\n` : '') +
            (classification.erg_guide ? `• **ERG Guide:** ${classification.erg_guide}\n` : '') +
            `\n*Classification confidence: ${Math.round((classification.confidence || 0) * 100)}%*`
          : `${productName} appears to be a non-regulated material. ${classification.exemption_reason || 'It is not classified as dangerous goods for transportation.'}`;
        
        return NextResponse.json({
          success: true,
          message,
          response,
          sources: classification.source ? [{
            source: classification.source,
            score: classification.confidence?.toFixed(3),
            metadata: { 
              unNumber: classification.un_number,
              hazardClass: classification.hazard_class 
            }
          }] : [],
          model: 'database-rag',
          usage: { totalTokens: 0, estimatedCost: '$0.000000' }
        });
      } catch (error) {
        console.error('Classification failed, falling back to general search:', error);
      }
    }
    
    // For general queries, search the RAG database
    console.log(`Searching database RAG for: "${message}"`);
    const ragResults = await searchDatabaseRAG(message, ragLimit);
    
    if (!ragResults || ragResults.length === 0) {
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
    const sql = getRawSql();
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    // Get document count from database
    const countResult = await sql`
      SELECT COUNT(*) as count FROM rag.documents
    `;
    const documentCount = ((countResult as any).rows || countResult)[0]?.count || 0;
    
    return NextResponse.json({
      success: true,
      message: 'RAG Chat API is operational',
      version: '2.0',
      model: 'database-rag + gpt-5-nano',
      database: {
        connected: true,
        documents: documentCount,
        embeddingModel: 'text-embedding-3-small (1536 dimensions)'
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
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Database connection may be unavailable'
    }, { status: 503 });
  }
}
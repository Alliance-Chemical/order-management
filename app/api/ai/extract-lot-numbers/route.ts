import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Simple in-memory cache for development
// In production, use Redis or similar
const extractionCache = new Map<string, { result: any; timestamp: number }>();

export async function POST(request: NextRequest) {
  try {
    const { image, orderId } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Validate image data URL
    if (!image.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Invalid image format. Expected base64 data URL' },
        { status: 400 }
      );
    }

    // Check image size (rough estimate for base64)
    const base64Length = image.length - image.indexOf(',') - 1;
    const estimatedSize = (base64Length * 3) / 4;
    if (estimatedSize > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Generate cache key from image hash
    const imageHash = createHash('md5').update(image).digest('hex');
    const cacheKey = `lot-extract-${imageHash}`;

    // Check cache
    const cached = extractionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Using cached lot extraction for order ${orderId}`);
      return NextResponse.json({
        ...cached.result,
        orderId,
        fromCache: true
      });
    }

    // Keep the base64 image with data URL prefix for OpenAI
    const prompt = `
      Analyze this image of a chemical container label and extract ALL lot numbers, batch numbers, or similar identifiers.

      Look for:
      - Lot numbers (may be labeled as "LOT", "LOT#", "LOT NO", etc.)
      - Batch numbers (may be labeled as "BATCH", "BATCH#", etc.)
      - Manufacturing codes
      - Date codes that might serve as lot identifiers
      - Any alphanumeric codes that appear to be tracking numbers

      Return ONLY a JSON array of the lot/batch numbers found, with no additional text or explanation.
      If no lot numbers are found, return an empty array.

      Example response format:
      ["LOT123456", "BATCH-789", "2024-001"]
    `;

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not configured');
      return NextResponse.json(
        {
          error: 'AI service not configured',
          details: 'Please configure OPENAI_API_KEY environment variable'
        },
        { status: 503 }
      );
    }

    const response = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: image } }
            ]
          }
        ],
        max_completion_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const payload = await response.json();
    const text = payload.choices?.[0]?.message?.content || '[]';
    
    // Parse the response to extract lot numbers
    let lotNumbers: string[] = [];
    try {
      // Try to parse as JSON array
      const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
      lotNumbers = JSON.parse(cleanedText);
      
      // Ensure it's an array of strings
      if (!Array.isArray(lotNumbers)) {
        lotNumbers = [];
      } else {
        lotNumbers = lotNumbers.filter(item => typeof item === 'string' && item.trim() !== '');
      }
    } catch (parseError) {
      // If parsing fails, try to extract lot numbers from the text
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      
      // Fallback: Look for patterns that might be lot numbers
      const patterns = [
        /LOT[\s#:]*([A-Z0-9\-]+)/gi,
        /BATCH[\s#:]*([A-Z0-9\-]+)/gi,
        /\b[A-Z]{2,3}\d{4,}\b/g, // Common lot number format
      ];
      
      const matches = new Set<string>();
      patterns.forEach(pattern => {
        const found = text.matchAll(pattern);
        for (const match of found) {
          matches.add(match[1] || match[0]);
        }
      });
      
      lotNumbers = Array.from(matches);
    }

    // Log for debugging
    console.log(`Extracted lot numbers for order ${orderId}:`, lotNumbers);

    // Cache the result
    const result = {
      lotNumbers,
      confidence: lotNumbers.length > 0 ? 0.85 : 0.0, // Basic confidence score
      processedAt: new Date().toISOString()
    };

    extractionCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Clean old cache entries
    if (extractionCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of extractionCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
          extractionCache.delete(key);
        }
      }
    }

    return NextResponse.json({
      ...result,
      orderId
    });

  } catch (error) {
    console.error('Error processing image with OpenAI:', error);

    // Provide more specific error messages
    let errorMessage = 'Failed to process image';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
        statusCode = 429;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
        statusCode = 504;
      } else if (error.message.includes('API key')) {
        errorMessage = 'Service configuration error';
        statusCode = 503;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini Pro with vision capabilities
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { image, orderId } = await request.json();
    
    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Remove data URL prefix to get base64 string
    const base64Image = image.replace(/^data:image\/\w+;base64,/, '');
    
    // Use Gemini Pro Vision model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
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

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
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
      console.error('Failed to parse Gemini response as JSON:', parseError);
      
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

    return NextResponse.json({
      lotNumbers,
      orderId,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing image with Gemini:', error);
    return NextResponse.json(
      { error: 'Failed to process image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
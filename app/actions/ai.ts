'use server'

import { openaiChat, openaiEmbedding, openaiService } from '@/lib/services/ai/openai-service'

type GenericRecord = Record<string, unknown>

export async function processDocumentOCR(data: {
  file: File
  documentType: string
}) {
  try {
    const { file, documentType } = data

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    const prompt = `You are an OCR assistant for chemical logistics.\n` +
      `Extract key information from the attached ${documentType.replace(/_/g, ' ')} and respond with plain text.`

    const content = await openaiChat([
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}` } },
        ],
      },
    ], {
      maxTokens: 900,
    })

    return {
      success: true,
      extractedText: content,
      documentType,
    }
  } catch (error) {
    console.error('Error processing document with OCR:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process document',
    }
  }
}

export async function detectAnomalies(data: {
  orderData: GenericRecord
  inspectionData: GenericRecord
}) {
  try {
    const { orderData, inspectionData } = data

    const prompt = `Analyze this warehouse inspection data for anomalies.\n\n` +
      `Order Data: ${JSON.stringify(orderData, null, 2)}\n` +
      `Inspection Data: ${JSON.stringify(inspectionData, null, 2)}\n\n` +
      `Identify issues and respond in JSON with anomalies (array), severity (low|medium|high|critical) and recommendations (array).`

    const content = await openaiChat([
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
    ], {
      maxTokens: 600,
      responseFormat: { type: 'json_object' },
    })

    let analysis: GenericRecord
    try {
      analysis = JSON.parse(content)
    } catch {
      analysis = {
        anomalies: [content || 'Unable to parse analysis'],
        severity: 'medium',
        recommendations: [],
      }
    }

    return {
      success: true,
      analysis,
    }
  } catch (error) {
    console.error('Error detecting anomalies:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect anomalies',
    }
  }
}

export async function extractLotNumbers(data: {
  imageBase64: string
  mimeType: string
}) {
  try {
    const { imageBase64, mimeType } = data

    const prompt = `Extract all lot numbers, batch codes, serial numbers, manufacturing dates, and expiration dates visible in the image. ` +
      `Return ONLY a JSON array of strings. If none found, return an empty array.`

    const content = await openaiChat([
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ], {
      maxTokens: 400,
    })

    let lotNumbers: string[] = []
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        lotNumbers = JSON.parse(jsonMatch[0])
      }
    } catch {
      lotNumbers = content.match(/[A-Z0-9-]{4,}/gi) || []
    }

    return {
      success: true,
      lotNumbers,
    }
  } catch (error) {
    console.error('Error extracting lot numbers:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract lot numbers',
    }
  }
}

export async function generateFreightEmbedding(text: string) {
  return openaiEmbedding(text)
}

export const aiAnalysisService = openaiService

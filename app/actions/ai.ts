'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '')
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

export async function processDocumentOCR(data: {
  file: File
  documentType: string
}) {
  try {
    const { file, documentType } = data
    
    // Convert file to base64
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')
    
    // Prepare prompt based on document type
    let prompt = ''
    switch (documentType) {
      case 'bill_of_lading':
        prompt = 'Extract all text from this Bill of Lading. Focus on: shipper, consignee, carrier, tracking numbers, commodity description, weight, and special instructions.'
        break
      case 'certificate_of_analysis':
        prompt = 'Extract all data from this Certificate of Analysis. Include: product name, batch/lot number, test results, specifications, and approval signatures.'
        break
      case 'safety_data_sheet':
        prompt = 'Extract key information from this Safety Data Sheet. Include: product identifier, hazard classification, composition, first aid measures, and handling precautions.'
        break
      case 'customs_form':
        prompt = 'Extract all customs information. Include: declaration numbers, commodity codes, values, countries of origin, and regulatory compliance statements.'
        break
      default:
        prompt = 'Extract all readable text from this document. Organize the information in a structured format.'
    }
    
    // Call Gemini API
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: file.type,
          data: base64
        }
      }
    ])
    
    const response = await result.response
    const text = response.text()
    
    return {
      success: true,
      extractedText: text,
      documentType
    }
  } catch (error) {
    console.error('Error processing document with OCR:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process document'
    }
  }
}

type GenericRecord = Record<string, unknown>;

export async function detectAnomalies(data: {
  orderData: GenericRecord;
  inspectionData: GenericRecord;
}) {
  try {
    const { orderData, inspectionData } = data
    
    const prompt = `Analyze this warehouse inspection data for anomalies:
    
Order Data: ${JSON.stringify(orderData, null, 2)}
Inspection Data: ${JSON.stringify(inspectionData, null, 2)}

Look for:
1. Quantity mismatches
2. Product discrepancies
3. Damaged containers
4. Missing documentation
5. Safety concerns
6. Unusual patterns

Return a JSON object with:
- anomalies: array of detected issues
- severity: low/medium/high/critical
- recommendations: suggested actions`
    
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Try to parse as JSON
    let analysis
    try {
      // Extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        analysis = { anomalies: [text], severity: 'medium', recommendations: [] }
      }
    } catch {
      analysis = { anomalies: [text], severity: 'medium', recommendations: [] }
    }
    
    return {
      success: true,
      analysis
    }
  } catch (error) {
    console.error('Error detecting anomalies:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect anomalies'
    }
  }
}

export async function extractLotNumbers(data: {
  imageBase64: string
  mimeType: string
}) {
  try {
    const { imageBase64, mimeType } = data

    const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const prompt = `Extract all lot numbers, batch codes, and serial numbers visible in this image.
Look for:
- Lot numbers (LOT, L#, Lot#)
- Batch codes (BATCH, B#)
- Serial numbers (S/N, SN)
- Manufacturing dates
- Expiration dates

Return ONLY a JSON array of the extracted codes, like: ["LOT123", "BATCH456"]
If no codes are found, return an empty array: []`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 300
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    const text = result.choices[0]?.message?.content || ''

    // Try to parse as JSON array
    let lotNumbers = []
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        lotNumbers = JSON.parse(jsonMatch[0])
      }
    } catch {
      // Fallback: extract any alphanumeric codes that look like lot numbers
      const matches = text.match(/[A-Z0-9]{4,}/gi) || []
      lotNumbers = matches
    }

    return {
      success: true,
      lotNumbers
    }
  } catch (error) {
    console.error('Error extracting lot numbers:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract lot numbers'
    }
  }
}

export async function classifyHazmat(data: {
  sku: string
  productName: string
}) {
  try {
    const { sku, productName } = data
    
    const prompt = `Classify this chemical product for hazmat shipping:
Product: ${productName}
SKU: ${sku}

Determine:
1. UN Number (if hazardous)
2. Hazard Class
3. Packing Group
4. Proper Shipping Name
5. Is it exempt from hazmat regulations?

Return JSON with:
- un_number: string or null
- hazard_class: string or null
- packing_group: "I", "II", "III" or null
- proper_shipping_name: string
- is_hazmat: boolean
- exemption_reason: string or null
- confidence: number (0-1)`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Parse JSON response
    let classification
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        classification = JSON.parse(jsonMatch[0])
      } else {
        classification = {
          un_number: null,
          hazard_class: null,
          packing_group: null,
          proper_shipping_name: productName,
          is_hazmat: false,
          exemption_reason: 'Unable to determine classification',
          confidence: 0
        }
      }
    } catch {
      classification = {
        un_number: null,
        hazard_class: null,
        packing_group: null,
        proper_shipping_name: productName,
        is_hazmat: false,
        exemption_reason: 'Classification error',
        confidence: 0
      }
    }
    
    return {
      success: true,
      ...classification
    }
  } catch (error) {
    console.error('Error classifying hazmat:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to classify hazmat'
    }
  }
}

export async function ragChat(data: {
  query: string
}) {
  try {
    // Here you would implement your RAG logic
    // For now, returning a mock response
    // You can integrate with your existing RAG system
    
    const prompt = `
      You are a hazmat classification assistant.
      Query: ${data.query}
      
      Provide helpful information about hazmat regulations, classifications, and shipping requirements.
    `
    
    const result = await model.generateContent(prompt)
    const response = result.response.text()
    
    return {
      success: true,
      answer: response,
      sources: [],
      confidence: 0.8
    }
  } catch (error) {
    console.error('RAG chat error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process query'
    }
  }
}

export async function reportIssue(data: {
  issueType: string
  description: string
  severity: string
  imageBase64?: string
  mimeType?: string
  workspaceId?: string
}) {
  try {
    const { issueType, description, severity, imageBase64, mimeType } = data
    
    const prompt = `Analyze this warehouse issue report:
Type: ${issueType}
Severity: ${severity}
Description: ${description}

Provide:
1. Risk assessment
2. Immediate actions required
3. Root cause possibilities
4. Prevention recommendations

Format as JSON with keys: riskLevel, immediateActions, rootCauses, preventionSteps`
    
    const content: Array<string | { inlineData: { mimeType: string; data: string } }> = [prompt]
    
    if (imageBase64 && mimeType) {
      content.push({
        inlineData: {
          mimeType,
          data: imageBase64
        }
      })
    }
    
    const result = await model.generateContent(content)
    const response = await result.response
    const text = response.text()
    
    // Try to parse as JSON
    let analysis
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        analysis = {
          riskLevel: severity,
          immediateActions: ['Review issue with supervisor'],
          rootCauses: ['To be investigated'],
          preventionSteps: ['Follow up required']
        }
      }
    } catch {
      analysis = {
        riskLevel: severity,
        immediateActions: ['Review issue with supervisor'],
        rootCauses: ['To be investigated'],
        preventionSteps: ['Follow up required']
      }
    }
    
    return {
      success: true,
      issueId: Math.random().toString(36).substring(7),
      analysis,
      reportedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error reporting issue:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to report issue'
    }
  }
}

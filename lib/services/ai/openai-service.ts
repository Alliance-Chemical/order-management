const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5-nano-2025-08-07'
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small'

if (!OPENAI_API_KEY) {
  console.warn('[OpenAI] OPENAI_API_KEY is not configured; AI features will fail until it is set.')
}

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >
}

interface ChatOptions {
  maxTokens?: number
  temperature?: number
  responseFormat?: { type: 'json_schema' | 'json_object' | 'text'; json_schema?: unknown }
}

async function callOpenAIChat(messages: ChatMessage[], options: ChatOptions = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const body: Record<string, unknown> = {
    model: OPENAI_CHAT_MODEL,
    messages,
    temperature: options.temperature ?? 1,
  }

  if (options.maxTokens) {
    body.max_completion_tokens = options.maxTokens
  }

  if (options.responseFormat) {
    body.response_format = options.responseFormat
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText)
    throw new Error(`OpenAI chat error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }

  return payload.choices?.[0]?.message?.content?.trim() ?? ''
}

async function createEmbedding(input: string) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBED_MODEL,
      input,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText)
    throw new Error(`OpenAI embedding error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const payload = await response.json() as {
    data: Array<{ embedding: number[] }>
  }

  return payload.data?.[0]?.embedding ?? []
}

export async function openaiChat(messages: ChatMessage[], options?: ChatOptions) {
  return callOpenAIChat(messages, options)
}

export async function openaiEmbedding(text: string) {
  return createEmbedding(text)
}

export class OpenAIService {
  async processVoiceNote(transcription: string) {
    const prompt = `You are an incident triage assistant for a chemical warehouse.\n` +
      `Classify the following inspection voice note transcript. Return JSON with:\n` +
      `transcription (string), issueType (damage | contamination | labeling | quantity | packaging | other), severity (low | medium | high), suggestedAction (string).\n` +
      `Transcript: ${transcription}`

    const content = await callOpenAIChat([
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
    ], {
      maxTokens: 400,
      responseFormat: { type: 'json_object' },
    })

    try {
      return JSON.parse(content)
    } catch {
      return {
        transcription,
        issueType: 'other',
        severity: 'medium',
        suggestedAction: 'Review manually',
      }
    }
  }

  async analyzeInspectionImage(imageBase64: string, context: string) {
    const prompt = `Analyze this inspection photo from a chemical warehouse.\n` +
      `Context: ${context}\n` +
      `Return JSON with detected_issues (string array), confidence (0-100), recommendations (string array), requires_supervisor (boolean).`

    const content = await callOpenAIChat([
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      },
    ], {
      maxTokens: 600,
      responseFormat: { type: 'json_object' },
    })

    try {
      return JSON.parse(content)
    } catch {
      return {
        detected_issues: ['Unable to process image'],
        confidence: 0,
        recommendations: ['Manual inspection required'],
        requires_supervisor: true,
      }
    }
  }

  async extractDocumentData(documentBase64: string, documentType: 'BOL' | 'COA') {
    const instructions = documentType === 'BOL'
      ? `Extract Bill of Lading fields: bol_number, carrier_name, ship_date, delivery_date, origin_address, destination_address, product_details (array with name, quantity, weight), special_instructions, hazmat_information.`
      : `Extract Certificate of Analysis fields: certificate_number, product_name, batch_number, manufacturing_date, expiration_date, test_results (array with test and result), specifications_met, quality_control_signature, lab_information.`

    const prompt = `${instructions}\nReturn JSON with extracted_data (object), confidence_scores (object with 0-100 values), validation_errors (string array).`

    const content = await callOpenAIChat([
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${documentBase64}` } },
        ],
      },
    ], {
      maxTokens: 800,
      responseFormat: { type: 'json_object' },
    })

    try {
      return JSON.parse(content)
    } catch {
      return {
        extracted_data: {},
        confidence_scores: {},
        validation_errors: ['Document processing failed'],
      }
    }
  }

  async detectAnomalies(historicalData: Array<{
    product: string
    customer: string | null
    failures: Array<{ type: string; date: Date | null; severity: string }>
    total_inspections: number
  }>) {
    const prompt = `You are an operations analyst.\n` +
      `Analyze the following inspection history for risk patterns.\n` +
      `${JSON.stringify(historicalData)}\n` +
      `Return JSON with risk_patterns (array of { pattern, risk_score (0-100), affected_products, affected_customers, recommendation }) and high_risk_combinations (array of { product, customer, predicted_failure_rate (0-1), common_issues }).`

    const content = await callOpenAIChat([
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
    ], {
      maxTokens: 800,
      responseFormat: { type: 'json_object' },
    })

    try {
      return JSON.parse(content)
    } catch {
      return {
        risk_patterns: [],
        high_risk_combinations: [],
      }
    }
  }

  async generateEmbedding(text: string) {
    return await createEmbedding(text)
  }
}

export const openaiService = new OpenAIService()

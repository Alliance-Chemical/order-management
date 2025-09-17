import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export class GeminiService {
  private model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  private visionModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  async processVoiceNote(audioBase64: string): Promise<{
    transcription: string;
    issueType: string;
    severity: 'low' | 'medium' | 'high';
    suggestedAction: string;
  }> {
    const prompt = `
      Analyze this voice transcription from a warehouse worker reporting an inspection issue.
      Extract:
      1. The main issue type (damage, contamination, labeling, quantity, packaging, other)
      2. Severity level (low, medium, high)
      3. Suggested immediate action
      
      Audio transcription: ${audioBase64}
      
      Return JSON format only.
    `;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      return {
        transcription: audioBase64,
        issueType: 'other',
        severity: 'medium',
        suggestedAction: 'Review manually'
      };
    }
  }

  async analyzeInspectionImage(imageBase64: string, context: string): Promise<{
    detected_issues: string[];
    confidence: number;
    recommendations: string[];
    requires_supervisor: boolean;
  }> {
    const prompt = `
      Analyze this inspection image from a chemical warehouse.
      Context: ${context}
      
      Look for:
      - Physical damage (dents, leaks, tears)
      - Label issues (missing, damaged, incorrect)
      - Contamination signs
      - Packaging integrity
      - Safety hazards
      
      Return a JSON with:
      - detected_issues: array of specific issues found
      - confidence: 0-100 score
      - recommendations: array of actions to take
      - requires_supervisor: boolean if immediate escalation needed
    `;

    const result = await this.visionModel.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg'
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      return {
        detected_issues: ['Unable to process image'],
        confidence: 0,
        recommendations: ['Manual inspection required'],
        requires_supervisor: true
      };
    }
  }

  async extractDocumentData(documentBase64: string, documentType: 'BOL' | 'COA'): Promise<{
    extracted_data: Record<string, unknown>;
    confidence_scores: Record<string, number>;
    validation_errors: string[];
  }> {
    const prompts = {
      BOL: `
        Extract from this Bill of Lading:
        - BOL Number
        - Carrier Name
        - Ship Date
        - Delivery Date
        - Origin Address
        - Destination Address
        - Product Details (name, quantity, weight)
        - Special Instructions
        - Hazmat Information
      `,
      COA: `
        Extract from this Certificate of Analysis:
        - Certificate Number
        - Product Name
        - Batch/Lot Number
        - Manufacturing Date
        - Expiration Date
        - Test Results (list all)
        - Specifications Met
        - Quality Control Signature
        - Lab Information
      `
    };

    const result = await this.visionModel.generateContent([
      `${prompts[documentType]}
      
      Return as JSON with:
      - extracted_data: object with all fields
      - confidence_scores: object with confidence (0-100) for each field
      - validation_errors: array of any issues or missing required fields`,
      {
        inlineData: {
          data: documentBase64,
          mimeType: 'image/png'
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      return {
        extracted_data: {},
        confidence_scores: {},
        validation_errors: ['Document processing failed']
      };
    }
  }

  async detectAnomalies(historicalData: {
    product: string;
    customer: string;
    failures: Array<{ type: string; date: Date; severity: string }>;
    total_inspections: number;
  }[]): Promise<{
    risk_patterns: Array<{
      pattern: string;
      risk_score: number;
      affected_products: string[];
      affected_customers: string[];
      recommendation: string;
    }>;
    high_risk_combinations: Array<{
      product: string;
      customer: string;
      predicted_failure_rate: number;
      common_issues: string[];
    }>;
  }> {
    const prompt = `
      Analyze this historical inspection data for patterns and anomalies:
      ${JSON.stringify(historicalData)}
      
      Identify:
      1. Statistical patterns in failure rates
      2. Product-customer combinations with high risk
      3. Seasonal or temporal patterns
      4. Common failure modes by product type
      
      Return JSON with:
      - risk_patterns: array of identified patterns with risk scores
      - high_risk_combinations: specific product-customer pairs to watch
    `;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      return {
        risk_patterns: [],
        high_risk_combinations: []
      };
    }
  }
}

export const geminiService = new GeminiService();

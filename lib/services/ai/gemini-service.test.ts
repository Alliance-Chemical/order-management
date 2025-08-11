import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GeminiService } from './gemini-service'

// Mock the Google Generative AI module
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: vi.fn().mockReturnValue(JSON.stringify({
            bolNumber: 'TEST-BOL-123',
            shipDate: '2024-01-15',
            carrier: 'Test Carrier',
            weight: '500 lbs',
            customerName: 'Test Customer',
            productDetails: [
              {
                name: 'Chemical Product A',
                quantity: '2 drums',
                weight: '250 lbs each'
              }
            ],
            confidence: 0.95
          }))
        }
      })
    })
  }))
}))

describe('GeminiService', () => {
  let geminiService: GeminiService
  
  beforeEach(() => {
    // Set test API key
    process.env.GEMINI_API_KEY = 'test-api-key'
    geminiService = new GeminiService()
  })

  describe('processDocument', () => {
    it('should extract data from BOL document', async () => {
      // Create a mock image buffer
      const mockImageBuffer = Buffer.from('fake-image-data')
      
      // Process the document
      const result = await geminiService.processDocument(mockImageBuffer, 'bol')
      
      // Assert the extracted data
      expect(result).toBeDefined()
      expect(result.bolNumber).toBe('TEST-BOL-123')
      expect(result.shipDate).toBe('2024-01-15')
      expect(result.carrier).toBe('Test Carrier')
      expect(result.weight).toBe('500 lbs')
      expect(result.customerName).toBe('Test Customer')
      expect(result.productDetails).toHaveLength(1)
      expect(result.productDetails[0].name).toBe('Chemical Product A')
      expect(result.confidence).toBe(0.95)
    })
    
    it('should extract data from COA document', async () => {
      // Mock a different response for COA
      const GoogleGenerativeAI = (await import('@google/generative-ai')).GoogleGenerativeAI
      vi.mocked(GoogleGenerativeAI).mockImplementationOnce(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: vi.fn().mockReturnValue(JSON.stringify({
                certificateNumber: 'COA-2024-001',
                productName: 'Chemical Product A',
                batchNumber: 'BATCH-123',
                testDate: '2024-01-10',
                specifications: {
                  purity: '99.5%',
                  ph: '7.0',
                  viscosity: '100 cP'
                },
                testResults: {
                  purity: '99.7%',
                  ph: '7.1',
                  viscosity: '98 cP'
                },
                passed: true,
                confidence: 0.98
              }))
            }
          })
        })
      }))
      
      // Recreate service to use new mock
      geminiService = new GeminiService()
      
      // Create a mock image buffer
      const mockImageBuffer = Buffer.from('fake-coa-image-data')
      
      // Process the document
      const result = await geminiService.processDocument(mockImageBuffer, 'coa')
      
      // Assert the extracted data
      expect(result).toBeDefined()
      expect(result.certificateNumber).toBe('COA-2024-001')
      expect(result.productName).toBe('Chemical Product A')
      expect(result.batchNumber).toBe('BATCH-123')
      expect(result.specifications.purity).toBe('99.5%')
      expect(result.testResults.purity).toBe('99.7%')
      expect(result.passed).toBe(true)
      expect(result.confidence).toBe(0.98)
    })
    
    it('should handle API errors gracefully', async () => {
      // Mock an API error
      const GoogleGenerativeAI = (await import('@google/generative-ai')).GoogleGenerativeAI
      vi.mocked(GoogleGenerativeAI).mockImplementationOnce(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockRejectedValue(new Error('API Error'))
        })
      }))
      
      // Recreate service to use new mock
      geminiService = new GeminiService()
      
      // Create a mock image buffer
      const mockImageBuffer = Buffer.from('fake-image-data')
      
      // Process should throw error
      await expect(geminiService.processDocument(mockImageBuffer, 'bol')).rejects.toThrow('API Error')
    })
  })

  describe('analyzeIssue', () => {
    it('should analyze inspection issue from voice and image', async () => {
      // Mock issue analysis response
      const GoogleGenerativeAI = (await import('@google/generative-ai')).GoogleGenerativeAI
      vi.mocked(GoogleGenerativeAI).mockImplementationOnce(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: vi.fn().mockReturnValue(JSON.stringify({
                issueType: 'damage',
                severity: 'high',
                description: 'Significant dent on drum side, potential leak risk',
                suggestedActions: [
                  'Quarantine affected drum',
                  'Notify supervisor immediately',
                  'Request replacement from supplier'
                ],
                requiresEscalation: true,
                confidence: 0.92
              }))
            }
          })
        })
      }))
      
      // Recreate service to use new mock
      geminiService = new GeminiService()
      
      // Create mock inputs
      const mockVoiceTranscript = 'There is a large dent on the side of drum number 2'
      const mockImageBuffer = Buffer.from('fake-damage-image')
      
      // Analyze the issue
      const result = await geminiService.analyzeIssue(mockVoiceTranscript, mockImageBuffer)
      
      // Assert the analysis results
      expect(result).toBeDefined()
      expect(result.issueType).toBe('damage')
      expect(result.severity).toBe('high')
      expect(result.description).toContain('dent')
      expect(result.suggestedActions).toHaveLength(3)
      expect(result.requiresEscalation).toBe(true)
      expect(result.confidence).toBe(0.92)
    })
  })

  describe('detectAnomalies', () => {
    it('should detect patterns in historical data', async () => {
      // Mock anomaly detection response
      const GoogleGenerativeAI = (await import('@google/generative-ai')).GoogleGenerativeAI
      vi.mocked(GoogleGenerativeAI).mockImplementationOnce(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: vi.fn().mockReturnValue(JSON.stringify({
                anomalies: [
                  {
                    type: 'failure_rate_spike',
                    description: 'Increased failure rate for Product A from Customer X',
                    riskLevel: 'medium',
                    pattern: 'Failures increased from 2% to 15% over last 10 orders',
                    recommendation: 'Review storage conditions and handling procedures'
                  },
                  {
                    type: 'seasonal_pattern',
                    description: 'Higher inspection failures during summer months',
                    riskLevel: 'low',
                    pattern: 'Temperature-sensitive products show 3x failure rate June-August',
                    recommendation: 'Implement enhanced climate control measures'
                  }
                ],
                overallRiskScore: 0.65,
                confidence: 0.88
              }))
            }
          })
        })
      }))
      
      // Recreate service to use new mock
      geminiService = new GeminiService()
      
      // Create mock historical data
      const mockHistoricalData = {
        orders: [
          { product: 'Product A', customer: 'Customer X', failed: true },
          { product: 'Product A', customer: 'Customer X', failed: false },
          // ... more data
        ],
        timeRange: '2024-01-01 to 2024-01-31'
      }
      
      // Detect anomalies
      const result = await geminiService.detectAnomalies(mockHistoricalData)
      
      // Assert the detection results
      expect(result).toBeDefined()
      expect(result.anomalies).toHaveLength(2)
      expect(result.anomalies[0].type).toBe('failure_rate_spike')
      expect(result.anomalies[0].riskLevel).toBe('medium')
      expect(result.anomalies[1].type).toBe('seasonal_pattern')
      expect(result.overallRiskScore).toBe(0.65)
      expect(result.confidence).toBe(0.88)
    })
  })
})
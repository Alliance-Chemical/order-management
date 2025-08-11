import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock environment variables for tests
vi.stubEnv('DATABASE_URL', process.env.DATABASE_URL || 'postgres://test')
vi.stubEnv('SHIPSTATION_API_KEY', 'test-api-key')
vi.stubEnv('SHIPSTATION_API_SECRET', 'test-api-secret')
vi.stubEnv('AWS_REGION', 'us-east-2')
vi.stubEnv('S3_DOCUMENTS_BUCKET', 'test-bucket')
vi.stubEnv('QR_GENERATION_QUEUE_URL', 'https://sqs.test.url')
vi.stubEnv('ALERT_QUEUE_URL', 'https://sqs.alert.test.url')
vi.stubEnv('SNS_SUPERVISOR_ALERTS_TOPIC', 'test-topic')
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key')

// Mock fetch for API tests
global.fetch = vi.fn()

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})
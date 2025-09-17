import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from './route'
import { createTestDb, cleanupTestDb, seedTestWorkspace } from '@/tests/helpers/db'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema/qr-workspace'

describe('/api/workspace/[orderId]/qrcodes', () => {
  let testDb: ReturnType<typeof createTestDb>
  
  beforeEach(() => {
    testDb = createTestDb()
  })
  
  afterEach(async () => {
    await cleanupTestDb(testDb)
  })

  describe('GET /api/workspace/[orderId]/qrcodes', () => {
    it('should generate QR codes on-demand if none exist', async () => {
      // Seed workspace without QR codes
      const workspace = await seedTestWorkspace(testDb, '12345')
      
      // Mock the database connection
      vi.mock('@/lib/db', () => ({
        db: testDb
      }))
      
      // Mock QR code generation
      vi.mock('qrcode', () => ({
        toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode')
      }))
      
      // Create a mock request
      const request = new NextRequest('http://localhost:3000/api/workspace/12345/qrcodes')
      
      // Call the handler
      const response = await GET(request, { params: { orderId: '12345' } })
      
      // Assert the response
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.qrCodes).toBeDefined()
      expect(data.qrCodes.length).toBeGreaterThan(0)
      
      // Check that Master QR was created
      const masterQR = data.qrCodes.find((qr: { type: string }) => qr.type === 'master')
      expect(masterQR).toBeDefined()
      expect(masterQR.label).toBe('MASTER-12345')
      
      // Check that Container QRs were created (2 drums as per test data)
      const containerQRs = data.qrCodes.filter((qr: { type: string }) => qr.type === 'container')
      expect(containerQRs.length).toBe(2)
      expect(containerQRs[0].label).toContain('DRUM-1-12345')
      expect(containerQRs[1].label).toContain('DRUM-2-12345')
      
      // Verify QR codes were saved to database
      const savedQRs = await testDb.select().from(schema.qrCodes).where(
        schema.qrCodes.workspaceId === workspace.id
      )
      expect(savedQRs.length).toBe(3) // 1 master + 2 containers
    })
    
    it('should return existing QR codes if they already exist', async () => {
      // Seed workspace with existing QR codes
      const workspace = await seedTestWorkspace(testDb, '12345')
      
      // Add existing QR codes
      await testDb.insert(schema.qrCodes).values([
        {
          workspaceId: workspace.id,
          type: 'master',
          label: 'MASTER-12345',
          data: JSON.stringify({ orderId: '12345', type: 'master' }),
          imageUrl: 'data:image/png;base64,existingMasterQR',
          scanned: false,
          scannedAt: null,
          scannedBy: null
        },
        {
          workspaceId: workspace.id,
          type: 'container',
          label: 'DRUM-1-12345',
          data: JSON.stringify({ orderId: '12345', type: 'container', drumNumber: 1 }),
          imageUrl: 'data:image/png;base64,existingDrum1QR',
          scanned: false,
          scannedAt: null,
          scannedBy: null
        }
      ])
      
      // Mock the database connection
      vi.mock('@/lib/db', () => ({
        db: testDb
      }))
      
      // Create a mock request
      const request = new NextRequest('http://localhost:3000/api/workspace/12345/qrcodes')
      
      // Call the handler
      const response = await GET(request, { params: { orderId: '12345' } })
      
      // Assert the response
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.qrCodes).toBeDefined()
      expect(data.qrCodes.length).toBe(2)
      
      // Verify existing QR codes are returned
      expect(data.qrCodes[0].imageUrl).toBe('data:image/png;base64,existingMasterQR')
      expect(data.qrCodes[1].imageUrl).toBe('data:image/png;base64,existingDrum1QR')
    })
    
    it('should return 404 for non-existent workspace', async () => {
      // Mock the database connection
      vi.mock('@/lib/db', () => ({
        db: testDb
      }))
      
      // Create a mock request for non-existent order
      const request = new NextRequest('http://localhost:3000/api/workspace/99999/qrcodes')
      
      // Call the handler
      const response = await GET(request, { params: { orderId: '99999' } })
      
      // Assert the response
      expect(response.status).toBe(404)
      
      const data = await response.json()
      expect(data.error).toBe('Workspace not found')
    })
  })
})

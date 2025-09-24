import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET, PUT } from './route'
import { createTestDb, cleanupTestDb, seedTestWorkspace } from '@/tests/helpers/db'
import { NextRequest } from 'next/server'

const mockedDb = vi.hoisted(() => ({ db: undefined as unknown }))

vi.mock('@/lib/db', () => mockedDb)

describe.skip('/api/workspace/[orderId]', () => {
  let testDb: ReturnType<typeof createTestDb>
  
  beforeEach(() => {
    testDb = createTestDb()
    mockedDb.db = testDb
  })
  
  afterEach(async () => {
    await cleanupTestDb(testDb)
    mockedDb.db = undefined
  })

  describe('GET /api/workspace/[orderId]', () => {
    it('should fetch a workspace successfully', async () => {
      // Seed test data
      await seedTestWorkspace(testDb, '12345')
      
      // Mock the database connection in the route handler
      // Create a mock request
      const request = new NextRequest('http://localhost:3000/api/workspace/12345')
      
      // Call the handler
      const response = await GET(request, { params: { orderId: '12345' } })
      
      // Assert the response
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.orderNumber).toBe('12345')
      expect(data.status).toBe('pending')
      expect(data.workflowPhase).toBe('pre_mix')
      expect(data.metadata.customerName).toBe('Test Customer')
    })
    
    it('should return 404 for non-existent workspace', async () => {
      // Mock the database connection
      // Create a mock request for non-existent order
      const request = new NextRequest('http://localhost:3000/api/workspace/99999')
      
      // Call the handler
      const response = await GET(request, { params: { orderId: '99999' } })
      
      // Assert the response
      expect(response.status).toBe(404)
      
      const data = await response.json()
      expect(data.error).toBe('Workspace not found')
    })
  })

  describe('PUT /api/workspace/[orderId]', () => {
    it('should update workspace module status', async () => {
      // Seed test data
      await seedTestWorkspace(testDb, '12345')
      
      // Mock the database connection
      // Create a mock request with update data
      const updateData = {
        module: 'inspection',
        status: 'in_progress',
        data: {
          inspector: 'John Doe',
          timestamp: new Date().toISOString()
        }
      }
      
      const request = new NextRequest('http://localhost:3000/api/workspace/12345', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      // Call the handler
      const response = await PUT(request, { params: { orderId: '12345' } })
      
      // Assert the response
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.workspace.modules.inspection.status).toBe('in_progress')
      expect(data.workspace.modules.inspection.inspector).toBe('John Doe')
    })
    
    it('should handle invalid module updates', async () => {
      // Seed test data
      await seedTestWorkspace(testDb, '12345')
      // Create a mock request with invalid module
      const updateData = {
        module: 'invalid_module',
        status: 'in_progress'
      }
      
      const request = new NextRequest('http://localhost:3000/api/workspace/12345', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      // Call the handler
      const response = await PUT(request, { params: { orderId: '12345' } })
      
      // Assert the response
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toBeTruthy()
    })
  })
})

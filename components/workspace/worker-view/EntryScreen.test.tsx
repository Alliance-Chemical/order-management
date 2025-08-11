import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EntryScreen from './EntryScreen'

describe('EntryScreen Component', () => {
  const mockWorkspace = {
    id: 'test-id',
    orderNumber: 'TEST-001',
    shipStationOrderId: 'TEST-001',
    shipStationOrderKey: 'key-TEST-001',
    status: 'pending',
    workflowPhase: 'pre_mix',
    currentUsers: [],
    currentViewMode: 'worker',
    modules: {
      inspection: {
        status: 'not_started',
        inspector: null,
        timestamp: null,
        results: {},
        issues: []
      },
      documentation: {
        status: 'not_started',
        documents: [],
        timestamp: null
      },
      shipping: {
        status: 'not_started',
        carrier: null,
        trackingNumber: null,
        timestamp: null
      },
      quality: {
        status: 'not_started',
        inspector: null,
        results: {},
        timestamp: null
      }
    },
    metadata: {
      customerName: 'Test Customer Corp',
      productName: 'Chemical Product X',
      quantity: 5,
      drumCount: 5,
      orderDate: '2024-01-15T10:00:00Z',
      orderTotal: 5000.00,
      items: [
        {
          sku: 'CHEM-001',
          name: 'Chemical Product X',
          quantity: 5,
          unitPrice: 1000.00,
          lineItemTotal: 5000.00
        }
      ]
    },
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z')
  }

  const mockOnStartInspection = vi.fn()

  it('should display order information correctly', () => {
    render(
      <EntryScreen 
        workspace={mockWorkspace} 
        onStartInspection={mockOnStartInspection}
      />
    )

    // Check order number is displayed
    expect(screen.getByText('TEST-001')).toBeInTheDocument()
    
    // Check customer name is displayed
    expect(screen.getByText('Test Customer Corp')).toBeInTheDocument()
    
    // Check product info is displayed
    expect(screen.getByText(/Chemical Product X/)).toBeInTheDocument()
    expect(screen.getByText(/5 drums/)).toBeInTheDocument()
  })

  it('should show correct phase-based button text', () => {
    // Test Pre-Mix phase
    render(
      <EntryScreen 
        workspace={mockWorkspace} 
        onStartInspection={mockOnStartInspection}
      />
    )
    
    expect(screen.getByRole('button', { name: /Start Pre-Mix Inspection/i })).toBeInTheDocument()
    
    // Clean up
    screen.debug = vi.fn()
  })

  it('should show Pre-Ship inspection for pre_ship phase', () => {
    const preShipWorkspace = {
      ...mockWorkspace,
      workflowPhase: 'pre_ship'
    }
    
    render(
      <EntryScreen 
        workspace={preShipWorkspace} 
        onStartInspection={mockOnStartInspection}
      />
    )
    
    expect(screen.getByRole('button', { name: /Start Pre-Ship Inspection/i })).toBeInTheDocument()
  })

  it('should call onStartInspection when button is clicked', () => {
    render(
      <EntryScreen 
        workspace={mockWorkspace} 
        onStartInspection={mockOnStartInspection}
      />
    )
    
    const startButton = screen.getByRole('button', { name: /Start Pre-Mix Inspection/i })
    fireEvent.click(startButton)
    
    expect(mockOnStartInspection).toHaveBeenCalledTimes(1)
  })

  it('should display order date in readable format', () => {
    render(
      <EntryScreen 
        workspace={mockWorkspace} 
        onStartInspection={mockOnStartInspection}
      />
    )
    
    // Check that date is formatted (exact format may vary based on locale)
    expect(screen.getByText(/January|Jan/)).toBeInTheDocument()
  })

  it('should be accessible with proper ARIA attributes', () => {
    render(
      <EntryScreen 
        workspace={mockWorkspace} 
        onStartInspection={mockOnStartInspection}
      />
    )
    
    // Check for data-testid for E2E testing
    const entryScreen = screen.getByTestId('entry-screen')
    expect(entryScreen).toBeInTheDocument()
    
    // Check button is properly labeled
    const button = screen.getByRole('button')
    expect(button).toHaveAccessibleName()
  })

  it('should handle missing metadata gracefully', () => {
    const workspaceNoMetadata = {
      ...mockWorkspace,
      metadata: null
    }
    
    render(
      <EntryScreen 
        workspace={workspaceNoMetadata} 
        onStartInspection={mockOnStartInspection}
      />
    )
    
    // Should still render without crashing
    expect(screen.getByText('TEST-001')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
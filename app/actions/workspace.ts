'use server'

import { WorkspaceService } from '@/lib/services/workspace/service'
import { revalidatePath } from 'next/cache'
import { getOptimizedDb } from '@/lib/db/neon'
import { workspaces, documents } from '@/lib/db/schema/qr-workspace'
import { eq, desc } from 'drizzle-orm'
import { normalizeFinalMeasurementsPayload } from '@/lib/measurements/normalize'

const workspaceService = new WorkspaceService()

type WorkspaceNote = {
  id: string
  content: string
  author?: string
  type?: string
  createdAt: string
}

type ChecklistItem = Record<string, unknown>

type NotificationEntry = {
  type: string
  status: string
  notes?: string
  timestamp: string
}

export async function createWorkspace(data: {
  orderId: string | number
  orderNumber: string
  userId?: string
}) {
  try {
    const { orderId, orderNumber, userId = 'system' } = data

    if (!orderId || !orderNumber) {
      return {
        success: false,
        error: 'Order ID and order number are required'
      }
    }

    const workspace = await workspaceService.createWorkspace(
      orderId.toString(),
      orderNumber,
      userId
    )

    // Revalidate relevant paths
    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      workspace
    }
  } catch (error) {
    console.error('Error creating workspace:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create workspace'
    }
  }
}

export async function shipWorkspace(orderId: string) {
  try {
    const db = getOptimizedDb()
    
    // Get the workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, BigInt(orderId))
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Update workspace status to shipped
    await db
      .update(workspaces)
      .set({
        status: 'shipped',
        updatedAt: new Date(),
        shippedAt: new Date(),
        workflowPhase: 'completed'
      })
      .where(eq(workspaces.orderId, BigInt(orderId)))

    // Revalidate paths
    revalidatePath('/')
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      message: 'Workspace marked as shipped'
    }
  } catch (error) {
    console.error('Error shipping workspace:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to ship workspace'
    }
  }
}

export async function updateMeasurements(
  orderId: string,
  measurements: unknown
) {
  try {
    const db = getOptimizedDb()
    const normalized = normalizeFinalMeasurementsPayload(measurements, {
      userId:
        typeof (measurements as { measuredBy?: string } | undefined)?.measuredBy === 'string'
          ? ((measurements as { measuredBy: string }).measuredBy?.trim() || 'worker')
          : 'worker',
      timestamp: (measurements as { measuredAt?: string } | undefined)?.measuredAt,
    })

    // Update workspace with measurements
    await db
      .update(workspaces)
      .set({
        finalMeasurements: normalized,
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, BigInt(orderId)))

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      measurements: normalized
    }
  } catch (error) {
    console.error('Error updating measurements:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update measurements'
    }
  }
}

export async function addNote(
  orderId: string,
  note: {
    content: string
    author?: string
    type?: string
  }
) {
  try {
    const db = getOptimizedDb()
    
    // Get current workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, BigInt(orderId))
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Add note to notes array
    const currentNotes = Array.isArray(workspace.notes)
      ? (workspace.notes as WorkspaceNote[])
      : []
    const newNote: WorkspaceNote = {
      id: `note-${Date.now()}`,
      content: note.content,
      author: note.author || 'system',
      type: note.type || 'general',
      createdAt: new Date().toISOString()
    }

    await db
      .update(workspaces)
      .set({
        notes: [...currentNotes, newNote],
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, BigInt(orderId)))

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      note: newNote
    }
  } catch (error) {
    console.error('Error adding note:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add note'
    }
  }
}

export async function updateFinalMeasurements(
  orderId: string,
  measurements: {
    weight: number
    weightUnit: string
    length: number
    width: number
    height: number
    dimensionUnit: string
    palletCount?: number
    packageCount?: number
  }
) {
  try {
    const db = getOptimizedDb()
    
    // Update workspace with final measurements
    await db
      .update(workspaces)
      .set({
        finalMeasurements: measurements,
        updatedAt: new Date(),
        workflowPhase: 'shipping' // Move to shipping phase after measurements
      })
      .where(eq(workspaces.orderId, BigInt(orderId)))

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      measurements
    }
  } catch (error) {
    console.error('Error updating final measurements:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update final measurements'
    }
  }
}

export async function saveFinalMeasurements(
  orderId: string,
  data: {
    dimensions: {
      length: number
      width: number
      height: number
      units: string
    }
    weight: {
      value: number
      units: string
    }
  }
) {
  try {
    const db = getOptimizedDb()
    
    // Update workspace with final measurements
    const measurements = {
      length: data.dimensions.length,
      width: data.dimensions.width,
      height: data.dimensions.height,
      dimensionUnit: data.dimensions.units,
      weight: data.weight.value,
      weightUnit: data.weight.units
    }

    await db
      .update(workspaces)
      .set({
        finalMeasurements: measurements,
        updatedAt: new Date(),
        workflowPhase: 'shipping' // Move to shipping phase after measurements
      })
      .where(eq(workspaces.orderId, BigInt(orderId)))

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      measurements
    }
  } catch (error) {
    console.error('Error saving final measurements:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save final measurements'
    }
  }
}

export async function completePreShip(
  orderId: string,
  data: {
    completedBy: string
    notes?: string
    checklistItems?: ChecklistItem[]
  }
) {
  try {
    const db = getOptimizedDb()
    
    // Update workspace module states
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, BigInt(orderId))
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Update module states to mark pre-ship as complete
    const currentModuleStates = (workspace.moduleStates as Record<string, unknown> | undefined) || {}
    const preShipState = (currentModuleStates.preShip as Record<string, unknown> | undefined) || {}
    currentModuleStates.preShip = {
      ...preShipState,
      completed: true,
      completedAt: new Date().toISOString(),
      completedBy: data.completedBy,
      notes: data.notes,
      checklistItems: data.checklistItems
    }

    await db
      .update(workspaces)
      .set({
        moduleStates: currentModuleStates,
        workflowPhase: 'ready_to_ship',
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, BigInt(orderId)))

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      message: 'Pre-ship inspection completed'
    }
  } catch (error) {
    console.error('Error completing pre-ship:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete pre-ship'
    }
  }
}

export async function getWorkspace(orderId: string) {
  try {
    const db = getOptimizedDb()
    
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, BigInt(orderId)),
      with: {
        qrCodes: true,
        documents: true
      }
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    return {
      success: true,
      workspace
    }
  } catch (error) {
    console.error('Error fetching workspace:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch workspace'
    }
  }
}

export async function updateWorkspaceStatus(
  orderId: string,
  status: 'active' | 'in_progress' | 'completed' | 'shipped' | 'archived'
) {
  try {
    const db = getOptimizedDb()
    
    await db
      .update(workspaces)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, BigInt(orderId)))

    // Revalidate paths
    revalidatePath('/')
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      status
    }
  } catch (error) {
    console.error('Error updating workspace status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update status'
    }
  }
}

export async function getWorkspaceActivity(orderId: string) {
  try {
    const db = getOptimizedDb()
    
    // Get workspace with all related data
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, BigInt(orderId)),
      with: {
        documents: {
          orderBy: [desc(documents.uploadedAt)],
          limit: 50
        }
      }
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Parse activity from module states and notes
    const activities: Array<{
      id: string
      type: string
      action: string
      description: string
      user: string
      timestamp: string
    }> = []
    
    // Add notes as activities
    if (workspace.notes && Array.isArray(workspace.notes)) {
      (workspace.notes as WorkspaceNote[]).forEach((note) => {
        activities.push({
          id: note.id || `note-${activities.length}`,
          type: 'note',
          action: note.type || 'note_added',
          description: note.content,
          user: note.author || 'System',
          timestamp: note.createdAt || new Date().toISOString()
        })
      })
    }
    
    // Add document uploads as activities
    workspace.documents?.forEach((doc) => {
      activities.push({
        id: doc.id,
        type: 'document',
        action: 'document_uploaded',
        description: `${doc.documentType} uploaded`,
        user: doc.uploadedBy || 'System',
        timestamp: doc.uploadedAt || doc.createdAt
      })
    })
    
    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return {
      success: true,
      activities
    }
  } catch (error) {
    console.error('Error fetching workspace activity:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch activity'
    }
  }
}

export async function notifyWorkspace(
  orderId: string,
  data: {
    type: string
    status: string
    notes?: string
  }
) {
  try {
    const db = getOptimizedDb()
    
    // Get current workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, BigInt(orderId))
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Store notification in module states
    const currentModuleStates = (workspace.moduleStates as Record<string, unknown> | undefined) || {}
    const notifications = Array.isArray(currentModuleStates.notifications)
      ? (currentModuleStates.notifications as NotificationEntry[])
      : []
    notifications.push({
      type: data.type,
      status: data.status,
      notes: data.notes,
      timestamp: new Date().toISOString()
    })
    currentModuleStates.notifications = notifications

    await db
      .update(workspaces)
      .set({
        moduleStates: currentModuleStates,
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, BigInt(orderId)))

    // You can add AWS SNS or other notification services here

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      message: 'Notification sent'
    }
  } catch (error) {
    console.error('Error notifying workspace:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send notification'
    }
  }
}

export async function updateWorkspaceModuleState(
  orderId: string,
  module: string,
  state: Record<string, any>
) {
  try {
    const db = getOptimizedDb()

    // Get current workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, BigInt(orderId))
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Update module states
    const currentModuleStates = (workspace.moduleStates as Record<string, unknown> | undefined) || {}

    // Handle module aliases (pre_mix vs preMix, etc)
    const MODULE_STATE_ALIASES: Record<string, string[]> = {
      pre_mix: ['pre_mix', 'preMix'],
      pre_ship: ['pre_ship', 'preShip'],
      inspection: ['inspection', 'inspection_runs']
    }

    const aliases = MODULE_STATE_ALIASES[module]
    const canonicalKey = aliases ? aliases[0] : module

    // Update the canonical key
    currentModuleStates[canonicalKey] = state

    // Remove any duplicate aliases
    if (aliases) {
      for (const alias of aliases) {
        if (alias !== canonicalKey && alias in currentModuleStates) {
          delete currentModuleStates[alias]
        }
      }
    }

    // Save to database
    await db
      .update(workspaces)
      .set({
        moduleStates: currentModuleStates,
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, BigInt(orderId)))

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      message: 'Module state updated'
    }
  } catch (error) {
    console.error('Error updating module state:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update module state'
    }
  }
}

'use server'

import { WorkspaceService } from '@/lib/services/workspace/service'
import { revalidatePath } from 'next/cache'
import { getOptimizedDb } from '@/lib/db/neon'
import { workspaces, documents, activityLog } from '@/lib/db/schema/qr-workspace'
import { eq, desc } from 'drizzle-orm'
import { normalizeFinalMeasurementsPayload } from '@/lib/measurements/normalize'
import { markFreightReady } from '@/lib/services/shipstation/tags'

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

type ModuleStates = Record<string, unknown>

function toModuleStates(value: unknown): ModuleStates {
  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) }
  }
  return {}
}

function toNumericOrderId(orderId: string | number): number | null {
  if (typeof orderId === 'number' && Number.isFinite(orderId)) {
    return orderId
  }

  if (typeof orderId === 'string') {
    const parsed = Number(orderId)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

export async function createWorkspace(data: {
  orderId: string | number
  orderNumber: string
  userId?: string
  workflowType?: 'pump_and_fill' | 'direct_resell'
}) {
  try {
    const { orderId, orderNumber, userId = 'system', workflowType = 'pump_and_fill' } = data

    if (!orderId || !orderNumber) {
      return {
        success: false,
        error: 'Order ID and order number are required'
      }
    }

    const numericOrderId = toNumericOrderId(orderId)
    if (numericOrderId === null) {
      return {
        success: false,
        error: 'Invalid order ID'
      }
    }

    // Delegate entirely to WorkspaceService - single source of truth for workspace creation
    const workspace = await workspaceService.createWorkspace(
      numericOrderId,
      orderNumber,
      userId,
      workflowType
    )

    // Revalidate relevant paths
    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath(`/workspace/${numericOrderId}`)

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
    const numericOrderId = toNumericOrderId(orderId)

    if (numericOrderId === null) {
      return {
        success: false,
        error: 'Invalid order ID'
      }
    }
    
    // Get the workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, numericOrderId)
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
      .where(eq(workspaces.orderId, numericOrderId))

    // Revalidate paths
    revalidatePath('/')
    revalidatePath(`/workspace/${numericOrderId}`)

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
    const numericOrderId = toNumericOrderId(orderId)
    if (numericOrderId === null) {
      return {
        success: false,
        error: 'Invalid order ID'
      }
    }
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
      .where(eq(workspaces.orderId, numericOrderId))

    // Revalidate workspace page
    revalidatePath(`/workspace/${numericOrderId}`)

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
    const numericOrderId = toNumericOrderId(orderId)

    if (numericOrderId === null) {
      return {
        success: false,
        error: 'Invalid order ID'
      }
    }
    
    // Get current workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, numericOrderId)
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    const newNote: WorkspaceNote = {
      id: `note-${Date.now()}`,
      content: note.content,
      author: note.author || 'system',
      type: note.type || 'general',
      createdAt: new Date().toISOString()
    }

    await workspaceService.repository.logActivity({
      workspaceId: workspace.id,
      activityType: newNote.type ?? 'note_added',
      activityDescription: newNote.content,
      performedBy: newNote.author ?? 'system',
      module: 'notes',
      metadata: newNote
    })

    // Revalidate workspace page
    revalidatePath(`/workspace/${numericOrderId}`)

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
    const numericOrderId = toNumericOrderId(orderId)

    if (numericOrderId === null) {
      return {
        success: false,
        error: 'Invalid order ID'
      }
    }
    
    // Update workspace with final measurements
    await db
      .update(workspaces)
      .set({
        finalMeasurements: measurements,
        updatedAt: new Date(),
        workflowPhase: 'shipping' // Move to shipping phase after measurements
      })
      .where(eq(workspaces.orderId, numericOrderId))

    // Revalidate workspace page
    revalidatePath(`/workspace/${numericOrderId}`)

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
    const numericOrderId = toNumericOrderId(orderId)

    if (numericOrderId === null) {
      return {
        success: false,
        error: 'Invalid order ID'
      }
    }
    
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
      .where(eq(workspaces.orderId, numericOrderId))

    // Revalidate workspace page
    revalidatePath(`/workspace/${numericOrderId}`)

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
    const numericOrderId = toNumericOrderId(orderId)

    if (numericOrderId === null) {
      return {
        success: false,
        error: 'Invalid order ID'
      }
    }
    
    // Update workspace module states
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, numericOrderId)
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Update module states to mark pre-ship as complete
    const currentModuleStates = toModuleStates(workspace.moduleStates)
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
      .where(eq(workspaces.orderId, numericOrderId))

    // Revalidate workspace page
    revalidatePath(`/workspace/${numericOrderId}`)

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
    const numericOrderId = toNumericOrderId(orderId)

    if (numericOrderId === null) {
      return {
        success: false,
        error: 'Invalid order ID'
      }
    }
    
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, numericOrderId),
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
    const numericOrderId = toNumericOrderId(orderId)

    if (numericOrderId === null) {
      return {
        success: false,
        error: 'Invalid order ID'
      }
    }
    
    await db
      .update(workspaces)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, numericOrderId))

    // Revalidate paths
    revalidatePath('/')
    revalidatePath(`/workspace/${numericOrderId}`)

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
    const numericOrderId = toNumericOrderId(orderId)

    if (numericOrderId === null) {
      return {
        success: false,
        error: 'Invalid order ID'
      }
    }
    
    // Get workspace with all related data
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, numericOrderId),
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

    const activityEntries = await db.query.activityLog.findMany({
      where: eq(activityLog.workspaceId, workspace.id),
      orderBy: [desc(activityLog.performedAt)],
      limit: 100,
    })

    const activities: Array<{
      id: string
      type: string
      action: string
      description: string
      user: string
      timestamp: string
    }> = activityEntries.map((entry) => ({
      id: entry.id,
      type: entry.activityType,
      action: entry.activityType,
      description: entry.activityDescription ?? entry.activityType,
      user: entry.performedBy,
      timestamp: (entry.performedAt ?? new Date()).toISOString(),
    }))

    workspace.documents?.forEach((doc) => {
      const uploadedAt = doc.uploadedAt
      const timestamp = uploadedAt instanceof Date
        ? uploadedAt.toISOString()
        : typeof uploadedAt === 'string'
          ? uploadedAt
          : new Date().toISOString()
      activities.push({
        id: doc.id,
        type: 'document',
        action: 'document_uploaded',
        description: `${doc.documentType} uploaded`,
        user: doc.uploadedBy || 'System',
        timestamp
      })
    })

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
    const numericOrderId = toNumericOrderId(orderId)

    if (numericOrderId === null) {
      return {
        success: false,
        error: 'Invalid order ID'
      }
    }
    
    // Get current workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, numericOrderId)
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Store notification in module states
    const currentModuleStates = toModuleStates(workspace.moduleStates)
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
      .where(eq(workspaces.orderId, numericOrderId))

    // You can add AWS SNS or other notification services here

    // Revalidate workspace page
    revalidatePath(`/workspace/${numericOrderId}`)

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
    const numericOrderId = toNumericOrderId(orderId)

    if (numericOrderId === null) {
      return {
        success: false,
        error: 'Invalid order ID'
      }
    }

    // Get current workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, numericOrderId)
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Update module states
    const currentModuleStates = toModuleStates(workspace.moduleStates)

    // Handle module aliases (pre_mix vs preMix, etc)
    const MODULE_STATE_ALIASES: Record<string, string[]> = {
      pre_mix: ['pre_mix', 'preMix'],
      pre_ship: ['pre_ship', 'preShip'],
      inspection: ['inspection', 'inspection_runs']
    }

    const aliases = MODULE_STATE_ALIASES[module]
      || Object.entries(MODULE_STATE_ALIASES).find(([, values]) => values.includes(module))?.[1]
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

    const updatePayload: Partial<typeof workspaces.$inferInsert> = {
      moduleStates: currentModuleStates,
      updatedAt: new Date()
    }

    let shouldMarkReady = false

    if (canonicalKey === 'pre_ship') {
      const completed = Boolean((state as { completed?: boolean } | undefined)?.completed)
      if (completed) {
        shouldMarkReady = true
        const nowIso = new Date().toISOString()
        const currentPhaseCompleted = (workspace.phaseCompletedAt as Record<string, string> | undefined) || {}

        updatePayload.status = 'ready_to_ship'
        updatePayload.workflowPhase = 'ready_to_ship'
        updatePayload.phaseCompletedAt = {
          ...currentPhaseCompleted,
          pre_ship: nowIso
        }
      }
    }

    await db
      .update(workspaces)
      .set(updatePayload)
      .where(eq(workspaces.orderId, numericOrderId))

    if (shouldMarkReady) {
      try {
        await markFreightReady(numericOrderId)
        await workspaceService.repository.logActivity({
          workspaceId: workspace.id,
          activityType: 'pre_ship_inspection_completed',
          activityDescription: 'Pre-ship inspection marked complete via worker inspection.',
          performedBy: 'worker_view',
          module: 'warehouse',
          metadata: {
            source: 'worker_resilient_inspection',
            checklist: (state as Record<string, unknown> | undefined)?.checklist,
          }
        })
      } catch (tagError) {
        console.error('Failed to mark freight ready:', tagError)
      }
    }

    // Revalidate workspace page
    revalidatePath(`/workspace/${numericOrderId}`)
    revalidatePath('/')

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

/**
 * Ensure workspace exists in database, creating it if necessary
 * This is the primary auto-creation point for worker views
 *
 * - Validates orderId
 * - Creates workspace if missing
 * - Fetches ShipStation data with timeout (non-blocking)
 * - Returns workspace ready for inspection
 */
export async function ensureWorkspaceExists(orderId: string) {
  try {
    // Import validation
    const { validateOrderId } = await import('@/lib/validation/order-id');

    // Validate orderId first
    const validation = validateOrderId(orderId);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Invalid order ID',
      };
    }

    const numericOrderId = validation.normalized!;

    // Check if workspace already exists
    const existingResult = await getWorkspace(orderId);
    if (existingResult.success && existingResult.workspace) {
      return {
        success: true,
        workspace: existingResult.workspace,
        created: false,
      };
    }

    // Workspace doesn't exist - create it
    console.log(`[ensureWorkspaceExists] Creating workspace for order ${orderId}`);

    const createResult = await workspaceService.createWorkspace(
      numericOrderId,
      orderId, // Use orderId as orderNumber fallback
      'system', // Created by auto-creation system
      'pump_and_fill' // Default workflow type
    );

    // Revalidate paths
    revalidatePath(`/workspace/${orderId}`);
    revalidatePath('/');

    return {
      success: true,
      workspace: createResult,
      created: true,
    };
  } catch (error) {
    console.error('[ensureWorkspaceExists] Failed to ensure workspace exists:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create workspace',
    };
  }
}

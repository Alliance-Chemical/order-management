'use server'

import { WorkspaceService } from '@/lib/services/workspace/service'
import { tagSyncService } from '@/lib/services/shipstation/ensure-phase'
import { asBigInt } from '@/lib/utils/bigint'
import { db } from '@/lib/db'
import { activityLog } from '@/lib/db/schema/qr-workspace'
import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

const workspaceService = new WorkspaceService()

export async function submitInspection(data: {
  orderId: string
  phase: string
  result: 'pass' | 'fail' | 'hold'
  inspectionData?: Record<string, unknown>
  userId?: string
  idempotencyKey?: string
}) {
  try {
    const { orderId: orderIdStr, phase, result, inspectionData, userId = 'system', idempotencyKey } = data
    const orderId = asBigInt(orderIdStr)
    
    // Validate result
    if (!['pass', 'fail', 'hold'].includes(result)) {
      return {
        success: false,
        error: 'Invalid result. Must be pass, fail, or hold'
      }
    }
    
    // Find workspace
    const workspace = await workspaceService.repository.findByOrderId(Number(orderId))
    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Idempotency: reject duplicate submissions with same key
    if (idempotencyKey) {
      const dup = await db.query.activityLog.findFirst({
        where: and(
          eq(activityLog.workspaceId, workspace.id),
          sql`${activityLog.metadata} ->> 'idempotencyKey' = ${idempotencyKey}`
        ),
      })
      if (dup) {
        return {
          success: false,
          error: 'Duplicate submission',
          code: 'DUPLICATE'
        }
      }
    }
    
    // Update module state
    const moduleStates = (workspace.moduleStates as Record<string, unknown> | undefined) || {}
    moduleStates[phase] = { 
      ...(moduleStates[phase] as Record<string, unknown> | undefined), 
      result,
      completedAt: new Date().toISOString(),
      data: inspectionData 
    }
    
    // Update phase completion timestamp
    const phaseCompletedAt = (workspace.phaseCompletedAt as Record<string, string> | undefined) || {}
    const nowIso = new Date().toISOString()
    phaseCompletedAt[phase] = nowIso

    await workspaceService.repository.update(workspace.id, {
      moduleStates,
      updatedBy: userId,
      phaseCompletedAt,
    })
    
    // Log inspection activity
    await workspaceService.repository.logActivity({
      workspaceId: workspace.id,
      activityType: `inspection_${phase}_${result}`,
      performedBy: userId,
      metadata: { phase, result, data: inspectionData, idempotencyKey }
    })
    
    // Handle phase transitions for pass results
    let ensureResult = { success: true, finalTags: [], finalPhase: workspace.workflowPhase }
    
    if (result === 'pass') {
      // Transition phase on PASS results
      if (phase === 'pre_ship' || phase === 'pre_ship_inspection') {
        // Pre-ship pass -> mark as ready to ship
        ensureResult = await tagSyncService.ensurePhase(
          orderId,
          'ready_to_ship',
          userId
        )
        
        if (ensureResult.success) {
          await workspaceService.repository.logActivity({
            workspaceId: workspace.id,
            activityType: 'freight_ready_tagged',
            performedBy: 'system',
            metadata: { 
              trigger: 'pre_ship_inspection_passed',
              tags: ensureResult.finalTags
            }
          })
        }
      } else if (phase === 'pre_mix' || phase === 'pre_mix_inspection') {
        // Pre-mix pass -> move to warehouse phase
        ensureResult = await tagSyncService.ensurePhase(
          orderId,
          'warehouse',
          userId
        )
      } else if (phase === 'warehouse' || phase === 'warehouse_inspection') {
        // Warehouse pass -> move to shipping phase
        ensureResult = await tagSyncService.ensurePhase(
          orderId,
          'shipping',
          userId
        )
      }
    }

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderIdStr}`)
    revalidatePath('/')

    return {
      success: true,
      result,
      phase,
      workspacePhase: ensureResult.finalPhase,
      tags: ensureResult.finalTags
    }
  } catch (error) {
    console.error('Error submitting inspection:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit inspection'
    }
  }
}

export async function getInspectionHistory(orderId: string) {
  try {
    const workspace = await workspaceService.repository.findByOrderId(Number(orderId))
    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Get inspection activities
    const activities = await db.query.activityLog.findMany({
      where: and(
        eq(activityLog.workspaceId, workspace.id),
        sql`${activityLog.activityType} LIKE 'inspection_%'`
      ),
      orderBy: (activity, { desc }) => [desc(activity.createdAt)]
    })

    return {
      success: true,
      inspections: activities.map(activity => ({
        id: activity.id,
        phase: activity.metadata?.phase,
        result: activity.metadata?.result,
        data: activity.metadata?.data,
        performedBy: activity.performedBy,
        createdAt: activity.createdAt
      }))
    }
  } catch (error) {
    console.error('Error fetching inspection history:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch inspection history'
    }
  }
}

export async function submitBatchInspection(data: {
  orderIds: string[]
  phase: string
  result: 'pass' | 'fail' | 'hold'
  inspectionData?: Record<string, unknown>
  userId?: string
}) {
  try {
    const results: Array<{ orderId: string; success: boolean; error?: string }> = []
    
    for (const orderId of data.orderIds) {
      const result = await submitInspection({
        orderId,
        phase: data.phase,
        result: data.result,
        inspectionData: data.inspectionData,
        userId: data.userId
      })
      
      results.push({
        orderId,
        ...result
      })
    }

    return {
      success: true,
      results
    }
  } catch (error) {
    console.error('Error submitting batch inspection:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit batch inspection'
    }
  }
}

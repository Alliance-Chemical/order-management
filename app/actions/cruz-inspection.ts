'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema/qr-workspace'
import { eq } from 'drizzle-orm'

import {
  CruzInspectionState,
  CruzInspectionRun,
  CruzRunStatus,
  CruzStepId,
  CruzStepPayload,
  CruzStepPayloadMap,
  CRUZ_STEP_ORDER,
  computeRunStatusAfterStep,
  createRunId,
  ensureRunOrder,
  getNextStepId,
  getStepIndex,
  normalizeInspectionState,
  validateStepPayload,
} from '@/lib/inspection/cruz'
import { WorkspaceService } from '@/lib/services/workspace/service'

const workspaceService = new WorkspaceService()

type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

interface MutationContext {
  userId: string
  workspaceId: string
  orderId: string
}

async function withInspectionState<T>(
  orderId: string,
  userId: string,
  mutator: (state: Mutable<CruzInspectionState>, ctx: MutationContext) => T | Promise<T>,
  opts?: { revalidate?: boolean }
): Promise<T> {
  const numericOrderId = Number(orderId)

  // Note: neon-http driver doesn't support transactions
  // We use read-modify-write pattern with workspace updates
  // Race conditions are rare in inspection flows but possible

  // Fetch workspace
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.orderId, numericOrderId))
    .limit(1)

  if (!workspace) {
    throw new Error(`Workspace not found for order ${orderId}`)
  }

  const rawModuleStates = (workspace.moduleStates as Record<string, unknown> | undefined) ?? {}
  const rawInspectionState = rawModuleStates.inspection

  const baseState = normalizeInspectionState(rawInspectionState)
  const state: Mutable<CruzInspectionState> = structuredClone(baseState)

  const mutatorResult = await mutator(state, {
    userId,
    workspaceId: workspace.id,
    orderId: orderId,
  })

  ensureRunOrder(state)

  const updatedModuleStates = {
    ...rawModuleStates,
    inspection: state,
  }

  // Update workspace with new state
  await db
    .update(workspaces)
    .set({
      moduleStates: updatedModuleStates,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspace.id))

  if (opts?.revalidate !== false) {
    revalidatePath(`/workspace/${orderId}`)
  }

  return mutatorResult
}

export async function getCruzInspectionState(orderId: string) {
  const numericOrderId = Number(orderId)
  const workspace = await workspaceService.repository.findByOrderId(numericOrderId)
  if (!workspace) {
    throw new Error(`Workspace not found for order ${orderId}`)
  }

  const rawModuleStates = (workspace.moduleStates as Record<string, unknown> | undefined) ?? {}
  const rawInspectionState = rawModuleStates.inspection
  return normalizeInspectionState(rawInspectionState)
}

export interface InspectionRunInput {
  qrCodeId?: string
  qrValue?: string
  shortCode?: string
  itemKey?: string
  sku?: string
  materialName?: string
  containerType: CruzInspectionRun['containerType']
  containerCount?: number
  metadata?: Record<string, unknown>
}

function buildRunFromInput(input: InspectionRunInput): CruzInspectionRun {
  const nowIso = new Date().toISOString()
  return {
    id: createRunId(),
    createdAt: nowIso,
    updatedAt: nowIso,
    qrCodeId: input.qrCodeId,
    qrValue: input.qrValue,
    shortCode: input.shortCode,
    itemKey: input.itemKey,
    sku: input.sku,
    materialName: input.materialName,
    containerType: input.containerType,
    containerCount: Math.max(1, input.containerCount ?? 1),
    currentStepId: 'scan_qr',
    status: 'active',
    steps: {},
    history: [],
    metadata: input.metadata,
  }
}

async function logActivity(
  ctx: MutationContext,
  activityType: string,
  description: string,
  metadata?: Record<string, unknown>
) {
  await workspaceService.repository.logActivity({
    workspaceId: ctx.workspaceId,
    activityType,
    activityDescription: description,
    performedBy: ctx.userId,
    module: 'inspection',
    metadata,
  })
}

function redactPayloadForLog(stepId: CruzStepId, payload: CruzStepPayload) {
  if (!payload) return payload
  const clone: Record<string, unknown> = { ...payload }
  if ('photos' in clone && Array.isArray(clone.photos)) {
    clone.photos = clone.photos.map((photo: any) => ({
      id: photo.id,
      name: photo.name,
      uploadedAt: photo.uploadedAt,
      documentId: photo.documentId,
    }))
  }
  if ('lots' in clone && Array.isArray(clone.lots)) {
    clone.lots = clone.lots.map((lot: any) => ({
      id: lot.id,
      lotRaw: lot.lotRaw,
      confirmed: 'confirmed' in lot ? lot.confirmed : undefined,
    }))
  }
  return clone
}

function refreshWorkspaceCompletion(state: Mutable<CruzInspectionState>, performedBy: string) {
  const runs = Object.values(state.runsById)
  if (runs.length === 0) {
    state.completedAt = undefined
    state.completedBy = undefined
    return
  }

  const allClosed = runs.every((run) =>
    run.status === 'completed' || (run.status === 'canceled' && Boolean(run.metadata?.cancelReason))
  )

  if (allClosed) {
    const nowIso = new Date().toISOString()
    state.completedAt = nowIso
    state.completedBy = performedBy
  } else {
    state.completedAt = undefined
    state.completedBy = undefined
  }
}

function applyStatusTransition(
  state: Mutable<CruzInspectionState>,
  run: Mutable<CruzInspectionRun>,
  previousStatus: CruzRunStatus,
  nextStatus: CruzRunStatus
) {
  if (previousStatus === nextStatus) {
    return
  }

  state.totals = state.totals || {}

  if (previousStatus !== 'completed' && nextStatus === 'completed') {
    state.totals.runsCompleted = (state.totals.runsCompleted ?? 0) + 1
  }

  if (previousStatus === 'completed' && nextStatus !== 'completed') {
    state.totals.runsCompleted = Math.max(0, (state.totals.runsCompleted ?? 1) - 1)
  }

  if (previousStatus !== 'hold' && nextStatus === 'hold') {
    state.totals.runsOnHold = (state.totals.runsOnHold ?? 0) + 1
  }

  if (previousStatus === 'hold' && nextStatus !== 'hold') {
    state.totals.runsOnHold = Math.max(0, (state.totals.runsOnHold ?? 1) - 1)
  }

  run.status = nextStatus
}

export async function createInspectionRuns(orderId: string, runs: InspectionRunInput[], userId = 'system') {
  if (runs.length === 0) {
    return getCruzInspectionState(orderId)
  }

  try {
    return await withInspectionState(orderId, userId, async (state, ctx) => {
      const createdRuns: CruzInspectionRun[] = []
      for (const input of runs) {
        const run = buildRunFromInput(input)
        state.runsById[run.id] = run
        state.runOrder.push(run.id)
        state.totals = state.totals || {}
        state.totals.runsCreated = (state.totals.runsCreated ?? 0) + 1
        if (run.status === 'hold') {
          state.totals.runsOnHold = (state.totals.runsOnHold ?? 0) + 1
        }
        createdRuns.push(run)
      }

      await logActivity(ctx, 'inspection_runs_created', `Created ${createdRuns.length} inspection run(s)`, {
        runIds: createdRuns.map((run) => run.id),
        runs: createdRuns.map((run) => ({
          id: run.id,
          sku: run.sku,
          containerCount: run.containerCount,
          containerType: run.containerType,
          qrCodeId: run.qrCodeId,
        })),
      })

      refreshWorkspaceCompletion(state, ctx.userId)

      return state
    })
  } catch (error) {
    // If workspace doesn't exist, try to create it
    if (error instanceof Error && error.message.includes('Workspace not found')) {
      console.log(`[Cruz Inspection] Workspace not found for order ${orderId}, attempting to create...`)

      try {
        // Try to create the workspace
        const numericOrderId = Number(orderId)
        await workspaceService.createWorkspace(numericOrderId, orderId, userId, 'pump_and_fill')

        // Retry the inspection run creation
        return await withInspectionState(orderId, userId, async (state, ctx) => {
          const createdRuns: CruzInspectionRun[] = []
          for (const input of runs) {
            const run = buildRunFromInput(input)
            state.runsById[run.id] = run
            state.runOrder.push(run.id)
            state.totals = state.totals || {}
            state.totals.runsCreated = (state.totals.runsCreated ?? 0) + 1
            if (run.status === 'hold') {
              state.totals.runsOnHold = (state.totals.runsOnHold ?? 0) + 1
            }
            createdRuns.push(run)
          }

          await logActivity(ctx, 'inspection_runs_created', `Created ${createdRuns.length} inspection run(s)`, {
            runIds: createdRuns.map((run) => run.id),
            runs: createdRuns.map((run) => ({
              id: run.id,
              sku: run.sku,
              containerCount: run.containerCount,
              containerType: run.containerType,
              qrCodeId: run.qrCodeId,
            })),
          })

          refreshWorkspaceCompletion(state, ctx.userId)

          return state
        })
      } catch (createError) {
        console.error('[Cruz Inspection] Failed to auto-create workspace:', createError)
        throw new Error(`Workspace not found for order ${orderId} and auto-creation failed. Please create the workspace first via supervisor view.`)
      }
    }

    throw error
  }
}

export interface RecordStepParams<StepId extends CruzStepId = CruzStepId> {
  orderId: string
  runId: string
  stepId: StepId
  payload: CruzStepPayloadMap[StepId]
  outcome: 'PASS' | 'FAIL' | 'HOLD'
  userId?: string
}

function ensureSequential(run: CruzInspectionRun, stepId: CruzStepId) {
  const stepIndex = getStepIndex(stepId)
  if (stepIndex === -1) {
    throw new Error(`Unknown step ${stepId}`)
  }

  const expectedStep = run.currentStepId
  if (expectedStep !== stepId) {
    throw new Error(`Cannot record step ${stepId} while run is on ${expectedStep}`)
  }

  const completedSteps = CRUZ_STEP_ORDER.filter((id) => id !== stepId && run.steps[id as CruzStepId])
  for (const id of completedSteps) {
    if (getStepIndex(id as CruzStepId) > stepIndex) {
      throw new Error('Steps must be completed in order')
    }
  }
}

export async function recordStep(params: RecordStepParams) {
  const { orderId, runId, stepId, payload, outcome } = params
  const userId = params.userId ?? 'system'

  return withInspectionState(orderId, userId, async (state, ctx) => {
    const run = state.runsById[runId]
    if (!run) {
      throw new Error(`Inspection run ${runId} not found`)
    }

    ensureSequential(run, stepId)

    const validatedPayload = validateStepPayload(stepId, payload) as CruzStepPayload
    const nowIso = new Date().toISOString()

    const previousStatus = run.status

    run.steps[stepId] = validatedPayload as any
    run.updatedAt = nowIso

    const nextStepId = outcome === 'PASS' ? getNextStepId(stepId) : null

    let newStatus: CruzRunStatus
    if (outcome === 'HOLD') {
      newStatus = 'hold'
      run.currentStepId = stepId
    } else {
      newStatus = computeRunStatusAfterStep(run, stepId, validatedPayload, outcome)
      if (outcome === 'PASS' && nextStepId) {
        run.currentStepId = nextStepId
      } else {
        run.currentStepId = stepId
      }
    }

    applyStatusTransition(state, run as Mutable<CruzInspectionRun>, previousStatus, newStatus)

    run.history.push({
      id: `hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      runId,
      stepId,
      outcome,
      recordedAt: nowIso,
      recordedBy: userId,
      payload: redactPayloadForLog(stepId, validatedPayload),
    })

    await logActivity(
      ctx,
      'inspection_step',
      `${stepId} ${outcome}`,
      {
        runId,
        stepId,
        outcome,
        payload: redactPayloadForLog(stepId, validatedPayload),
        currentStepId: run.currentStepId,
        status: run.status,
      }
    )

    refreshWorkspaceCompletion(state, ctx.userId)

    return state
  })
}

function cloneRun(run: CruzInspectionRun): CruzInspectionRun {
  const nowIso = new Date().toISOString()
  const cloned: CruzInspectionRun = structuredClone(run)
  cloned.id = createRunId()
  cloned.createdAt = nowIso
  cloned.updatedAt = nowIso
  cloned.metadata = {
    ...(cloned.metadata || {}),
    clonedFromRunId: run.id,
  }
  cloned.history = [...run.history]
  return cloned
}

function adjustTotalsForRemoval(state: Mutable<CruzInspectionState>, run: CruzInspectionRun) {
  if (!state.totals) return
  if (run.status === 'hold') {
    state.totals.runsOnHold = Math.max(0, (state.totals.runsOnHold ?? 0) - 1)
  }
  if (run.status === 'completed') {
    state.totals.runsCompleted = Math.max(0, (state.totals.runsCompleted ?? 0) - 1)
  }
}

export async function splitInspectionRun(orderId: string, runId: string, quantity: number, userId = 'system') {
  return withInspectionState(orderId, userId, async (state, ctx) => {
    const run = state.runsById[runId]
    if (!run) {
      throw new Error(`Inspection run ${runId} not found`)
    }

    if (run.containerCount <= 1) {
      throw new Error('Cannot split a run with only one container')
    }

    if (quantity < 1 || quantity >= run.containerCount) {
      throw new Error('Split quantity must be between 1 and the number of containers minus one')
    }

    const newRun = cloneRun(run)
    newRun.containerCount = quantity
    newRun.metadata = {
      ...(newRun.metadata || {}),
      splitFromRunId: run.id,
    }

    run.containerCount -= quantity
    run.updatedAt = new Date().toISOString()

    state.runsById[newRun.id] = newRun
    const index = state.runOrder.indexOf(run.id)
    if (index >= 0) {
      state.runOrder.splice(index + 1, 0, newRun.id)
    } else {
      state.runOrder.push(newRun.id)
    }

    state.totals = state.totals || {}
    state.totals.runsCreated = (state.totals.runsCreated ?? 0) + 1
    if (newRun.status === 'hold') {
      state.totals.runsOnHold = (state.totals.runsOnHold ?? 0) + 1
    }
    if (newRun.status === 'completed') {
      state.totals.runsCompleted = (state.totals.runsCompleted ?? 0) + 1
    }

    await logActivity(ctx, 'inspection_run_split', 'Split inspection run', {
      originalRunId: run.id,
      newRunId: newRun.id,
      splitQuantity: quantity,
      remainingQuantity: run.containerCount,
    })

    refreshWorkspaceCompletion(state, ctx.userId)
    return state
  })
}

export async function groupInspectionRuns(orderId: string, runIds: string[], userId = 'system') {
  if (runIds.length < 2) {
    throw new Error('Select at least two runs to group')
  }

  return withInspectionState(orderId, userId, async (state, ctx) => {
    const runs = runIds.map((id) => {
      const run = state.runsById[id]
      if (!run) {
        throw new Error(`Inspection run ${id} not found`)
      }
      return run
    })

    const [baseRun, ...rest] = runs

    for (const candidate of rest) {
      if (candidate.containerType !== baseRun.containerType) {
        throw new Error('Runs must share the same container type to be grouped')
      }
      if (candidate.status !== baseRun.status) {
        throw new Error('Runs must share the same status to be grouped')
      }
      if (candidate.currentStepId !== baseRun.currentStepId) {
        throw new Error('Runs must be on the same step to be grouped')
      }
      if (JSON.stringify(candidate.steps) !== JSON.stringify(baseRun.steps)) {
        throw new Error('Runs must have matching step data to be grouped')
      }
    }

    const additionalCount = rest.reduce((total, run) => total + run.containerCount, 0)
    baseRun.containerCount += additionalCount
    baseRun.updatedAt = new Date().toISOString()
    baseRun.metadata = {
      ...(baseRun.metadata || {}),
      groupedRunIds: [...(baseRun.metadata?.groupedRunIds as string[] | undefined) ?? [], ...rest.map((run) => run.id)],
    }
    const nowIso = new Date().toISOString()
    baseRun.history.push({
      id: `hist_group_${Date.now().toString(36)}`,
      runId: baseRun.id,
      stepId: baseRun.currentStepId,
      outcome: 'PASS',
      recordedAt: nowIso,
      recordedBy: userId,
      payload: { groupedWith: rest.map((run) => run.id) },
    })
    baseRun.history = [...baseRun.history, ...rest.flatMap((run) => run.history)]
    baseRun.history.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))

    for (const removedRun of rest) {
      adjustTotalsForRemoval(state, removedRun)
      delete state.runsById[removedRun.id]
      state.runOrder = state.runOrder.filter((id) => id !== removedRun.id)
    }

    await logActivity(ctx, 'inspection_runs_grouped', 'Grouped inspection runs', {
      survivorRunId: baseRun.id,
      mergedRunIds: rest.map((run) => run.id),
      totalContainers: baseRun.containerCount,
    })

    refreshWorkspaceCompletion(state, ctx.userId)
    return state
  })
}

export async function holdInspectionRun(orderId: string, runId: string, reason?: string, userId = 'system') {
  return withInspectionState(orderId, userId, async (state, ctx) => {
    const run = state.runsById[runId]
    if (!run) {
      throw new Error(`Inspection run ${runId} not found`)
    }

    if (run.status === 'completed' || run.status === 'canceled') {
      throw new Error('Cannot place a completed or canceled run on hold')
    }

    const previousStatus = run.status
    applyStatusTransition(state, run as Mutable<CruzInspectionRun>, previousStatus, 'hold')

    run.metadata = {
      ...run.metadata,
      holdReason: reason,
      holdSetAt: new Date().toISOString(),
      holdSetBy: userId,
    }

    await logActivity(ctx, 'inspection_run_hold', 'Run placed on hold', {
      runId,
      reason,
    })

    refreshWorkspaceCompletion(state, ctx.userId)
    return state
  })
}

export async function releaseInspectionHold(orderId: string, runId: string, userId = 'system') {
  return withInspectionState(orderId, userId, async (state, ctx) => {
    const run = state.runsById[runId]
    if (!run) {
      throw new Error(`Inspection run ${runId} not found`)
    }

    if (run.status !== 'hold') {
      return state
    }

    const previousStatus = run.status
    applyStatusTransition(state, run as Mutable<CruzInspectionRun>, previousStatus, 'active')

    run.metadata = {
      ...run.metadata,
      holdReleasedAt: new Date().toISOString(),
      holdReleasedBy: userId,
    }

    await logActivity(ctx, 'inspection_run_unhold', 'Run removed from hold', {
      runId,
    })

    refreshWorkspaceCompletion(state, ctx.userId)
    return state
  })
}

export async function cancelInspectionRun(orderId: string, runId: string, reason: string, userId = 'system') {
  if (!reason?.trim()) {
    throw new Error('Cancel reason is required')
  }

  return withInspectionState(orderId, userId, async (state, ctx) => {
    const run = state.runsById[runId]
    if (!run) {
      throw new Error(`Inspection run ${runId} not found`)
    }

    const previousStatus = run.status
    applyStatusTransition(state, run as Mutable<CruzInspectionRun>, previousStatus, 'canceled')

    run.metadata = {
      ...run.metadata,
      cancelReason: reason,
      canceledAt: new Date().toISOString(),
      canceledBy: userId,
    }

    await logActivity(ctx, 'inspection_run_canceled', 'Run canceled', {
      runId,
      reason,
    })

    refreshWorkspaceCompletion(state, ctx.userId)
    return state
  })
}

export interface BindRunToQrParams {
  qrCodeId: string
  qrValue: string
  shortCode?: string
}

export async function bindRunToQr(orderId: string, runId: string, qr: BindRunToQrParams, userId = 'system') {
  return withInspectionState(orderId, userId, async (state, ctx) => {
    const run = state.runsById[runId]
    if (!run) {
      throw new Error(`Inspection run ${runId} not found`)
    }

    run.qrCodeId = qr.qrCodeId
    run.qrValue = qr.qrValue
    run.shortCode = qr.shortCode
    run.updatedAt = new Date().toISOString()

    const shouldAdvance = run.currentStepId === 'scan_qr'
    const payload = validateStepPayload('scan_qr', {
      qrValue: qr.qrValue,
      qrValidated: true,
      validatedAt: new Date().toISOString(),
      qrCodeId: qr.qrCodeId,
      shortCode: qr.shortCode,
    })

    run.steps.scan_qr = payload

    const previousStatus = run.status
    const nextStatus = computeRunStatusAfterStep(run, 'scan_qr', payload, 'PASS')
    applyStatusTransition(state, run as Mutable<CruzInspectionRun>, previousStatus, nextStatus)

    if (shouldAdvance) {
      const nextStep = getNextStepId('scan_qr')
      if (nextStep) {
        run.currentStepId = nextStep
      }
    }

    run.history.push({
      id: `hist_scan_${Date.now().toString(36)}`,
      runId: run.id,
      stepId: 'scan_qr',
      outcome: 'PASS',
      recordedAt: payload.validatedAt,
      recordedBy: userId,
      payload: redactPayloadForLog('scan_qr', payload),
    })

    await logActivity(ctx, 'inspection_run_bound', 'Run bound to QR', {
      runId,
      qrCodeId: qr.qrCodeId,
      shortCode: qr.shortCode,
    })

    return state
  })
}

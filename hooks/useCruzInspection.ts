'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'

import type {
  CruzInspectionState,
  CruzInspectionRun,
  CruzStepId,
  CruzStepPayloadMap,
} from '@/lib/inspection/cruz'
import {
  bindRunToQr,
  cancelInspectionRun,
  createInspectionRuns,
  getCruzInspectionState,
  holdInspectionRun,
  recordStep,
  releaseInspectionHold,
  splitInspectionRun,
  groupInspectionRuns,
  type InspectionRunInput,
  type RecordStepParams,
  type BindRunToQrParams,
} from '@/app/actions/cruz-inspection'
import { normalizeInspectionState } from '@/lib/inspection/cruz'

type StepPayloadFor<K extends CruzStepId> = CruzStepPayloadMap[K]

export function useCruzInspection(orderId: string, initialState?: unknown) {
  const normalizedInitial = useMemo(
    () => normalizeInspectionState(initialState),
    [initialState]
  )

  const [state, setState] = useState<CruzInspectionState>(normalizedInitial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const next = await getCruzInspectionState(orderId)
      setState(next)
    } catch (err) {
      console.error('Failed to refresh inspection state', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [orderId])

  const mutate = useCallback(<T>(action: () => Promise<CruzInspectionState | T>) => {
    setError(null)
    startTransition(() => {
      action()
        .then((result) => {
          if (result && typeof result === 'object' && 'runsById' in (result as any)) {
            setState(result as CruzInspectionState)
            setError(null) // Clear any previous errors on success
          }
        })
        .catch((err) => {
          console.error('Inspection mutation failed', err)
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'

          // Make error messages more user-friendly
          if (errorMessage.includes('Workspace not found')) {
            setError('Workspace not found in database. The system will try to create it automatically.')
          } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
            setError('Request timed out. Please check your connection and try again.')
          } else if (errorMessage.includes('network') || errorMessage.includes('fetch failed')) {
            setError('Network error. Please check your connection and try again.')
          } else if (errorMessage.includes('Database')) {
            setError('Database connection error. Please try again in a moment.')
          } else {
            setError(errorMessage)
          }
        })
    })
  }, [])

  const createRuns = useCallback(
    (runs: InspectionRunInput[], userId?: string) => {
      mutate(() => createInspectionRuns(orderId, runs, userId))
    },
    [mutate, orderId]
  )

  const submitStep = useCallback(
    <K extends CruzStepId>(params: RecordStepParams<K>) => {
      mutate(() => recordStep(params))
    },
    [mutate]
  )

  const placeOnHold = useCallback(
    (runId: string, reason?: string, userId?: string) => {
      mutate(() => holdInspectionRun(orderId, runId, reason, userId))
    },
    [mutate, orderId]
  )

  const releaseHold = useCallback(
    (runId: string, userId?: string) => {
      mutate(() => releaseInspectionHold(orderId, runId, userId))
    },
    [mutate, orderId]
  )

  const cancelRun = useCallback(
    (runId: string, reason: string, userId?: string) => {
      mutate(() => cancelInspectionRun(orderId, runId, reason, userId))
    },
    [mutate, orderId]
  )

  const bindRun = useCallback(
    (runId: string, payload: BindRunToQrParams, userId?: string) => {
      mutate(() => bindRunToQr(orderId, runId, payload, userId))
    },
    [mutate, orderId]
  )

  const splitRun = useCallback(
    (runId: string, quantity: number, userId?: string) => {
      mutate(() => splitInspectionRun(orderId, runId, quantity, userId))
    },
    [mutate, orderId]
  )

  const groupRuns = useCallback(
    (runIds: string[], userId?: string) => {
      mutate(() => groupInspectionRuns(orderId, runIds, userId))
    },
    [mutate, orderId]
  )

  const runs: CruzInspectionRun[] = useMemo(
    () => state.runOrder.map((id) => state.runsById[id]).filter(Boolean),
    [state.runOrder, state.runsById]
  )

  return {
    state,
    runs,
    isPending,
    error,
    refresh,
    createRuns,
    submitStep,
    placeOnHold,
    releaseHold,
    cancelRun,
    bindRun,
    splitRun,
    groupRuns,
  }
}

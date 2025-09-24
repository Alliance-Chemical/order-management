'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ValidatedQRScanner } from '@/components/qr/ValidatedQRScanner'
import { cn } from '@/lib/utils'
import type { WorkspaceData } from '@/lib/types/agent-view'
import {
  CONTAINER_TYPES,
  CRUZ_STEP_ORDER,
  CRUZ_NAVIGABLE_STEPS,
  type ContainerType,
  type CruzInspectionRun,
  type CruzStepId,
  type CruzStepPayloadMap,
  type InspectionPhoto,
  normalizeInspectionState,
} from '@/lib/inspection/cruz'
import { INSPECTORS } from '@/lib/inspection/inspectors'
import { useCruzInspection } from '@/hooks/useCruzInspection'
import type { BindRunToQrParams, RecordStepParams } from '@/app/actions/cruz-inspection'
import { uploadDocument } from '@/app/actions/documents'
import { deleteDocument } from '@/app/actions/documents'

interface InspectionRunsPanelProps {
  orderId: string
  workspace: WorkspaceData
  initialState?: unknown
  onStateChange?: (state: Record<string, unknown>) => void
}

interface CreateRunFormState {
  containerType: ContainerType
  containerCount: number
  sku: string
  materialName: string
}

const STEP_LABELS: Record<CruzStepId, string> = {
  scan_qr: 'QR Bind & Verify',
  inspection_info: 'Inspection Header',
  verify_packing_label: 'Package Match Verification',
  verify_product_label: 'Product Label Compliance',
  lot_number: 'Lot Capture',
  final_review: 'Final Review & Sign Off',
}

type ShipmentAddress = {
  name?: string;
  company?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
};

const formatAddressLines = (address?: ShipmentAddress): string[] => {
  if (!address) {
    return ['Not provided'];
  }

  const lines: string[] = [];
  if (address.name) {
    lines.push(address.name);
  }
  if (address.company && address.company !== address.name) {
    lines.push(address.company);
  }
  const streetParts = [address.street1, address.street2].filter(Boolean);
  if (streetParts.length) {
    lines.push(streetParts.join(', '));
  }
  const cityState = [address.city, address.state].filter(Boolean).join(', ');
  const locationLine = [cityState, address.postalCode].filter(Boolean).join(' ');
  if (locationLine.trim()) {
    lines.push(locationLine.trim());
  }
  if (address.country) {
    lines.push(address.country);
  }
  if (address.phone) {
    lines.push(`Phone: ${address.phone}`);
  }
  return lines.length ? lines : ['Not provided'];
};

interface StepFormProps<StepId extends CruzStepId = CruzStepId> {
  run: CruzInspectionRun
  payload?: CruzStepPayloadMap[StepId]
  onSubmit: (payload: CruzStepPayloadMap[StepId], outcome: 'PASS' | 'FAIL' | 'HOLD') => void
  isPending: boolean
  orderId: string
  shipTo?: ShipmentAddress
  shipFrom?: ShipmentAddress
  customerEmail?: string
}

function StatusBadge({ run }: { run: CruzInspectionRun }) {
  const color = {
    completed: 'bg-green-100 text-green-700',
    active: 'bg-blue-100 text-blue-700',
    hold: 'bg-amber-100 text-amber-800',
    canceled: 'bg-slate-100 text-slate-700',
    needs_reverify: 'bg-red-100 text-red-700',
  }[run.status]

  return <Badge className={cn('rounded-full px-3 py-1', color)}>{run.status.replace('_', ' ').toUpperCase()}</Badge>
}

function StepChip({ stepId, current }: { stepId: CruzStepId; current: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        current ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
      )}
    >
      {STEP_LABELS[stepId]}
    </span>
  )
}

function useCreateRunForm(defaultSku?: string, defaultMaterialName?: string) {
  const [form, setForm] = useState<CreateRunFormState>({
    containerType: 'drum',
    containerCount: 1,
    sku: defaultSku ?? '',
    materialName: defaultMaterialName ?? '',
  })

  const update = (value: Partial<CreateRunFormState>) => {
    setForm((prev) => ({ ...prev, ...value }))
  }

  const reset = () => {
    setForm({
      containerType: 'drum',
      containerCount: 1,
      sku: defaultSku ?? '',
      materialName: defaultMaterialName ?? '',
    })
  }

  return { form, update, reset }
}

export function InspectionRunsPanel({ orderId, workspace, initialState }: InspectionRunsPanelProps) {
  const normalizedInitial = useMemo(
    () => normalizeInspectionState(initialState ?? (workspace.moduleStates as Record<string, unknown> | undefined)?.inspection),
    [initialState, workspace.moduleStates]
  )

  const shipstationData = workspace.shipstationData as any
  const shipToAddress = shipstationData?.shipTo ?? shipstationData?.billTo
  const shipFromAddress = shipstationData?.shipFrom ?? shipstationData?.warehouse ?? shipstationData?.originAddress
  const customerEmail = shipstationData?.customerEmail

  const skuImageMap = useMemo(() => {
    const map = new Map<string, string>()
    const base = process.env.NEXT_PUBLIC_SHOPIFY_CDN_BASE
    workspace.shipstationData?.items?.forEach((item) => {
      const sku = item?.sku?.trim()
      if (!sku) return
      if (item.imageUrl) {
        map.set(sku.toUpperCase(), item.imageUrl)
        return
      }
      if (base) {
        const sanitized = sku.replace(/[^A-Za-z0-9_-]/g, '_')
        map.set(sku.toUpperCase(), `${base.replace(/\/$/, '')}/${sanitized}.jpg`)
      }
    })
    return map
  }, [workspace.shipstationData?.items])

  const getRunImage = useCallback(
    (run: CruzInspectionRun) => {
      const sku = run.sku?.trim()
      if (!sku) return null
      return skuImageMap.get(sku.toUpperCase()) ?? null
    },
    [skuImageMap]
  )

  const {
    runs,
    state,
    createRuns,
    submitStep,
    placeOnHold,
    releaseHold,
    cancelRun,
    bindRun,
    splitRun,
    groupRuns,
    isPending,
    error,
  } = useCruzInspection(orderId, normalizedInitial)

  const { form, update, reset } = useCreateRunForm()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectedRuns, setSelectedRuns] = useState<string[]>([])
  const [splitTarget, setSplitTarget] = useState<CruzInspectionRun | null>(null)
  const [splitQuantity, setSplitQuantity] = useState(1)

  const selectedRun = useMemo(() => runs.find((run) => run.id === selectedRunId) ?? null, [runs, selectedRunId])

  const totals = state.totals || {}

  const toggleSelection = (runId: string, checked: boolean) => {
    setSelectedRuns((prev) => {
      if (checked) {
        return prev.includes(runId) ? prev : [...prev, runId]
      }
      return prev.filter((id) => id !== runId)
    })
  }

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (form.containerCount < 1) {
      update({ containerCount: 1 })
    }

    createRuns([
      {
        containerType: form.containerType,
        containerCount: Math.max(1, Number(form.containerCount) || 1),
        sku: form.sku || undefined,
        materialName: form.materialName || undefined,
      },
    ])

    reset()
    setCreateModalOpen(false)
  }

  const handleHoldToggle = (run: CruzInspectionRun) => {
    if (run.status === 'hold') {
      releaseHold(run.id)
      return
    }

    const reason = window.prompt('Provide a reason for placing this run on hold (optional).')
    placeOnHold(run.id, reason ?? undefined)
  }

  const handleCancel = (run: CruzInspectionRun) => {
    const reason = window.prompt('Provide a cancellation reason (required).')
    if (!reason) {
      return
    }
    cancelRun(run.id, reason)
  }

  const handleGroupSelected = () => {
    if (selectedRuns.length < 2) {
      return
    }
    groupRuns(selectedRuns)
    setSelectedRuns([])
  }

  const openSplitModal = (run: CruzInspectionRun) => {
    setSplitTarget(run)
    setSplitQuantity(1)
  }

  const confirmSplit = () => {
    if (!splitTarget) return
    const maxQuantity = splitTarget.containerCount - 1
    const qty = Math.max(1, Math.min(splitQuantity, maxQuantity))
    splitRun(splitTarget.id, qty)
    setSplitTarget(null)
    setSplitQuantity(1)
  }

  useEffect(() => {
    setSelectedRuns((prev) => prev.filter((id) => runs.some((run) => run.id === id)))
  }, [runs])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Inspection Runs</h2>
          <p className="text-sm text-slate-500">Strict six-step Cruz v1 inspection workflow.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={selectedRuns.length < 2 || isPending} onClick={handleGroupSelected}>
            Group selected
          </Button>
          <Button variant="outline" disabled>
            Scan QR (coming soon)
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>Create runs</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total Runs</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{runs.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Completed</p>
          <p className="mt-2 text-2xl font-semibold text-green-600">{totals.runsCompleted ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">On Hold</p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{totals.runsOnHold ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Workflow Version</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">Cruz v1</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Select
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Item / SKU
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Container
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Count
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Current Step
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                  No inspection runs yet. Create the first run to begin the workflow.
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={selectedRuns.includes(run.id)}
                      onChange={(event) => toggleSelection(run.id, event.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="flex items-start gap-3">
                      {(() => {
                        const imageUrl = getRunImage(run)
                        if (!imageUrl) return null
                        return (
                          <img
                            src={imageUrl}
                            alt={run.materialName || run.sku || 'Product'}
                            className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                            onError={(event) => {
                              const target = event.target as HTMLImageElement
                              target.style.display = 'none'
                            }}
                          />
                        )
                      })()}
                      <div>
                        <div className="font-medium text-slate-900">{run.materialName || 'Unassigned item'}</div>
                        <div className="text-xs text-slate-500">SKU: {run.sku || 'N/A'}</div>
                        {run.qrValue && (
                          <div className="text-xs text-slate-400">QR: {run.qrValue}</div>
                        )}
                        {Array.isArray(run.metadata?.groupedRunIds) && run.metadata!.groupedRunIds!.length > 0 && (
                          <div className="mt-1 text-xs text-indigo-600">
                            Grouped with {run.metadata!.groupedRunIds!.length} run(s)
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize text-slate-700">{run.containerType}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{run.containerCount}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <StepChip stepId={run.currentStepId} current={true} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <StatusBadge run={run} />
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-700">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedRunId(run.id)}>
                        Open
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openSplitModal(run)} disabled={run.containerCount <= 1}>
                        Split
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleHoldToggle(run)}>
                        {run.status === 'hold' ? 'Unhold' : 'Hold'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCancel(run)} disabled={run.status === 'completed'}>
                        Cancel
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={createModalOpen} onOpenChange={(open) => setCreateModalOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create inspection runs</DialogTitle>
            <DialogDescription>
              Choose container details. More advanced grouping and QR-driven creation are coming soon.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Container Type</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.containerType}
                onChange={(event) => update({ containerType: event.target.value as ContainerType })}
              >
                {CONTAINER_TYPES.map((type) => (
                  <option key={type} value={type} className="capitalize">
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Container Count</label>
              <Input
                type="number"
                min={1}
                value={form.containerCount}
                onChange={(event) => update({ containerCount: Number(event.target.value) })}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">SKU</label>
              <Input
                value={form.sku}
                onChange={(event) => update({ sku: event.target.value })}
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Material Name</label>
              <Input
                value={form.materialName}
                onChange={(event) => update({ materialName: event.target.value })}
                placeholder="Optional"
              />
            </div>

            <DialogFooter className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating…' : 'Create run'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <RunWizard
        run={selectedRun}
        orderId={orderId}
        onClose={() => setSelectedRunId(null)}
        submitStep={submitStep}
        bindRun={bindRun}
        isPending={isPending}
        getRunImage={getRunImage}
      />

      <Dialog open={Boolean(splitTarget)} onOpenChange={(open) => {
        if (!open) {
          setSplitTarget(null)
          setSplitQuantity(1)
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Split inspection run</DialogTitle>
            <DialogDescription>
              Move a subset of containers into a new run. Remaining containers stay on the original run.
            </DialogDescription>
          </DialogHeader>
          {splitTarget && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                {splitTarget.materialName || 'Unassigned item'} • {splitTarget.containerType.toUpperCase()} × {splitTarget.containerCount}
              </p>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Containers to move</label>
                <Input
                  type="number"
                  min={1}
                  max={Math.max(1, splitTarget.containerCount - 1)}
                  value={splitQuantity}
                  onChange={(event) => setSplitQuantity(Number(event.target.value))}
                  required
                />
                <p className="mt-1 text-xs text-slate-500">1 to {splitTarget.containerCount - 1}</p>
              </div>
              <DialogFooter className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setSplitTarget(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={confirmSplit} disabled={splitQuantity < 1 || splitQuantity >= splitTarget.containerCount || isPending}>
                  Split run
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface RunWizardProps {
  run: CruzInspectionRun | null
  orderId: string
  onClose: () => void
  submitStep: <K extends CruzStepId>(params: RecordStepParams<K>) => void
  bindRun: (runId: string, payload: BindRunToQrParams, userId?: string) => void
  isPending: boolean
  getRunImage: (run: CruzInspectionRun) => string | null
}

function RunWizard({ run, orderId, onClose, submitStep, bindRun, isPending, getRunImage }: RunWizardProps) {
  const [localError, setLocalError] = useState<string | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<CruzStepId | null>(null)

  if (!run) {
    return null
  }

  const currentStep = run.currentStepId
  useEffect(() => {
    setSelectedStepId(null)
  }, [currentStep])

  const displayStep = selectedStepId || currentStep

  const handleSubmit = <K extends CruzStepId>(stepId: K, payload: CruzStepPayloadMap[K], outcome: 'PASS' | 'FAIL' | 'HOLD' = 'PASS') => {
    setLocalError(null)
    if (stepId !== currentStep) {
      setLocalError('Return to the active step before recording changes.')
      setSelectedStepId(null)
      return
    }
    try {
      submitStep({
        orderId,
        runId: run.id,
        stepId,
        payload,
        outcome,
      } as RecordStepParams<K>)
    } catch (error) {
      console.error(error)
      setLocalError(error instanceof Error ? error.message : 'Failed to submit step')
    }
  }

  const stepPayload = run.steps[displayStep as keyof typeof run.steps] as CruzStepPayloadMap[typeof displayStep] | undefined
  const isViewingPreviousStep = displayStep !== currentStep

  const handleBack = () => {
    const effectiveStep = displayStep === 'scan_qr' ? CRUZ_NAVIGABLE_STEPS[0] : displayStep
    const currentIdx = CRUZ_NAVIGABLE_STEPS.indexOf(effectiveStep as (typeof CRUZ_NAVIGABLE_STEPS)[number])

    if (currentIdx > 0) {
      const previousStep = CRUZ_NAVIGABLE_STEPS[currentIdx - 1]
      setSelectedStepId(previousStep)
    }
  }

  const canGoBack = (() => {
    const effectiveStep = displayStep === 'scan_qr' ? CRUZ_NAVIGABLE_STEPS[0] : displayStep
    return CRUZ_NAVIGABLE_STEPS.indexOf(effectiveStep as (typeof CRUZ_NAVIGABLE_STEPS)[number]) > 0
  })()

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Run: {run.materialName || 'Unassigned'} • {run.containerType.toUpperCase()} × {run.containerCount}
          </DialogTitle>
          <DialogDescription>
            Follow the ordered six-step inspection workflow. Steps must be completed sequentially.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-12">
          <aside className="md:col-span-4 space-y-2">
            {CRUZ_STEP_ORDER.map((stepId) => {
              const completed = Boolean(run.steps[stepId])
              const isCurrent = stepId === displayStep
              const stepIndex = CRUZ_STEP_ORDER.indexOf(stepId)
              const currentIndex = CRUZ_STEP_ORDER.indexOf(currentStep)
              const isSelectable = stepIndex <= currentIndex
              return (
                <button
                  key={stepId}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm text-left',
                    isCurrent
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : completed
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-slate-200 bg-white',
                    isSelectable ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60'
                  )}
                  onClick={() => {
                    if (!isSelectable) return
                    setSelectedStepId(stepId === currentStep ? null : stepId)
                  }}
                  disabled={!isSelectable}
                >
                  <span>{STEP_LABELS[stepId]}</span>
                  {completed && <span className="text-xs">✔</span>}
                </button>
              )
            })}
          </aside>

          <section className="md:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={handleBack} disabled={!canGoBack}>
                ← Back
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
            <div className="flex items-start gap-4">
              {(() => {
                if (!run) return null
                const imageUrl = getRunImage(run)
                if (!imageUrl) return null
                return (
                  <img
                    src={imageUrl}
                    alt={run.materialName || run.sku || 'Product'}
                    className="h-36 w-36 rounded-xl border border-slate-200 object-cover"
                    onError={(event) => {
                      const target = event.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                )
              })()}
              <div className="space-y-1 text-sm text-slate-600">
                {run.sku && (
                  <div><span className="font-semibold text-slate-700">SKU:</span> {run.sku}</div>
                )}
                {run.qrValue && (
                  <div><span className="font-semibold text-slate-700">QR:</span> {run.qrValue}</div>
                )}
                <div><span className="font-semibold text-slate-700">Containers:</span> {run.containerCount}</div>
              </div>
            </div>
            {localError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{localError}</div>
            )}

            {displayStep === 'scan_qr' && (
              <ScanQrStepForm
                run={run}
                payload={stepPayload as CruzStepPayloadMap['scan_qr']}
                orderId={orderId}
                onSubmit={(payload) => handleSubmit('scan_qr', payload, 'PASS')}
                isPending={isPending || isViewingPreviousStep}
                bindRun={bindRun}
              />
            )}

            {displayStep === 'inspection_info' && (
              <InspectionInfoStepForm
                run={run}
                payload={stepPayload as CruzStepPayloadMap['inspection_info']}
                orderId={orderId}
                shipTo={shipToAddress}
                shipFrom={shipFromAddress}
                customerEmail={customerEmail}
                onSubmit={(payload) => handleSubmit('inspection_info', payload, 'PASS')}
                isPending={isPending || isViewingPreviousStep}
              />
            )}

            {displayStep === 'verify_packing_label' && (
              <VerifyPackingLabelStepForm
                run={run}
                payload={stepPayload as CruzStepPayloadMap['verify_packing_label']}
                orderId={orderId}
                onSubmit={(payload, outcome) => handleSubmit('verify_packing_label', payload, outcome)}
                isPending={isPending || isViewingPreviousStep}
              />
            )}

            {displayStep === 'verify_product_label' && (
              <VerifyProductLabelStepForm
                run={run}
                payload={stepPayload as CruzStepPayloadMap['verify_product_label']}
                orderId={orderId}
                onSubmit={(payload, outcome) => handleSubmit('verify_product_label', payload, outcome)}
                isPending={isPending || isViewingPreviousStep}
              />
            )}

            {displayStep === 'lot_number' && (
              <LotNumberStepForm
                run={run}
                payload={stepPayload as CruzStepPayloadMap['lot_number']}
                orderId={orderId}
                onSubmit={(payload) => handleSubmit('lot_number', payload, 'PASS')}
                isPending={isPending || isViewingPreviousStep}
              />
            )}

            {displayStep === 'final_review' && (
              <FinalReviewStepForm
                run={run}
                payload={stepPayload as CruzStepPayloadMap['final_review']}
                orderId={orderId}
                onSubmit={(payload) => handleSubmit('final_review', payload, 'PASS')}
                isPending={isPending || isViewingPreviousStep}
              />
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ScanQrStepForm({ run, payload, onSubmit, isPending, orderId: _orderId, bindRun }: StepFormProps<'scan_qr'> & { bindRun: RunWizardProps['bindRun'] }) {
  const [qrValue, setQrValue] = useState(payload?.qrValue ?? run.qrValue ?? '')
  const [shortCode, setShortCode] = useState(payload?.shortCode ?? run.shortCode ?? '')
  const [showScanner, setShowScanner] = useState(false)
  const hasValidated = Boolean(payload?.qrValidated || run.steps?.scan_qr?.qrValidated)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!qrValue.trim()) {
      return
    }

    const now = new Date().toISOString()
    onSubmit(
      {
        qrValue: qrValue.trim(),
        qrValidated: true,
        validatedAt: now,
        shortCode: shortCode.trim() || undefined,
      },
      'PASS'
    )

    bindRun(run.id, {
      qrCodeId: qrValue.trim(),
      qrValue: qrValue.trim(),
      shortCode: shortCode.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-600">
        {hasValidated
          ? 'QR code already validated for this run. Rescan if you need to rebind or confirm.'
          : 'Scan and validate the QR code associated with this run. Manual entry is allowed temporarily; the code will be marked as validated.'}
      </p>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">QR Value</label>
        <Input value={qrValue} onChange={(event) => setQrValue(event.target.value)} required placeholder="Scan or paste QR value" />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Short Code (optional)</label>
        <Input value={shortCode} onChange={(event) => setShortCode(event.target.value)} placeholder="Short code" />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || !qrValue.trim()}>
          {hasValidated ? 'Re-validate QR' : 'Mark QR as validated'}
        </Button>
        <Button type="button" variant="outline" onClick={() => setShowScanner(true)}>
          Open scanner
        </Button>
      </div>

      {showScanner && (
        <ValidatedQRScanner
          onClose={() => setShowScanner(false)}
          onScan={(raw) => setQrValue(raw)}
          onValidatedScan={(data) => {
            const resolvedValue = data.shortCode || data.id || data.workspace?.orderNumber || ''
            setQrValue(resolvedValue)
            setShortCode(data.shortCode || '')
            bindRun(run.id, {
              qrCodeId: data.id,
              qrValue: resolvedValue,
              shortCode: data.shortCode || undefined,
            })
            onSubmit(
              {
                qrValue: resolvedValue,
                qrValidated: true,
                validatedAt: new Date().toISOString(),
                shortCode: data.shortCode || undefined,
              },
              'PASS'
            )
            setShowScanner(false)
          }}
          allowManualEntry
          supervisorMode
          title="Scan container QR"
        />
      )}
    </form>
  )
}

function InspectionInfoStepForm({ run, payload, onSubmit, isPending, orderId, shipTo, shipFrom, customerEmail }: StepFormProps<'inspection_info'>) {
  const now = useMemo(() => new Date(), [])
  const formatDate = useCallback((date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const formatTime = useCallback((date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }, [])

  const derivedOrderNumber = payload?.orderNumber ?? run.steps.scan_qr?.qrValue ?? run.qrValue ?? orderId ?? ''
  const [datePerformed, setDatePerformed] = useState(() => payload?.datePerformed ?? formatDate(now))
  const [timePerformed, setTimePerformed] = useState(() => payload?.timePerformed ?? formatTime(now))
  const [inspector, setInspector] = useState(payload?.inspector ?? '')
  const [notes, setNotes] = useState(payload?.notes ?? '')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!derivedOrderNumber.trim() || !datePerformed || !timePerformed || !inspector.trim()) {
      return
    }

    onSubmit(
      {
        orderNumber: derivedOrderNumber.trim(),
        datePerformed,
        timePerformed,
        inspector: inspector.trim(),
        notes: notes.trim() || undefined,
      },
      'PASS'
    )
  }

  const shipToLines = formatAddressLines(shipTo)
  const shipFromLines = formatAddressLines(shipFrom)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Order Number</label>
          <Input value={derivedOrderNumber} readOnly disabled className="bg-slate-100 text-slate-600" />
          <p className="mt-1 text-xs text-slate-500">Captured automatically from the QR/workspace binding so inspectors don&apos;t re-type it.</p>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Date Performed</label>
          <Input type="date" value={datePerformed} onChange={(event) => setDatePerformed(event.target.value)} required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Time Performed</label>
          <Input type="time" value={timePerformed} onChange={(event) => setTimePerformed(event.target.value)} required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Inspector</label>
          <select
            value={INSPECTORS.includes(inspector as any) ? inspector : inspector ? 'custom' : ''}
            onChange={(event) => {
              const value = event.target.value
              if (value === 'custom') {
                setInspector('')
              } else {
                setInspector(value)
              }
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          >
            <option value="" disabled>
              Select inspector
            </option>
            {INSPECTORS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="custom">Other…</option>
          </select>
          {!INSPECTORS.includes(inspector as any) && (
            <Input
              className="mt-2"
              value={inspector}
              onChange={(event) => setInspector(event.target.value)}
              placeholder="Enter inspector name"
              required
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">Ship To</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {shipToLines.map((line, index) => (
              <p key={`super-ship-to-${index}`}>{line}</p>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">Ship From</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {shipFromLines.map((line, index) => (
              <p key={`super-ship-from-${index}`}>{line}</p>
            ))}
          </div>
        </div>
      </div>

      {customerEmail && (
        <p className="text-xs text-slate-500">
          Customer email: <a className="text-indigo-600 hover:underline" href={`mailto:${customerEmail}`}>{customerEmail}</a>
        </p>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Notes (optional)</label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </div>

      <Button type="submit" disabled={isPending || !derivedOrderNumber.trim() || !inspector.trim()}>
        {isPending ? 'Saving…' : 'Save inspection information'}
      </Button>
    </form>
  )
}

function VerifyPackingLabelStepForm({ run, payload, onSubmit, isPending, orderId }: StepFormProps<'verify_packing_label'>) {
  const [checks, setChecks] = useState({
    shipToOk: payload?.shipToOk ?? false,
    companyOk: payload?.companyOk ?? false,
    orderNumberOk: payload?.orderNumberOk ?? false,
    productDescriptionOk: payload?.productDescriptionOk ?? false,
  })
  const [mismatchReason, setMismatchReason] = useState(payload?.mismatchReason ?? '')
  const [photos, setPhotos] = useState<InspectionPhoto[]>(payload?.photos ?? [])
  const [uploading, setUploading] = useState(false)

  const allChecksTrue = Object.values(checks).every(Boolean)
  const hasMismatch = !allChecksTrue
  const finalOutcome: 'PASS' | 'FAIL' = hasMismatch ? 'FAIL' : 'PASS'

  const handleFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      return
    }

    setUploading(true)
    const uploaded: InspectionPhoto[] = []
    try {
      for (const file of Array.from(files)) {
        const result = await uploadDocument({
          file,
          orderId,
          documentType: 'inspection_photo',
          metadata: {
            runId: run.id,
            stepId: 'verify_packing_label',
          },
        })

        if (result.success && result.document) {
          uploaded.push({
            id: result.document.id,
            name: result.document.fileName ?? file.name,
            uploadedAt: new Date().toISOString(),
            documentId: result.document.id,
            url: result.document.url,
          })
        }
      }

      if (uploaded.length) {
        setPhotos((prev) => [...prev, ...uploaded])
      }
    } catch (err) {
      console.error('Failed to upload inspection photos', err)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleRemovePhoto = async (photoId: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId))
    try {
      await deleteDocument(photoId)
    } catch (error) {
      console.error('Failed to delete inspection photo', error)
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (finalOutcome === 'FAIL' && (!mismatchReason.trim() || photos.length === 0)) {
      return
    }

    onSubmit(
      {
        ...checks,
        gate1Outcome: finalOutcome,
        mismatchReason: finalOutcome === 'FAIL' ? mismatchReason.trim() : undefined,
        photos,
        completedAt: new Date().toISOString(),
      },
      finalOutcome
    )
  }

  const updateCheck = (key: keyof typeof checks, value: boolean) => {
    setChecks((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Package Match Verification</p>
        <p>Toggle off anything that does not match the packing slip. Any unchecked item automatically records this step as a FAIL.</p>
        <p className="mt-2 text-xs text-slate-500">Current status: {finalOutcome === 'PASS' ? 'PASS — all items match.' : 'FAIL — at least one mismatch needs documentation.'}</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-slate-500">Confirm each packing label element before marking it.</p>
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={checks.shipToOk} onChange={(event) => updateCheck('shipToOk', event.target.checked)} />
          Ship-to matches packing label
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={checks.companyOk} onChange={(event) => updateCheck('companyOk', event.target.checked)} />
          Company name matches
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={checks.orderNumberOk} onChange={(event) => updateCheck('orderNumberOk', event.target.checked)} />
          Order number matches
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={checks.productDescriptionOk} onChange={(event) => updateCheck('productDescriptionOk', event.target.checked)} />
          Product description matches
        </label>
      </div>
      {finalOutcome === 'FAIL' && (
        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-amber-900">Describe the mismatch (required)</label>
            <Textarea value={mismatchReason} onChange={(event) => setMismatchReason(event.target.value)} rows={3} required />
          </div>
          <p className="text-xs text-amber-800">Include enough context so the next inspector understands what needs to be re-checked.</p>
        </div>
      )}

      <div className="space-y-2">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Inspection photos {finalOutcome === 'FAIL' ? '(required when documenting a mismatch)' : '(optional)'}
        </label>
        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <span key={photo.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {photo.name}
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700"
                onClick={() => handleRemovePhoto(photo.id)}
              >
                ×
              </button>
            </span>
          ))}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Upload
            <input type="file" className="sr-only" multiple onChange={handleFilesChange} disabled={uploading} accept="image/*" />
          </label>
        </div>
        {uploading && <p className="text-xs text-slate-500">Uploading…</p>}
      </div>

      <Button
        type="submit"
        disabled={
          isPending ||
          (finalOutcome === 'FAIL' && (!mismatchReason.trim() || photos.length === 0))
        }
      >
        {isPending
          ? 'Saving…'
          : finalOutcome === 'FAIL'
            ? 'Record mismatch and hold run'
            : 'Checklist complete — continue'}
      </Button>
    </form>
  )
}

function VerifyProductLabelStepForm({ run, payload, onSubmit, isPending, orderId }: StepFormProps<'verify_product_label'>) {
  const [checks, setChecks] = useState({
    gradeOk: payload?.gradeOk ?? false,
    unOk: payload?.unOk ?? false,
    pgOk: payload?.pgOk ?? false,
    lidOk: payload?.lidOk ?? false,
    ghsOk: payload?.ghsOk ?? false,
  })
  const [issueReason, setIssueReason] = useState(payload?.issueReason ?? '')
  const [photos, setPhotos] = useState<InspectionPhoto[]>(payload?.photos ?? [])
  const [uploading, setUploading] = useState(false)

  const allChecksTrue = Object.values(checks).every(Boolean)
  const hasMismatch = !allChecksTrue
  const finalOutcome: 'PASS' | 'FAIL' = hasMismatch ? 'FAIL' : 'PASS'

  const handleFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      return
    }

    setUploading(true)
    const uploaded: InspectionPhoto[] = []
    try {
      for (const file of Array.from(files)) {
        const result = await uploadDocument({
          file,
          orderId,
          documentType: 'inspection_photo',
          metadata: {
            runId: run.id,
            stepId: 'verify_product_label',
          },
        })

        if (result.success && result.document) {
          uploaded.push({
            id: result.document.id,
            name: result.document.fileName ?? file.name,
            uploadedAt: new Date().toISOString(),
            documentId: result.document.id,
            url: result.document.url,
          })
        }
      }

      if (uploaded.length) {
        setPhotos((prev) => [...prev, ...uploaded])
      }
    } catch (err) {
      console.error('Failed to upload product label photos', err)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleRemovePhoto = async (photoId: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId))
    try {
      await deleteDocument(photoId)
    } catch (error) {
      console.error('Failed to delete product label photo', error)
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (photos.length === 0) {
      return
    }

    if (finalOutcome === 'FAIL' && !issueReason.trim()) {
      return
    }

    onSubmit(
      {
        ...checks,
        gate2Outcome: finalOutcome,
        issueReason: finalOutcome === 'FAIL' ? issueReason.trim() : undefined,
        photos,
        completedAt: new Date().toISOString(),
      },
      finalOutcome
    )
  }

  const updateCheck = (key: keyof typeof checks, value: boolean) => {
    setChecks((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Product Label Compliance</p>
        <p>Confirm every regulatory element on the product label. Any unchecked item automatically records this step as a FAIL and keeps the run in re-verify.</p>
        <p className="mt-2 text-xs text-slate-500">Current status: {finalOutcome === 'PASS' ? 'PASS — all requirements satisfied.' : 'FAIL — at least one label element needs follow-up.'}</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-slate-500">Check each product label requirement after visually confirming it.</p>
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={checks.gradeOk} onChange={(event) => updateCheck('gradeOk', event.target.checked)} />
          Grade correct (ACS, Food, USP, etc.)
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={checks.unOk} onChange={(event) => updateCheck('unOk', event.target.checked)} />
          UN number correct
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={checks.pgOk} onChange={(event) => updateCheck('pgOk', event.target.checked)} />
          Packing group (PG) correct
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={checks.lidOk} onChange={(event) => updateCheck('lidOk', event.target.checked)} />
          Lid inspection passed
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={checks.ghsOk} onChange={(event) => updateCheck('ghsOk', event.target.checked)} />
          GHS labels correct
        </label>
      </div>

      <div className="space-y-2">
        <label className="mb-2 block text-sm font-medium text-slate-700">Photo evidence (required)</label>
        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <span key={photo.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {photo.name}
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700"
                onClick={() => handleRemovePhoto(photo.id)}
              >
                ×
              </button>
            </span>
          ))}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Upload
            <input type="file" className="sr-only" multiple onChange={handleFilesChange} disabled={uploading} accept="image/*" />
          </label>
        </div>
        {uploading && <p className="text-xs text-slate-500">Uploading…</p>}
      </div>

      {finalOutcome === 'FAIL' && (
        <div>
          <label className="mb-2 block text-sm font-medium text-red-700">Issue reason</label>
          <Textarea value={issueReason} onChange={(event) => setIssueReason(event.target.value)} rows={3} required />
        </div>
      )}

      <Button
        type="submit"
        disabled={
          isPending ||
          photos.length === 0 ||
          (finalOutcome === 'FAIL' && !issueReason.trim()) ||
          (finalOutcome === 'PASS' && !allChecksTrue)
        }
      >
        {isPending
          ? 'Saving…'
          : finalOutcome === 'FAIL'
            ? 'Document issue and hold run'
            : 'Checklist complete — continue'}
      </Button>
    </form>
  )
}

function LotNumberStepForm({ run: _run, payload, onSubmit, isPending, orderId: _orderId }: StepFormProps<'lot_number'>) {
  const [lots, setLots] = useState(() => payload?.lots?.map((lot) => lot.lotRaw) || [''])
  const [sameForAll, setSameForAll] = useState(payload?.sameForAll ?? false)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (lots.some((lotValue: string) => !lotValue.trim())) {
      return
    }

    onSubmit(
      {
        lots: lots.map((lotValue: string, index: number) => ({
          id: payload?.lots?.[index]?.id ?? `lot_${index}_${Date.now()}`,
          lotRaw: lotValue.trim(),
        })),
        sameForAll,
        completedAt: new Date().toISOString(),
      },
      'PASS'
    )
  }

  const updateLot = (index: number, value: string) => {
    const next = [...lots]
    next[index] = value
    setLots(next)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-600">Record the lot number(s) exactly as printed. Multiple lots are supported.</p>

      <label className="flex items-center gap-3 text-sm text-slate-700">
        <input type="checkbox" checked={sameForAll} onChange={(event) => setSameForAll(event.target.checked)} /> Same lot for all containers
      </label>

      <div className="space-y-3">
        {lots.map((lotValue: string, index: number) => (
          <div key={index} className="flex gap-2">
            <Input value={lotValue} onChange={(event) => updateLot(index, event.target.value)} placeholder="LOT number" required />
            {lots.length > 1 && (
              <Button type="button" variant="ghost" onClick={() => setLots(lots.filter((_, i) => i !== index))}>
                Remove
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setLots([...lots, ''])}>
          Add another lot
        </Button>
      </div>

      <div className="space-y-3">
        <Button type="submit" disabled={isPending || lots.some((lotValue: string) => !lotValue.trim())}>
          {isPending ? 'Saving…' : 'Save lots'}
        </Button>
      </div>
    </form>
  )
}

function FinalReviewStepForm({ run, payload, onSubmit, isPending, orderId: _orderId }: StepFormProps<'final_review'>) {
  const inspectionInfo = run.steps.inspection_info
  const packing = run.steps.verify_packing_label
  const product = run.steps.verify_product_label
  const lotData = run.steps.lot_number

  const [approvals, setApprovals] = useState(() => ({
    packingLabel: payload?.approvals?.packingLabel ?? false,
    productLabel: payload?.approvals?.productLabel ?? false,
    lotNumbers: payload?.approvals?.lotNumbers ?? false,
  }))
  const [finalNotes, setFinalNotes] = useState(payload?.finalNotes ?? '')

  const lotNumbers = lotData?.lots ?? []
  const allApproved = approvals.packingLabel && approvals.productLabel && approvals.lotNumbers

  const statusBadge = (label: string, outcome?: 'PASS' | 'FAIL') => (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        outcome === 'PASS'
          ? 'bg-green-100 text-green-700'
          : outcome === 'FAIL'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-100 text-slate-600'
      }`}
    >
      {label}
    </span>
  )

  const handleCheckboxChange = (key: keyof typeof approvals) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked
    setApprovals((prev) => ({ ...prev, [key]: checked }))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!allApproved) {
      return
    }

    onSubmit(
      {
        approvals: {
          packingLabel: approvals.packingLabel,
          productLabel: approvals.productLabel,
          lotNumbers: approvals.lotNumbers,
        },
        finalNotes: finalNotes.trim() || undefined,
        completedAt: new Date().toISOString(),
      },
      'PASS'
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-800">Inspection Summary</p>
        <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Inspector</p>
            <p>{inspectionInfo?.inspector || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Performed</p>
            <p>
              {inspectionInfo?.datePerformed || '—'} {inspectionInfo?.timePerformed ? `@ ${inspectionInfo.timePerformed}` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Order Number</p>
            <p>{inspectionInfo?.orderNumber || workspace.orderNumber || orderId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Notes</p>
            <p>{inspectionInfo?.notes || 'None recorded'}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Package Match Verification</p>
            {statusBadge(packing?.gate1Outcome ?? 'PENDING', packing?.gate1Outcome)}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Ship-to, company, order number, and description were checked against the physical package.
          </p>
          {packing?.mismatchReason && (
            <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">
              Reported issue: {packing.mismatchReason}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Product Label Compliance</p>
            {statusBadge(product?.gate2Outcome ?? 'PENDING', product?.gate2Outcome)}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Grade, UN, packing group, lid security, and GHS labels were reviewed with photo evidence.
          </p>
          {product?.issueReason && (
            <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">
              Reported issue: {product.issueReason}
            </p>
          )}
        </div>

        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-800">Lot Numbers Captured</p>
          {lotNumbers.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No lot numbers recorded yet. Return to the previous step to add them.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {lotNumbers.map((lot, index) => (
                <li key={lot.id ?? index} className="font-mono">
                  • {lot.lotRaw}
                </li>
              ))}
            </ul>
          )}
          {lotData?.sameForAll && lotNumbers.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">Same lot applies to all containers.</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Final Acknowledgements</p>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={approvals.packingLabel} onChange={handleCheckboxChange('packingLabel')} />
          <span>I confirm the packing label findings above are complete.</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={approvals.productLabel} onChange={handleCheckboxChange('productLabel')} />
          <span>I confirm the product label review is complete.</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={approvals.lotNumbers} onChange={handleCheckboxChange('lotNumbers')} />
          <span>I confirm the recorded lot number(s) are accurate.</span>
        </label>
        {!allApproved && (
          <p className="text-xs text-amber-700">Acknowledge each item to finalize the inspection.</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Final notes (optional)</label>
        <Textarea value={finalNotes} onChange={(event) => setFinalNotes(event.target.value)} rows={3} placeholder="Any final observations before completing the run" />
      </div>

      <Button type="submit" disabled={isPending || !allApproved}>
        {isPending ? 'Saving…' : 'Complete Inspection ✓'}
      </Button>
    </form>
  )
}

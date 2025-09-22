'use client'

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { useCruzInspection } from '@/hooks/useCruzInspection'
import { ValidatedQRScanner } from '@/components/qr/ValidatedQRScanner'
import { InspectionItem } from '@/lib/types/agent-view'
import { InspectionHeader } from '@/components/inspection/InspectionHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { INSPECTORS } from '@/lib/inspection/inspectors'
import { uploadDocument, deleteDocument } from '@/app/actions/documents'
import {
  CRUZ_STEP_ORDER,
  type CruzInspectionRun,
  type CruzStepId,
  type CruzStepPayloadMap,
  type InspectionPhoto,
  normalizeInspectionState,
} from '@/lib/inspection/cruz'
import type { RecordStepParams, BindRunToQrParams } from '@/app/actions/cruz-inspection'

interface ResilientInspectionScreenProps {
  orderId: string
  orderNumber: string
  customerName: string
  orderItems: any[]
  workflowPhase: string
  workflowType: string
  items: InspectionItem[]
  workspace?: any
  onComplete: (results: Record<string, 'pass' | 'fail'>, notes: Record<string, string>) => void
  onSwitchToSupervisor: () => void
}

// Step form components - These are adapted from inspection-runs-panel.tsx
// They've been modified to work within the ResilientInspectionScreen context

interface StepFormProps<StepId extends CruzStepId = CruzStepId> {
  run: CruzInspectionRun
  payload?: CruzStepPayloadMap[StepId]
  onSubmit: (payload: CruzStepPayloadMap[StepId], outcome: 'PASS' | 'FAIL' | 'HOLD') => void
  isPending: boolean
  orderId: string
  orderNumber?: string
  bindRun?: (runId: string, payload: BindRunToQrParams) => void
}

function ScanQrStepForm({ run, payload, onSubmit, isPending, orderId: _orderId, bindRun }: StepFormProps<'scan_qr'> & { bindRun: (runId: string, payload: BindRunToQrParams) => void }) {
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

    if (bindRun) {
      bindRun(run.id, {
        qrCodeId: qrValue.trim(),
        qrValue: qrValue.trim(),
        shortCode: shortCode.trim() || undefined,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-600">
        {hasValidated
          ? 'QR code already validated for this run. Rescan if you need to rebind or confirm.'
          : 'Scan and validate the QR code associated with this run.'}
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
            if (bindRun) {
              bindRun(run.id, {
                qrCodeId: data.id,
                qrValue: resolvedValue,
                shortCode: data.shortCode || undefined,
              })
            }
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

function InspectionInfoStepForm({ run, payload, onSubmit, isPending, orderId, orderNumber }: StepFormProps<'inspection_info'>) {
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

  const derivedOrderNumber = payload?.orderNumber ?? orderNumber ?? run.steps.scan_qr?.qrValue ?? run.qrValue ?? orderId ?? ''
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Order Number</label>
          <Input value={derivedOrderNumber} readOnly disabled className="bg-slate-100 text-slate-600" />
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

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Notes (optional)</label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </div>

      <Button
        type="submit"
        disabled={isPending || !derivedOrderNumber.trim() || !inspector.trim()}
        className="w-full h-16 text-xl font-semibold bg-green-600 hover:bg-green-700"
      >
        {isPending ? 'Saving…' : 'Save and Continue →'}
      </Button>
    </form>
  )
}

function VerifyPackingLabelStepForm({ run, payload, onSubmit, isPending, orderId, orderNumber, orderItems, customerName }: StepFormProps<'verify_packing_label'> & { orderItems?: any[], customerName?: string }) {
  const [checks, setChecks] = useState({
    shipToOk: payload?.shipToOk ?? true,
    companyOk: payload?.companyOk ?? true,
    orderNumberOk: payload?.orderNumberOk ?? true,
    productDescriptionOk: payload?.productDescriptionOk ?? true,
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

  // Get first order item for display
  const primaryItem = orderItems?.[0]
  const fallbackCdnBase = process.env.NEXT_PUBLIC_SHOPIFY_CDN_BASE
  const productImage = primaryItem?.imageUrl
    ? primaryItem.imageUrl
    : primaryItem?.sku && fallbackCdnBase
      ? `${fallbackCdnBase.replace(/\/$/, '')}/${primaryItem.sku.replace(/[^A-Za-z0-9_-]/g, '_')}.jpg`
      : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Order Info Display */}
      <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 space-y-3">
        <div className="flex gap-4">
          {productImage && (
            <img
              src={productImage}
              alt={primaryItem?.name || 'Product'}
              className="h-24 w-24 rounded-lg object-cover border border-blue-200"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="flex-1">
            <h3 className="text-lg font-bold text-blue-900">Order #{orderNumber || orderId}</h3>
            <p className="text-blue-800 font-medium">{customerName || 'Customer'}</p>
            {primaryItem && (
              <p className="text-sm text-blue-700 mt-1">
                {primaryItem.name} - {primaryItem.quantity} {primaryItem.unitOfMeasure || 'units'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Verify Physical Package</p>
        <p>Confirm the physical package matches this order information above.</p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3 text-base font-medium text-slate-700">
          <input
            type="checkbox"
            checked={checks.orderNumberOk}
            onChange={(event) => updateCheck('orderNumberOk', event.target.checked)}
            className="w-5 h-5"
          />
          This physical package is for Order #{orderNumber || orderId}
        </label>
        <label className="flex items-center gap-3 text-base font-medium text-slate-700">
          <input
            type="checkbox"
            checked={checks.shipToOk}
            onChange={(event) => updateCheck('shipToOk', event.target.checked)}
            className="w-5 h-5"
          />
          Shipping destination: <span className="text-blue-700">{customerName || 'Customer'}</span> ✓
        </label>
        <label className="flex items-center gap-3 text-base font-medium text-slate-700">
          <input
            type="checkbox"
            checked={checks.productDescriptionOk}
            onChange={(event) => updateCheck('productDescriptionOk', event.target.checked)}
            className="w-5 h-5"
          />
          Product matches: <span className="text-blue-700">{primaryItem?.name || 'Product'}</span>
        </label>
        <label className="flex items-center gap-3 text-base font-medium text-slate-700">
          <input
            type="checkbox"
            checked={checks.companyOk}
            onChange={(event) => updateCheck('companyOk', event.target.checked)}
            className="w-5 h-5"
          />
          Quantity correct: <span className="text-blue-700">{primaryItem?.quantity || 1} {primaryItem?.unitOfMeasure || 'units'}</span>
        </label>
      </div>

      {finalOutcome === 'FAIL' && (
        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-amber-900">Describe the mismatch (required)</label>
            <Textarea value={mismatchReason} onChange={(event) => setMismatchReason(event.target.value)} rows={3} required />
          </div>
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
        className={`w-full h-16 text-xl font-semibold ${
          finalOutcome === 'FAIL' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {isPending
          ? 'Saving…'
          : finalOutcome === 'FAIL'
            ? 'Record Mismatch ⚠'
            : 'Save and Continue →'}
      </Button>
    </form>
  )
}

function VerifyProductLabelStepForm({ run, payload, onSubmit, isPending, orderId, orderNumber, orderItems }: StepFormProps<'verify_product_label'> & { orderItems?: any[] }) {
  const [checks, setChecks] = useState({
    gradeOk: payload?.gradeOk ?? true,
    unOk: payload?.unOk ?? true,
    pgOk: payload?.pgOk ?? true,
    lidOk: payload?.lidOk ?? true,
    ghsOk: payload?.ghsOk ?? true,
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

  // Get product info for display
  const primaryItem = orderItems?.[0]
  const fallbackCdnBase = process.env.NEXT_PUBLIC_SHOPIFY_CDN_BASE
  const productImage = primaryItem?.imageUrl
    ? primaryItem.imageUrl
    : primaryItem?.sku && fallbackCdnBase
      ? `${fallbackCdnBase.replace(/\/$/, '')}/${primaryItem.sku.replace(/[^A-Za-z0-9_-]/g, '_')}.jpg`
      : null

  const productName = primaryItem?.name || 'Product'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Product Info Display with Image */}
      <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
        <div className="flex gap-4">
          {productImage && (
            <div className="flex-shrink-0">
              <img
                src={productImage}
                alt={primaryItem?.name || 'Product'}
                className="h-32 w-32 rounded-lg object-cover border-2 border-purple-200"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <p className="text-xs text-purple-700 mt-1 text-center">Product Image</p>
            </div>
          )}
          <div className="flex-1 space-y-2">
            <h3 className="text-lg font-bold text-purple-900">{productName}</h3>
            <div className="text-sm text-purple-700">
              <div className="font-mono">{primaryItem?.sku || 'Product SKU'}</div>
              <div className="mt-1">{primaryItem?.quantity || 1} {primaryItem?.unitOfMeasure || 'units'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Verify Product Labels</p>
        <p>Confirm the physical labels match the expected regulatory information above.</p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3 text-base font-medium text-slate-700">
          <input
            type="checkbox"
            checked={checks.gradeOk}
            onChange={(event) => updateCheck('gradeOk', event.target.checked)}
            className="w-5 h-5"
          />
          Grade correct (ACS, Tech, USP, Food, etc.)
        </label>
        <label className="flex items-center gap-3 text-base font-medium text-slate-700">
          <input
            type="checkbox"
            checked={checks.unOk}
            onChange={(event) => updateCheck('unOk', event.target.checked)}
            className="w-5 h-5"
          />
          UN number correct (if applicable)
        </label>
        <label className="flex items-center gap-3 text-base font-medium text-slate-700">
          <input
            type="checkbox"
            checked={checks.pgOk}
            onChange={(event) => updateCheck('pgOk', event.target.checked)}
            className="w-5 h-5"
          />
          Packing Group (PG) label present and correct
        </label>
        <label className="flex items-center gap-3 text-base font-medium text-slate-700">
          <input
            type="checkbox"
            checked={checks.lidOk}
            onChange={(event) => updateCheck('lidOk', event.target.checked)}
            className="w-5 h-5"
          />
          Lid/closure properly secured
        </label>
        <label className="flex items-center gap-3 text-base font-medium text-slate-700">
          <input
            type="checkbox"
            checked={checks.ghsOk}
            onChange={(event) => updateCheck('ghsOk', event.target.checked)}
            className="w-5 h-5"
          />
          GHS hazard labels visible and intact
        </label>
      </div>

      <div className="space-y-2">
        <label className="mb-2 block text-base font-medium text-slate-700">Photo evidence of labels (required) 📷</label>
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
          (finalOutcome === 'FAIL' && !issueReason.trim())
        }
        className={`w-full h-16 text-xl font-semibold ${
          finalOutcome === 'FAIL' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {isPending
          ? 'Saving…'
          : finalOutcome === 'FAIL'
            ? 'Document Issue ⚠'
            : 'Save and Continue →'}
      </Button>
    </form>
  )
}

function LotNumberStepForm({ payload, onSubmit, isPending, orderId: _orderId }: StepFormProps<'lot_number'>) {
  const [lots, setLots] = useState(() => payload?.lots?.map((lot) => lot.lotRaw) || [''])
  const [sameForAll, setSameForAll] = useState(payload?.sameForAll ?? false)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (lots.some((lot) => !lot.trim())) {
      return
    }

    onSubmit(
      {
        lots: lots.map((lot, index) => ({
          id: payload?.lots?.[index]?.id ?? `lot_${index}_${Date.now()}`,
          lotRaw: lot.trim(),
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
      <p className="text-sm text-slate-600">Record the lot number(s) exactly as printed.</p>

      <label className="flex items-center gap-3 text-sm text-slate-700">
        <input type="checkbox" checked={sameForAll} onChange={(event) => setSameForAll(event.target.checked)} /> Same lot for all containers
      </label>

      <div className="space-y-3">
        {lots.map((lot, index) => (
          <div key={index} className="flex gap-2">
            <Input value={lot} onChange={(event) => updateLot(index, event.target.value)} placeholder="LOT number" required />
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

      <Button
        type="submit"
        disabled={isPending || lots.some((lot) => !lot.trim())}
        className="w-full h-16 text-xl font-semibold bg-green-600 hover:bg-green-700"
      >
        {isPending ? 'Saving…' : 'Save and Continue →'}
      </Button>
    </form>
  )
}

function LotExtractionStepForm({ run, payload, onSubmit, isPending, orderId: _orderId }: StepFormProps<'lot_extraction'>) {
  const sourceLots = run.steps.lot_number?.lots ?? []
  const confirmedLots = payload?.lots ?? sourceLots.map((lot) => ({ ...lot, confirmed: false }))
  const [lots, setLots] = useState(confirmedLots)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (lots.some((lot) => !lot.confirmed)) {
      return
    }

    onSubmit(
      {
        lots: lots.map((lot) => ({ ...lot, confirmed: true })),
        parseMode: 'none',
        completedAt: new Date().toISOString(),
      },
      'PASS'
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-600">Confirm each recorded lot before completing the run.</p>

      <div className="space-y-3">
        {lots.map((lot, index) => (
          <label key={lot.id ?? index} className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={lot.confirmed}
              onChange={(event) => {
                const next = [...lots]
                next[index] = { ...lot, confirmed: event.target.checked }
                setLots(next)
              }}
            />
            <span className="font-mono text-sm">{lot.lotRaw}</span>
          </label>
        ))}
      </div>

      <Button
        type="submit"
        disabled={isPending || lots.some((lot) => !lot.confirmed)}
        className="w-full h-16 text-xl font-semibold bg-green-600 hover:bg-green-700"
      >
        {isPending ? 'Saving…' : 'Complete Inspection ✓'}
      </Button>
    </form>
  )
}

export default function ResilientInspectionScreen(props: ResilientInspectionScreenProps) {
  const {
    orderId,
    orderNumber,
    customerName,
    orderItems,
    workspace,
    onSwitchToSupervisor
  } = props

  // Initialize the Cruz inspection state
  const normalizedInitial = useMemo(
    () => normalizeInspectionState(workspace?.moduleStates?.inspection),
    [workspace?.moduleStates?.inspection]
  )

  const {
    runs,
    submitStep,
    bindRun,
    isPending,
    error,
    createRuns,
  } = useCruzInspection(orderId, normalizedInitial)

  // Auto-create inspection run if none exist
  const [hasAutoCreated, setHasAutoCreated] = useState(false)
  const [hasAutoSkippedQr, setHasAutoSkippedQr] = useState(false)

  useEffect(() => {
    // If no runs exist and we haven't already tried to create one, do it now
    if (runs.length === 0 && !hasAutoCreated && !isPending) {
      setHasAutoCreated(true)

      // Create real inspection runs for all items in the order
      const runsToCreate = orderItems && orderItems.length > 0
        ? orderItems.map(item => ({
            itemName: item.name || 'Product',
            itemSku: item.sku || '',
            quantity: item.quantity || 1,
            unitOfMeasure: item.unitOfMeasure || 'EA',
            containerType: 'drum' as const,
            containerCount: item.quantity || 1,
          }))
        : [{
            itemName: 'Product',
            itemSku: '',
            quantity: 1,
            unitOfMeasure: 'EA',
            containerType: 'drum' as const,
            containerCount: 1,
          }]

      createRuns(runsToCreate)
    }
  }, [runs.length, hasAutoCreated, isPending, createRuns, orderItems])

  // Find the active run that the worker should work on
  const activeRun = useMemo(() => {
    // First priority: runs that need reverification
    const needsReverify = runs.find(run => run.status === 'needs_reverify')
    if (needsReverify) return needsReverify

    // Second priority: active runs
    const active = runs.find(run => run.status === 'active')
    if (active) return active

    // Third priority: first run if any exist
    return runs[0] || null
  }, [runs])

  // State for manual step navigation
  const [selectedStepId, setSelectedStepId] = useState<CruzStepId | null>(null)

  // Auto-skip QR scan step since we already scanned to enter the inspection
  useEffect(() => {
    if (activeRun && activeRun.currentStepId === 'scan_qr' && !hasAutoSkippedQr && !isPending) {
      setHasAutoSkippedQr(true)
      // Auto-complete the QR scan step since we already scanned to get here
      submitStep({
        orderId,
        runId: activeRun.id,
        stepId: 'scan_qr',
        payload: {
          qrValue: orderId || 'auto-skipped',
          qrValidated: true,
          validatedAt: new Date().toISOString(),
          shortCode: workspace?.qrCode?.shortCode,
        },
        outcome: 'PASS',
      })
    }
  }, [activeRun, hasAutoSkippedQr, isPending, submitStep, orderId, workspace])

  // Use selected step if set, otherwise use the current step from the run
  const currentStep = selectedStepId || activeRun?.currentStepId || 'inspection_info'
  const currentStepIndex = CRUZ_STEP_ORDER.indexOf(currentStep)
  // Adjust for display - we skip QR scan, so subtract 1 from index and total
  const displayStepIndex = currentStep === 'scan_qr' ? 0 : Math.max(0, currentStepIndex - 1)
  const visibleStepsCount = CRUZ_STEP_ORDER.length - 1 // Exclude scan_qr from count
  const progress = activeRun ? ((displayStepIndex + 1) / visibleStepsCount) * 100 : 0

  // Network status
  const [networkStatus] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // Handle step submission
  const handleSubmit = useCallback(<K extends CruzStepId>(
    stepId: K,
    payload: CruzStepPayloadMap[K],
    outcome: 'PASS' | 'FAIL' | 'HOLD'
  ) => {
    if (!activeRun) return

    submitStep({
      orderId,
      runId: activeRun.id,
      stepId,
      payload,
      outcome,
    } as RecordStepParams<K>)
  }, [activeRun, orderId, submitStep])

  // Get reference image for the product
  const referenceItem = orderItems && orderItems.length > 0 ? orderItems[0] : null
  const fallbackCdnBase = process.env.NEXT_PUBLIC_SHOPIFY_CDN_BASE
  const referenceImage = referenceItem?.imageUrl
    ? referenceItem.imageUrl
    : referenceItem?.sku && fallbackCdnBase
      ? `${fallbackCdnBase.replace(/\/$/, '')}/${referenceItem.sku.replace(/[^A-Za-z0-9_-]/g, '_')}.jpg`
      : null

  if (!activeRun) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          {isPending || (runs.length === 0 && !hasAutoCreated) ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Setting up inspection...</h2>
              <p className="text-gray-600 mb-6">Creating inspection run for this order.</p>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">No Active Inspection Run</h2>
              <p className="text-gray-600 mb-6">Unable to create inspection run. Please contact a supervisor.</p>
              <Button onClick={onSwitchToSupervisor}>Switch to Supervisor View</Button>
            </>
          )}
        </div>
      </div>
    )
  }

  // Allow manual navigation override
  const displayStep = selectedStepId || activeRun.currentStepId
  const stepPayload = activeRun.steps[displayStep as keyof typeof activeRun.steps]

  return (
    <div className="min-h-screen bg-white">
      <InspectionHeader
        orderNumber={orderNumber}
        customerName={customerName}
        currentIndex={displayStepIndex}
        totalItems={visibleStepsCount}
        progress={progress}
        networkStatus={networkStatus}
        queueLength={0}
        canUndo={false}
        onBack={() => {}}
        onUndo={() => {}}
        onSwitchToSupervisor={onSwitchToSupervisor}
      />

      {/* Reference Image */}
      {referenceItem && referenceImage && (
        <div className="px-6 pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center rounded-xl border border-slate-200 bg-slate-50 p-4">
            <img
              src={referenceImage}
              alt={referenceItem.name || referenceItem.sku || 'Product reference'}
              className="h-32 w-32 rounded-lg border border-slate-200 object-cover"
              onError={(event) => {
                const target = event.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
            <div className="text-sm text-slate-600">
              <div className="text-lg font-semibold text-slate-900">Visual Reference</div>
              <div>{referenceItem.name}</div>
              {referenceItem.sku && <div>SKU: {referenceItem.sku}</div>}
              <div className="mt-1 text-xs text-slate-500">Use this image to verify the item appearance matches what is being inspected.</div>
            </div>
          </div>
        </div>
      )}

      {/* Step Progress Indicators - Clickable for navigation */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {CRUZ_STEP_ORDER.filter(stepId => stepId !== 'scan_qr').map((stepId, idx) => {
            const isCompleted = activeRun.steps[stepId] !== undefined
            const isCurrent = stepId === displayStep

            return (
              <button
                key={stepId}
                onClick={() => setSelectedStepId(stepId)}
                className={`
                  px-3 py-1 rounded-lg text-sm whitespace-nowrap cursor-pointer
                  hover:opacity-80 transition-opacity
                  ${isCurrent ? 'bg-blue-600 text-white' : ''}
                  ${isCompleted && !isCurrent ? 'bg-green-100 text-green-800' : ''}
                  ${!isCurrent && !isCompleted ? 'bg-gray-200 text-gray-600' : ''}
                `}
              >
                {idx + 1}. {stepId.replace(/_/g, ' ')}
              </button>
            )
          })}
        </div>
      </div>

      {/* Current Step Form */}
      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-2">
            {displayStep === 'scan_qr' ? 'QR SCAN (Auto-Completed)' : `Step: ${displayStep.replace(/_/g, ' ').toUpperCase()}`}
          </h2>
          <p className="text-gray-700">
            {selectedStepId
              ? 'You can complete any step in any order. Changes will be saved.'
              : 'Complete this step to proceed with the inspection workflow.'}
          </p>
        </div>

        {/* Dynamic form rendering based on current step */}
        {displayStep === 'scan_qr' && (
          <div className="text-center py-8">
            <div className="text-green-600 text-lg font-semibold">✓ QR Scan Already Completed</div>
            <p className="text-gray-600 mt-2">You scanned the QR code to enter this inspection.</p>
            <Button
              className="mt-4"
              onClick={() => setSelectedStepId('inspection_info')}
            >
              Continue to Next Step
            </Button>
          </div>
        )}

        {displayStep === 'inspection_info' && (
          <>
            <InspectionInfoStepForm
              run={activeRun}
              payload={stepPayload as CruzStepPayloadMap['inspection_info']}
              orderId={orderId}
              orderNumber={orderNumber}
              onSubmit={(payload) => {
                handleSubmit('inspection_info', payload, 'PASS')
                // Auto-advance to next step after successful save
                setTimeout(() => setSelectedStepId('verify_packing_label'), 100)
              }}
              isPending={isPending}
            />
            <div className="mt-8 space-y-3">
              <Button
                onClick={() => setSelectedStepId('verify_packing_label')}
                disabled={isPending}
                className="w-full h-16 text-xl font-semibold bg-blue-600 hover:bg-blue-700"
              >
                Skip to Next Step →
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedStepId('scan_qr')}
                disabled={isPending}
                className="w-full h-14 text-lg"
              >
                ← Back to Previous
              </Button>
            </div>
          </>
        )}

        {displayStep === 'verify_packing_label' && (
          <>
            <VerifyPackingLabelStepForm
              run={activeRun}
              payload={stepPayload as CruzStepPayloadMap['verify_packing_label']}
              orderId={orderId}
              orderNumber={orderNumber}
              orderItems={orderItems}
              customerName={customerName}
              onSubmit={(payload, outcome) => {
                handleSubmit('verify_packing_label', payload, outcome)
                // Auto-advance to next step after successful save
                setTimeout(() => setSelectedStepId('verify_product_label'), 100)
              }}
              isPending={isPending}
            />
            <div className="mt-8 space-y-3">
              <Button
                onClick={() => setSelectedStepId('verify_product_label')}
                disabled={isPending}
                className="w-full h-16 text-xl font-semibold bg-blue-600 hover:bg-blue-700"
              >
                Skip to Next Step →
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedStepId('inspection_info')}
                disabled={isPending}
                className="w-full h-14 text-lg"
              >
                ← Back to Previous
              </Button>
            </div>
          </>
        )}

        {displayStep === 'verify_product_label' && (
          <>
            <VerifyProductLabelStepForm
              run={activeRun}
              payload={stepPayload as CruzStepPayloadMap['verify_product_label']}
              orderId={orderId}
              orderNumber={orderNumber}
              orderItems={orderItems}
              onSubmit={(payload, outcome) => {
                handleSubmit('verify_product_label', payload, outcome)
                // Auto-advance to next step after successful save
                setTimeout(() => setSelectedStepId('lot_number'), 100)
              }}
              isPending={isPending}
            />
            <div className="mt-8 space-y-3">
              <Button
                onClick={() => setSelectedStepId('lot_number')}
                disabled={isPending}
                className="w-full h-16 text-xl font-semibold bg-blue-600 hover:bg-blue-700"
              >
                Skip to Next Step →
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedStepId('verify_packing_label')}
                disabled={isPending}
                className="w-full h-14 text-lg"
              >
                ← Back to Previous
              </Button>
            </div>
          </>
        )}

        {displayStep === 'lot_number' && (
          <>
            <LotNumberStepForm
              run={activeRun}
              payload={stepPayload as CruzStepPayloadMap['lot_number']}
              orderId={orderId}
              onSubmit={(payload) => {
                handleSubmit('lot_number', payload, 'PASS')
                // Auto-advance to next step after successful save
                setTimeout(() => setSelectedStepId('lot_extraction'), 100)
              }}
              isPending={isPending}
            />
            <div className="mt-8 space-y-3">
              <Button
                onClick={() => setSelectedStepId('lot_extraction')}
                disabled={isPending}
                className="w-full h-16 text-xl font-semibold bg-blue-600 hover:bg-blue-700"
              >
                Skip to Final Step →
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedStepId('verify_product_label')}
                disabled={isPending}
                className="w-full h-14 text-lg"
              >
                ← Back to Previous
              </Button>
            </div>
          </>
        )}

        {displayStep === 'lot_extraction' && (
          <>
            <LotExtractionStepForm
              run={activeRun}
              payload={stepPayload as CruzStepPayloadMap['lot_extraction']}
              orderId={orderId}
              onSubmit={(payload) => handleSubmit('lot_extraction', payload, 'PASS')}
              isPending={isPending}
            />
            <div className="mt-8 space-y-3">
              <div className="text-center text-lg font-semibold text-green-600 py-4">
                ✓ Final Step - Complete inspection above
              </div>
              <Button
                variant="outline"
                onClick={() => setSelectedStepId('lot_number')}
                disabled={isPending}
                className="w-full h-14 text-lg"
              >
                ← Back to Previous
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
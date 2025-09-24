'use client'

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { useCruzInspection } from '@/hooks/useCruzInspection'
import { ValidatedQRScanner } from '@/components/qr/ValidatedQRScanner'
import { InspectionItem } from '@/lib/types/agent-view'
import { InspectionHeader } from '@/components/inspection/InspectionHeader'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { INSPECTORS } from '@/lib/inspection/inspectors'
import { uploadDocument, deleteDocument } from '@/app/actions/documents'
import { useToast } from '@/hooks/use-toast'
import { ImageViewer } from '../../ui/image-viewer'
import {
  CRUZ_STEP_ORDER,
  CRUZ_NAVIGABLE_STEPS,
  type CruzInspectionRun,
  type CruzStepId,
  type CruzStepPayloadMap,
  type InspectionPhoto,
  normalizeInspectionState,
} from '@/lib/inspection/cruz'
import type { RecordStepParams, BindRunToQrParams } from '@/app/actions/cruz-inspection'
import { Loader2 } from 'lucide-react'

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

const STEP_LABELS: Record<CruzStepId, string> = {
  scan_qr: 'QR Bind & Verify',
  inspection_info: 'Inspection Header',
  verify_packing_label: 'Package Match Verification',
  verify_product_label: 'Product Label Compliance',
  lot_number: 'Lot Capture',
  final_review: 'Final Review & Sign Off',
}

// Step form components - These are adapted from inspection-runs-panel.tsx
// They've been modified to work within the ResilientInspectionScreen context

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
  orderNumber?: string
  bindRun?: (runId: string, payload: BindRunToQrParams) => void
  shipTo?: ShipmentAddress
  shipFrom?: ShipmentAddress
  customerEmail?: string
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

function InspectionInfoStepForm({ run, payload, onSubmit, isPending, orderId, orderNumber, shipTo, shipFrom, customerEmail }: StepFormProps<'inspection_info'>) {
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

  const shipToLines = formatAddressLines(shipTo)
  const shipFromLines = formatAddressLines(shipFrom)

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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">Ship To</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {shipToLines.map((line, index) => (
              <p key={`ship-to-${index}`}>{line}</p>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">Ship From</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {shipFromLines.map((line, index) => (
              <p key={`ship-from-${index}`}>{line}</p>
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
            <ImageViewer
              src={productImage}
              alt={primaryItem?.name || 'Product'}
              className="h-40 w-40 rounded-lg object-cover border-2 border-blue-200"
              title={primaryItem?.name || 'Product'}
              subtitle={`SKU: ${primaryItem?.sku || 'N/A'} • ${primaryItem?.quantity || 1} ${primaryItem?.unitOfMeasure || 'units'}`}
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
        <p className="font-medium text-slate-800">Package Match Verification</p>
        <p>Confirm the physical package matches this order information above.</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-slate-500">Check each box after verifying the detail on the physical packing label.</p>
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
              <ImageViewer
                src={productImage}
                alt={primaryItem?.name || 'Product'}
                className="h-48 w-48 rounded-lg object-cover border-2 border-purple-200"
                title={productName}
                subtitle={`SKU: ${primaryItem?.sku || 'Product SKU'} • ${primaryItem?.quantity || 1} ${primaryItem?.unitOfMeasure || 'units'}`}
              />
              <p className="text-xs text-purple-700 mt-1 text-center">Product Image • Tap to enlarge</p>
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
        <p className="font-medium text-slate-800">Product Label Compliance</p>
        <p>Confirm the physical labels match the expected regulatory information above.</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-slate-500">Mark each item only after confirming it on the product label.</p>
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

function LotNumberStepForm({ run: _run, payload, onSubmit, isPending, orderId }: StepFormProps<'lot_number'>) {
  const [lots, setLots] = useState(() => payload?.lots?.map((lot) => lot.lotRaw) || [''])
  const [sameForAll, setSameForAll] = useState(payload?.sameForAll ?? false)
  const [isExtracting, setIsExtracting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { toast } = useToast()

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result === 'string') {
          resolve(result)
        } else {
          reject(new Error('Unsupported file format'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })

  const handleExtractFromPhoto = async (file: File) => {
    try {
      setIsExtracting(true)
      const dataUrl = await readFileAsDataUrl(file)

      const response = await fetch('/api/ai/extract-lot-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: dataUrl,
          orderId
        })
      })

      if (!response.ok) {
        throw new Error(`Lot extraction failed (${response.status})`)
      }

      const result = await response.json()
      const extracted: string[] = Array.isArray(result?.lotNumbers) ? result.lotNumbers : []

      if (!extracted.length) {
        toast({
          title: 'No lot numbers found',
          description: 'Double-check the photo and try again or type the lot manually.',
          variant: 'destructive'
        })
        return
      }

      const merged = Array.from(
        new Set([
          ...lots.map((lotValue) => lotValue.trim()).filter(Boolean),
          ...extracted.map((lot) => `${lot}`.trim()).filter(Boolean)
        ])
      )

      setLots(merged.length ? merged : [''])
      toast({
        title: 'Lot numbers extracted',
        description: merged.join(', ')
      })
    } catch (error) {
      console.error('Error extracting lot numbers', error)
      toast({
        title: 'Extraction error',
        description: 'We could not read the lot number from the photo. Try again or enter it manually.',
        variant: 'destructive'
      })
    } finally {
      setIsExtracting(false)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    await handleExtractFromPhoto(file)
    event.target.value = ''
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (lots.some((lotValue) => !lotValue.trim())) {
      return
    }

    onSubmit(
      {
        lots: lots.map((lotValue, index) => ({
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
      <p className="text-sm text-slate-600">Record the lot number(s) exactly as printed.</p>

      <label className="flex items-center gap-3 text-sm text-slate-700">
        <input type="checkbox" checked={sameForAll} onChange={(event) => setSameForAll(event.target.checked)} /> Same lot for all containers
      </label>

      <div className="space-y-3">
        {lots.map((lotValue, index) => (
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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">Use AI to extract lot numbers</p>
        <p className="mt-1 text-xs text-slate-600">
          Upload a clear photo of the product or packing label. We will fill in the lot fields for you.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending || isExtracting}
          >
            {isExtracting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Extracting…
              </span>
            ) : (
              'Upload label photo'
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={isPending || isExtracting}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLots([''])}
            disabled={isPending || isExtracting}
          >
            Clear lot fields
          </Button>
        </div>
        {isExtracting && (
          <p className="mt-2 text-xs text-slate-500">Hang tight—this usually takes a few seconds.</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending || lots.some((lotValue) => !lotValue.trim())}
        className="w-full h-16 text-xl font-semibold bg-green-600 hover:bg-green-700"
      >
        {isPending ? 'Saving…' : 'Save and Continue →'}
      </Button>
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
            <p>{inspectionInfo?.orderNumber || _orderId}</p>
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
            Grade, UN, packing group, lid security, and GHS hazards were verified with required photo evidence.
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

      <Button
        type="submit"
        disabled={isPending || !allApproved}
        className="w-full h-16 text-xl font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-60"
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

  const { toast } = useToast()

  const shipstationData = workspace?.shipstationData as any
  const shipToAddress = shipstationData?.shipTo ?? shipstationData?.billTo
  const shipFromAddress = shipstationData?.shipFrom ?? shipstationData?.warehouse ?? shipstationData?.originAddress
  const customerEmail = shipstationData?.customerEmail

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
  const effectiveStepForDisplay = currentStep === 'scan_qr' ? CRUZ_NAVIGABLE_STEPS[0] : currentStep
  const displayStepIndex = Math.max(
    0,
    CRUZ_NAVIGABLE_STEPS.indexOf(effectiveStepForDisplay as (typeof CRUZ_NAVIGABLE_STEPS)[number])
  )
  const visibleStepsCount = CRUZ_NAVIGABLE_STEPS.length
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

    const expectedStep = activeRun.currentStepId
    if (expectedStep && expectedStep !== stepId) {
      toast({
        title: 'Finish earlier step',
        description: `Complete “${STEP_LABELS[expectedStep]}” before “${STEP_LABELS[stepId]}”.`,
        variant: 'destructive',
      })
      setSelectedStepId(expectedStep)
      return
    }

    submitStep({
      orderId,
      runId: activeRun.id,
      stepId,
      payload,
      outcome,
    } as RecordStepParams<K>)
  }, [activeRun, orderId, submitStep, toast, setSelectedStepId])

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

  const handleBack = useCallback(() => {
    const rawStep = selectedStepId || activeRun.currentStepId
    const effectiveStep = rawStep === 'scan_qr' ? CRUZ_NAVIGABLE_STEPS[0] : rawStep
    const currentIdx = CRUZ_NAVIGABLE_STEPS.indexOf(effectiveStep as (typeof CRUZ_NAVIGABLE_STEPS)[number])

    if (currentIdx > 0) {
      const previousStep = CRUZ_NAVIGABLE_STEPS[currentIdx - 1]
      setSelectedStepId(previousStep)
    }
  }, [selectedStepId, activeRun.currentStepId, setSelectedStepId])

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
        onBack={handleBack}
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
          {CRUZ_NAVIGABLE_STEPS.map((stepId, idx) => {
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
              shipTo={shipToAddress}
              shipFrom={shipFromAddress}
              customerEmail={customerEmail}
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
                // Auto-advance to final review after successful save
                setTimeout(() => setSelectedStepId('final_review'), 100)
              }}
              isPending={isPending}
            />
            <div className="mt-8 space-y-3">
              <Button
                onClick={() => setSelectedStepId('final_review')}
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

        {displayStep === 'final_review' && (
          <>
            <FinalReviewStepForm
              run={activeRun}
              payload={stepPayload as CruzStepPayloadMap['final_review']}
              orderId={orderId}
              onSubmit={(payload) => handleSubmit('final_review', payload, 'PASS')}
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

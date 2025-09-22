'use client'

import { useState, useEffect } from 'react'
import { useInspectionState } from '@/hooks/useInspectionState'
import { useToast } from '@/hooks/use-toast'
import { inspectionQueue } from '@/lib/services/offline/inspection-queue'
import { InspectionItem } from '@/lib/types/agent-view'
import { QRType } from '@/lib/services/qr/validation'
import { updateFinalMeasurements } from '@/app/actions/workspace'
import { extractLotNumbers } from '@/app/actions/ai'

interface FormData {
  datePerformed: string
  inspector: string
  packingSlipVerified: boolean
  packingSlipChecks: {
    shipToOk: boolean
    companyOk: boolean
    orderNumberOk: boolean
    productDescriptionOk: boolean
  }
  lotNumbers: string
  coaStatus: string
  productInspection: {
    grade_correct: boolean
    un_number_correct: boolean
    packing_group_correct: boolean
    lid_inspection: boolean
    ghs_labels: boolean
  }
  containerQR: {
    scanned: boolean
    qrData: string
    matches_label: boolean
  }
  lidPhotos: Array<{ url: string; name: string; timestamp: string }>
  lotNumberPhoto: { url: string; base64?: string; timestamp: string } | null
  extractedLotNumbers: string[]
}

interface Measurements {
  dimensions: {
    length: string
    width: string
    height: string
    units: string
  }
  weight: {
    value: string
    units: string
  }
}

interface UseInspectionProps {
  orderId: string
  orderNumber: string
  workflowPhase: string
  items: InspectionItem[]
  onComplete: (results: Record<string, 'pass' | 'fail'>, notes: Record<string, string>) => void
}

export function useInspection({
  orderId,
  orderNumber,
  workflowPhase,
  items,
  onComplete
}: UseInspectionProps) {
  const { toast } = useToast()
  
  // Core inspection state from existing hook
  const inspectionState = useInspectionState({
    orderId,
    workflowPhase,
    items,
    onComplete: (r, n) => {
      setPendingCompletion({ results: r, notes: n })
      setShowMeasurementsModal(true)
    },
    enablePersistence: true
  })

  // UI state
  const [showScanner, setShowScanner] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [currentFailedItem, setCurrentFailedItem] = useState<InspectionItem | null>(null)
  const [networkStatus, setNetworkStatus] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [queueStatus, setQueueStatus] = useState(inspectionQueue.getStatus())
  const [showMeasurementsModal, setShowMeasurementsModal] = useState(false)
  const [pendingCompletion, setPendingCompletion] = useState<{
    results: Record<string, 'pass' | 'fail'>
    notes: Record<string, string>
  } | null>(null)
  const [isProcessingLotNumbers, setIsProcessingLotNumbers] = useState(false)
  const [savingMeasurements, setSavingMeasurements] = useState(false)

  // Form data
  const [formData, setFormData] = useState<FormData>({
    datePerformed: new Date().toISOString().split('T')[0],
    inspector: '',
    packingSlipVerified: true,
    packingSlipChecks: {
      shipToOk: true,
      companyOk: true,
      orderNumberOk: true,
      productDescriptionOk: true,
    },
    lotNumbers: '',
    coaStatus: '',
    productInspection: {
      grade_correct: false,
      un_number_correct: false,
      packing_group_correct: false,
      lid_inspection: false,
      ghs_labels: false
    },
    containerQR: {
      scanned: false,
      qrData: '',
      matches_label: false
    },
    lidPhotos: [],
    lotNumberPhoto: null,
    extractedLotNumbers: []
  })

  // Measurements
  const [measurements, setMeasurements] = useState<Measurements>({
    dimensions: { length: '', width: '', height: '', units: 'in' },
    weight: { value: '', units: 'lbs' }
  })

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus(true)
      inspectionQueue.retryFailed()
    }
    
    const handleOffline = () => {
      setNetworkStatus(false)
    }

    if (typeof window === 'undefined') {
      return
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const interval = setInterval(() => {
      setQueueStatus(inspectionQueue.getStatus())
    }, 5000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  // Show restoration message
  useEffect(() => {
    if (inspectionState.isRestored) {
      const message = document.createElement('div')
      message.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      message.textContent = 'Inspection progress restored'
      document.body.appendChild(message)
      
      setTimeout(() => {
        message.remove()
      }, 3000)
    }
  }, [inspectionState.isRestored])

  // Helper functions
  const getExpectedQRType = (): QRType | undefined => {
    const currentItem = inspectionState.currentItem
    if (!currentItem) return undefined
    
    if (currentItem.id === 'scan_destination_qr') return 'destination'
    if (currentItem.id === 'scan_master_label') return 'order_master'
    if (currentItem.id === 'scan_qr') return 'order_master'
    
    return undefined
  }

  const qrScanStepIds = new Set(['scan_qr', 'scan_destination_qr', 'scan_master_label'])
  const requiresQRScan = qrScanStepIds.has(inspectionState.currentItem?.id ?? '')

  // Form field update functions
  const updateFormField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const updateNestedField = <
    Parent extends 'productInspection' | 'containerQR',
    Key extends keyof FormData[Parent]
  >(parent: Parent, field: Key, value: FormData[Parent][Key]) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as FormData[Parent]),
        [field]: value
      }
    }))
  }

  // Photo handling
  const handlePhotoUpload = async (file: File) => {
    const photoUrl = URL.createObjectURL(file)
    const newPhoto = { url: photoUrl, name: file.name, timestamp: new Date().toISOString() }
    setFormData(prev => ({
      ...prev,
      lidPhotos: [...prev.lidPhotos, newPhoto]
    }))
  }

  const handleLotNumberPhotoCapture = async (file: File) => {
    const photoUrl = URL.createObjectURL(file)
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      setFormData(prev => ({
        ...prev,
        lotNumberPhoto: { url: photoUrl, base64, timestamp: new Date().toISOString() }
      }))
    }
    
    reader.readAsDataURL(file)
  }

  const extractLotNumbersFromPhoto = async () => {
    if (!formData.lotNumberPhoto?.base64) return
    
    setIsProcessingLotNumbers(true)
    try {
      const result = await extractLotNumbers({ 
        imageBase64: formData.lotNumberPhoto.base64!,
        mimeType: 'image/jpeg' // You might want to get the actual mime type
      })
      
      if (result.success && result.lotNumbers) {
        const extractedNumbers = result.lotNumbers
        
        setFormData(prev => ({
          ...prev,
          extractedLotNumbers: extractedNumbers,
          lotNumbers: extractedNumbers.join(', ')
        }))
      } else {
        console.error('Failed to extract lot numbers')
        toast({
          title: "Error",
          description: "Failed to extract lot numbers. Please try again or enter manually.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error extracting lot numbers:', error)
      toast({
        title: "Error",
        description: "Error extracting lot numbers. Please try again or enter manually.",
        variant: "destructive"
      })
    } finally {
      setIsProcessingLotNumbers(false)
    }
  }

  // Form validation
  const validateFormStep = (stepId: string): boolean => {
    switch (stepId) {
      case 'basic_info':
        return !!(formData.datePerformed && formData.inspector)
      case 'packing_slip':
        return formData.packingSlipVerified
      case 'lot_numbers':
        return !!formData.lotNumbers.trim()
      // 'coa_status' step removed from worker flow
      case 'product_inspection':
        const hasSelection = Object.values(formData.productInspection).some(Boolean)
        const hasLidPhotos = !formData.productInspection.lid_inspection || formData.lidPhotos.length > 0
        return hasSelection && hasLidPhotos
      default:
        return true
    }
  }

  // QR scan handling
  const handleQRScan = (data: any, shortCode?: string) => {
    if (data) {
      // Check if this is a container QR scan during product inspection
      if (inspectionState.currentItem?.id === 'product_inspection' && formData.containerQR.scanned) {
        // Handle container QR verification
        updateFormField('containerQR', {
          ...formData.containerQR,
          qrData: shortCode || JSON.stringify(data),
          scanned: true
        })

        inspectionQueue.enqueue({
          type: 'container_qr_scan',
          orderId,
          data: {
            stepId: 'product_inspection_container_qr',
            qrData: data,
            shortCode,
            timestamp: new Date().toISOString()
          }
        })
      } else {
        // Handle regular workflow QR scans (if any still exist)
        inspectionState.recordQRScan(inspectionState.currentItem.id, shortCode || JSON.stringify(data))
        inspectionState.recordResult(inspectionState.currentItem.id, 'pass')

        inspectionQueue.enqueue({
          type: 'qr_scan',
          orderId,
          data: {
            stepId: inspectionState.currentItem.id,
            qrData: data,
            shortCode,
            timestamp: new Date().toISOString()
          }
        })

        inspectionState.nextStep()
      }
    }

    setShowScanner(false)
  }

  const handleSkipQRScan = (reason: string) => {
    inspectionState.recordResult(inspectionState.currentItem.id, 'pass', `QR scan skipped: ${reason}`)
    
    inspectionQueue.enqueue({
      type: 'qr_skip',
      orderId,
      data: {
        stepId: inspectionState.currentItem.id,
        reason,
        timestamp: new Date().toISOString()
      }
    })
    
    setShowScanner(false)
    inspectionState.nextStep()
  }

  // Result handling
  const handleResult = (result: 'pass' | 'fail') => {
    if (result === 'fail') {
      setCurrentFailedItem(inspectionState.currentItem)
      setIssueModalOpen(true)
    } else {
      inspectionState.recordResult(inspectionState.currentItem.id, 'pass')
      
      inspectionQueue.enqueue({
        type: 'inspection_result',
        orderId,
        phase: workflowPhase,
        data: {
          stepId: inspectionState.currentItem.id,
          result: 'pass',
          timestamp: new Date().toISOString(),
          phase: workflowPhase
        }
      })
      
      inspectionState.nextStep()
    }
  }

  const handleIssueSubmit = (issue: string) => {
    if (currentFailedItem) {
      inspectionState.recordResult(currentFailedItem.id, 'fail', issue)
      
      inspectionQueue.enqueue({
        type: 'inspection_result',
        orderId,
        phase: workflowPhase,
        data: {
          stepId: currentFailedItem.id,
          result: 'fail',
          issue,
          phase: workflowPhase,
          timestamp: new Date().toISOString()
        }
      })
      
      setCurrentFailedItem(null)
    }
    
    setIssueModalOpen(false)
    inspectionState.nextStep()
  }

  const handleFormStepComplete = (stepId: string) => {
    if (validateFormStep(stepId)) {
      inspectionState.recordResult(stepId, 'pass', JSON.stringify(formData))
      inspectionState.nextStep()
    } else {
      toast({
        title: "Error",
        description: "Please complete all required fields before continuing.",
        variant: "destructive"
      })
    }
  }

  // Final measurements
  const saveFinalMeasurements = async () => {
    if (!pendingCompletion) return
    const { dimensions, weight } = measurements
    
    if (!dimensions.length || !dimensions.width || !dimensions.height || !weight.value) {
      toast({
        title: "Error",
        description: "Please enter all dimensions and weight.",
        variant: "destructive"
      })
      return
    }
    
    setSavingMeasurements(true)
    try {
      const result = await updateFinalMeasurements(orderId, {
        weight: Number(weight.value),
        weightUnit: weight.units,
        length: Number(dimensions.length),
        width: Number(dimensions.width),
        height: Number(dimensions.height),
        dimensionUnit: dimensions.units,
      })
      
      if (result.success) {
        onComplete(pendingCompletion.results, pendingCompletion.notes)
        setShowMeasurementsModal(false)
      } else {
        throw new Error(result.error || 'Failed to save measurements')
      }
    } catch (e) {
      console.error('Failed to save measurements', e)
      toast({
        title: "Error",
        description: "Failed to save measurements. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSavingMeasurements(false)
    }
  }

  return {
    // Core inspection state
    ...inspectionState,
    
    // UI state
    showScanner,
    setShowScanner,
    issueModalOpen,
    setIssueModalOpen,
    currentFailedItem,
    networkStatus,
    queueStatus,
    showMeasurementsModal,
    setShowMeasurementsModal,
    isProcessingLotNumbers,
    savingMeasurements,
    
    // Form data
    formData,
    updateFormField,
    updateNestedField,
    
    // Measurements
    measurements,
    setMeasurements,
    
    // Helper functions
    getExpectedQRType,
    requiresQRScan,
    
    // Handlers
    handlePhotoUpload,
    handleLotNumberPhotoCapture,
    extractLotNumbersFromPhoto,
    validateFormStep,
    handleQRScan,
    handleSkipQRScan,
    handleResult,
    handleIssueSubmit,
    handleFormStepComplete,
    saveFinalMeasurements,
  }
}

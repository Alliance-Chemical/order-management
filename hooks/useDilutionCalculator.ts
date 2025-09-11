import { useState, useMemo, useCallback } from 'react'

// Constants
const DENSITY_WATER_LBS_PER_GAL = 8.345
const GALLONS_TO_LITERS = 3.78541
const LITERS_TO_GALLONS = 1 / GALLONS_TO_LITERS
const LBS_TO_KG = 0.453592
const KG_TO_LBS = 1 / LBS_TO_KG

export interface ChemicalData {
  name: string
  specificGravity: number
  initialConcentration: number
  method: 'vv' | 'wv' | 'ww'
  hazardClass?: string
  ppeSuggestion?: string
  batchHistoryIds?: string[]
}

export interface BatchHistory {
  id: string
  date: string
  chemicalName: string
  initialConcentration: number
  desiredConcentration: number
  totalVolume: number
  chemicalAmount: number
  waterAmount: number
  chemicalWeight: number
  waterWeight: number
  notes: string
  completedBy: string
  batchNumber: string
  methodUsed: 'vv' | 'wv' | 'ww'
  initialSpecificGravity: number
}

export interface DilutionResult {
  chemicalAmount: number
  waterAmount: number
  totalVolume: number
  chemicalWeight: number
  waterWeight: number
  totalWeight: number
  finalSpecificGravity: number
  safetyWarnings: string[]
}

export function useDilutionCalculator() {
  const [chemicalName, setChemicalName] = useState('')
  const [specificGravity, setSpecificGravity] = useState(1.0)
  const [initialConcentration, setInitialConcentration] = useState(100)
  const [desiredConcentration, setDesiredConcentration] = useState(10)
  const [totalVolume, setTotalVolume] = useState(1)
  const [volumeUnit, setVolumeUnit] = useState<'gallons' | 'liters'>('gallons')
  const [method, setMethod] = useState<'vv' | 'wv' | 'ww'>('vv')
  const [notes, setNotes] = useState('')
  const [completedBy, setCompletedBy] = useState('')
  const [batchNumber, setBatchNumber] = useState('')

  // Validation
  const validateInputs = useCallback(() => {
    const errors: string[] = []
    
    if (desiredConcentration >= initialConcentration) {
      errors.push('Desired concentration must be less than initial concentration')
    }
    
    if (initialConcentration <= 0 || initialConcentration > 100) {
      errors.push('Initial concentration must be between 0 and 100%')
    }
    
    if (desiredConcentration <= 0 || desiredConcentration >= 100) {
      errors.push('Desired concentration must be between 0 and 100%')
    }
    
    if (totalVolume <= 0) {
      errors.push('Total volume must be greater than 0')
    }
    
    if (specificGravity <= 0) {
      errors.push('Specific gravity must be greater than 0')
    }
    
    return errors
  }, [desiredConcentration, initialConcentration, totalVolume, specificGravity])

  // Calculate dilution
  const calculateDilution = useCallback((): DilutionResult | null => {
    const errors = validateInputs()
    if (errors.length > 0) {
      return null
    }

    // Convert volume to gallons if needed
    const volumeInGallons = volumeUnit === 'liters' 
      ? totalVolume * LITERS_TO_GALLONS 
      : totalVolume

    let chemicalAmount: number
    let waterAmount: number
    let chemicalWeight: number
    let waterWeight: number

    switch (method) {
      case 'vv': // Volume/Volume
        chemicalAmount = (desiredConcentration / initialConcentration) * volumeInGallons
        waterAmount = volumeInGallons - chemicalAmount
        chemicalWeight = chemicalAmount * specificGravity * DENSITY_WATER_LBS_PER_GAL
        waterWeight = waterAmount * DENSITY_WATER_LBS_PER_GAL
        break

      case 'wv': // Weight/Volume
        // For w/v, concentration is in g/100mL or %
        const volumeInLiters = volumeInGallons * GALLONS_TO_LITERS
        const desiredWeightKg = (desiredConcentration / 100) * volumeInLiters * 10 // Convert to kg
        const initialWeightKg = (initialConcentration / 100) * volumeInLiters * 10
        
        chemicalWeight = (desiredWeightKg / initialWeightKg) * initialWeightKg * KG_TO_LBS
        chemicalAmount = chemicalWeight / (specificGravity * DENSITY_WATER_LBS_PER_GAL)
        waterAmount = volumeInGallons - chemicalAmount
        waterWeight = waterAmount * DENSITY_WATER_LBS_PER_GAL
        break

      case 'ww': // Weight/Weight
        const totalWeightLbs = volumeInGallons * DENSITY_WATER_LBS_PER_GAL
        chemicalWeight = (desiredConcentration / 100) * totalWeightLbs
        waterWeight = totalWeightLbs - chemicalWeight
        chemicalAmount = chemicalWeight / (specificGravity * DENSITY_WATER_LBS_PER_GAL)
        waterAmount = waterWeight / DENSITY_WATER_LBS_PER_GAL
        break

      default:
        return null
    }

    // Calculate final specific gravity
    const totalWeight = chemicalWeight + waterWeight
    const finalSpecificGravity = totalWeight / (volumeInGallons * DENSITY_WATER_LBS_PER_GAL)

    // Generate safety warnings
    const safetyWarnings: string[] = []
    
    if (initialConcentration > 90) {
      safetyWarnings.push('⚠️ Working with highly concentrated chemical - use extreme caution')
    }
    
    if (chemicalAmount > 50) {
      safetyWarnings.push('⚠️ Large volume of concentrated chemical - ensure adequate ventilation')
    }
    
    if (specificGravity > 1.5) {
      safetyWarnings.push('⚠️ High density chemical - use mechanical lifting for large volumes')
    }

    return {
      chemicalAmount,
      waterAmount,
      totalVolume: volumeInGallons,
      chemicalWeight,
      waterWeight,
      totalWeight,
      finalSpecificGravity,
      safetyWarnings
    }
  }, [
    desiredConcentration,
    initialConcentration,
    totalVolume,
    volumeUnit,
    specificGravity,
    method,
    validateInputs
  ])

  // Memoized result
  const result = useMemo(() => calculateDilution(), [calculateDilution])

  // Save batch to history
  const saveBatch = useCallback(async () => {
    if (!result) return null

    const batch: BatchHistory = {
      id: `batch-${Date.now()}`,
      date: new Date().toISOString(),
      chemicalName,
      initialConcentration,
      desiredConcentration,
      totalVolume,
      chemicalAmount: result.chemicalAmount,
      waterAmount: result.waterAmount,
      chemicalWeight: result.chemicalWeight,
      waterWeight: result.waterWeight,
      notes,
      completedBy,
      batchNumber,
      methodUsed: method,
      initialSpecificGravity: specificGravity
    }

    // Save to localStorage for now
    const existingBatches = JSON.parse(localStorage.getItem('dilutionBatches') || '[]')
    existingBatches.push(batch)
    localStorage.setItem('dilutionBatches', JSON.stringify(existingBatches))

    return batch
  }, [
    result,
    chemicalName,
    initialConcentration,
    desiredConcentration,
    totalVolume,
    notes,
    completedBy,
    batchNumber,
    method,
    specificGravity
  ])

  // Load batch history
  const loadBatchHistory = useCallback((): BatchHistory[] => {
    if (typeof window === 'undefined') return []
    return JSON.parse(localStorage.getItem('dilutionBatches') || '[]')
  }, [])

  // Generate printable report
  const generateReport = useCallback(() => {
    if (!result) return null

    return {
      title: 'Dilution Calculation Report',
      date: new Date().toISOString(),
      chemical: chemicalName || 'Unknown Chemical',
      parameters: {
        initialConcentration: `${initialConcentration}%`,
        desiredConcentration: `${desiredConcentration}%`,
        totalVolume: `${totalVolume} ${volumeUnit}`,
        method: method.toUpperCase(),
        specificGravity
      },
      results: {
        chemicalAmount: `${result.chemicalAmount.toFixed(2)} gallons`,
        waterAmount: `${result.waterAmount.toFixed(2)} gallons`,
        chemicalWeight: `${result.chemicalWeight.toFixed(2)} lbs`,
        waterWeight: `${result.waterWeight.toFixed(2)} lbs`,
        totalWeight: `${result.totalWeight.toFixed(2)} lbs`,
        finalSpecificGravity: result.finalSpecificGravity.toFixed(3)
      },
      safety: result.safetyWarnings,
      preparedBy: completedBy,
      batchNumber,
      notes
    }
  }, [
    result,
    chemicalName,
    initialConcentration,
    desiredConcentration,
    totalVolume,
    volumeUnit,
    method,
    specificGravity,
    completedBy,
    batchNumber,
    notes
  ])

  return {
    // State
    chemicalName,
    setChemicalName,
    specificGravity,
    setSpecificGravity,
    initialConcentration,
    setInitialConcentration,
    desiredConcentration,
    setDesiredConcentration,
    totalVolume,
    setTotalVolume,
    volumeUnit,
    setVolumeUnit,
    method,
    setMethod,
    notes,
    setNotes,
    completedBy,
    setCompletedBy,
    batchNumber,
    setBatchNumber,
    
    // Computed
    result,
    validationErrors: validateInputs(),
    
    // Actions
    saveBatch,
    loadBatchHistory,
    generateReport
  }
}
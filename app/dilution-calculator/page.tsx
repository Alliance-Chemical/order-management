'use client'

import React from 'react'
import { useDilutionCalculator } from '@/hooks/useDilutionCalculator'
import { useToast } from '@/hooks/use-toast'
import { DilutionForm } from '@/components/dilution/DilutionForm'
import { DilutionResults } from '@/components/dilution/DilutionResults'
import { BatchInfo } from '@/components/dilution/BatchInfo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BeakerIcon,
  ClipboardDocumentListIcon,
  ShieldExclamationIcon,
  CalendarIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

// Common chemicals database
const COMMON_CHEMICALS = [
  {
    name: 'Acetic Acid (Glacial)',
    specificGravity: 1.049,
    initialConcentration: 99.7,
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron'
  },
  {
    name: 'Aluminum Sulfate Solution 48%',
    specificGravity: 1.335,
    initialConcentration: 48.0,
    method: 'ww' as const,
    hazardClass: 'Corrosive, Skin/Eye Irritant',
    ppeSuggestion: 'Closed goggles or face shield, chemical resistant gloves (rubber, neoprene, PVC), work clothing.'
  },
  {
    name: 'Ammonium Hydroxide 29%',
    specificGravity: 0.897,
    initialConcentration: 29.0,
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, respirator'
  },
  {
    name: 'Ferric Chloride Solution 40%',
    specificGravity: 1.37,
    initialConcentration: 40.0,
    method: 'ww' as const,
    hazardClass: 'Corrosive, Serious Eye Damage, Skin Irritant, Harmful if Swallowed',
    ppeSuggestion: 'Chemical splash goggles or face shield, impervious rubber gloves, rubber boots, rain suit or rubber apron.'
  },
  {
    name: 'Hydrochloric Acid 31%',
    specificGravity: 1.15,
    initialConcentration: 31.0,
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator'
  },
  {
    name: 'Hydrochloric Acid 35%',
    specificGravity: 1.18,
    initialConcentration: 35.0,
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator'
  },
  {
    name: 'Hydrogen Peroxide 35%',
    specificGravity: 1.13,
    initialConcentration: 35.0,
    method: 'ww' as const,
    hazardClass: 'Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield'
  },
  {
    name: 'Isopropyl Alcohol 99%',
    specificGravity: 0.786,
    initialConcentration: 99.0,
    method: 'vv' as const,
    hazardClass: 'Flammable',
    ppeSuggestion: 'Chemical resistant gloves, goggles'
  },
  {
    name: 'Methanol',
    specificGravity: 0.792,
    initialConcentration: 99.9,
    method: 'vv' as const,
    hazardClass: 'Flammable, Toxic',
    ppeSuggestion: 'Chemical resistant gloves, goggles, respirator'
  },
  {
    name: 'Nitric Acid 70%',
    specificGravity: 1.42,
    initialConcentration: 70.0,
    method: 'ww' as const,
    hazardClass: 'Corrosive, Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator'
  },
  {
    name: 'Phosphoric Acid 85%',
    specificGravity: 1.685,
    initialConcentration: 85.0,
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron'
  },
  {
    name: 'Potassium Hydroxide 45%',
    specificGravity: 1.48,
    initialConcentration: 45.0,
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield'
  },
  {
    name: 'Sodium Hydroxide 50%',
    specificGravity: 1.53,
    initialConcentration: 50.0,
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield'
  },
  {
    name: 'Sodium Hypochlorite 12.5%',
    specificGravity: 1.16,
    initialConcentration: 12.5,
    method: 'ww' as const,
    hazardClass: 'Corrosive, Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield'
  },
  {
    name: 'Sulfuric Acid 93%',
    specificGravity: 1.84,
    initialConcentration: 93.0,
    method: 'ww' as const,
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator'
  }
]

export default function DilutionCalculatorPage() {
  const { toast } = useToast()
  const calculator = useDilutionCalculator()
  const {
    result,
    validationErrors,
    saveBatch,
    loadBatchHistory,
    generateReport
  } = calculator

  const handleSave = async () => {
    const batch = await saveBatch()
    if (batch) {
      toast({
        title: "Success",
        description: "Batch saved successfully!"
      })
    }
  }

  const handlePrint = () => {
    const report = generateReport()
    if (report) {
      // In a real app, this would format and print the report
      console.log('Printing report:', report)
      window.print()
    }
  }

  const handleExport = () => {
    const report = generateReport()
    if (report) {
      // In a real app, this would generate and download a PDF
      const dataStr = JSON.stringify(report, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
      const exportFileDefaultName = `dilution-report-${report.batchNumber || Date.now()}.json`
      
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', exportFileDefaultName)
      linkElement.click()
    }
  }

  // Get current chemical details for PPE display
  const currentChemical = COMMON_CHEMICALS.find(c => c.name === calculator.chemicalName)

  return (
    <div className="container mx-auto max-w-7xl p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BeakerIcon className="h-8 w-8 text-blue-600" />
            Chemical Dilution Calculator
          </h1>
          <p className="text-gray-600 mt-1">
            Calculate precise dilutions for chemical solutions
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CalendarIcon className="h-4 w-4" />
          {new Date().toLocaleDateString()}
          <ClockIcon className="h-4 w-4 ml-2" />
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* PPE Warning */}
      {currentChemical && (
        <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <ShieldExclamationIcon className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-semibold">
                Hazard Class: {currentChemical.hazardClass}
              </div>
              <div>
                Required PPE: {currentChemical.ppeSuggestion}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Input Form */}
        <div className="space-y-6">
          <DilutionForm
            {...calculator}
            commonChemicals={COMMON_CHEMICALS}
          />
          
          <BatchInfo
            completedBy={calculator.completedBy}
            setCompletedBy={calculator.setCompletedBy}
            batchNumber={calculator.batchNumber}
            setBatchNumber={calculator.setBatchNumber}
            notes={calculator.notes}
            setNotes={calculator.setNotes}
            onSave={handleSave}
            onPrint={handlePrint}
            onExport={handleExport}
            canSave={!!result && validationErrors.length === 0}
          />
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          <DilutionResults
            result={result}
            validationErrors={validationErrors}
            volumeUnit={calculator.volumeUnit}
          />

          {/* Batch History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardDocumentListIcon className="h-5 w-5" />
                Recent Batches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {loadBatchHistory().slice(-5).map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-900"
                  >
                    <div className="text-sm">
                      <div className="font-medium">{batch.batchNumber}</div>
                      <div className="text-gray-500">
                        {batch.chemicalName} - {batch.desiredConcentration}%
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(batch.date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {loadBatchHistory().length === 0 && (
                  <div className="text-center text-sm text-gray-500 py-4">
                    No batch history available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
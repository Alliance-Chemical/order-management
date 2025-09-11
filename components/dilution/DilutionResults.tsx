'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  BeakerIcon, 
  ScaleIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline'
import { DilutionResult } from '@/hooks/useDilutionCalculator'

interface DilutionResultsProps {
  result: DilutionResult | null
  validationErrors: string[]
  volumeUnit: 'gallons' | 'liters'
}

export function DilutionResults({ result, validationErrors, volumeUnit }: DilutionResultsProps) {
  if (validationErrors.length > 0) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <ExclamationTriangleIcon className="h-5 w-5" />
            Validation Errors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {validationErrors.map((error, index) => (
              <li key={index} className="text-sm text-red-600 dark:text-red-400">
                • {error}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )
  }

  if (!result) {
    return (
      <Card className="border-gray-200">
        <CardContent className="py-12 text-center text-gray-500">
          Enter parameters to calculate dilution
        </CardContent>
      </Card>
    )
  }

  const formatVolume = (gallons: number) => {
    if (volumeUnit === 'liters') {
      return `${(gallons * 3.78541).toFixed(2)} L`
    }
    return `${gallons.toFixed(2)} gal`
  }

  const formatWeight = (lbs: number) => {
    return `${lbs.toFixed(2)} lbs (${(lbs * 0.453592).toFixed(2)} kg)`
  }

  return (
    <div className="space-y-4">
      {/* Results Card */}
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircleIcon className="h-5 w-5" />
            Dilution Calculation Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Volume Results */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                <BeakerIcon className="h-4 w-4" />
                Volume Requirements
              </div>
              <div className="space-y-1 pl-6">
                <div className="flex justify-between">
                  <span className="text-sm">Chemical:</span>
                  <span className="font-semibold">{formatVolume(result.chemicalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Water:</span>
                  <span className="font-semibold">{formatVolume(result.waterAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-sm font-medium">Total:</span>
                  <span className="font-bold">{formatVolume(result.totalVolume)}</span>
                </div>
              </div>
            </div>

            {/* Weight Results */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                <ScaleIcon className="h-4 w-4" />
                Weight Requirements
              </div>
              <div className="space-y-1 pl-6">
                <div className="flex justify-between">
                  <span className="text-sm">Chemical:</span>
                  <span className="font-semibold">{formatWeight(result.chemicalWeight)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Water:</span>
                  <span className="font-semibold">{formatWeight(result.waterWeight)}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-sm font-medium">Total:</span>
                  <span className="font-bold">{formatWeight(result.totalWeight)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Final Specific Gravity */}
          <div className="rounded-lg bg-white p-3 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Final Specific Gravity:</span>
              <Badge variant="secondary" className="text-lg">
                {result.finalSpecificGravity.toFixed(3)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety Warnings */}
      {result.safetyWarnings.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />
          <AlertDescription>
            <div className="space-y-1">
              {result.safetyWarnings.map((warning, index) => (
                <div key={index} className="text-sm">
                  {warning}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
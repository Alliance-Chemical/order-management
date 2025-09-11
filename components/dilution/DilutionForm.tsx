'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BeakerIcon, ScaleIcon } from '@heroicons/react/24/outline'

interface DilutionFormProps {
  chemicalName: string
  setChemicalName: (value: string) => void
  specificGravity: number
  setSpecificGravity: (value: number) => void
  initialConcentration: number
  setInitialConcentration: (value: number) => void
  desiredConcentration: number
  setDesiredConcentration: (value: number) => void
  totalVolume: number
  setTotalVolume: (value: number) => void
  volumeUnit: 'gallons' | 'liters'
  setVolumeUnit: (value: 'gallons' | 'liters') => void
  method: 'vv' | 'wv' | 'ww'
  setMethod: (value: 'vv' | 'wv' | 'ww') => void
  commonChemicals?: Array<{
    name: string
    specificGravity: number
    initialConcentration: number
    method: 'vv' | 'wv' | 'ww'
  }>
}

export function DilutionForm({
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
  commonChemicals = []
}: DilutionFormProps) {
  const handleChemicalSelect = (name: string) => {
    const chemical = commonChemicals.find(c => c.name === name)
    if (chemical) {
      setChemicalName(chemical.name)
      setSpecificGravity(chemical.specificGravity)
      setInitialConcentration(chemical.initialConcentration)
      setMethod(chemical.method)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BeakerIcon className="h-5 w-5" />
          Chemical Parameters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chemical Selection */}
        <div className="space-y-2">
          <Label htmlFor="chemical">Chemical Name</Label>
          <Select value={chemicalName} onValueChange={handleChemicalSelect}>
            <SelectTrigger id="chemical">
              <SelectValue placeholder="Select a chemical or enter custom" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Custom Chemical</SelectItem>
              {commonChemicals.map((chem) => (
                <SelectItem key={chem.name} value={chem.name}>
                  {chem.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!commonChemicals.find(c => c.name === chemicalName) && (
            <Input
              value={chemicalName}
              onChange={(e) => setChemicalName(e.target.value)}
              placeholder="Enter custom chemical name"
            />
          )}
        </div>

        {/* Specific Gravity */}
        <div className="space-y-2">
          <Label htmlFor="specific-gravity" className="flex items-center gap-2">
            <ScaleIcon className="h-4 w-4" />
            Specific Gravity
          </Label>
          <Input
            id="specific-gravity"
            type="number"
            step="0.001"
            value={specificGravity}
            onChange={(e) => setSpecificGravity(parseFloat(e.target.value) || 1)}
            min="0.1"
            max="5"
          />
        </div>

        {/* Concentrations */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="initial-conc">Initial Concentration (%)</Label>
            <Input
              id="initial-conc"
              type="number"
              step="0.1"
              value={initialConcentration}
              onChange={(e) => setInitialConcentration(parseFloat(e.target.value) || 0)}
              min="0"
              max="100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desired-conc">Desired Concentration (%)</Label>
            <Input
              id="desired-conc"
              type="number"
              step="0.1"
              value={desiredConcentration}
              onChange={(e) => setDesiredConcentration(parseFloat(e.target.value) || 0)}
              min="0"
              max="100"
            />
          </div>
        </div>

        {/* Volume */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="total-volume">Total Volume</Label>
            <Input
              id="total-volume"
              type="number"
              step="0.1"
              value={totalVolume}
              onChange={(e) => setTotalVolume(parseFloat(e.target.value) || 0)}
              min="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="volume-unit">Unit</Label>
            <Select value={volumeUnit} onValueChange={(v) => setVolumeUnit(v as 'gallons' | 'liters')}>
              <SelectTrigger id="volume-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gallons">Gallons</SelectItem>
                <SelectItem value="liters">Liters</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Method */}
        <div className="space-y-2">
          <Label htmlFor="method">Calculation Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as 'vv' | 'wv' | 'ww')}>
            <SelectTrigger id="method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vv">Volume/Volume (v/v)</SelectItem>
              <SelectItem value="wv">Weight/Volume (w/v)</SelectItem>
              <SelectItem value="ww">Weight/Weight (w/w)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
'use client';

import React, { useState, useMemo, ChangeEvent, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BeakerIcon,
  ScaleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  PrinterIcon,
  ClipboardDocumentListIcon,
  UserIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useSearchParams, useRouter } from 'next/navigation';

interface ChemicalData {
  id?: string;
  name: string;
  specificGravity: number;
  initialConcentration: number;
  method: 'vv' | 'wv' | 'ww';
  hazardClass?: string;
  ppeSuggestion?: string;
  shopifyProductId?: string;
  shopifyTitle?: string;
  shopifySKU?: string;
}

// Constants
const DENSITY_WATER_LBS_PER_GAL = 8.345;
const GALLONS_TO_LITERS = 3.78541;
const LITERS_TO_GALLONS = 1 / GALLONS_TO_LITERS;
const LBS_TO_KG = 0.453592;

// Default chemical data - will be replaced with API data
const defaultChemicalData: ChemicalData[] = [
  {
    name: 'Sodium Hypochlorite 12.5%',
    specificGravity: 1.21,
    initialConcentration: 12.5,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical safety glasses, face shield, gloves, complete body suit'
  },
  {
    name: 'Sodium Hydroxide 50%',
    specificGravity: 1.54,
    initialConcentration: 50.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, caustic resistant apron'
  },
  {
    name: 'Sulfuric Acid 93%',
    specificGravity: 1.84,
    initialConcentration: 93.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant suit, respirator'
  },
  {
    name: 'Hydrochloric Acid 31%',
    specificGravity: 1.15,
    initialConcentration: 31.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator'
  },
];

interface BatchHistory {
  id: string;
  date: string;
  chemicalName: string;
  initialConcentration: number;
  desiredConcentration: number;
  totalVolume: number;
  chemicalAmount: number;
  waterAmount: number;
  chemicalWeight: number;
  waterWeight: number;
  notes: string;
  completedBy: string;
  batchNumber: string;
  methodUsed: 'vv' | 'wv' | 'ww';
  initialSpecificGravity: number;
}

const generateBatchNumber = (chemicalName: string): string => {
  const date = new Date();
  const year = date.getFullYear().toString().substring(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const abbrev = chemicalName.split(' ')[0].substring(0, 4).toUpperCase();
  return `${abbrev}${year}${month}${day}-${Date.now().toString().slice(-4)}`;
};

function DilutionCalculatorContent() {
  const params = useSearchParams();
  const router = useRouter();
  
  const [chemicalData, setChemicalData] = useState<ChemicalData[]>([]);
  const [selectedChemical, setSelectedChemical] = useState<string>('');
  const [selectedChemicalData, setSelectedChemicalData] = useState<ChemicalData | null>(null);
  const [initialConcentration, setInitialConcentration] = useState<number>(0);
  const [desiredConcentration, setDesiredConcentration] = useState<number>(0);
  const [totalVolume, setTotalVolume] = useState<number>(0);
  const [method, setMethod] = useState<'vv' | 'wv' | 'ww'>('ww');
  const [specificGravity, setSpecificGravity] = useState<number>(1);
  const [isLoadingChemicals, setIsLoadingChemicals] = useState<boolean>(true);
  const [result, setResult] = useState<{
    chemicalVolume: number;
    waterVolume: number;
    chemicalWeight: number;
    waterWeight: number;
    totalWeight: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [completedBy, setCompletedBy] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [batchHistory, setBatchHistory] = useState<BatchHistory[]>([]);
  const [volumeUnit, setVolumeUnit] = useState<'gallons' | 'liters'>('gallons');
  const [commonSizes] = useState<number[]>([5, 15, 55, 275, 330]);
  const [selectedCommonSize, setSelectedCommonSize] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'calculator' | 'history'>('calculator');
  const [destinationQrShortCodes, setDestinationQrShortCodes] = useState<string[]>([]);

  const sortedChemicalData = useMemo(() => [...chemicalData].sort((a, b) => a.name.localeCompare(b.name)), [chemicalData]);

  // Fetch chemicals from API
  const fetchChemicals = async () => {
    setIsLoadingChemicals(true);
    try {
      const response = await fetch('/api/chemicals?includeShopify=true');
      if (response.ok) {
        const data = await response.json();
        setChemicalData(data.chemicals || []);
        // If we still have no data, fall back to default
        if (!data.chemicals || data.chemicals.length === 0) {
          setChemicalData(defaultChemicalData);
        }
      } else {
        // Fall back to default data if API fails
        setChemicalData(defaultChemicalData);
      }
    } catch (error) {
      console.error('Failed to fetch chemicals:', error);
      // Fall back to default data
      setChemicalData(defaultChemicalData);
    } finally {
      setIsLoadingChemicals(false);
    }
  };

  // Load batch history from API
  useEffect(() => {
    fetchBatchHistory();
    fetchChemicals();
  }, []);

  // Prefill from query params
  useEffect(() => {
    if (!params) return;
    
    const chemParam = params.get('chem');
    const icParam = params.get('ic');
    const dcParam = params.get('dc');
    const targetParam = params.get('target');
    const orderIdParam = params.get('orderId');
    const destQRsParam = params.get('destQRs');

    if (chemParam) {
      const matched = sortedChemicalData.find(c => 
        c.name.toLowerCase().includes(chemParam.toLowerCase()) ||
        chemParam.toLowerCase().includes(c.name.split('%')[0].toLowerCase().trim())
      );
      if (matched) {
        setSelectedChemical(matched.name);
        setInitialConcentration(matched.initialConcentration);
        setSpecificGravity(matched.specificGravity);
        setMethod(matched.method);
      }
    }

    if (icParam) setInitialConcentration(parseFloat(icParam));
    if (dcParam) setDesiredConcentration(parseFloat(dcParam));
    if (targetParam) setTotalVolume(parseFloat(targetParam));
    
    // Parse destination QR codes
    if (destQRsParam) {
      try {
        const destQRs = JSON.parse(decodeURIComponent(destQRsParam));
        if (Array.isArray(destQRs)) {
          setDestinationQrShortCodes(destQRs);
          console.log('[Dilution Calculator] Received destination QR codes:', destQRs);
        }
      } catch (error) {
        console.error('[Dilution Calculator] Failed to parse destination QR codes:', error);
      }
    }
  }, [params, sortedChemicalData]);

  // Generate batch number when chemical is selected
  useEffect(() => {
    if (selectedChemical) {
      setBatchNumber(generateBatchNumber(selectedChemical));
    }
  }, [selectedChemical]);

  const fetchBatchHistory = async () => {
    try {
      const response = await fetch('/api/batches/history');
      if (response.ok) {
        const data = await response.json();
        setBatchHistory(data.batches || []);
      }
    } catch (err) {
      console.error('Failed to fetch batch history:', err);
    }
  };

  const getVolumeInGallons = (value: number): number => {
    return volumeUnit === 'liters' ? value * LITERS_TO_GALLONS : value;
  };

  const getVolumeInDisplayUnit = (gallons: number): number => {
    return volumeUnit === 'liters' ? gallons * GALLONS_TO_LITERS : gallons;
  };

  const calculateDilution = () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    // Input validation
    if (!selectedChemical || initialConcentration <= 0 || specificGravity <= 0) {
      setError("Invalid chemical data selected.");
      setIsLoading(false);
      return;
    }
    if (desiredConcentration >= initialConcentration) {
      setError('Desired concentration must be less than initial concentration for dilution.');
      setIsLoading(false);
      return;
    }
    if (totalVolume <= 0) {
      setError('Total volume must be greater than zero.');
      setIsLoading(false);
      return;
    }

    const densityInitialLbsPerGal = specificGravity * DENSITY_WATER_LBS_PER_GAL;
    const densityWaterLbsPerGal = DENSITY_WATER_LBS_PER_GAL;

    let chemicalVolumeGallons = 0;
    let waterVolumeGallons = 0;

    try {
      if (method === 'vv') {
        // Volume/Volume
        chemicalVolumeGallons = (desiredConcentration * totalVolume) / initialConcentration;
        waterVolumeGallons = totalVolume - chemicalVolumeGallons;
      } else if (method === 'ww') {
        // Weight/Weight
        const Ci = initialConcentration / 100;
        const Cd = desiredConcentration / 100;
        
        if (desiredConcentration === 0) {
          chemicalVolumeGallons = 0;
          waterVolumeGallons = totalVolume;
        } else {
          const numerator = totalVolume * densityWaterLbsPerGal * Cd;
          const denominator = densityInitialLbsPerGal * (Ci - Cd) + densityWaterLbsPerGal * Cd;
          chemicalVolumeGallons = numerator / denominator;
          waterVolumeGallons = totalVolume - chemicalVolumeGallons;
        }
      } else if (method === 'wv') {
        // Weight/Volume
        const pureChemicalLbs = (desiredConcentration / 100) * totalVolume * DENSITY_WATER_LBS_PER_GAL;
        const pureChemicalPerGalStock = (initialConcentration / 100) * densityInitialLbsPerGal;
        chemicalVolumeGallons = pureChemicalLbs / pureChemicalPerGalStock;
        waterVolumeGallons = totalVolume - chemicalVolumeGallons;
      }

      const chemicalWeightLbs = chemicalVolumeGallons * densityInitialLbsPerGal;
      const waterWeightLbs = waterVolumeGallons * densityWaterLbsPerGal;
      const totalWeightLbs = chemicalWeightLbs + waterWeightLbs;

      setResult({
        chemicalVolume: chemicalVolumeGallons,
        waterVolume: waterVolumeGallons,
        chemicalWeight: chemicalWeightLbs,
        waterWeight: waterWeightLbs,
        totalWeight: totalWeightLbs
      });
    } catch (err: any) {
      setError(`Calculation Error: ${err.message || 'Please check inputs.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const printBatchPDF = async (batchId: string) => {
    try {
      const response = await fetch('/api/batches/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dilution-batch-${batchNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to print batch:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const saveBatch = async () => {
    if (!result || !selectedChemical || !batchNumber || !completedBy) {
      setError("Cannot save batch. Please ensure calculation is done and fields are filled.");
      return;
    }

    const orderId = params?.get('orderId');
    const workspaceId = params?.get('workspaceId');

    try {
      const response = await fetch('/api/batches/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          orderId,
          batchNumber,
          chemicalName: selectedChemical,
          chemicalId: selectedChemicalData?.id,
          shopifyProductId: selectedChemicalData?.shopifyProductId,
          shopifyTitle: selectedChemicalData?.shopifyTitle,
          shopifySKU: selectedChemicalData?.shopifySKU,
          initialConcentration,
          desiredConcentration,
          totalVolumeGallons: totalVolume,
          chemicalVolumeGallons: result.chemicalVolume,
          waterVolumeGallons: result.waterVolume,
          chemicalWeightLbs: result.chemicalWeight,
          waterWeightLbs: result.waterWeight,
          notes,
          completedBy,
          methodUsed: method,
          initialSpecificGravity: specificGravity,
          hazardClass: selectedChemicalData?.hazardClass,
          ppeSuggestion: selectedChemicalData?.ppeSuggestion,
          destinationQrShortCodes // Pass the destination QR codes
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert('Batch saved successfully!');
        fetchBatchHistory();
        
        // Ask if user wants to print the batch record
        if (confirm('Would you like to print the dilution record?')) {
          printBatchPDF(data.batch.id);
        }
        
        // Navigate back if return URL provided
        const returnUrl = params?.get('return');
        if (returnUrl) {
          router.push(decodeURIComponent(returnUrl));
        }
      } else {
        throw new Error('Failed to save batch');
      }
    } catch (err) {
      console.error('Failed to save batch:', err);
      setError('Failed to save batch to database');
    }
  };

  const handleChemicalSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const chemName = e.target.value;
    const chem = sortedChemicalData.find((c) => c.name === chemName);
    if (chem) {
      setSelectedChemical(chem.name);
      setSelectedChemicalData(chem);
      setInitialConcentration(chem.initialConcentration);
      setSpecificGravity(chem.specificGravity);
      setMethod(chem.method);
      setDesiredConcentration(0);
      setResult(null);
      setError(null);
    } else {
      setSelectedChemical('');
      setSelectedChemicalData(null);
      setInitialConcentration(0);
      setSpecificGravity(1);
      setMethod('ww');
      setDesiredConcentration(0);
      setResult(null);
      setError(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Chemical Dilution Calculator</h1>
          <p className="text-lg text-gray-600">Calculate precise dilution ratios for pump & fill operations</p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm p-2 mb-8">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'calculator' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
            >
              <BeakerIcon className="w-5 h-5 inline mr-2" />
              Calculator
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
            >
              <DocumentTextIcon className="w-5 h-5 inline mr-2" />
              History
            </button>
          </div>
        </div>

        {activeTab === 'calculator' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Destination Containers Info */}
              {destinationQrShortCodes.length > 0 && (
                <Card className="p-6 bg-blue-50 border-blue-200">
                  <h2 className="text-xl font-semibold mb-3 text-blue-900">Dilution for Containers</h2>
                  <div className="flex flex-wrap gap-2">
                    {destinationQrShortCodes.map((code, idx) => (
                      <span key={idx} className="px-3 py-1 bg-white border border-blue-300 rounded-lg text-sm font-medium text-blue-800">
                        Container: {code}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-blue-700 mt-3">
                    This dilution batch will be linked to these destination containers for full traceability.
                  </p>
                </Card>
              )}

              {/* Chemical Selection */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Chemical Selection</h2>
                <div className="space-y-4">
                  <div>
                    <Label>Select Chemical {isLoadingChemicals && "(Loading...)"}</Label>
                    <select
                      value={selectedChemical}
                      onChange={handleChemicalSelect}
                      className="w-full p-2 border rounded-lg"
                      disabled={isLoadingChemicals}
                    >
                      <option value="">Select a chemical</option>
                      {sortedChemicalData.map((chemical, idx) => (
                        <option key={idx} value={chemical.name}>
                          {chemical.name}
                          {chemical.shopifyTitle && chemical.shopifyTitle !== chemical.name && 
                            ` (Shopify: ${chemical.shopifyTitle})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Initial Concentration (%)</Label>
                      <Input type="number" value={initialConcentration} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                      <Label>Specific Gravity</Label>
                      <Input type="number" value={specificGravity} readOnly className="bg-gray-50" />
                    </div>
                  </div>

                  {/* Display Shopify Product Link if available */}
                  {selectedChemicalData?.shopifyProductId && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm text-blue-800">
                        <strong>Linked Shopify Product:</strong> {selectedChemicalData.shopifyTitle || selectedChemicalData.name}
                        {selectedChemicalData.shopifySKU && (
                          <span className="ml-2 text-xs">(SKU: {selectedChemicalData.shopifySKU})</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Safety Warning */}
                  {selectedChemical && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-red-800">
                          <strong>CRITICAL SAFETY NOTICE:</strong> Verify these values against the current SDS. 
                          Specific gravity and concentration method directly affect safety. 
                          {selectedChemicalData?.hazardClass && (
                            <div className="mt-1">
                              <strong>Hazard Class:</strong> {selectedChemicalData.hazardClass}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Desired Concentration (%)</Label>
                    <Input
                      type="number"
                      value={desiredConcentration}
                      onChange={(e) => setDesiredConcentration(parseFloat(e.target.value) || 0)}
                      placeholder="Enter target concentration"
                    />
                  </div>
                </div>
              </Card>

              {/* Volume Configuration */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Volume Configuration</h2>
                <div className="space-y-4">
                  {/* Unit Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setVolumeUnit('gallons')}
                      className={`p-3 rounded-lg border-2 ${volumeUnit === 'gallons' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}
                    >
                      Gallons
                    </button>
                    <button
                      onClick={() => setVolumeUnit('liters')}
                      className={`p-3 rounded-lg border-2 ${volumeUnit === 'liters' ? 'border-green-600 bg-green-50' : 'border-gray-300'}`}
                    >
                      Liters
                    </button>
                  </div>

                  {/* Common Sizes */}
                  <div>
                    <Label>Common Container Sizes</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {commonSizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => {
                            setTotalVolume(size);
                            setSelectedCommonSize(size);
                          }}
                          className={`p-2 rounded-lg border ${selectedCommonSize === size ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                        >
                          {getVolumeInDisplayUnit(size).toFixed(0)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Total Volume ({volumeUnit})</Label>
                    <Input
                      type="number"
                      value={getVolumeInDisplayUnit(totalVolume).toFixed(1)}
                      onChange={(e) => setTotalVolume(getVolumeInGallons(parseFloat(e.target.value) || 0))}
                      placeholder="Enter total volume"
                    />
                  </div>
                </div>
              </Card>

              {/* Batch Information */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Batch Information</h2>
                <div className="space-y-4">
                  <div>
                    <Label>Batch Number</Label>
                    <Input value={batchNumber} readOnly className="bg-gray-50" />
                  </div>
                  <div>
                    <Label>Completed By</Label>
                    <Input
                      value={completedBy}
                      onChange={(e) => setCompletedBy(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <textarea
                      className="w-full p-2 border rounded-lg"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes..."
                    />
                  </div>
                </div>
              </Card>

              {/* Calculate Button */}
              <div className="flex gap-4">
                <Button
                  onClick={calculateDilution}
                  disabled={isLoading || !selectedChemical || !totalVolume || desiredConcentration <= 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? 'Calculating...' : 'Calculate Dilution'}
                </Button>
                {result && (
                  <Button onClick={saveBatch} className="bg-green-600 hover:bg-green-700">
                    Save Batch
                  </Button>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* Results Panel */}
            <div>
              {result && (
                <Card className="p-6 sticky top-8">
                  <h3 className="text-xl font-semibold mb-4">Dilution Results</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="font-medium text-blue-800">Chemical Amount:</p>
                      <p className="text-xl font-bold text-blue-800">
                        {getVolumeInDisplayUnit(result.chemicalVolume).toFixed(2)} {volumeUnit}
                      </p>
                      <p className="text-sm text-blue-600">
                        {result.chemicalWeight.toFixed(2)} lbs ({(result.chemicalWeight * LBS_TO_KG).toFixed(2)} kg)
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="font-medium text-green-800">Water Amount:</p>
                      <p className="text-xl font-bold text-green-800">
                        {getVolumeInDisplayUnit(result.waterVolume).toFixed(2)} {volumeUnit}
                      </p>
                      <p className="text-sm text-green-600">
                        {result.waterWeight.toFixed(2)} lbs ({(result.waterWeight * LBS_TO_KG).toFixed(2)} kg)
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="font-medium">Total Weight:</p>
                      <p className="text-lg font-bold">
                        {result.totalWeight.toFixed(2)} lbs ({(result.totalWeight * LBS_TO_KG).toFixed(2)} kg)
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        ) : (
          // History Tab
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Batch History</h2>
            {batchHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No batch history available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2">Batch #</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Chemical</th>
                      <th className="p-2">Concentration</th>
                      <th className="p-2">Volume</th>
                      <th className="p-2">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchHistory.map((batch) => (
                      <tr key={batch.id} className="border-b">
                        <td className="p-2">{batch.batchNumber}</td>
                        <td className="p-2">{new Date(batch.date).toLocaleDateString()}</td>
                        <td className="p-2">{batch.chemicalName}</td>
                        <td className="p-2">{batch.initialConcentration}% → {batch.desiredConcentration}%</td>
                        <td className="p-2">{batch.totalVolume} gal</td>
                        <td className="p-2">{batch.completedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

export default function DilutionCalculatorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <DilutionCalculatorContent />
    </Suspense>
  );
}
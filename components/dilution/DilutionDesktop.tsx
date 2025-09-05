'use client';

import React, { ChangeEvent, useEffect } from 'react';
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
  ShieldExclamationIcon,
  UserIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { DilutionProps } from './types';

// Custom components
const ModernInput: React.FC<{
  label: string;
  type?: string;
  min?: string;
  max?: number;
  step?: string;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  error?: string | null;
}> = ({ label, type = 'text', min, max, step, value, onChange, placeholder, icon, error }) => {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        <Input
          type={type}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${icon ? 'pl-10' : ''} ${error ? 'border-red-300 bg-red-50 ring-2 ring-red-200' : ''}`}
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
};

const ModernSelect: React.FC<{
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, value, onChange, placeholder, icon, children }) => {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 z-10">
            {icon}
          </div>
        )}
        <select
          value={value}
          onChange={onChange}
          className={`w-full h-10 px-3 py-2 ${icon ? 'pl-10' : ''} text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {children}
        </select>
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 font-medium border-b-2 ${
      active ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    {children}
  </button>
);

const MixtureDisplay: React.FC<{
  chemical: number;
  water: number;
}> = ({ chemical, water }) => {
  const total = chemical + water;
  const chemicalPercent = total > 0 ? (chemical / total) * 100 : 0;
  const waterPercent = total > 0 ? (water / total) * 100 : 0;

  return (
    <div className="mt-6 flex flex-col items-center">
      {/* Chemical Progress Bar */}
      <div className="w-full bg-blue-50 rounded-lg p-4 mb-2">
        <div className="flex justify-between mb-1 text-sm font-medium text-blue-700">
          <span>Chemical</span>
          <span>{chemicalPercent.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${chemicalPercent}%` }}
          />
        </div>
      </div>

      {/* Water Progress Bar */}
      <div className="w-full bg-green-50 rounded-lg p-4">
        <div className="flex justify-between mb-1 text-sm font-medium text-green-700">
          <span>Water</span>
          <span>{waterPercent.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${waterPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default function DilutionDesktop(props: DilutionProps) {
  const {
    sortedChemicalData,
    selectedChemical,
    setSelectedChemical,
    initialConcentration,
    setInitialConcentration,
    desiredConcentration,
    setDesiredConcentration,
    totalVolume,
    setTotalVolume,
    method,
    setMethod,
    specificGravity,
    setSpecificGravity,
    result,
    setResult,
    error,
    setError,
    isLoading,
    setIsLoading,
    batchNumber,
    setBatchNumber,
    completedBy,
    setCompletedBy,
    notes,
    setNotes,
    batchHistory,
    setBatchHistory,
    volumeUnit,
    setVolumeUnit,
    activeTab,
    setActiveTab,
    quickTemplates,
    generateBatchNumber,
    loadBatchHistory,
    params,
    router,
    DENSITY_WATER_LBS_PER_GAL,
    GALLONS_TO_LITERS,
    LITERS_TO_GALLONS,
    LBS_TO_KG,
  } = props;

  // Unit conversion helpers
  const convertVolume = (value: number, fromUnit: 'gallons' | 'liters', toUnit: 'gallons' | 'liters'): number => {
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'gallons' && toUnit === 'liters') return value * GALLONS_TO_LITERS;
    if (fromUnit === 'liters' && toUnit === 'gallons') return value * LITERS_TO_GALLONS;
    return value;
  };

  const getVolumeInGallons = (value: number): number => {
    return volumeUnit === 'liters' ? value * LITERS_TO_GALLONS : value;
  };

  const getVolumeInDisplayUnit = (gallons: number): number => {
    return volumeUnit === 'liters' ? gallons * GALLONS_TO_LITERS : gallons;
  };

  // Dilution calculation logic
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
    if (desiredConcentration < 0) {
      setError("Desired concentration cannot be negative.");
      setIsLoading(false);
      return;
    }
    if (desiredConcentration >= initialConcentration) {
      setError('Desired concentration must be less than initial concentration for dilution.');
      setIsLoading(false);
      return;
    }
    if (totalVolume <= 0) {
      setError(`Total volume must be greater than zero.`);
      setIsLoading(false);
      return;
    }

    // Density calculations
    const densityInitialLbsPerGal = specificGravity * DENSITY_WATER_LBS_PER_GAL;
    const densityWaterLbsPerGal = DENSITY_WATER_LBS_PER_GAL;

    let chemicalVolumeGallons = 0;
    let waterVolumeGallons = 0;
    let chemicalWeightLbs = 0;
    let waterWeightLbs = 0;

    try {
      if (method === 'vv') {
        // Volume/Volume Calculation
        if (initialConcentration === 0) throw new Error("Initial V/V concentration cannot be zero.");
        chemicalVolumeGallons = (desiredConcentration * totalVolume) / initialConcentration;
        waterVolumeGallons = totalVolume - chemicalVolumeGallons;
      }
      else if (method === 'wv') {
        // Weight/Volume Calculation
        const pureChemicalLbs = (desiredConcentration / 100) * totalVolume * DENSITY_WATER_LBS_PER_GAL;
        const pureChemicalPerGalStock = (initialConcentration / 100) * densityInitialLbsPerGal;
        
        if (pureChemicalPerGalStock === 0) throw new Error("Initial W/V concentration cannot be zero.");
        chemicalVolumeGallons = pureChemicalLbs / pureChemicalPerGalStock;
        waterVolumeGallons = totalVolume - chemicalVolumeGallons;
      }
      else if (method === 'ww') {
        // Weight/Weight Calculation
        const Ci = initialConcentration / 100;
        const Cd = desiredConcentration / 100;
        
        if (desiredConcentration === 0) {
          chemicalVolumeGallons = 0;
          waterVolumeGallons = totalVolume;
        } else {
          const numerator = totalVolume * densityWaterLbsPerGal * Cd;
          const denominator = densityInitialLbsPerGal * (Ci - Cd) + densityWaterLbsPerGal * Cd;
          
          if (Math.abs(denominator) < 1e-9) {
            throw new Error("Calculation error: Invalid parameters for W/W calculation.");
          }
          
          chemicalVolumeGallons = numerator / denominator;
          waterVolumeGallons = totalVolume - chemicalVolumeGallons;
        }
      }

      // Handle floating point errors
      if (Math.abs(chemicalVolumeGallons) < 1e-9) chemicalVolumeGallons = 0;
      if (Math.abs(waterVolumeGallons) < 1e-9) waterVolumeGallons = 0;
      
      // Ensure volumes are valid
      if (chemicalVolumeGallons < 0 || waterVolumeGallons < 0 || !isFinite(chemicalVolumeGallons) || !isFinite(waterVolumeGallons)) {
        console.error("Calculation resulted in invalid volumes:", {chemicalVolumeGallons, waterVolumeGallons});
        throw new Error('Invalid calculation result: Check input parameters.');
      }
      
      // Ensure volumes sum to total
      const volumeSum = chemicalVolumeGallons + waterVolumeGallons;
      if (Math.abs(volumeSum - totalVolume) > 0.001) {
        waterVolumeGallons = totalVolume - chemicalVolumeGallons;
      }

      chemicalWeightLbs = chemicalVolumeGallons * densityInitialLbsPerGal;
      waterWeightLbs = waterVolumeGallons * densityWaterLbsPerGal;
      const totalWeightLbs = chemicalWeightLbs + waterWeightLbs;

      setResult({
        chemicalVolume: chemicalVolumeGallons,
        waterVolume: waterVolumeGallons,
        chemicalWeight: chemicalWeightLbs,
        waterWeight: waterWeightLbs,
        totalWeight: totalWeightLbs
      });

    } catch (err: any) {
      console.error("Dilution Calculation Error:", err);
      setError(`Calculation Error: ${err.message || 'Please check inputs.'}`);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesiredConcentrationChange = (value: number) => {
    if (isNaN(value)) {
      return;
    }
    
    if (value < 0) {
      setError('Desired concentration cannot be negative.');
    } else if (value >= initialConcentration) {
      setError('Desired concentration must be less than initial concentration for dilution.');
    } else {
      setError(null);
    }
    setDesiredConcentration(value);
  };

  const handleChemicalSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const chemName = e.target.value;
    const chem = sortedChemicalData.find((chem) => chem.name === chemName);
    if (chem) {
      setSelectedChemical(chem.name);
      setInitialConcentration(chem.initialConcentration);
      setSpecificGravity(chem.specificGravity);
      setMethod(chem.method);
      setDesiredConcentration(0);
      setResult(null);
      setError(null);
      setNotes('');
      setBatchNumber(generateBatchNumber(chem.name));
    } else {
      setSelectedChemical('');
      setInitialConcentration(0);
      setSpecificGravity(1);
      setMethod('vv');
      setDesiredConcentration(0);
      setResult(null);
      setError(null);
      setNotes('');
      setCompletedBy('');
      setTotalVolume(0);
      setBatchNumber('');
    }
  };

  return (
    <>
      {/* Header Section */}
      <div className="pt-8 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-100 rounded-2xl mb-4">
              <BeakerIcon className="w-8 h-8 text-cyan-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Chemical Dilution System
            </h1>
            <p className="text-lg text-gray-600">
              Precise calculations with warehouse safety protocols for chemical dilution
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-2">
          <div className="flex space-x-2">
            <TabButton active={activeTab === 0} onClick={() => setActiveTab(0)}>
              <BeakerIcon className="w-5 h-5 mr-2" />
              Calculator
            </TabButton>
            <TabButton active={activeTab === 1} onClick={() => setActiveTab(1)}>
              <DocumentTextIcon className="w-5 h-5 mr-2" />
              Batch History
            </TabButton>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Tab Content */}
        {activeTab === 0 ? (
          <div>
            {/* Calculator Tab */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column - Main Input Form */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Unit Selection */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <ScaleIcon className="w-6 h-6 text-cyan-600" />
                      <h2 className="text-xl font-semibold text-gray-900">Unit Selection</h2>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="text-center mb-6">
                      <div className="text-2xl font-bold text-gray-900 mb-2">
                        Working in: <span className={`px-4 py-2 rounded-xl text-white shadow-sm ${volumeUnit === 'gallons' ? 'bg-blue-600' : 'bg-green-600'}`}>
                          {volumeUnit.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-600">All calculations will display in {volumeUnit}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setVolumeUnit('gallons')}
                        className={`p-4 rounded-xl border-2 font-semibold transition-all duration-200 ${
                          volumeUnit === 'gallons'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg transform scale-105'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                      >
                        <div className="text-2xl mb-2">🇺🇸</div>
                        <div className="text-lg">GALLONS</div>
                        <div className="text-sm opacity-75 mt-1">US Standard</div>
                      </button>
                      <button
                        onClick={() => setVolumeUnit('liters')}
                        className={`p-4 rounded-xl border-2 font-semibold transition-all duration-200 ${
                          volumeUnit === 'liters'
                            ? 'bg-green-600 text-white border-green-600 shadow-lg transform scale-105'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50'
                        }`}
                      >
                        <div className="text-2xl mb-2">🌍</div>
                        <div className="text-lg">LITERS</div>
                        <div className="text-sm opacity-75 mt-1">Metric</div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Chemical Selection */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <BeakerIcon className="w-6 h-6 text-blue-600" />
                      <h2 className="text-xl font-semibold text-gray-900">Chemical Selection</h2>
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    
                    {/* Chemical Dropdown */}
                    <ModernSelect
                      label="Select Chemical"
                      value={selectedChemical}
                      onChange={handleChemicalSelect}
                      placeholder="Choose a chemical from the list"
                      icon={<BeakerIcon className="w-5 h-5" />}
                    >
                      <option value="" disabled>Select a chemical</option>
                      {sortedChemicalData.map((chemical, index) => (
                        <option key={index} value={chemical.name}>
                          {chemical.name.includes('%') ? chemical.name : `${chemical.name} ${chemical.initialConcentration}%`}
                        </option>
                      ))}
                    </ModernSelect>

                    {/* Chemical Details and Batch Info - Show only when chemical is selected */}
                    {selectedChemical && (
                      <div className="grid grid-cols-2 gap-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Specific Gravity (SG)</label>
                            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-600">
                              {specificGravity.toFixed(3)}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Dilution Method</label>
                            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-600">
                              {method === 'vv' ? 'Volume/Volume' : method === 'wv' ? 'Weight/Volume' : 'Weight/Weight'}
                            </div>
                          </div>
                        </div>
                        
                        <ModernInput
                          label="Completed By"
                          type="text"
                          value={completedBy}
                          onChange={(e) => setCompletedBy(e.target.value)}
                          placeholder="Enter your name"
                          icon={<UserIcon className="w-5 h-5" />}
                        />
                      </div>
                    )}

                    {/* Quick Templates */}
                    {selectedChemical && (
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">Quick Concentration Templates</label>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                          {quickTemplates.map((template, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                if (template.concentration < initialConcentration) {
                                  handleDesiredConcentrationChange(template.concentration);
                                }
                              }}
                              disabled={template.concentration >= initialConcentration}
                              className={`p-3 rounded-xl border-2 font-medium transition-all duration-200 ${
                                desiredConcentration === template.concentration
                                  ? 'bg-cyan-100 border-cyan-500 text-cyan-700'
                                  : template.concentration >= initialConcentration
                                  ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-white border-gray-300 text-gray-700 hover:border-cyan-400 hover:bg-cyan-50'
                              }`}
                            >
                              {template.name}
                            </button>
                          ))}
                          {/* Special button for Phosphoric Acid 85% */}
                          {selectedChemical === 'Phosphoric Acid 85%' && (
                            <button
                              onClick={() => {
                                const targetConcentration = 30;
                                if (targetConcentration < initialConcentration) {
                                  handleDesiredConcentrationChange(targetConcentration);
                                }
                              }}
                              className="p-3 rounded-xl border-2 font-semibold transition-all duration-200 bg-emerald-100 border-emerald-500 text-emerald-700 hover:bg-emerald-200"
                            >
                              30% (pH-ree fall)
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Desired Concentration */}
                    <ModernInput
                      label="Desired Concentration (%)"
                      type="number"
                      min="0"
                      max={initialConcentration - 0.1}
                      step="0.1"
                      value={desiredConcentration}
                      onChange={(e) => handleDesiredConcentrationChange(parseFloat(e.target.value))}
                      placeholder="Enter target concentration"
                      icon={<TagIcon className="w-5 h-5" />}
                      error={error}
                    />
                  </div>
                </div>

                {/* Volume Configuration */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <ScaleIcon className="w-6 h-6 text-green-600" />
                      <h2 className="text-xl font-semibold text-gray-900">Volume Configuration</h2>
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    
                    {/* Total Volume Input */}
                    <ModernInput
                      label={`Total Volume (${volumeUnit})`}
                      type="number"
                      min="0"
                      step="any"
                      value={totalVolume === 0 ? '' : getVolumeInDisplayUnit(totalVolume)}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (inputValue === '') {
                          setTotalVolume(0);
                        } else {
                          const numValue = parseFloat(inputValue);
                          if (!isNaN(numValue) && numValue >= 0) {
                            setTotalVolume(getVolumeInGallons(numValue));
                          }
                        }
                      }}
                      placeholder="Enter total volume needed"
                      icon={<ScaleIcon className="w-5 h-5" />}
                    />
                  </div>
                </div>

                {/* Calculate Button & Notes */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                  {/* Notes */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Notes (Optional)</Label>
                    <textarea
                      rows={3}
                      className="w-full p-3 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      placeholder="Add any special instructions or notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Calculate Button */}
                  <button
                    onClick={calculateDilution}
                    disabled={isLoading || !selectedChemical || !totalVolume || desiredConcentration <= 0}
                    className="w-full inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Calculating...
                      </>
                    ) : (
                      <>
                        <BeakerIcon className="w-6 h-6 mr-3" />
                        Calculate Dilution
                      </>
                    )}
                  </button>
                  
                  {/* Action Buttons */}
                  {result && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => {/* printCalculation(null) */}} 
                        disabled={!result} 
                        className="flex items-center justify-center"
                      >
                        <PrinterIcon className="mr-2 w-4 h-4" /> Print
                      </Button>
                      <Button 
                        onClick={() => {/* saveBatch() */}} 
                        disabled={!result || !completedBy}
                        className="flex items-center justify-center bg-green-600 hover:bg-green-700"
                      >
                        <ArrowDownTrayIcon className="mr-2 w-4 h-4" /> Save
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Results & Safety Info */}
              <div className="space-y-6">
                {/* Enhanced Safety Protocol */}
                {selectedChemical && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
                    <div className="flex items-start space-x-3">
                      <ShieldExclamationIcon className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Warehouse Safety Protocol</h3>
                        <div className="space-y-3 text-sm text-gray-700">
                          <div>
                            <p className="font-semibold text-yellow-800 mb-1">⚠️ Critical Safety Steps:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-2">
                              <li><span className="font-medium">ALWAYS</span> add water first - never add water to acid</li>
                              <li>Add chemical slowly with constant stirring</li>
                              <li>Monitor temperature - use ice bath if needed</li>
                              <li>Work in fume hood or well-ventilated area</li>
                            </ol>
                          </div>
                          
                          {(() => {
                            const chemical = sortedChemicalData.find(c => c.name === selectedChemical);
                            return (
                              <>
                                {chemical?.hazardClass && (
                                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                                    <p className="font-semibold text-red-800">Hazard Class:</p>
                                    <p className="text-red-700">{chemical.hazardClass}</p>
                                  </div>
                                )}
                                
                                {chemical?.ppeSuggestion && (
                                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                    <p className="font-semibold text-blue-800">Required PPE:</p>
                                    <p className="text-blue-700">{chemical.ppeSuggestion}</p>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          
                          <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                            <p className="font-semibold text-orange-800">Emergency Response:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2 text-orange-700">
                              <li>Skin: Flush 15-20 min with water</li>
                              <li>Eyes: Use eyewash station 15-20 min</li>
                              <li>Spills: Use appropriate spill kit</li>
                              <li>Always seek medical attention after exposure</li>
                            </ul>
                          </div>
                          
                          <p className="text-xs text-gray-600 italic mt-2">
                            This protocol follows warehouse safety standards from CLAUDE.md. 
                            Always consult the full SDS before handling chemicals.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Results Display */}
                {result && (
                  <Card className="bg-white p-6">
                    <h5 className="text-xl font-bold tracking-tight text-gray-900 mb-4">
                      Dilution Results
                    </h5>
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-900">Chemical Details:</p>
                        <p className="text-gray-700">{selectedChemical}</p>
                        <p className="text-gray-700">
                          Initial: {initialConcentration}% → Target: {desiredConcentration}%
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <p className="font-medium text-blue-800">Chemical Amount:</p>
                          <p className="text-xl font-bold text-blue-800">
                            {getVolumeInDisplayUnit(result.chemicalVolume).toFixed(2)} <span className="text-sm">{volumeUnit === 'gallons' ? 'gal' : 'L'}</span>
                          </p>
                          <p className="text-sm text-blue-800/70">
                            {volumeUnit === 'liters' && `(${result.chemicalVolume.toFixed(2)} gal) • `}
                            {(result.chemicalWeight).toFixed(2)} lbs ({(result.chemicalWeight * LBS_TO_KG).toFixed(2)} kg)
                          </p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                          <p className="font-medium text-green-800">Water Amount:</p>
                          <p className="text-xl font-bold text-green-800">
                            {getVolumeInDisplayUnit(result.waterVolume).toFixed(2)} <span className="text-sm">{volumeUnit === 'gallons' ? 'gal' : 'L'}</span>
                          </p>
                          <p className="text-sm text-green-800/70">
                            {volumeUnit === 'liters' && `(${result.waterVolume.toFixed(2)} gal) • `}
                            {(result.waterWeight).toFixed(2)} lbs ({(result.waterWeight * LBS_TO_KG).toFixed(2)} kg)
                          </p>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-900">Total Batch:</p>
                        <p className="text-gray-700">
                          Volume: {getVolumeInDisplayUnit(totalVolume).toFixed(2)} {volumeUnit}
                          {volumeUnit === 'liters' ? ` (${totalVolume.toFixed(2)} gal)` : ` (${(totalVolume * GALLONS_TO_LITERS).toFixed(2)} L)`}
                        </p>
                        <p className="text-gray-700">
                          Weight: {(result.totalWeight).toFixed(2)} lbs ({(result.totalWeight * LBS_TO_KG).toFixed(2)} kg)
                        </p>
                      </div>
                    </div>
                    
                    {/* Visual Mixture Representation */}
                    <MixtureDisplay chemical={result.chemicalVolume} water={result.waterVolume} />
                  </Card>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Batch History Tab
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Recent Batches</h3>
              <Button variant="outline" disabled={batchHistory.length === 0} className="flex items-center transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg hover:shadow-xl">
                <ClipboardDocumentListIcon className="mr-2 w-4 h-4" /> Export CSV
              </Button>
            </div>
            
            {batchHistory.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No batch history available.</p>
                <p className="text-gray-400 text-sm mt-2">Saved batches will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-4 py-3">Batch #</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Chemical</th>
                      <th className="px-4 py-3">Conc. (%)</th>
                      <th className="px-4 py-3">Volume ({volumeUnit === 'gallons' ? 'gal' : 'L'})</th>
                      <th className="px-4 py-3">By</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchHistory
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((batch) => (
                        <tr key={batch.id} className="bg-white border-b hover:bg-gray-50">
                          <td className="px-4 py-4 font-medium text-gray-900">{batch.batchNumber}</td>
                          <td className="px-4 py-4">{batch.date}</td>
                          <td className="px-4 py-4">{batch.chemicalName.split(' ')[0]}</td>
                          <td className="px-4 py-4">{batch.initialConcentration}% → {batch.desiredConcentration}%</td>
                          <td className="px-4 py-4">{getVolumeInDisplayUnit(batch.totalVolume).toFixed(1)} {volumeUnit === 'gallons' ? 'gal' : 'L'}</td>
                          <td className="px-4 py-4">{batch.completedBy}</td>
                          <td className="px-4 py-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const chemical = sortedChemicalData.find(chem => chem.name === batch.chemicalName);
                                if (chemical) {
                                  setSelectedChemical(chemical.name);
                                  setInitialConcentration(chemical.initialConcentration);
                                  setSpecificGravity(chemical.specificGravity);
                                  setMethod(chemical.method);
                                  setDesiredConcentration(batch.desiredConcentration);
                                  setTotalVolume(batch.totalVolume);
                                  setCompletedBy(batch.completedBy);
                                  setNotes(batch.notes);
                                  setBatchNumber(batch.batchNumber);
                                  calculateDilution();
                                  setActiveTab(0);
                                }
                              }}
                            >
                              Load
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-2 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg hover:shadow-xl"
                              onClick={() => {/* printCalculation(batch) */}}
                            >
                              Print
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
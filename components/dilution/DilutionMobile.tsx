'use client';

import React, { ChangeEvent, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BeakerIcon,
  ScaleIcon,
  ShieldExclamationIcon,
  PrinterIcon,
  ClipboardDocumentListIcon,
  UserIcon,
  ArrowDownTrayIcon,
  TagIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { DilutionProps } from './types';

// Warehouse UI friendly components with larger touch targets
const WarehouseButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'go' | 'stop' | 'caution';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, disabled = false, variant = 'primary', size = 'lg', children, className = '' }) => {
  const variants = {
    primary: 'bg-warehouse-info text-white border-4 border-warehouse-info/20',
    secondary: 'bg-gray-100 text-gray-800 border-4 border-gray-300',
    danger: 'bg-warehouse-stop text-white border-4 border-warehouse-stop/20',
    go: 'bg-warehouse-go text-white border-4 border-warehouse-go/20',
    stop: 'bg-warehouse-stop text-white border-4 border-warehouse-stop/20',
    caution: 'bg-warehouse-caution text-warehouse-caution border-4 border-warehouse-caution/20',
  };

  const sizes = {
    sm: 'min-h-[60px] px-4 py-2 text-sm',
    md: 'min-h-[80px] px-6 py-3 text-base',
    lg: 'min-h-[100px] px-8 py-4 text-lg',
    xl: 'min-h-[120px] px-10 py-6 text-xl',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${variants[variant]}
        ${sizes[size]}
        rounded-2xl font-black uppercase tracking-wide
        transition-all duration-200 transform
        active:scale-95 hover:scale-105
        disabled:opacity-50 disabled:transform-none
        shadow-lg hover:shadow-xl
        border-b-8 active:border-b-4
        ${className}
      `}
      style={{
        textShadow: '0 1px 3px rgba(0,0,0,0.3)'
      }}
    >
      {children}
    </button>
  );
};

const WarehouseInput: React.FC<{
  label: string;
  type?: string;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string | null;
  disabled?: boolean;
}> = ({ label, type = 'text', value, onChange, placeholder, error, disabled = false }) => {
  return (
    <div className="space-y-3">
      <Label className="text-warehouse-3xl font-black text-gray-900 uppercase tracking-wide">
        {label}
      </Label>
      <div className="relative">
        <Input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            min-h-[80px] px-6 py-4 text-2xl text-center font-bold rounded-2xl
            border-4 focus:ring-4 focus:ring-warehouse-info/50
            ${error ? 'border-warehouse-stop bg-red-50' : 'border-gray-300 focus:border-warehouse-info'}
            ${disabled ? 'bg-gray-100 text-gray-500' : 'bg-white'}
          `}
        />
      </div>
      {error && (
        <div className="p-4 bg-warehouse-stop/10 border-2 border-warehouse-stop rounded-xl">
          <p className="text-warehouse-stop font-bold text-center text-lg">{error}</p>
        </div>
      )}
    </div>
  );
};

const WarehouseSelect: React.FC<{
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ label, value, onChange, children, disabled = false }) => {
  return (
    <div className="space-y-3">
      <Label className="text-warehouse-3xl font-black text-gray-900 uppercase tracking-wide">
        {label}
      </Label>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`
          w-full min-h-[80px] px-6 py-4 text-xl font-bold rounded-2xl
          border-4 focus:ring-4 focus:ring-warehouse-info/50
          focus:border-warehouse-info border-gray-300
          ${disabled ? 'bg-gray-100 text-gray-500' : 'bg-white'}
        `}
      >
        {children}
      </select>
    </div>
  );
};

const SwipeableTabs: React.FC<{
  activeTab: number;
  setActiveTab: (tab: number) => void;
  tabs: Array<{ label: string; icon: React.ComponentType<any> }>;
}> = ({ activeTab, setActiveTab, tabs }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg border-4 border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between">
        <WarehouseButton
          onClick={() => setActiveTab(Math.max(0, activeTab - 1))}
          disabled={activeTab === 0}
          variant="secondary"
          size="md"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </WarehouseButton>
        
        <div className="flex-1 text-center px-4">
          <div className="flex items-center justify-center space-x-2">
            {React.createElement(tabs[activeTab].icon, { className: "w-8 h-8" })}
            <span className="text-2xl font-black uppercase tracking-wide">
              {tabs[activeTab].label}
            </span>
          </div>
          <div className="mt-2 flex justify-center space-x-2">
            {tabs.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full ${
                  index === activeTab ? 'bg-warehouse-info' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
        
        <WarehouseButton
          onClick={() => setActiveTab(Math.min(tabs.length - 1, activeTab + 1))}
          disabled={activeTab === tabs.length - 1}
          variant="secondary"
          size="md"
        >
          <ChevronRightIcon className="w-6 h-6" />
        </WarehouseButton>
      </div>
    </div>
  );
};

export default function DilutionMobile(props: DilutionProps) {
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

  const [showSafety, setShowSafety] = useState(true);

  // Mobile-specific state
  const [currentStep, setCurrentStep] = useState(0);
  const steps = ['units', 'chemical', 'concentration', 'volume', 'calculate', 'results'];

  const tabs = [
    { label: 'Calculator', icon: BeakerIcon },
    { label: 'History', icon: ClipboardDocumentListIcon },
  ];

  // Unit conversion helpers
  const getVolumeInGallons = (value: number): number => {
    return volumeUnit === 'liters' ? value * LITERS_TO_GALLONS : value;
  };

  const getVolumeInDisplayUnit = (gallons: number): number => {
    return volumeUnit === 'liters' ? gallons * GALLONS_TO_LITERS : gallons;
  };

  // Dilution calculation logic (same as desktop but with mobile feedback)
  const calculateDilution = () => {
    // Haptic feedback for mobile
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }

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

    // Calculation logic (same as desktop)
    const densityInitialLbsPerGal = specificGravity * DENSITY_WATER_LBS_PER_GAL;
    const densityWaterLbsPerGal = DENSITY_WATER_LBS_PER_GAL;

    let chemicalVolumeGallons = 0;
    let waterVolumeGallons = 0;
    let chemicalWeightLbs = 0;
    let waterWeightLbs = 0;

    try {
      if (method === 'vv') {
        if (initialConcentration === 0) throw new Error("Initial V/V concentration cannot be zero.");
        chemicalVolumeGallons = (desiredConcentration * totalVolume) / initialConcentration;
        waterVolumeGallons = totalVolume - chemicalVolumeGallons;
      }
      else if (method === 'wv') {
        const pureChemicalLbs = (desiredConcentration / 100) * totalVolume * DENSITY_WATER_LBS_PER_GAL;
        const pureChemicalPerGalStock = (initialConcentration / 100) * densityInitialLbsPerGal;
        
        if (pureChemicalPerGalStock === 0) throw new Error("Initial W/V concentration cannot be zero.");
        chemicalVolumeGallons = pureChemicalLbs / pureChemicalPerGalStock;
        waterVolumeGallons = totalVolume - chemicalVolumeGallons;
      }
      else if (method === 'ww') {
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

      // Validation and cleanup
      if (Math.abs(chemicalVolumeGallons) < 1e-9) chemicalVolumeGallons = 0;
      if (Math.abs(waterVolumeGallons) < 1e-9) waterVolumeGallons = 0;
      
      if (chemicalVolumeGallons < 0 || waterVolumeGallons < 0 || !isFinite(chemicalVolumeGallons) || !isFinite(waterVolumeGallons)) {
        throw new Error('Invalid calculation result: Check input parameters.');
      }
      
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

      // Success haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([200]);
      }

      setCurrentStep(5); // Move to results step

    } catch (err: any) {
      console.error("Dilution Calculation Error:", err);
      setError(`Calculation Error: ${err.message || 'Please check inputs.'}`);
      setResult(null);
      
      // Error haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 100, 100, 100, 100]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesiredConcentrationChange = (value: number) => {
    if (isNaN(value)) return;
    
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
      setShowSafety(true); // Show safety info when new chemical is selected
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

  // Step navigation
  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return true; // units always allowed
      case 1: return selectedChemical !== ''; // chemical selected
      case 2: return desiredConcentration > 0 && desiredConcentration < initialConcentration; // valid concentration
      case 3: return totalVolume > 0; // volume entered
      case 4: return completedBy !== ''; // name entered
      default: return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4">
      {/* Mobile Header */}
      <div className="text-center mb-6 pt-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-warehouse-info/20 rounded-3xl mb-4">
          <BeakerIcon className="w-10 h-10 text-warehouse-info" />
        </div>
        <h1 className="text-warehouse-3xl font-black text-gray-900 mb-2 uppercase tracking-wide">
          Dilution System
        </h1>
        <p className="text-lg text-gray-600 font-semibold">
          Safe Chemical Mixing for Warehouse
        </p>
      </div>

      {/* Swipeable Tabs */}
      <SwipeableTabs 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        tabs={tabs}
      />

      {activeTab === 0 ? (
        // Calculator Tab
        <div className="space-y-6">
          
          {/* Progress Indicator */}
          <div className="bg-white rounded-2xl shadow-lg border-4 border-gray-200 p-6">
            <div className="text-center mb-4">
              <p className="text-xl font-bold text-gray-800">
                Step {currentStep + 1} of {steps.length}
              </p>
            </div>
            <div className="flex justify-center space-x-2 mb-4">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-full ${
                    index <= currentStep ? 'bg-warehouse-go' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-700 capitalize">
                {steps[currentStep].replace('-', ' ')}
              </p>
            </div>
          </div>

          {/* Step Content */}
          <div className="bg-white rounded-2xl shadow-lg border-4 border-gray-200 p-6">
            
            {/* Step 0: Unit Selection */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <h2 className="text-warehouse-3xl font-black text-center uppercase">Choose Units</h2>
                <div className="grid grid-cols-1 gap-4">
                  <WarehouseButton
                    onClick={() => setVolumeUnit('gallons')}
                    variant={volumeUnit === 'gallons' ? 'go' : 'secondary'}
                    size="xl"
                  >
                    <div className="flex items-center justify-center space-x-4">
                      <span className="text-4xl">🇺🇸</span>
                      <div>
                        <div className="text-2xl">GALLONS</div>
                        <div className="text-sm opacity-75">US Standard</div>
                      </div>
                    </div>
                  </WarehouseButton>
                  <WarehouseButton
                    onClick={() => setVolumeUnit('liters')}
                    variant={volumeUnit === 'liters' ? 'go' : 'secondary'}
                    size="xl"
                  >
                    <div className="flex items-center justify-center space-x-4">
                      <span className="text-4xl">🌍</span>
                      <div>
                        <div className="text-2xl">LITERS</div>
                        <div className="text-sm opacity-75">Metric</div>
                      </div>
                    </div>
                  </WarehouseButton>
                </div>
              </div>
            )}

            {/* Step 1: Chemical Selection */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h2 className="text-warehouse-3xl font-black text-center uppercase">Select Chemical</h2>
                <WarehouseSelect
                  label="Chemical"
                  value={selectedChemical}
                  onChange={handleChemicalSelect}
                >
                  <option value="" disabled>Choose a chemical</option>
                  {sortedChemicalData.map((chemical, index) => (
                    <option key={index} value={chemical.name}>
                      {chemical.name.includes('%') ? chemical.name : `${chemical.name} ${chemical.initialConcentration}%`}
                    </option>
                  ))}
                </WarehouseSelect>
                
                {selectedChemical && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                      <p className="font-bold text-blue-800 text-center">Specific Gravity</p>
                      <p className="text-2xl font-black text-blue-900 text-center">{specificGravity.toFixed(3)}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                      <p className="font-bold text-green-800 text-center">Method</p>
                      <p className="text-2xl font-black text-green-900 text-center">
                        {method === 'vv' ? 'V/V' : method === 'wv' ? 'W/V' : 'W/W'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Concentration */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h2 className="text-warehouse-3xl font-black text-center uppercase">Target Concentration</h2>
                
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-300 text-center">
                  <p className="font-bold text-gray-700">Starting Concentration</p>
                  <p className="text-4xl font-black text-gray-900">{initialConcentration}%</p>
                </div>

                {/* Quick Templates */}
                <div className="grid grid-cols-3 gap-3">
                  {quickTemplates.map((template, index) => (
                    <WarehouseButton
                      key={index}
                      onClick={() => {
                        if (template.concentration < initialConcentration) {
                          handleDesiredConcentrationChange(template.concentration);
                        }
                      }}
                      disabled={template.concentration >= initialConcentration}
                      variant={desiredConcentration === template.concentration ? 'go' : 'secondary'}
                      size="md"
                    >
                      {template.name}
                    </WarehouseButton>
                  ))}
                </div>

                <WarehouseInput
                  label="Target %"
                  type="number"
                  value={desiredConcentration}
                  onChange={(e) => handleDesiredConcentrationChange(parseFloat(e.target.value))}
                  placeholder="Enter target %"
                  error={error}
                />
              </div>
            )}

            {/* Step 3: Volume */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h2 className="text-warehouse-3xl font-black text-center uppercase">
                  Total Volume ({volumeUnit})
                </h2>
                
                <WarehouseInput
                  label={`Volume (${volumeUnit})`}
                  type="number"
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
                  placeholder={`Enter volume in ${volumeUnit}`}
                />

                {/* Common sizes as big buttons */}
                <div className="grid grid-cols-2 gap-3">
                  {[5, 15, 55, 275, 330, 500].map((size) => {
                    const displaySize = getVolumeInDisplayUnit(size);
                    return (
                      <WarehouseButton
                        key={size}
                        onClick={() => setTotalVolume(size)}
                        variant={Math.abs(totalVolume - size) < 0.1 ? 'go' : 'secondary'}
                        size="md"
                      >
                        {displaySize.toFixed(0)}
                      </WarehouseButton>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Final Details */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <h2 className="text-warehouse-3xl font-black text-center uppercase">Final Details</h2>
                
                <WarehouseInput
                  label="Your Name"
                  type="text"
                  value={completedBy}
                  onChange={(e) => setCompletedBy(e.target.value)}
                  placeholder="Enter your name"
                />

                <div className="space-y-3">
                  <Label className="text-warehouse-3xl font-black text-gray-900 uppercase tracking-wide">
                    Notes (Optional)
                  </Label>
                  <textarea
                    rows={4}
                    className="w-full min-h-[120px] px-6 py-4 text-xl font-semibold rounded-2xl border-4 border-gray-300 focus:border-warehouse-info focus:ring-4 focus:ring-warehouse-info/50"
                    placeholder="Add any special instructions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 5: Results */}
            {currentStep === 5 && result && (
              <div className="space-y-6">
                <h2 className="text-warehouse-3xl font-black text-center uppercase text-warehouse-go">
                  Results Ready!
                </h2>
                
                {/* Chemical Amount */}
                <div className="bg-blue-50 rounded-2xl p-6 border-4 border-blue-200">
                  <h3 className="text-2xl font-black text-blue-800 text-center mb-2 uppercase">
                    Chemical Amount
                  </h3>
                  <p className="text-4xl font-black text-blue-900 text-center">
                    {getVolumeInDisplayUnit(result.chemicalVolume).toFixed(2)}
                  </p>
                  <p className="text-xl font-bold text-blue-700 text-center">
                    {volumeUnit === 'gallons' ? 'Gallons' : 'Liters'}
                  </p>
                  <p className="text-lg text-blue-600 text-center mt-2">
                    {result.chemicalWeight.toFixed(2)} lbs ({(result.chemicalWeight * LBS_TO_KG).toFixed(2)} kg)
                  </p>
                </div>

                {/* Water Amount */}
                <div className="bg-green-50 rounded-2xl p-6 border-4 border-green-200">
                  <h3 className="text-2xl font-black text-green-800 text-center mb-2 uppercase">
                    Water Amount
                  </h3>
                  <p className="text-4xl font-black text-green-900 text-center">
                    {getVolumeInDisplayUnit(result.waterVolume).toFixed(2)}
                  </p>
                  <p className="text-xl font-bold text-green-700 text-center">
                    {volumeUnit === 'gallons' ? 'Gallons' : 'Liters'}
                  </p>
                  <p className="text-lg text-green-600 text-center mt-2">
                    {result.waterWeight.toFixed(2)} lbs ({(result.waterWeight * LBS_TO_KG).toFixed(2)} kg)
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 gap-4">
                  <WarehouseButton
                    onClick={() => {/* printCalculation() */}}
                    variant="primary"
                    size="lg"
                  >
                    <PrinterIcon className="w-8 h-8 mr-3" />
                    Print Instructions
                  </WarehouseButton>
                  
                  <WarehouseButton
                    onClick={() => {/* saveBatch() */}}
                    variant="go"
                    size="lg"
                    disabled={!completedBy}
                  >
                    <ArrowDownTrayIcon className="w-8 h-8 mr-3" />
                    Save to History
                  </WarehouseButton>
                </div>
              </div>
            )}
          </div>

          {/* Safety Warning - Always visible when chemical selected */}
          {selectedChemical && showSafety && (
            <div className="bg-warehouse-caution/20 border-4 border-warehouse-caution rounded-2xl p-6">
              <div className="flex items-start space-x-4">
                <ShieldExclamationIcon className="w-12 h-12 text-warehouse-caution flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-2xl font-black text-gray-900 mb-3 uppercase">
                    ⚠️ Safety First
                  </h3>
                  <div className="space-y-2 text-lg font-semibold">
                    <p className="text-warehouse-stop">• ALWAYS add water first!</p>
                    <p className="text-gray-800">• Add chemical slowly with stirring</p>
                    <p className="text-gray-800">• Use all required PPE</p>
                    <p className="text-gray-800">• Work in ventilated area</p>
                  </div>
                  
                  {(() => {
                    const chemical = sortedChemicalData.find(c => c.name === selectedChemical);
                    return chemical && (
                      <div className="mt-4 p-4 bg-red-100 rounded-xl border-2 border-red-300">
                        <p className="font-black text-red-800">HAZARD: {chemical.hazardClass}</p>
                        <p className="font-semibold text-red-700 mt-1">PPE: {chemical.ppeSuggestion}</p>
                      </div>
                    );
                  })()}
                  
                  <WarehouseButton
                    onClick={() => setShowSafety(false)}
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                  >
                    Got It - Hide Warning
                  </WarehouseButton>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="grid grid-cols-3 gap-4">
            <WarehouseButton
              onClick={prevStep}
              disabled={currentStep === 0}
              variant="secondary"
              size="lg"
            >
              <ChevronLeftIcon className="w-6 h-6 mr-2" />
              Back
            </WarehouseButton>
            
            {currentStep === 4 ? (
              <WarehouseButton
                onClick={calculateDilution}
                disabled={isLoading || !canProceed()}
                variant="go"
                size="lg"
              >
                {isLoading ? 'Calculating...' : 'Calculate!'}
              </WarehouseButton>
            ) : currentStep < 5 ? (
              <WarehouseButton
                onClick={nextStep}
                disabled={!canProceed()}
                variant="go"
                size="lg"
              >
                Next
                <ChevronRightIcon className="w-6 h-6 ml-2" />
              </WarehouseButton>
            ) : (
              <WarehouseButton
                onClick={() => {
                  setCurrentStep(0);
                  setSelectedChemical('');
                  setResult(null);
                  setError(null);
                }}
                variant="primary"
                size="lg"
              >
                New Batch
              </WarehouseButton>
            )}

            <WarehouseButton
              onClick={() => setShowSafety(!showSafety)}
              variant="caution"
              size="lg"
            >
              <ShieldExclamationIcon className="w-6 h-6 mr-2" />
              Safety
            </WarehouseButton>
          </div>
        </div>
      ) : (
        // History Tab
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg border-4 border-gray-200 p-6">
            <div className="text-center mb-6">
              <h2 className="text-warehouse-3xl font-black text-gray-900 uppercase">
                Batch History
              </h2>
              <p className="text-lg text-gray-600 font-semibold">
                Previous dilutions
              </p>
            </div>

            {batchHistory.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-2xl font-bold text-gray-500">No batches yet</p>
                <p className="text-lg text-gray-400 mt-2">Completed batches will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {batchHistory
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 10)
                  .map((batch) => (
                    <div key={batch.id} className="bg-gray-50 rounded-xl p-4 border-2 border-gray-300">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-black text-gray-900">{batch.batchNumber}</h3>
                        <span className="text-sm font-semibold text-gray-600">{batch.date}</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-800">
                        {batch.chemicalName.split(' ')[0]}
                      </p>
                      <p className="text-base text-gray-600">
                        {batch.initialConcentration}% → {batch.desiredConcentration}% • 
                        {getVolumeInDisplayUnit(batch.totalVolume).toFixed(1)} {volumeUnit === 'gallons' ? 'gal' : 'L'}
                      </p>
                      <p className="text-sm text-gray-500">By: {batch.completedBy}</p>
                      
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <WarehouseButton
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
                              setActiveTab(0);
                              setCurrentStep(4);
                            }
                          }}
                          variant="primary"
                          size="sm"
                        >
                          Load
                        </WarehouseButton>
                        <WarehouseButton
                          onClick={() => {/* printCalculation(batch) */}}
                          variant="secondary"
                          size="sm"
                        >
                          Print
                        </WarehouseButton>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
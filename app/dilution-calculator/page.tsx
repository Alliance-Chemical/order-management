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
  ShieldExclamationIcon,
  UserIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  TagIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import DilutionDesktop from '@/components/dilution/DilutionDesktop';
import DilutionMobile from '@/components/dilution/DilutionMobile';

interface ChemicalData {
  name: string;
  specificGravity: number;
  initialConcentration: number;
  method: 'vv' | 'wv' | 'ww';
  hazardClass?: string;
  ppeSuggestion?: string;
  batchHistoryIds?: string[];
}

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

// Constants
const DENSITY_WATER_LBS_PER_GAL = 8.345;
const GALLONS_TO_LITERS = 3.78541;
const LITERS_TO_GALLONS = 1 / GALLONS_TO_LITERS;
const LBS_TO_KG = 0.453592;

// Chemical data from the chemical-pricer app
const chemicalData: ChemicalData[] = [
  {
    name: 'Acetic Acid 100% / Vinegar 100%',
    specificGravity: 1.049,
    initialConcentration: 100.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron'
  },
  {
    name: 'Aluminum Sulfate Solution 48%',
    specificGravity: 1.335,
    initialConcentration: 48.0,
    method: 'ww',
    hazardClass: 'Corrosive, Skin/Eye Irritant',
    ppeSuggestion: 'Closed goggles or face shield, chemical resistant gloves (rubber, neoprene, PVC), work clothing.'
  },
  {
    name: 'Ammonium Hydroxide 29%',
    specificGravity: 0.897,
    initialConcentration: 29.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, respirator'
  },
  {
    name: 'Ferric Chloride Solution 40%',
    specificGravity: 1.37,
    initialConcentration: 40.0,
    method: 'ww',
    hazardClass: 'Corrosive, Serious Eye Damage, Skin Irritant, Harmful if Swallowed',
    ppeSuggestion: 'Chemical splash goggles or face shield, impervious rubber gloves, rubber boots, rain suit or rubber apron.'
  },
  {
    name: 'Hydrochloric Acid 31%',
    specificGravity: 1.15,
    initialConcentration: 31.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator'
  },
  {
    name: 'Hydrochloric Acid 35%',
    specificGravity: 1.18,
    initialConcentration: 35.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator'
  },
  {
    name: 'Hydrogen Peroxide 35%',
    specificGravity: 1.13,
    initialConcentration: 35.0,
    method: 'ww',
    hazardClass: 'Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield'
  },
  {
    name: 'Hydrogen Peroxide 50%',
    specificGravity: 1.20,
    initialConcentration: 50.0,
    method: 'ww',
    hazardClass: 'Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, chemical resistant suit'
  },
  {
    name: 'Isopropyl Alcohol 99.9%',
    specificGravity: 0.785,
    initialConcentration: 99.9,
    method: 'vv',
    hazardClass: 'Flammable',
    ppeSuggestion: 'Chemical resistant gloves, safety glasses'
  },
  {
    name: 'Methanol 100%',
    specificGravity: 0.791,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Flammable, Toxic',
    ppeSuggestion: 'Chemical resistant gloves, goggles, respirator'
  },
  {
    name: 'Monoethanolamine (MEA) 100%',
    specificGravity: 1.012,
    initialConcentration: 100.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield'
  },
  {
    name: 'Nitric Acid 65%',
    specificGravity: 1.40,
    initialConcentration: 65.0,
    method: 'ww',
    hazardClass: 'Corrosive, Oxidizer',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron, respirator'
  },
  {
    name: 'Phosphoric Acid 85%',
    specificGravity: 1.685,
    initialConcentration: 85.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron'
  },
  {
    name: 'Propylene Glycol 100%',
    specificGravity: 1.038,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Mild Skin Irritant, Eye Irritant',
    ppeSuggestion: 'Chemical safety glasses or goggles, nitrile or rubber gloves, apron or lab coat.'
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
    name: 'Sodium Hypochlorite 12.5%',
    specificGravity: 1.21,
    initialConcentration: 12.50,
    method: 'ww',
    hazardClass: 'Corrosive (Skin Burns, Eye Damage), Very Toxic to Aquatic Life',
    ppeSuggestion: 'Chemical safety glasses or goggles, face shield, nitrile or rubber gloves, complete body suit.'
  },
  {
    name: 'Sulfuric Acid 50%',
    specificGravity: 1.40,
    initialConcentration: 50.0,
    method: 'ww',
    hazardClass: 'Corrosive',
    ppeSuggestion: 'Chemical resistant gloves, goggles, face shield, acid resistant apron'
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
    name: 'Ethylene Glycol 100%',
    specificGravity: 1.113,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Toxic',
    ppeSuggestion: 'Chemical resistant gloves, safety glasses'
  },
  {
    name: 'Denatured Ethanol 200 Proof',
    specificGravity: 0.789,
    initialConcentration: 100.0,
    method: 'vv',
    hazardClass: 'Flammable, Toxic',
    ppeSuggestion: 'Chemical resistant gloves, goggles, respirator'
  }
];

// Utility functions
const loadBatchHistory = (): BatchHistory[] => {
  if (typeof window !== 'undefined') {
    const savedHistory = localStorage.getItem('batchHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        return parsed.map((item: any) => ({
          ...item,
          methodUsed: item.methodUsed || 'vv',
          initialSpecificGravity: item.initialSpecificGravity || 1,
          chemicalWeight: item.chemicalWeight || 0,
          waterWeight: item.waterWeight || 0
        }));
      } catch (e) {
        console.error('Error parsing batch history from localStorage', e);
      }
    }
  }
  return [];
};

const generateBatchNumber = (chemicalName: string): string => {
  const date = new Date();
  const year = date.getFullYear().toString().substring(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const abbrev = chemicalName.split(' ')[0].substring(0, 4).toUpperCase();
  return `${abbrev}${year}${month}${day}-${Date.now().toString().slice(-4)}`;
};

function DilutionCalculatorContent() {
  const router = useRouter();
  const params = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const sortedChemicalData = useMemo(() => [...chemicalData].sort((a, b) => a.name.localeCompare(b.name)), []);

  // States
  const [selectedChemical, setSelectedChemical] = useState<string>('');
  const [initialConcentration, setInitialConcentration] = useState<number>(0);
  const [desiredConcentration, setDesiredConcentration] = useState<number>(0);
  const [totalVolume, setTotalVolume] = useState<number>(0);
  const [method, setMethod] = useState<'vv' | 'wv' | 'ww'>('vv');
  const [specificGravity, setSpecificGravity] = useState<number>(1);
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
  const [activeTab, setActiveTab] = useState<number>(0);
  const [quickTemplates] = useState<Array<{ name: string; concentration: number }>>([
    { name: '10%', concentration: 10 },
    { name: '20%', concentration: 20 },
    { name: '30%', concentration: 30 },
    { name: '50%', concentration: 50 },
    { name: '75%', concentration: 75 },
  ]);

  // Common shared props for both desktop and mobile
  const sharedProps = {
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
  };

  // Load batch history on mount
  useEffect(() => {
    setBatchHistory(loadBatchHistory());
  }, []);

  // Generate batch number when chemical is selected
  useEffect(() => {
    if (selectedChemical) {
      setBatchNumber(generateBatchNumber(selectedChemical));
    } else {
      setBatchNumber('');
    }
  }, [selectedChemical]);

  // Render appropriate component based on screen size
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50">
      {isMobile ? (
        <DilutionMobile {...sharedProps} />
      ) : (
        <DilutionDesktop {...sharedProps} />
      )}
    </div>
  );
}

export default function DilutionCalculatorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <DilutionCalculatorContent />
    </Suspense>
  );
}
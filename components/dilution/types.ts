import { ReadonlyURLSearchParams } from 'next/navigation';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export interface ChemicalData {
  name: string;
  specificGravity: number;
  initialConcentration: number;
  method: 'vv' | 'wv' | 'ww';
  hazardClass?: string;
  ppeSuggestion?: string;
  batchHistoryIds?: string[];
}

export interface BatchHistory {
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

export interface DilutionResult {
  chemicalVolume: number;
  waterVolume: number;
  chemicalWeight: number;
  waterWeight: number;
  totalWeight: number;
}

export interface DilutionProps {
  sortedChemicalData: ChemicalData[];
  selectedChemical: string;
  setSelectedChemical: (value: string) => void;
  initialConcentration: number;
  setInitialConcentration: (value: number) => void;
  desiredConcentration: number;
  setDesiredConcentration: (value: number) => void;
  totalVolume: number;
  setTotalVolume: (value: number) => void;
  method: 'vv' | 'wv' | 'ww';
  setMethod: (value: 'vv' | 'wv' | 'ww') => void;
  specificGravity: number;
  setSpecificGravity: (value: number) => void;
  result: DilutionResult | null;
  setResult: (value: DilutionResult | null) => void;
  error: string | null;
  setError: (value: string | null) => void;
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
  batchNumber: string;
  setBatchNumber: (value: string) => void;
  completedBy: string;
  setCompletedBy: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  batchHistory: BatchHistory[];
  setBatchHistory: (value: BatchHistory[]) => void;
  volumeUnit: 'gallons' | 'liters';
  setVolumeUnit: (value: 'gallons' | 'liters') => void;
  activeTab: number;
  setActiveTab: (value: number) => void;
  quickTemplates: Array<{ name: string; concentration: number }>;
  generateBatchNumber: (chemicalName: string) => string;
  loadBatchHistory: () => BatchHistory[];
  params: ReadonlyURLSearchParams | null;
  router: AppRouterInstance;
  DENSITY_WATER_LBS_PER_GAL: number;
  GALLONS_TO_LITERS: number;
  LITERS_TO_GALLONS: number;
  LBS_TO_KG: number;
}
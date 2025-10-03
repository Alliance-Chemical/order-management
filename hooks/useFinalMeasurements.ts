import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Pallet } from '@/hooks/usePalletBuilder';

const AUTOSAVE_DELAY_MS = 1200;
const DEFAULT_WEIGHT_UNIT = 'lbs';
const DEFAULT_DIMENSION_UNIT = 'in';

export interface MeasurementEntry {
  id: string;
  weight: string;
  weightUnit: string;
  length: string;
  width: string;
  height: string;
  dimensionUnit: string;
  containerCode?: string | null;
  measuredAt?: string;
}

export type SaveState = 'idle' | 'saving' | 'error';

export interface FinalMeasurementsData {
  mode?: 'single' | 'pallets';
  measuredBy?: string;
  measuredAt?: string;
  weight?: { value: number; units: string } | null;
  dimensions?: { length: number; width: number; height: number; units: string } | null;
  scannedContainer?: string | null;
  entryCount?: number;
  totalWeight?: number;
  palletCount?: number;
  entries?: Array<{
    id?: string;
    weight?: string | number | { value?: number; units?: string };
    weightUnit?: string;
    length?: string | number;
    width?: string | number;
    height?: string | number;
    dimensionUnit?: string;
    containerCode?: string | null;
    scannedContainer?: string | null;
    measuredAt?: string;
    dimensions?: {
      length?: string | number;
      width?: string | number;
      height?: string | number;
      units?: string;
    } | null;
  }>;
  pallets?: Pallet[];
}

export type FinalMeasurementsSavePayload =
  | {
      mode: 'single';
      entries: Array<{
        id: string;
        weight: string;
        weightUnit: string;
        length: string;
        width: string;
        height: string;
        dimensionUnit: string;
        containerCode: string | null;
        measuredAt: string;
      }>;
      entryCount: number;
      measuredBy: string;
      measuredAt: string;
      weight: { value: number; units: string } | null;
      dimensions: { length: number; width: number; height: number; units: string } | null;
      scannedContainer: string | null;
    }
  | {
      mode: 'pallets';
      pallets: Pallet[];
      palletCount: number;
      totalWeight: number;
      measuredBy: string;
      measuredAt: string;
    };

interface UseFinalMeasurementsProps {
  initialData?: FinalMeasurementsData;
  onSave: (measurements: FinalMeasurementsSavePayload) => Promise<void> | void;
}

function createEntry(partial?: Partial<MeasurementEntry>): MeasurementEntry {
  return {
    id: partial?.id ?? `measurement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    weight: partial?.weight ?? '',
    weightUnit: partial?.weightUnit ?? DEFAULT_WEIGHT_UNIT,
    length: partial?.length ?? '',
    width: partial?.width ?? '',
    height: partial?.height ?? '',
    dimensionUnit: partial?.dimensionUnit ?? DEFAULT_DIMENSION_UNIT,
    containerCode: partial?.containerCode ?? null,
    measuredAt: partial?.measuredAt ?? undefined,
  };
}

function isEntryComplete(entry: MeasurementEntry) {
  return Boolean(
    entry.weight &&
    entry.length &&
    entry.width &&
    entry.height &&
    !Number.isNaN(parseFloat(entry.weight)) &&
    !Number.isNaN(parseFloat(entry.length)) &&
    !Number.isNaN(parseFloat(entry.width)) &&
    !Number.isNaN(parseFloat(entry.height))
  );
}

export function useFinalMeasurements({ initialData, onSave }: UseFinalMeasurementsProps) {
  const initialEntries = useMemo<MeasurementEntry[]>(() => {
    if (Array.isArray(initialData?.entries) && initialData.entries.length > 0) {
      return initialData.entries.map((entry) => {
        const rawWeight = entry?.weight;
        const weightValue = (() => {
          if (rawWeight === undefined || rawWeight === null) return '';
          if (typeof rawWeight === 'object') {
            return rawWeight.value !== undefined ? String(rawWeight.value) : '';
          }
          return String(rawWeight);
        })();
        const weightUnit = (() => {
          if (entry?.weightUnit) return entry.weightUnit;
          if (rawWeight && typeof rawWeight === 'object' && rawWeight.units) {
            return rawWeight.units;
          }
          return DEFAULT_WEIGHT_UNIT;
        })();

        const lengthValue = entry?.length ?? entry?.dimensions?.length;
        const widthValue = entry?.width ?? entry?.dimensions?.width;
        const heightValue = entry?.height ?? entry?.dimensions?.height;
        const dimensionUnit = entry?.dimensionUnit
          ?? (entry?.dimensions && 'units' in entry.dimensions ? entry.dimensions.units : undefined)
          ?? DEFAULT_DIMENSION_UNIT;

        return createEntry({
          id: entry?.id,
          weight: weightValue,
          weightUnit,
          length: lengthValue !== undefined && lengthValue !== null ? String(lengthValue) : '',
          width: widthValue !== undefined && widthValue !== null ? String(widthValue) : '',
          height: heightValue !== undefined && heightValue !== null ? String(heightValue) : '',
          dimensionUnit,
          containerCode: entry?.containerCode ?? entry?.scannedContainer ?? null,
          measuredAt: entry?.measuredAt,
        });
      });
    }

    if (initialData?.weight?.value && initialData?.dimensions) {
      return [
        createEntry({
          weight: `${initialData.weight.value}`,
          weightUnit: initialData.weight.units ?? DEFAULT_WEIGHT_UNIT,
          length: `${initialData.dimensions.length ?? ''}`,
          width: `${initialData.dimensions.width ?? ''}`,
          height: `${initialData.dimensions.height ?? ''}`,
          dimensionUnit: initialData.dimensions.units ?? DEFAULT_DIMENSION_UNIT,
          containerCode: initialData.scannedContainer ?? null,
          measuredAt: initialData.measuredAt,
        })
      ];
    }

    return [createEntry()];
  }, [initialData]);

  const [entries, setEntries] = useState<MeasurementEntry[]>(initialEntries);
  const [mode, setMode] = useState<'single' | 'pallets'>(initialData?.mode ?? 'single');
  const [palletData, setPalletData] = useState<Pallet[]>(Array.isArray(initialData?.pallets) ? initialData.pallets : []);
  const [showScanner, setShowScanner] = useState(false);
  const scannerTargetRef = useRef<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string>('');
  const [lastSaved, setLastSaved] = useState<Date | null>(initialData?.measuredAt ? new Date(initialData.measuredAt) : null);
  const [validationError, setValidationError] = useState<string>('');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialRenderRef = useRef(true);

  const measuredBy = initialData?.measuredBy || 'Current User';

  const serializeForSave = useCallback((): FinalMeasurementsSavePayload => {
    if (mode === 'single') {
      const serializedEntries = entries.map((entry) => ({
        id: entry.id,
        weight: entry.weight,
        weightUnit: entry.weightUnit,
        length: entry.length,
        width: entry.width,
        height: entry.height,
        dimensionUnit: entry.dimensionUnit,
        containerCode: entry.containerCode ?? null,
        measuredAt: entry.measuredAt ?? new Date().toISOString(),
      }));

      const firstComplete = entries.find(isEntryComplete);

      if (firstComplete) {
        return {
          mode: 'single',
          entries: serializedEntries,
          entryCount: serializedEntries.length,
          measuredBy,
          measuredAt: firstComplete.measuredAt ?? new Date().toISOString(),
          weight: {
            value: parseFloat(firstComplete.weight),
            units: firstComplete.weightUnit,
          },
          dimensions: {
            length: parseFloat(firstComplete.length),
            width: parseFloat(firstComplete.width),
            height: parseFloat(firstComplete.height),
            units: firstComplete.dimensionUnit,
          },
          scannedContainer: firstComplete.containerCode ?? null,
        };
      }

      return {
        mode: 'single',
        entries: serializedEntries,
        entryCount: serializedEntries.length,
        measuredBy,
        measuredAt: new Date().toISOString(),
        weight: null,
        dimensions: null,
        scannedContainer: null,
      };
    }

    const pallets = Array.isArray(palletData) ? palletData : [];
    const totalWeight = pallets.reduce((sum, pallet) => sum + pallet.weight.value, 0);

    if (pallets.length === 0) {
      setValidationError('Please add at least one pallet');
    } else {
      setValidationError('');
    }

    return {
      mode: 'pallets',
      pallets,
      palletCount: pallets.length,
      totalWeight,
      measuredBy,
      measuredAt: new Date().toISOString(),
    };
  }, [entries, measuredBy, mode, palletData]);

  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const executeSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const payload = serializeForSave();

    try {
      await onSaveRef.current(payload);
      setAutoSaveState('idle');
      const now = new Date();
      setLastSaved(now);
      setTimeout(() => {
        setLastSaved((current) => (current && current.getTime() === now.getTime() ? null : current));
      }, 4000);
    } catch (error) {
      console.error('Error saving measurements:', error);
      setAutoSaveState('error');
      setSaveError('Failed to auto-save measurements');
    }
  }, [serializeForSave]);

  const scheduleAutoSave = useCallback(() => {
    if (isInitialRenderRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    setAutoSaveState('saving');
    setSaveError('');
    saveTimerRef.current = setTimeout(() => {
      executeSave();
    }, AUTOSAVE_DELAY_MS);
  }, [executeSave]);

  useEffect(() => {
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      return;
    }

    scheduleAutoSave();
  }, [entries, mode, palletData, scheduleAutoSave]);

  useEffect(() => () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
  }, []);

  const handleQRScan = useCallback((data: string) => {
    const targetId = scannerTargetRef.current;
    if (!targetId) {
      return false;
    }

    try {
      let qrData: { shortCode?: string } | Record<string, unknown>;
      if (data.startsWith('http')) {
        const parts = data.split('/');
        const shortCode = parts[parts.length - 1].replace('%0A', '').trim();
        qrData = { shortCode };
      } else {
        qrData = JSON.parse(data) as Record<string, unknown>;
      }

      const extractedCode = (() => {
        if (typeof qrData === 'object' && qrData !== null) {
          const maybeShort = (qrData as { shortCode?: unknown }).shortCode;
          if (typeof maybeShort === 'string' && maybeShort.trim()) {
            return maybeShort.trim();
          }
          const maybeCode = (qrData as { code?: unknown }).code;
          if (typeof maybeCode === 'string' && maybeCode.trim()) {
            return maybeCode.trim();
          }
        }
        return 'Unknown';
      })();

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === targetId
            ? { ...entry, containerCode: extractedCode }
            : entry
        )
      );

      setShowScanner(false);
      scannerTargetRef.current = null;

      setTimeout(() => {
        const weightInput = document.getElementById(`weight-input-${targetId}`);
        if (weightInput) {
          weightInput.focus();
        }
      }, 100);

      return true;
    } catch (error) {
      console.error('Error parsing QR data:', error);
      setValidationError('Invalid QR code format');
      return false;
    }
  }, []);

  const updateMeasurement = useCallback((entryId: string, field: keyof MeasurementEntry, value: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? { ...entry, [field]: value }
          : entry
      )
    );
    setValidationError('');
  }, []);

  const resetMeasurement = useCallback((entryId: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? createEntry({ id: entryId })
          : entry
      )
    );
  }, []);

  const addMeasurementEntry = useCallback(() => {
    setEntries((prev) => [...prev, createEntry()]);
  }, []);

  const removeMeasurementEntry = useCallback((entryId: string) => {
    setEntries((prev) => {
      if (prev.length === 1) {
        return [createEntry({ id: prev[0].id })];
      }
      return prev.filter((entry) => entry.id !== entryId);
    });
  }, []);

  const handlePalletUpdate = useCallback((pallets: Pallet[]) => {
    setPalletData(pallets);
    setValidationError('');
  }, []);

  const triggerManualSave = useCallback(() => {
    executeSave();
  }, [executeSave]);

  const openScannerForEntry = useCallback((entryId: string) => {
    scannerTargetRef.current = entryId;
    setShowScanner(true);
  }, []);

  return {
    // State
    showScanner,
    entries,
    mode,
    palletData,
    autoSaveState,
    lastSaved,
    validationError,
    saveError,

    // Actions
    setShowScanner,
    setMode,
    addMeasurementEntry,
    removeMeasurementEntry,
    resetMeasurement,
    updateMeasurement,
    handlePalletUpdate,
    handleQRScan,
    openScannerForEntry,
    triggerManualSave,
  };
}

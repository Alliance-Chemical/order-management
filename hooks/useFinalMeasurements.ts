import { useState, useCallback } from 'react';

interface Measurements {
  weight: string;
  weightUnit: string;
  length: string;
  width: string;
  height: string;
  dimensionUnit: string;
}

interface UseFinalMeasurementsProps {
  initialData?: any;
  onSave: (measurements: any) => void;
}

export function useFinalMeasurements({ initialData, onSave }: UseFinalMeasurementsProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedContainer, setScannedContainer] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurements>({
    weight: initialData?.weight?.value || '',
    weightUnit: initialData?.weight?.units || 'lbs',
    length: initialData?.dimensions?.length || '',
    width: initialData?.dimensions?.width || '',
    height: initialData?.dimensions?.height || '',
    dimensionUnit: initialData?.dimensions?.units || 'in',
  });
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [mode, setMode] = useState<'single' | 'pallets'>('single');
  const [palletData, setPalletData] = useState<any[]>(initialData?.pallets || []);
  const [validationError, setValidationError] = useState<string>('');

  const handleQRScan = useCallback((data: string) => {
    try {
      // Parse QR data (could be URL or JSON)
      let qrData;
      if (data.startsWith('http')) {
        // Extract shortCode from URL
        const urlParts = data.split('/');
        const shortCode = urlParts[urlParts.length - 1].replace('%0A', '').trim();
        qrData = { shortCode, type: 'url' };
      } else {
        // Try to parse as JSON
        qrData = JSON.parse(data);
      }
      
      setScannedContainer(qrData.shortCode || 'Unknown');
      setShowScanner(false);
      
      // Auto-focus on weight input after scanning
      setTimeout(() => {
        const weightInput = document.getElementById('weight-input');
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

  const validateMeasurements = useCallback(() => {
    if (mode === 'single') {
      if (!measurements.weight || !measurements.length || !measurements.width || !measurements.height) {
        setValidationError('Please enter all measurements');
        return false;
      }
      
      // Validate positive numbers
      const values = [
        parseFloat(measurements.weight),
        parseFloat(measurements.length),
        parseFloat(measurements.width),
        parseFloat(measurements.height)
      ];
      
      if (values.some(v => isNaN(v) || v <= 0)) {
        setValidationError('All measurements must be positive numbers');
        return false;
      }
    } else if (mode === 'pallets') {
      if (!palletData || palletData.length === 0) {
        setValidationError('Please add at least one pallet');
        return false;
      }
    }
    
    setValidationError('');
    return true;
  }, [mode, measurements, palletData]);

  const handleSave = useCallback(async () => {
    if (!validateMeasurements()) {
      return;
    }

    setSaving(true);
    try {
      let measurementData;
      
      if (mode === 'single') {
        measurementData = {
          weight: {
            value: parseFloat(measurements.weight),
            units: measurements.weightUnit
          },
          dimensions: {
            length: parseFloat(measurements.length),
            width: parseFloat(measurements.width),
            height: parseFloat(measurements.height),
            units: measurements.dimensionUnit
          },
          scannedContainer,
          measuredBy: 'Current User', // In production, get from auth context
          measuredAt: new Date().toISOString(),
          mode: 'single'
        };
      } else {
        measurementData = {
          pallets: palletData,
          totalWeight: palletData.reduce((sum: number, p: any) => sum + (p.weight || 0), 0),
          palletCount: palletData.length,
          measuredBy: 'Current User',
          measuredAt: new Date().toISOString(),
          mode: 'pallets'
        };
      }

      await onSave(measurementData);
      setLastSaved(new Date());
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setLastSaved(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving measurements:', error);
      setValidationError('Failed to save measurements');
    } finally {
      setSaving(false);
    }
  }, [mode, measurements, scannedContainer, palletData, validateMeasurements, onSave]);

  const updateMeasurement = useCallback((field: keyof Measurements, value: string) => {
    setMeasurements(prev => ({
      ...prev,
      [field]: value
    }));
    setValidationError(''); // Clear error when user types
  }, []);

  const handlePalletUpdate = useCallback((pallets: any[]) => {
    setPalletData(pallets);
    setValidationError(''); // Clear error when pallets change
  }, []);

  const resetMeasurements = useCallback(() => {
    setMeasurements({
      weight: '',
      weightUnit: 'lbs',
      length: '',
      width: '',
      height: '',
      dimensionUnit: 'in',
    });
    setScannedContainer(null);
    setValidationError('');
  }, []);

  return {
    // State
    showScanner,
    scannedContainer,
    measurements,
    saving,
    lastSaved,
    mode,
    palletData,
    validationError,
    
    // Actions
    setShowScanner,
    setMode,
    handleQRScan,
    handleSave,
    updateMeasurement,
    handlePalletUpdate,
    resetMeasurements,
  };
}
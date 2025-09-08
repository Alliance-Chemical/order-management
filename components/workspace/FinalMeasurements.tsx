'use client';

import { useState, useEffect, useRef } from 'react';
import { ScaleIcon, CubeIcon, QrCodeIcon, CheckCircleIcon, TruckIcon } from '@heroicons/react/24/outline';
import { QRScanner } from '@/components/qr/QRScannerAdapter';
import PalletArrangementBuilder from './PalletArrangementBuilder';

interface FinalMeasurementsProps {
  orderId: string;
  orderItems?: Array<{
    sku: string;
    name: string;
    quantity: number;
    weight?: { value: number; units: string };
  }>;
  initialData?: any;
  onSave: (measurements: any) => void;
}

export default function FinalMeasurements({ orderId, orderItems = [], initialData, onSave }: FinalMeasurementsProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedContainer, setScannedContainer] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState({
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

  const handleQRScan = async (data: string) => {
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
      const weightInput = document.getElementById('weight-input');
      if (weightInput) {
        weightInput.focus();
      }
    } catch (error) {
      console.error('Error parsing QR data:', error);
      alert('Invalid QR code format');
    }
  };

  const handleSave = async () => {
    if (mode === 'single') {
      // Validate inputs
      if (!measurements.weight || !measurements.length || !measurements.width || !measurements.height) {
        alert('Please enter all measurements');
        return;
      }

      setSaving(true);
      try {
        const measurementData = {
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

        await onSave(measurementData);
        setLastSaved(new Date());
        
        // Show success feedback
        setTimeout(() => {
          setLastSaved(null);
        }, 3000);
      } catch (error) {
        console.error('Error saving measurements:', error);
        alert('Failed to save measurements');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSavePallets = async (pallets: any[]) => {
    setSaving(true);
    try {
      const measurementData = {
        pallets,
        mode: 'pallets',
        totalWeight: pallets.reduce((sum: number, p: any) => sum + p.weight.value, 0),
        palletCount: pallets.length,
        measuredBy: 'Current User',
        measuredAt: new Date().toISOString()
      };

      await onSave(measurementData);
      setPalletData(pallets);
      setLastSaved(new Date());
      
      setTimeout(() => {
        setLastSaved(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving pallet arrangement:', error);
      alert('Failed to save pallet arrangement');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickEntry = (e: React.KeyboardEvent) => {
    // Allow Tab or Enter to move between fields quickly
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = e.currentTarget.closest('form');
      const inputs = Array.from(form?.querySelectorAll('input[type="number"]') || []);
      const currentIndex = inputs.indexOf(e.currentTarget as HTMLInputElement);
      if (currentIndex < inputs.length - 1) {
        (inputs[currentIndex + 1] as HTMLInputElement).focus();
      } else {
        handleSave();
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <ScaleIcon className="h-6 w-6 mr-2 text-blue-600" />
          Final Weights & Dimensions
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Enter the actual measured values after mixing/packaging
        </p>
        
        {/* Mode Toggle */}
        {orderItems.length > 0 && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setMode('single')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <CubeIcon className="h-5 w-5 inline mr-2" />
              Single Package
            </button>
            <button
              onClick={() => setMode('pallets')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'pallets'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <TruckIcon className="h-5 w-5 inline mr-2" />
              Multiple Pallets
            </button>
          </div>
        )}
      </div>

      {mode === 'pallets' ? (
        <PalletArrangementBuilder
          orderId={orderId}
          orderItems={orderItems}
          existingPallets={palletData}
          onSave={handleSavePallets}
        />
      ) : (
        <>
          {/* QR Scanner Section */}
          <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700">
            Container Identification
          </label>
          {scannedContainer && (
            <span className="text-sm text-green-600 flex items-center">
              <CheckCircleIcon className="h-4 w-4 mr-1" />
              Scanned: {scannedContainer}
            </span>
          )}
        </div>
        
        {!showScanner ? (
          <button
            onClick={() => setShowScanner(true)}
            className="w-full py-3 px-4 bg-blue-50 text-blue-700 rounded-lg border-2 border-blue-200 hover:bg-blue-100 transition-colors flex items-center justify-center font-medium"
          >
            <QrCodeIcon className="h-5 w-5 mr-2" />
            Scan Container QR Code (Master or Destination)
          </button>
        ) : (
          <div className="border-2 border-blue-200 rounded-lg overflow-hidden">
            <QRScanner
              onScan={handleQRScan}
              onClose={() => setShowScanner(false)}
            />
          </div>
        )}
      </div>

      {/* Measurements Form */}
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        {/* Weight Section */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Weight
          </label>
          <div className="flex gap-3">
            <input
              id="weight-input"
              type="number"
              step="0.01"
              placeholder="Enter weight"
              value={measurements.weight}
              onChange={(e) => setMeasurements({ ...measurements, weight: e.target.value })}
              onKeyDown={handleQuickEntry}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <select
              value={measurements.weightUnit}
              onChange={(e) => setMeasurements({ ...measurements, weightUnit: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
          </div>
        </div>

        {/* Dimensions Section */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dimensions (L × W × H)
          </label>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <input
                type="number"
                step="0.01"
                placeholder="Length"
                value={measurements.length}
                onChange={(e) => setMeasurements({ ...measurements, length: e.target.value })}
                onKeyDown={handleQuickEntry}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <input
                type="number"
                step="0.01"
                placeholder="Width"
                value={measurements.width}
                onChange={(e) => setMeasurements({ ...measurements, width: e.target.value })}
                onKeyDown={handleQuickEntry}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <input
                type="number"
                step="0.01"
                placeholder="Height"
                value={measurements.height}
                onChange={(e) => setMeasurements({ ...measurements, height: e.target.value })}
                onKeyDown={handleQuickEntry}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <select
            value={measurements.dimensionUnit}
            onChange={(e) => setMeasurements({ ...measurements, dimensionUnit: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="in">inches</option>
            <option value="cm">centimeters</option>
          </select>
        </div>

        {/* Calculated Volume Display */}
        {measurements.length && measurements.width && measurements.height && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">
              <CubeIcon className="h-4 w-4 inline mr-1" />
              Volume: {(
                parseFloat(measurements.length) * 
                parseFloat(measurements.width) * 
                parseFloat(measurements.height)
              ).toFixed(2)} {measurements.dimensionUnit}³
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {lastSaved && (
              <p className="text-sm text-green-600 flex items-center">
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                Saved at {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              saving 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saving ? 'Saving...' : 'Save Measurements'}
          </button>
        </div>
      </form>

          {/* Quick Tips */}
          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Tips:</strong> Scan any container QR to identify it • Press Enter to move between fields • All measurements are saved to the order record
            </p>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import { useFinalMeasurements } from '@/hooks/useFinalMeasurements';
import { MeasurementForm } from '@/components/measurements/MeasurementForm';
import { MeasurementActions } from '@/components/measurements/MeasurementActions';
import { MeasurementModeTabs } from '@/components/measurements/MeasurementModeTabs';
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

export default function FinalMeasurements({ 
  orderId, 
  orderItems = [], 
  initialData, 
  onSave 
}: FinalMeasurementsProps) {
  const {
    showScanner,
    scannedContainer,
    measurements,
    saving,
    lastSaved,
    mode,
    palletData,
    validationError,
    setShowScanner,
    setMode,
    handleQRScan,
    handleSave,
    updateMeasurement,
    handlePalletUpdate,
    resetMeasurements,
  } = useFinalMeasurements({ initialData, onSave });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            Final Measurements
          </h3>
          
          <MeasurementModeTabs
            mode={mode}
            onChange={setMode}
          >
            {{
              single: (
                <div className="space-y-6">
                  <MeasurementForm
                    measurements={measurements}
                    onUpdate={updateMeasurement}
                  />
                  
                  <MeasurementActions
                    scannedContainer={scannedContainer}
                    saving={saving}
                    lastSaved={lastSaved}
                    validationError={validationError}
                    onOpenScanner={() => setShowScanner(true)}
                    onSave={handleSave}
                    onReset={resetMeasurements}
                  />
                </div>
              ),
              pallets: (
                <div className="space-y-6">
                  <PalletArrangementBuilder
                    orderId={orderId}
                    orderItems={orderItems}
                    initialPallets={palletData}
                    onUpdate={handlePalletUpdate}
                  />
                  
                  <MeasurementActions
                    scannedContainer={null}
                    saving={saving}
                    lastSaved={lastSaved}
                    validationError={validationError}
                    onOpenScanner={() => {}}
                    onSave={handleSave}
                    onReset={() => handlePalletUpdate([])}
                  />
                </div>
              ),
            }}
          </MeasurementModeTabs>
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
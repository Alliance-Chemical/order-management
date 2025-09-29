'use client';

import React from 'react';
import { useFinalMeasurements, type FinalMeasurementsData, type FinalMeasurementsSavePayload } from '@/hooks/useFinalMeasurements';
import { MeasurementForm } from '@/components/measurements/MeasurementForm';
import { MeasurementActions } from '@/components/measurements/MeasurementActions';
import { MeasurementModeTabs } from '@/components/measurements/MeasurementModeTabs';
import { QRScanner } from '@/components/qr/QRScannerAdapter';
import PalletArrangementBuilder from './PalletArrangementBuilder';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@heroicons/react/24/outline';

interface FinalMeasurementsProps {
  orderItems?: Array<{
    sku: string;
    name: string;
    quantity: number;
    weight?: { value: number; units: string };
  }>;
  initialData?: FinalMeasurementsData;
  onSave: (measurements: FinalMeasurementsSavePayload) => void;
}

export default function FinalMeasurements({
  orderItems = [],
  initialData,
  onSave,
}: FinalMeasurementsProps) {
  const {
    showScanner,
    entries,
    lastSaved,
    mode,
    palletData,
    validationError,
    saveError,
    autoSaveState,
    setShowScanner,
    setMode,
    handleQRScan,
    updateMeasurement,
    handlePalletUpdate,
    addMeasurementEntry,
    removeMeasurementEntry,
    resetMeasurement,
    openScannerForEntry,
  } = useFinalMeasurements({ initialData, onSave });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            Final Measurements
          </h3>
          {initialData && (
            <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-800">Recorded Measurements</p>
              <div className="mt-2 space-y-1">
                {initialData.dimensions && (
                  <p>
                    Dimensions: {initialData.dimensions.length ?? '—'} × {initialData.dimensions.width ?? '—'} × {initialData.dimensions.height ?? '—'} {initialData.dimensions.units ?? 'in'}
                  </p>
                )}
                {initialData.weight && (
                  <p>Weight: {initialData.weight.value ?? '—'} {initialData.weight.units ?? 'lbs'}</p>
                )}
                {(initialData.measuredBy || initialData.measuredAt) && (
                  <p className="text-xs text-slate-500">
                    Recorded by {initialData.measuredBy || 'Unknown'}
                    {initialData.measuredAt ? ` on ${new Date(initialData.measuredAt).toLocaleString()}` : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          <MeasurementModeTabs
            mode={mode}
            onChange={setMode}
          >
            {{
              single: (
                <div className="space-y-6">
                  {entries.map((entry, index) => {
                    const canRemove = entries.length > 1;
                    return (
                      <div key={entry.id} className="space-y-4 rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-base font-semibold text-slate-800">
                            Pallet {index + 1}
                          </h4>
                        </div>
                        <MeasurementForm
                          entry={entry}
                          title={`Pallet ${index + 1}`}
                          onUpdate={(field, value) => updateMeasurement(entry.id, field, value)}
                        />

                        <MeasurementActions
                          containerCode={entry.containerCode}
                          autoSaveState={autoSaveState}
                          lastSaved={lastSaved}
                          validationError={validationError}
                          saveError={saveError}
                          onOpenScanner={() => openScannerForEntry(entry.id)}
                          onReset={() => resetMeasurement(entry.id)}
                          onRemove={canRemove ? () => removeMeasurementEntry(entry.id) : undefined}
                          disableRemove={!canRemove}
                        />
                      </div>
                    );
                  })}

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addMeasurementEntry}
                      className="flex items-center gap-2"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Another Pallet
                    </Button>
                  </div>
                </div>
              ),
              pallets: (
                <div className="space-y-6">
                  <PalletArrangementBuilder
                    orderItems={orderItems}
                    existingPallets={palletData}
                    onUpdate={handlePalletUpdate}
                  />
                  <MeasurementActions
                    containerCode={null}
                    autoSaveState={autoSaveState}
                    lastSaved={lastSaved}
                    validationError={validationError}
                    saveError={saveError}
                    onOpenScanner={() => {}}
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

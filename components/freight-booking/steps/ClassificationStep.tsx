'use client';

import { useState } from 'react';
import StatusLight from '@/components/ui/StatusLight';
import HazmatCallout from '@/components/ui/HazmatCallout';
import { HazmatRAGPanel, type RAGSuggestion } from '@/components/freight-booking/HazmatRAGPanel';
import type { ShipStationOrder, ClassifiedItem, ManualClassificationInput, FreightBookingData } from '@/types/freight-booking';
import { linkProductToFreight } from '@/app/actions/freight';
import type { LinkProductToFreightSuccess } from '@/app/actions/freight';

const normalizeOptionalString = (value: string | null | undefined): string | undefined =>
  value == null || value === '' ? undefined : value;

interface WarehouseFeedback {
  success: () => void;
  warning: () => void;
  error: () => void;
  buttonPress: () => void;
}

interface ClassificationStepProps {
  selectedOrder: ShipStationOrder;
  classifiedItems: ClassifiedItem[];
  manualInputs: Record<string, ManualClassificationInput>;
  setManualInputs: (updater: (prev: Record<string, ManualClassificationInput>) => Record<string, ManualClassificationInput>) => void;
  setBookingData: (updater: (prev: FreightBookingData) => FreightBookingData) => void;
  onComplete: () => void;
  onBack: () => void;
  warehouseFeedback: WarehouseFeedback;
}

export default function ClassificationStep({
  selectedOrder,
  classifiedItems,
  manualInputs,
  setManualInputs,
  setBookingData,
  onComplete,
  onBack,
  warehouseFeedback
}: ClassificationStepProps) {
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});

  const handleManualSave = async (item: ShipStationOrder['items'][number]) => {
    const inputs = manualInputs[item.sku] || { freightClass: '', nmfcCode: '', nmfcSub: '', description: '' };
    if (!inputs.freightClass) {
      setManualInputs((prev) => ({ ...prev, [item.sku]: { ...inputs, error: 'Freight class is required' } }));
      warehouseFeedback.warning();
      return;
    }

    try {
      setSavingStates(prev => ({ ...prev, [item.sku]: true }));
      setManualInputs((prev) => ({ ...prev, [item.sku]: { ...inputs, saving: true, error: null } }));

      const data = await linkProductToFreight({
        sku: item.sku,
        freightClass: inputs.freightClass,
        nmfcCode: inputs.nmfcCode || undefined,
        nmfcSub: inputs.nmfcSub || undefined,
        description: inputs.description || undefined,
        approve: true,
        hazmatData: inputs.hazmatData || undefined,
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to save classification');
      }

      const successData: LinkProductToFreightSuccess = data;
      const manualHazmat = inputs.hazmatData;

      // Update local state
      setBookingData((prev) => ({
        ...prev,
        classifiedItems: prev.classifiedItems.map((ci) => {
          if (ci.sku !== item.sku) return ci;

          return {
            ...ci,
            classification: {
              nmfcCode: successData.classification.nmfcCode,
              nmfcSub: successData.classification.nmfcSub,
              freightClass: successData.classification.freightClass,
              description:
                successData.classification.description
                ?? normalizeOptionalString(inputs.description),
              isHazmat: successData.classification.isHazmat || manualHazmat?.isHazmat || false,
              hazmatClass:
                successData.classification.hazmatClass
                ?? normalizeOptionalString(manualHazmat?.hazardClass),
              unNumber:
                successData.classification.unNumber
                ?? normalizeOptionalString(manualHazmat?.unNumber),
              packingGroup:
                successData.classification.packingGroup
                ?? normalizeOptionalString(manualHazmat?.packingGroup),
              properShippingName:
                successData.classification.properShippingName
                ?? normalizeOptionalString(manualHazmat?.properShippingName)
                ?? normalizeOptionalString(inputs.description),
            }
          };
        })
      }));

      warehouseFeedback.success();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Save failed';
      setManualInputs((prev) => ({ ...prev, [item.sku]: { ...inputs, saving: false, error: errorMessage } }));
      warehouseFeedback.error();
    } finally {
      setSavingStates(prev => ({ ...prev, [item.sku]: false }));
      setManualInputs((prev) => ({ ...prev, [item.sku]: { ...prev[item.sku], saving: false } }));
    }
  };

  const handleRagSuggestionAccepted = async (sku: string, suggestion: RAGSuggestion) => {
    // Auto-save classification from RAG suggestion
    const classificationData = {
      freightClass: suggestion.hazard_class ? '85' : '50',
      nmfcCode: '',
      nmfcSub: '',
      description: suggestion.proper_shipping_name || selectedOrder.items.find(i => i.sku === sku)?.name || '',
      hazmatData: {
        unNumber: suggestion.un_number,
        hazardClass: suggestion.hazard_class,
        packingGroup: suggestion.packing_group,
        properShippingName: suggestion.proper_shipping_name,
        isHazmat: !!suggestion.un_number
      }
    };

    setManualInputs((prev) => ({
      ...prev,
      [sku]: {
        ...classificationData,
        saving: true,
        successMessage: '⏳ Applying classification...'
      }
    }));

    // Auto-save
    try {
      const data = await linkProductToFreight({
        sku: sku,
        freightClass: classificationData.freightClass,
        nmfcCode: classificationData.nmfcCode || undefined,
        nmfcSub: classificationData.nmfcSub || undefined,
        description: classificationData.description || undefined,
        approve: true,
        hazmatData: classificationData.hazmatData
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to save classification');
      }

      const successData: LinkProductToFreightSuccess = data;
      const suggestionHazmat = classificationData.hazmatData;

      // Update local state
      setBookingData((prev) => ({
        ...prev,
        classifiedItems: prev.classifiedItems.map((ci) => {
          if (ci.sku !== sku) return ci;

          return {
            ...ci,
            classification: {
              nmfcCode: successData.classification.nmfcCode,
              nmfcSub: successData.classification.nmfcSub,
              freightClass: successData.classification.freightClass,
              description:
                successData.classification.description
                ?? normalizeOptionalString(classificationData.description),
              isHazmat: successData.classification.isHazmat || suggestionHazmat?.isHazmat || false,
              hazmatClass:
                successData.classification.hazmatClass
                ?? normalizeOptionalString(suggestionHazmat?.hazardClass),
              unNumber:
                successData.classification.unNumber
                ?? normalizeOptionalString(suggestionHazmat?.unNumber),
              packingGroup:
                successData.classification.packingGroup
                ?? normalizeOptionalString(suggestionHazmat?.packingGroup),
              properShippingName:
                successData.classification.properShippingName
                ?? normalizeOptionalString(suggestionHazmat?.properShippingName)
                ?? normalizeOptionalString(classificationData.description),
            }
          };
        })
      }));

      warehouseFeedback.success();
      setManualInputs((prev) => ({
        ...prev,
        [sku]: {
          ...prev[sku],
          saving: false,
          successMessage: '✅ Classification applied and saved!'
        }
      }));

      // Clear success message after 3 seconds
      setTimeout(() => {
        setManualInputs((prev) => ({
          ...prev,
          [sku]: {
            ...prev[sku],
            successMessage: undefined
          }
        }));
      }, 3000);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save classification';
      setManualInputs((prev) => ({
        ...prev,
        [sku]: {
          ...prev[sku],
          saving: false,
          error: errorMessage,
          successMessage: undefined
        }
      }));
      warehouseFeedback.error();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-warehouse-2xl font-black text-gray-900 uppercase mb-4">⚡ Classification Status</h2>
        
        <div className="grid gap-4">
          {selectedOrder.items.map((item) => {
            const classification = classifiedItems.find(c => c.sku === item.sku);
            const hasClassification = classification?.classification;
            const manualHazmat = manualInputs[item.sku]?.hazmatData;
            
            return (
              <div key={item.sku} className="border-2 border-gray-300 rounded-warehouse p-6 shadow-warehouse">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <h3 className="text-warehouse-xl font-black text-gray-900 uppercase">{item.name}</h3>
                    <p className="text-warehouse-lg text-gray-600 mt-1">
                      SKU: <span className="font-mono font-bold">{item.sku}</span> • 
                      QTY: <span className="font-black">{item.quantity}</span>
                    </p>
                  </div>
                  <div className="ml-4">
                    {hasClassification ? (
                      <div className="text-center">
                        <div className="inline-flex items-center px-6 py-3 rounded-warehouse text-warehouse-lg font-black bg-warehouse-go text-white shadow-warehouse">
                          ✅ CLASSIFIED
                        </div>
                        <p className="text-warehouse-lg font-bold text-gray-700 mt-2">
                          CLASS {classification.classification?.freightClass}
                        </p>
                        {classification.classification?.isHazmat && (
                          <div className="mt-2">
                            <StatusLight status="caution" size="base" label="HAZMAT" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 max-w-2xl">
                        <div className="font-bold text-gray-800 mb-4 text-base">
                          Manual Classification
                          {manualHazmat?.isHazmat && (
                            <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                              ⚠️ HAZMAT DATA LOADED
                            </span>
                          )}
                        </div>
                        
                        {manualHazmat?.unNumber && (
                          <HazmatCallout
                            level="warning"
                            unNumber={normalizeOptionalString(manualHazmat?.unNumber)}
                            hazardClass={normalizeOptionalString(manualHazmat?.hazardClass)}
                            packingGroup={normalizeOptionalString(manualHazmat?.packingGroup)}
                            properShippingName={normalizeOptionalString(manualHazmat?.properShippingName)}
                            className="mb-4"
                          >
                            This product requires special handling and documentation
                          </HazmatCallout>
                        )}
                        
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Freight Class</label>
                            <input
                              type="text"
                              value={manualInputs[item.sku]?.freightClass ?? ''}
                              onChange={(e) => setManualInputs((prev) => ({
                                ...prev,
                                [item.sku]: {
                                  ...prev[item.sku],
                                  freightClass: e.target.value,
                                  nmfcCode: prev[item.sku]?.nmfcCode ?? '',
                                  nmfcSub: prev[item.sku]?.nmfcSub ?? '',
                                  description: prev[item.sku]?.description ?? '',
                                }
                              }))}
                              placeholder="e.g. 85"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">NMFC Code</label>
                            <input
                              type="text"
                              value={manualInputs[item.sku]?.nmfcCode ?? ''}
                              onChange={(e) => setManualInputs((prev) => ({
                                ...prev,
                                [item.sku]: {
                                  ...prev[item.sku],
                                  freightClass: prev[item.sku]?.freightClass ?? '',
                                  nmfcCode: e.target.value,
                                  nmfcSub: prev[item.sku]?.nmfcSub ?? '',
                                  description: prev[item.sku]?.description ?? '',
                                }
                              }))}
                              placeholder="e.g. 12345"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">NMFC Sub</label>
                            <input
                              type="text"
                              value={manualInputs[item.sku]?.nmfcSub ?? ''}
                              onChange={(e) => setManualInputs((prev) => ({
                                ...prev,
                                [item.sku]: {
                                  ...prev[item.sku],
                                  freightClass: prev[item.sku]?.freightClass ?? '',
                                  nmfcCode: prev[item.sku]?.nmfcCode ?? '',
                                  nmfcSub: e.target.value,
                                  description: prev[item.sku]?.description ?? '',
                                }
                              }))}
                              placeholder="e.g. 03"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description / Proper Shipping Name</label>
                          <input
                            type="text"
                            value={manualInputs[item.sku]?.description ?? ''}
                            onChange={(e) => setManualInputs((prev) => ({
                              ...prev,
                              [item.sku]: {
                                ...prev[item.sku],
                                description: e.target.value,
                              }
                            }))}
                            placeholder="Enter proper shipping name or description"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        
                        {manualInputs[item.sku]?.successMessage && (
                          <div className="text-green-600 text-xs mb-2 font-bold animate-pulse">
                            {manualInputs[item.sku]?.successMessage}
                          </div>
                        )}
                        {manualInputs[item.sku]?.error && (
                          <div className="text-red-600 text-xs mb-2">{manualInputs[item.sku]?.error}</div>
                        )}
                        
                        <button
                          onClick={() => handleManualSave(item)}
                          disabled={savingStates[item.sku]}
                          className="w-full px-4 py-3 bg-warehouse-caution text-white rounded-warehouse text-warehouse-lg font-black hover:bg-amber-600 transition-colors shadow-warehouse border-b-4 border-amber-700 active:scale-95"
                        >
                          {savingStates[item.sku] ? 'SAVING…' : 'SAVE & LINK'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* RAG Panel for Auto-Classification */}
        {classifiedItems.some(item => !item.classification) && (
          <HazmatRAGPanel
            unclassifiedSKUs={classifiedItems
              .filter(item => !item.classification)
              .map(item => item.sku)
            }
            items={selectedOrder.items}
            onSuggestionAccepted={handleRagSuggestionAccepted}
          />
        )}
        
        <div className="mt-6 flex justify-between gap-4">
          <button
            onClick={() => {
              warehouseFeedback.buttonPress();
              onBack();
            }}
            className="flex-1 px-8 py-6 bg-warehouse-neutral text-white rounded-warehouse text-warehouse-xl font-black hover:bg-gray-600 transition-colors shadow-warehouse border-b-4 border-gray-700 active:scale-95"
            style={{ minHeight: '80px' }}
          >
            ← BACK
          </button>
          <button
            onClick={() => {
              if (!classifiedItems.some(item => !item.classification)) {
                warehouseFeedback.success();
                onComplete();
              } else {
                warehouseFeedback.warning();
              }
            }}
            disabled={classifiedItems.some(item => !item.classification)}
            className="flex-1 px-8 py-6 bg-warehouse-go text-white rounded-warehouse text-warehouse-xl font-black hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-warehouse border-b-4 border-green-800 disabled:border-gray-500 active:scale-95"
            style={{ minHeight: '80px' }}
          >
            CONTINUE →
          </button>
        </div>
      </div>
    </div>
  );
}

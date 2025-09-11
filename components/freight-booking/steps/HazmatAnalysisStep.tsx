'use client';

import { CheckCircleIcon } from '@heroicons/react/24/solid';
import type { ShipStationOrder, HazmatOverride, NmfcOverride, NmfcSuggestion, ValidationErrors } from '@/types/freight-booking';

interface HazmatAnalysisStepProps {
  selectedOrder: ShipStationOrder;
  hazmatBySku: Record<string, HazmatOverride>;
  hazErrorsBySku: Record<string, ValidationErrors>;
  nmfcBySku: Record<string, NmfcOverride>;
  nmfcSuggestionBySku: Record<string, NmfcSuggestion>;
  updateHazmatForSku: (sku: string, patch: Partial<HazmatOverride>) => void;
  updateNmfcForSku: (sku: string, patch: Partial<NmfcOverride>) => void;
  suggestNmfcForSku: (sku: string, isHaz: boolean, packingGroup?: string | null, unitWeightLbs?: number, qty?: number) => void;
  onContinue: () => void;
  warehouseFeedback: any;
}

export default function HazmatAnalysisStep({
  selectedOrder,
  hazmatBySku,
  hazErrorsBySku,
  nmfcBySku,
  nmfcSuggestionBySku,
  updateHazmatForSku,
  updateNmfcForSku,
  suggestNmfcForSku,
  onContinue,
  warehouseFeedback
}: HazmatAnalysisStepProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Per-line Hazmat Overrides */}
      <div>
        <h3 className="text-warehouse-xl font-black text-gray-900 uppercase mb-3">Per-SKU Hazmat & NMFC</h3>
        <div className="space-y-4">
          {selectedOrder.items.map((item) => {
            const v = hazmatBySku[item.sku] || {};
            const err = hazErrorsBySku[item.sku] || {};
            const n = nmfcBySku[item.sku] || {};
            const suggest = nmfcSuggestionBySku[item.sku];
            
            return (
              <div key={item.sku} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-gray-900">{item.name}</div>
                    <div className="text-sm text-gray-600">SKU: <span className="font-mono">{item.sku}</span></div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={Boolean(v.persist)}
                      onChange={(e) => updateHazmatForSku(item.sku, { persist: e.target.checked })}
                    />
                    <span>Save as override</span>
                  </label>
                </div>

                <div className="grid md:grid-cols-5 gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={Boolean(v.isHazmat)}
                      onChange={(e) => updateHazmatForSku(item.sku, { isHazmat: e.target.checked })}
                    />
                    Hazmat
                  </label>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">UN Number</div>
                    <input
                      type="text"
                      value={v.unNumber ?? ''}
                      onChange={(e) => updateHazmatForSku(item.sku, { unNumber: e.target.value })}
                      placeholder="e.g. 1993"
                      className={`w-full p-2 border rounded-md ${err.unNumber ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {err.unNumber && <div className="text-xs text-red-600 mt-1">{err.unNumber}</div>}
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Hazard Class</div>
                    <input
                      type="text"
                      value={v.hazardClass ?? ''}
                      onChange={(e) => updateHazmatForSku(item.sku, { hazardClass: e.target.value })}
                      placeholder="e.g. 3"
                      className={`w-full p-2 border rounded-md ${err.hazardClass ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {err.hazardClass && <div className="text-xs text-red-600 mt-1">{err.hazardClass}</div>}
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Packing Group</div>
                    <input
                      type="text"
                      value={v.packingGroup ?? ''}
                      onChange={(e) => updateHazmatForSku(item.sku, { packingGroup: e.target.value })}
                      placeholder="I / II / III"
                      className={`w-full p-2 border rounded-md ${err.packingGroup ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {err.packingGroup && <div className="text-xs text-red-600 mt-1">{err.packingGroup}</div>}
                  </div>
                  <div className="md:col-span-5">
                    <div className="text-xs text-gray-600 mb-1">Proper Shipping Name</div>
                    <input
                      type="text"
                      value={v.properShippingName ?? ''}
                      onChange={(e) => updateHazmatForSku(item.sku, { properShippingName: e.target.value })}
                      placeholder="e.g. Flammable liquids, n.o.s."
                      className={`w-full p-2 border rounded-md ${err.properShippingName ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {err.properShippingName && <div className="text-xs text-red-600 mt-1">{err.properShippingName}</div>}
                  </div>
                </div>

                {/* NMFC inputs and density/PG suggestions */}
                <div className="mt-4 border-t pt-4">
                  <div className="grid md:grid-cols-5 gap-3 items-end">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">NMFC Code</div>
                      <input
                        type="text"
                        value={n.nmfcCode || ''}
                        onChange={(e) => {
                          updateNmfcForSku(item.sku, { nmfcCode: e.target.value });
                          suggestNmfcForSku(item.sku, Boolean(v.isHazmat), v.packingGroup, item.weight?.value, item.quantity);
                        }}
                        placeholder="e.g. 43940"
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">NMFC Sub</div>
                      <input
                        type="text"
                        value={n.nmfcSub || ''}
                        onChange={(e) => updateNmfcForSku(item.sku, { nmfcSub: e.target.value })}
                        placeholder="e.g. 3"
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Freight Class</div>
                      <input
                        type="text"
                        value={n.freightClass || ''}
                        onChange={(e) => updateNmfcForSku(item.sku, { freightClass: e.target.value })}
                        placeholder="e.g. 70"
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    {/* Dimensions for density suggestion */}
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Length (in)</div>
                      <input
                        type="number"
                        value={n.lengthIn || ''}
                        onChange={(e) => updateNmfcForSku(item.sku, { lengthIn: Number(e.target.value) })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Width (in)</div>
                      <input
                        type="number"
                        value={n.widthIn || ''}
                        onChange={(e) => updateNmfcForSku(item.sku, { widthIn: Number(e.target.value) })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Height (in)</div>
                      <input
                        type="number"
                        value={n.heightIn || ''}
                        onChange={(e) => updateNmfcForSku(item.sku, { heightIn: Number(e.target.value) })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="md:col-span-5 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => suggestNmfcForSku(item.sku, Boolean(v.isHazmat), v.packingGroup, item.weight?.value, item.quantity)}
                        className="px-4 py-2 bg-gray-200 rounded-md text-sm font-medium hover:bg-gray-300"
                      >
                        Suggest NMFC
                      </button>
                      {suggest?.label && (
                        <div className="flex items-center gap-3">
                          <span className={`text-sm ${suggest.error ? 'text-red-600' : suggest.loading ? 'text-blue-600' : 'text-gray-700'}`}>
                            {suggest.label}
                          </span>
                          {suggest.confidence && !suggest.error && !suggest.loading && (
                            <span className="text-xs text-gray-500">
                              {(suggest.confidence * 100).toFixed(0)}% confidence
                            </span>
                          )}
                          {suggest.source && !suggest.error && !suggest.loading && (
                            <span className="text-xs text-blue-600">
                              ({suggest.source.replace('-', ' ')})
                            </span>
                          )}
                          {!suggest.error && !suggest.loading && suggest.nmfcCode && (
                            <button
                              type="button"
                              onClick={() => updateNmfcForSku(item.sku, { 
                                nmfcCode: suggest.nmfcCode, 
                                nmfcSub: suggest.nmfcSub, 
                                freightClass: suggest.freightClass 
                              })}
                              className="px-3 py-1 bg-warehouse-go text-white rounded-md text-xs font-bold hover:bg-green-700"
                            >
                              Apply
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ready for booking notice */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
          <span className="text-green-800 font-medium">Ready for freight booking</span>
        </div>
        <p className="text-green-700 text-sm mt-1">
          All items classified. Use your TMS system to book freight with appropriate carriers.
        </p>
      </div>

      {/* Continue button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            warehouseFeedback.success();
            onContinue();
          }}
          className="px-8 py-6 bg-warehouse-go text-white rounded-warehouse text-warehouse-xl font-black hover:bg-green-700 transition-colors shadow-warehouse border-b-4 border-green-800 active:scale-95"
          style={{ minHeight: '80px' }}
        >
          CONTINUE TO CONFIRMATION →
        </button>
      </div>
    </div>
  );
}
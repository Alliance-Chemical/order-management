'use client';

import { CubeIcon, ScaleIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/solid';

interface Pallet {
  id: string;
  type: '48x48' | '48x40' | 'custom';
  dimensions: {
    length: number;
    width: number;
    height: number;
    units: 'in' | 'cm';
  };
  weight: {
    value: number;
    units: 'lbs' | 'kg';
  };
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
  }>;
  stackable: boolean;
  notes?: string;
}

interface PalletSummaryDisplayProps {
  pallets: Pallet[];
  className?: string;
}

export default function PalletSummaryDisplay({ pallets, className = '' }: PalletSummaryDisplayProps) {
  const totalWeight = pallets.reduce((sum, p) => sum + p.weight.value, 0);
  const totalItems = pallets.reduce((sum, p) => 
    sum + p.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
  );

  return (
    <div className={`bg-white rounded-lg border-2 border-gray-300 p-6 ${className}`}>
      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
        <CubeIcon className="h-6 w-6 mr-2 text-blue-600" />
        Pallet Configuration from Warehouse
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-blue-600">{pallets.length}</div>
          <div className="text-sm text-gray-600 uppercase">Pallets</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-green-600">{totalWeight.toFixed(0)}</div>
          <div className="text-sm text-gray-600 uppercase">Total LBS</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-purple-600">{totalItems}</div>
          <div className="text-sm text-gray-600 uppercase">Total Items</div>
        </div>
      </div>

      {/* Pallet Details */}
      <div className="space-y-4">
        {pallets.map((pallet, index) => (
          <div key={pallet.id} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-bold text-lg text-gray-800">
                  Pallet #{index + 1} - {pallet.type}
                </h4>
                <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                  <span className="flex items-center">
                    <ArrowsPointingOutIcon className="h-4 w-4 mr-1" />
                    {pallet.dimensions.length} × {pallet.dimensions.width} × {pallet.dimensions.height} {pallet.dimensions.units}
                  </span>
                  <span className="flex items-center">
                    <ScaleIcon className="h-4 w-4 mr-1" />
                    {pallet.weight.value} {pallet.weight.units}
                  </span>
                </div>
              </div>
              {pallet.stackable && (
                <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">
                  STACKABLE
                </span>
              )}
            </div>

            {/* Items on Pallet */}
            <div className="bg-white rounded p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Contents</div>
              <div className="space-y-1">
                {pallet.items.map((item) => (
                  <div key={item.sku} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.name}</span>
                    <span className="font-medium text-gray-900">
                      Qty: {item.quantity} | SKU: {item.sku}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {pallet.notes && (
              <div className="mt-3 text-sm text-gray-600 italic">
                Note: {pallet.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Freight Class Calculation Hint */}
      <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-yellow-800">
              Freight Class Calculation
            </h4>
            <div className="mt-1 text-sm text-yellow-700">
              Based on pallet dimensions and weight, the system will calculate density for accurate freight classification.
              Density = Weight ÷ (L × W × H ÷ 1728) for dimensions in inches.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
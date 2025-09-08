'use client';

import { useState, useEffect } from 'react';
import { 
  CubeIcon, 
  ScaleIcon, 
  PlusIcon, 
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowsPointingOutIcon
} from '@heroicons/react/24/solid';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import WarehouseButton from '@/components/ui/WarehouseButton';
import StatusLight from '@/components/ui/StatusLight';

interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  weight?: { value: number; units: string };
  dimensions?: { length: number; width: number; height: number; units: string };
}

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
    position?: { x: number; y: number; z: number };
  }>;
  stackable: boolean;
  notes?: string;
}

interface PalletArrangementBuilderProps {
  orderId: string;
  orderItems: OrderItem[];
  existingPallets?: Pallet[];
  onSave: (pallets: Pallet[]) => Promise<void>;
  readOnly?: boolean;
}

const STANDARD_PALLETS = {
  '48x48': { length: 48, width: 48, maxHeight: 72 },
  '48x40': { length: 48, width: 40, maxHeight: 72 },
  'custom': { length: 0, width: 0, maxHeight: 96 }
};

const MAX_PALLET_WEIGHT_LBS = 4000; // Standard pallet weight limit

export default function PalletArrangementBuilder({
  orderId,
  orderItems,
  existingPallets = [],
  onSave,
  readOnly = false
}: PalletArrangementBuilderProps) {
  const [pallets, setPallets] = useState<Pallet[]>(existingPallets.length > 0 ? existingPallets : []);
  const [unassignedItems, setUnassignedItems] = useState<OrderItem[]>([]);
  const [selectedPallet, setSelectedPallet] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<OrderItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDimensionInput, setShowDimensionInput] = useState<string | null>(null);

  // Initialize unassigned items
  useEffect(() => {
    if (pallets.length === 0) {
      setUnassignedItems(orderItems);
    } else {
      // Calculate remaining unassigned items
      const assignedSkus = new Map<string, number>();
      pallets.forEach(pallet => {
        pallet.items.forEach(item => {
          const current = assignedSkus.get(item.sku) || 0;
          assignedSkus.set(item.sku, current + item.quantity);
        });
      });

      const remaining = orderItems.map(item => {
        const assigned = assignedSkus.get(item.sku) || 0;
        const remainingQty = item.quantity - assigned;
        return remainingQty > 0 ? { ...item, quantity: remainingQty } : null;
      }).filter(Boolean) as OrderItem[];

      setUnassignedItems(remaining);
    }
  }, [pallets, orderItems]);

  const createNewPallet = (type: '48x48' | '48x40' | 'custom' = '48x48') => {
    warehouseFeedback.success();
    const standardDims = STANDARD_PALLETS[type];
    const newPallet: Pallet = {
      id: `pallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      dimensions: {
        length: standardDims.length,
        width: standardDims.width,
        height: 0, // Will be calculated based on items
        units: 'in'
      },
      weight: {
        value: 0,
        units: 'lbs'
      },
      items: [],
      stackable: true
    };
    setPallets([...pallets, newPallet]);
    setSelectedPallet(newPallet.id);
  };

  const deletePallet = (palletId: string) => {
    warehouseFeedback.warning();
    const pallet = pallets.find(p => p.id === palletId);
    if (pallet && pallet.items.length > 0) {
      // Return items to unassigned
      const itemsToReturn = pallet.items.map(item => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        weight: orderItems.find(oi => oi.sku === item.sku)?.weight,
        dimensions: orderItems.find(oi => oi.sku === item.sku)?.dimensions
      }));
      setUnassignedItems([...unassignedItems, ...itemsToReturn]);
    }
    setPallets(pallets.filter(p => p.id !== palletId));
    if (selectedPallet === palletId) {
      setSelectedPallet(null);
    }
  };

  const handleItemDrop = (palletId: string, item: OrderItem, quantity?: number) => {
    warehouseFeedback.success();
    const pallet = pallets.find(p => p.id === palletId);
    if (!pallet) return;

    const qtyToAdd = quantity || item.quantity;
    
    // Check weight limit
    const itemWeight = (item.weight?.value || 0) * qtyToAdd;
    const newTotalWeight = pallet.weight.value + itemWeight;
    
    if (newTotalWeight > MAX_PALLET_WEIGHT_LBS) {
      warehouseFeedback.error();
      alert(`Adding this item would exceed the ${MAX_PALLET_WEIGHT_LBS} lbs pallet weight limit`);
      return;
    }

    // Add item to pallet
    const existingItem = pallet.items.find(i => i.sku === item.sku);
    if (existingItem) {
      existingItem.quantity += qtyToAdd;
    } else {
      pallet.items.push({
        sku: item.sku,
        name: item.name,
        quantity: qtyToAdd
      });
    }

    // Update pallet weight and dimensions
    pallet.weight.value = newTotalWeight;
    
    // Estimate height based on items (simplified calculation)
    const estimatedHeight = Math.min(
      pallet.items.length * 12, // Rough estimate: 12 inches per layer
      STANDARD_PALLETS[pallet.type].maxHeight
    );
    pallet.dimensions.height = estimatedHeight;

    // Remove from unassigned
    const remainingQty = item.quantity - qtyToAdd;
    if (remainingQty > 0) {
      setUnassignedItems(unassignedItems.map(ui => 
        ui.sku === item.sku ? { ...ui, quantity: remainingQty } : ui
      ));
    } else {
      setUnassignedItems(unassignedItems.filter(ui => ui.sku !== item.sku));
    }

    setPallets([...pallets]);
  };

  const removeItemFromPallet = (palletId: string, itemSku: string) => {
    warehouseFeedback.warning();
    const pallet = pallets.find(p => p.id === palletId);
    if (!pallet) return;

    const item = pallet.items.find(i => i.sku === itemSku);
    if (!item) return;

    // Return to unassigned
    const orderItem = orderItems.find(oi => oi.sku === itemSku);
    if (orderItem) {
      const existing = unassignedItems.find(ui => ui.sku === itemSku);
      if (existing) {
        existing.quantity += item.quantity;
        setUnassignedItems([...unassignedItems]);
      } else {
        setUnassignedItems([...unassignedItems, { ...orderItem, quantity: item.quantity }]);
      }
    }

    // Remove from pallet
    pallet.items = pallet.items.filter(i => i.sku !== itemSku);
    
    // Recalculate weight
    pallet.weight.value = pallet.items.reduce((sum, i) => {
      const oi = orderItems.find(o => o.sku === i.sku);
      return sum + ((oi?.weight?.value || 0) * i.quantity);
    }, 0);

    setPallets([...pallets]);
  };

  const updatePalletDimensions = (palletId: string, dims: Partial<Pallet['dimensions']>) => {
    setPallets(pallets.map(p => 
      p.id === palletId 
        ? { ...p, dimensions: { ...p.dimensions, ...dims } }
        : p
    ));
    setShowDimensionInput(null);
  };

  const handleSave = async () => {
    setSaving(true);
    warehouseFeedback.success();
    
    try {
      await onSave(pallets);
    } catch (error) {
      console.error('Error saving pallet arrangement:', error);
      warehouseFeedback.error();
    } finally {
      setSaving(false);
    }
  };

  const getTotalWeight = () => {
    return pallets.reduce((sum, p) => sum + p.weight.value, 0);
  };

  const getWeightWarning = (weight: number) => {
    if (weight > MAX_PALLET_WEIGHT_LBS) return 'danger';
    if (weight > MAX_PALLET_WEIGHT_LBS * 0.8) return 'warning';
    return 'success';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border-2 border-gray-300 p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-warehouse-2xl font-black text-gray-900 flex items-center">
          <CubeIcon className="h-10 w-10 mr-3 text-blue-600" />
          PALLET ARRANGEMENT
        </h3>
        <p className="text-lg text-gray-600 mt-2">
          Drag items to pallets or use buttons to arrange
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unassigned Items Panel */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-300">
            <h4 className="text-xl font-bold text-gray-800 mb-4 uppercase">
              Items to Pack
            </h4>
            
            {unassignedItems.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-gray-600">All items assigned!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unassignedItems.map((item) => (
                  <div
                    key={item.sku}
                    className="bg-white p-4 rounded-lg border-2 border-blue-300 cursor-move hover:shadow-lg transition-shadow"
                    draggable={!readOnly}
                    onDragStart={() => setDraggedItem(item)}
                    onDragEnd={() => setDraggedItem(null)}
                  >
                    <div className="font-bold text-lg">{item.name}</div>
                    <div className="text-sm text-gray-600">SKU: {item.sku}</div>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-2xl font-bold text-blue-600">
                        QTY: {item.quantity}
                      </span>
                      {item.weight && (
                        <span className="text-sm text-gray-500">
                          {item.weight.value * item.quantity} {item.weight.units}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pallets Grid */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex justify-between items-center">
            <h4 className="text-xl font-bold text-gray-800 uppercase">
              Pallets ({pallets.length})
            </h4>
            {!readOnly && (
              <div className="flex gap-2">
                <WarehouseButton
                  variant="go"
                  size="medium"
                  onClick={() => createNewPallet('48x48')}
                  icon={<PlusIcon className="h-6 w-6" />}
                >
                  48×48
                </WarehouseButton>
                <WarehouseButton
                  variant="go"
                  size="medium"
                  onClick={() => createNewPallet('48x40')}
                  icon={<PlusIcon className="h-6 w-6" />}
                >
                  48×40
                </WarehouseButton>
              </div>
            )}
          </div>

          {pallets.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-12 border-2 border-dashed border-gray-400 text-center">
              <CubeIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-xl text-gray-600 mb-4">No pallets created yet</p>
              {!readOnly && (
                <p className="text-lg text-gray-500">
                  Click a button above to add a pallet
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pallets.map((pallet) => (
                <div
                  key={pallet.id}
                  className={`bg-white rounded-lg border-4 ${
                    selectedPallet === pallet.id ? 'border-blue-500' : 'border-gray-300'
                  } p-4 cursor-pointer transition-all hover:shadow-xl`}
                  onClick={() => setSelectedPallet(pallet.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedItem && !readOnly) {
                      handleItemDrop(pallet.id, draggedItem);
                    }
                  }}
                >
                  {/* Pallet Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h5 className="text-lg font-bold text-gray-800">
                        {pallet.type === 'custom' ? 'Custom' : pallet.type} Pallet
                      </h5>
                      <div className="text-sm text-gray-600 mt-1">
                        {pallet.dimensions.length} × {pallet.dimensions.width} × {pallet.dimensions.height || '?'} {pallet.dimensions.units}
                      </div>
                    </div>
                    {!readOnly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePallet(pallet.id);
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <TrashIcon className="h-6 w-6" />
                      </button>
                    )}
                  </div>

                  {/* Weight Status */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-600">Weight</span>
                      <StatusLight status={getWeightWarning(pallet.weight.value)} />
                    </div>
                    <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          getWeightWarning(pallet.weight.value) === 'danger' ? 'bg-red-500' :
                          getWeightWarning(pallet.weight.value) === 'warning' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min((pallet.weight.value / MAX_PALLET_WEIGHT_LBS) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {pallet.weight.value.toFixed(0)} / {MAX_PALLET_WEIGHT_LBS} lbs
                    </div>
                  </div>

                  {/* Items on Pallet */}
                  <div className="space-y-2">
                    {pallet.items.length === 0 ? (
                      <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <p className="text-gray-500">Drop items here</p>
                      </div>
                    ) : (
                      pallet.items.map((item) => (
                        <div
                          key={item.sku}
                          className="bg-blue-50 p-3 rounded-lg border-2 border-blue-200 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-sm text-gray-600">
                              QTY: {item.quantity} | SKU: {item.sku}
                            </div>
                          </div>
                          {!readOnly && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItemFromPallet(pallet.id, item.sku);
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Edit Dimensions Button */}
                  {!readOnly && showDimensionInput === pallet.id && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          placeholder="L"
                          defaultValue={pallet.dimensions.length}
                          onChange={(e) => updatePalletDimensions(pallet.id, { length: Number(e.target.value) })}
                          className="px-2 py-1 border rounded text-center"
                        />
                        <input
                          type="number"
                          placeholder="W"
                          defaultValue={pallet.dimensions.width}
                          onChange={(e) => updatePalletDimensions(pallet.id, { width: Number(e.target.value) })}
                          className="px-2 py-1 border rounded text-center"
                        />
                        <input
                          type="number"
                          placeholder="H"
                          defaultValue={pallet.dimensions.height}
                          onChange={(e) => updatePalletDimensions(pallet.id, { height: Number(e.target.value) })}
                          className="px-2 py-1 border rounded text-center"
                        />
                      </div>
                    </div>
                  )}
                  
                  {!readOnly && showDimensionInput !== pallet.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDimensionInput(pallet.id);
                      }}
                      className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <ArrowsPointingOutIcon className="h-4 w-4 mr-1" />
                      Adjust Dimensions
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary and Actions */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-600 uppercase font-semibold">Summary</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {pallets.length} Pallet{pallets.length !== 1 ? 's' : ''} | {getTotalWeight().toFixed(0)} lbs Total
            </div>
            {unassignedItems.length > 0 && (
              <div className="text-sm text-orange-600 mt-1 flex items-center">
                <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                {unassignedItems.reduce((sum, i) => sum + i.quantity, 0)} items not assigned
              </div>
            )}
          </div>
          
          {!readOnly && (
            <WarehouseButton
              variant={unassignedItems.length === 0 ? "go" : "caution"}
              size="large"
              onClick={handleSave}
              disabled={saving || pallets.length === 0}
              loading={saving}
            >
              {saving ? 'SAVING...' : 'SAVE ARRANGEMENT'}
            </WarehouseButton>
          )}
        </div>
      </div>
    </div>
  );
}
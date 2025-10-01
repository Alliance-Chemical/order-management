'use client';

import PalletSummaryDisplay from '@/components/freight-booking/PalletSummaryDisplay';
import type { FreightBookingData } from '@/types/freight-booking';

interface WarehouseFeedback {
  success: () => void;
  warning: () => void;
  error: () => void;
  buttonPress: () => void;
}

interface Pallet {
  id?: string;
  length?: number;
  width?: number;
  height?: number;
  weight?: number;
  [key: string]: unknown;
}

interface ConfirmationStepProps {
  bookingData: FreightBookingData;
  palletData: Pallet[] | null;
  booking: boolean;
  setBookingData: (fn: (prev: FreightBookingData) => FreightBookingData) => void;
  onBack: () => void;
  onConfirm: () => void;
  warehouseFeedback: WarehouseFeedback;
}

export default function ConfirmationStep({
  bookingData,
  palletData,
  booking,
  setBookingData,
  onBack,
  onConfirm,
  warehouseFeedback
}: ConfirmationStepProps) {
  if (!bookingData.selectedOrder) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-warehouse-2xl font-black text-gray-900 uppercase mb-6">🎯 Confirm Booking</h2>
      
      {/* Order Summary */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Order Details</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Order:</span> {bookingData.selectedOrder.orderNumber}</p>
            <p><span className="font-medium">Customer:</span> {bookingData.selectedOrder.billTo.company || bookingData.selectedOrder.billTo.name}</p>
            <p><span className="font-medium">Items:</span> {bookingData.selectedOrder.items.length}</p>
            <p><span className="font-medium">Value:</span> ${bookingData.selectedOrder.orderTotal}</p>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Freight Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
              <select
                value={bookingData.carrierName}
                onChange={(e) => setBookingData(prev => ({ ...prev, carrierName: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="SAIA">SAIA</option>
                <option value="XPO">XPO Logistics</option>
                <option value="FedEx Freight">FedEx Freight</option>
                <option value="YRC">YRC Freight</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
              <select
                value={bookingData.serviceType}
                onChange={(e) => setBookingData(prev => ({ ...prev, serviceType: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Standard LTL">Standard LTL</option>
                <option value="Expedited">Expedited</option>
                <option value="Volume LTL">Volume LTL</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost ($)</label>
              <input
                type="number"
                value={bookingData.estimatedCost}
                onChange={(e) => setBookingData(prev => ({ ...prev, estimatedCost: Number(e.target.value) }))}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter estimated cost"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Pallet Configuration from Warehouse */}
      {palletData && palletData.length > 0 && (
        <div className="mb-8">
          <PalletSummaryDisplay pallets={palletData} />
        </div>
      )}
      
      {/* Special Instructions */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions</label>
        <textarea
          value={bookingData.specialInstructions}
          onChange={(e) => setBookingData(prev => ({ ...prev, specialInstructions: e.target.value }))}
          placeholder="Any special handling requirements..."
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          rows={3}
        />
      </div>
      
      {/* Classification Summary */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Classification Summary</h3>
        <div className="grid gap-3">
          {bookingData.classifiedItems.map((item) => {
            const orderItem = bookingData.selectedOrder!.items.find(i => i.sku === item.sku);
            return (
              <div key={item.sku} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">{orderItem?.name}</span>
                  <span className="text-sm text-gray-500 ml-2">({item.sku})</span>
                </div>
                <div className="text-sm">
                  {item.classification ? (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.classification.isHazmat 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      Class {item.classification.freightClass}
                      {item.classification.isHazmat && ' • HAZMAT'}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Unclassified
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex justify-between gap-4">
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
            if (!booking && bookingData.estimatedCost > 0) {
              warehouseFeedback.buttonPress();
              onConfirm();
            } else if (bookingData.estimatedCost === 0) {
              warehouseFeedback.warning();
            }
          }}
          disabled={booking || bookingData.estimatedCost === 0}
          className="flex-1 bg-warehouse-go text-white py-6 px-8 rounded-warehouse text-warehouse-2xl font-black hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-warehouse border-b-8 border-green-800 disabled:border-gray-500 active:scale-95"
          style={{ minHeight: '100px' }}
        >
          {booking ? '🚛 BOOKING...' : '🚛 BOOK FREIGHT'}
        </button>
      </div>
    </div>
  );
}
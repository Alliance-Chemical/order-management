'use client';

import { useState } from 'react';
import { CheckCircleIcon, TruckIcon, DocumentTextIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import FinalMeasurements from '@/components/workspace/FinalMeasurements';
import PhotoGallery from '@/components/workspace/PhotoGallery';

interface PreShipInspectionProps {
  orderId: string;
  initialState?: any;
  onStateChange: (state: any) => void;
}

const shippingChecklist = [
  { id: 'order_match', label: 'Order Matches Shipment', required: true },
  { id: 'container_clean', label: 'Containers Clean & Free of Debris', required: true },
  { id: 'caps_clean', label: 'Caps Clean & Free of Debris', required: true },
  { id: 'no_leaks', label: 'No Leaks Detected', required: true },
  { id: 'pallet_stable', label: 'Pallet Condition Good & Stable', required: true },
];

export default function PreShipInspection({ orderId, initialState = {}, onStateChange }: PreShipInspectionProps) {
  const [state, setState] = useState({
    checklist: initialState.checklist || {},
    bolNumber: initialState.bolNumber || '',
    carrierName: initialState.carrierName || '',
    trailerNumber: initialState.trailerNumber || '',
    sealNumbers: initialState.sealNumbers || [],
    loadingPhotos: initialState.loadingPhotos || [],
    notes: initialState.notes || '',
    readyToShip: initialState.readyToShip || false,
    shippedAt: initialState.shippedAt || null,
    shippedBy: initialState.shippedBy || null,
    finalMeasurements: initialState.finalMeasurements || null,
  });

  const [newSealNumber, setNewSealNumber] = useState('');

  const handleChecklistChange = (itemId: string, checked: boolean) => {
    const newState = {
      ...state,
      checklist: {
        ...state.checklist,
        [itemId]: checked,
      },
    };
    setState(newState);
    onStateChange(newState);
  };

  const handleAddSealNumber = () => {
    if (newSealNumber.trim()) {
      const newState = {
        ...state,
        sealNumbers: [...state.sealNumbers, newSealNumber.trim()],
      };
      setState(newState);
      onStateChange(newState);
      setNewSealNumber('');
    }
  };

  const handleRemoveSealNumber = (index: number) => {
    const newState = {
      ...state,
      sealNumbers: state.sealNumbers.filter((_: any, i: number) => i !== index),
    };
    setState(newState);
    onStateChange(newState);
  };

  const handlePhotoUpload = async (file: File) => {
    // In a real app, upload to S3 here
    const photoUrl = URL.createObjectURL(file);
    const newState = {
      ...state,
      loadingPhotos: [...state.loadingPhotos, { 
        url: photoUrl, 
        name: file.name, 
        timestamp: new Date().toISOString() 
      }],
    };
    setState(newState);
    onStateChange(newState);
  };

  const handleMeasurementsSave = async (measurements: any) => {
    // Save measurements to workspace via API
    try {
      const response = await fetch(`/api/workspace/${orderId}/measurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(measurements),
      });
      
      if (response.ok) {
        const newState = { ...state, finalMeasurements: measurements };
        setState(newState);
        onStateChange(newState);
      } else {
        throw new Error('Failed to save measurements');
      }
    } catch (error) {
      console.error('Error saving measurements:', error);
      throw error;
    }
  };

  const handleMarkReadyToShip = () => {
    // Check required items
    const requiredItems = shippingChecklist.filter(item => item.required);
    const allRequiredComplete = requiredItems.every(item => state.checklist[item.id]);

    if (!allRequiredComplete) {
      alert('Please complete all required checklist items');
      return;
    }

    if (!state.bolNumber || !state.carrierName) {
      alert('Please enter BOL number and carrier name');
      return;
    }

    const newState = {
      ...state,
      readyToShip: true,
      shippedAt: new Date().toISOString(),
      shippedBy: 'current_user', // Replace with actual user
    };
    setState(newState);
    onStateChange(newState);

    // Update ShipStation and send notifications
    fetch(`/api/workspace/${orderId}/ship`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bolNumber: state.bolNumber,
        carrierName: state.carrierName,
        trailerNumber: state.trailerNumber,
        sealNumbers: state.sealNumbers,
      }),
    });
  };

  const isShipped = state.shippedAt !== null;
  const completedCount = Object.values(state.checklist).filter(Boolean).length;
  const totalCount = shippingChecklist.length;
  const progress = (completedCount / totalCount) * 100;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Shipping Checklist Progress</span>
          <span className="text-sm text-gray-500">{completedCount} of {totalCount}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              progress === 100 ? 'bg-green-600' : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Shipping Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TruckIcon className="w-5 h-5 mr-1.5 shrink-0" />
          Shipping Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              BOL Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={state.bolNumber}
              onChange={(e) => {
                const newState = { ...state, bolNumber: e.target.value };
                setState(newState);
                onStateChange(newState);
              }}
              disabled={isShipped}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              placeholder="Enter BOL number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Carrier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={state.carrierName}
              onChange={(e) => {
                const newState = { ...state, carrierName: e.target.value };
                setState(newState);
                onStateChange(newState);
              }}
              disabled={isShipped}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              placeholder="Enter carrier name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trailer Number
            </label>
            <input
              type="text"
              value={state.trailerNumber}
              onChange={(e) => {
                const newState = { ...state, trailerNumber: e.target.value };
                setState(newState);
                onStateChange(newState);
              }}
              disabled={isShipped}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              placeholder="Enter trailer number"
            />
          </div>
        </div>
      </div>

      {/* Seal Numbers */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Seal Numbers</h3>
        <div className="space-y-3">
          {state.sealNumbers.map((seal: string, index: number) => (
            <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="font-mono text-sm">{seal}</span>
              {!isShipped && (
                <button
                  onClick={() => handleRemoveSealNumber(index)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {!isShipped && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newSealNumber}
                onChange={(e) => setNewSealNumber(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddSealNumber()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter seal number"
              />
              <button
                onClick={handleAddSealNumber}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Shipping Checklist */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Pre-Ship Checklist</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {shippingChecklist.map((item) => (
            <div key={item.id} className="px-6 py-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.checklist[item.id] || false}
                  onChange={(e) => handleChecklistChange(item.id, e.target.checked)}
                  disabled={isShipped}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <div className="ml-3 flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    {item.label}
                    {item.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                </div>
                {state.checklist[item.id] && (
                  <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />
                )}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Final Measurements Section */}
      <FinalMeasurements
        orderId={orderId}
        initialData={state.finalMeasurements}
        onSave={handleMeasurementsSave}
      />

      {/* Inspection Photos */}
      <PhotoGallery orderId={orderId} moduleState={initialState} />

      {/* Notes */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipping Notes</h3>
        <textarea
          value={state.notes}
          onChange={(e) => {
            const newState = { ...state, notes: e.target.value };
            setState(newState);
            onStateChange(newState);
          }}
          disabled={isShipped}
          placeholder="Add any shipping notes or special instructions..."
          className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
        />
      </div>

      {/* Action Buttons */}
      {!isShipped && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleMarkReadyToShip}
            className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center"
          >
            <TruckIcon className="w-5 h-5 mr-1.5 shrink-0" />
            Mark Ready to Ship
          </button>
        </div>
      )}

      {/* Completion Status */}
      {isShipped && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">Order Shipped</p>
              <p className="text-sm text-green-700">
                By {state.shippedBy} on {new Date(state.shippedAt).toLocaleString()}
              </p>
              <p className="text-sm text-green-700 mt-1">
                BOL: {state.bolNumber} | Carrier: {state.carrierName}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
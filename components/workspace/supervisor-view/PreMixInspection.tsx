'use client';

import { useState } from 'react';
import { CheckCircleIcon, XCircleIcon, CameraIcon } from '@heroicons/react/24/outline';

interface PreMixInspectionProps {
  orderId: string;
  initialState?: any;
  onStateChange: (state: any) => void;
}

const inspectionItems = [
  { id: 'container_condition', label: 'Container Condition', description: 'Check for damage, leaks, or contamination' },
  { id: 'label_verification', label: 'Label Verification', description: 'Verify product labels match order' },
  { id: 'quantity_check', label: 'Quantity Check', description: 'Confirm correct quantity of containers' },
  { id: 'scan_destination_qr', label: 'Scan Destination QR', description: 'Scan QR code on each destination container' },
  { id: 'hazmat_placards', label: 'Hazmat Placards', description: 'Verify proper hazmat labeling if required' },
  { id: 'seal_integrity', label: 'Seal Integrity', description: 'Check all seals are intact' },
];

export default function PreMixInspection({ orderId, initialState = {}, onStateChange }: PreMixInspectionProps) {
  const [state, setState] = useState({
    checklist: initialState.checklist || {},
    notes: initialState.notes || '',
    photos: initialState.photos || [],
    completedAt: initialState.completedAt || null,
    completedBy: initialState.completedBy || null,
  });

  const handleChecklistChange = (itemId: string, value: 'pass' | 'fail' | null) => {
    const newState = {
      ...state,
      checklist: {
        ...state.checklist,
        [itemId]: value,
      },
    };
    setState(newState);
    onStateChange(newState);
  };

  const handleNotesChange = (notes: string) => {
    const newState = { ...state, notes };
    setState(newState);
    onStateChange(newState);
  };

  const handlePhotoUpload = async (file: File) => {
    // In a real app, upload to S3 here
    const photoUrl = URL.createObjectURL(file);
    const newState = {
      ...state,
      photos: [...state.photos, { url: photoUrl, name: file.name, timestamp: new Date().toISOString() }],
    };
    setState(newState);
    onStateChange(newState);
  };

  const handleComplete = () => {
    const allItemsChecked = inspectionItems.every(item => state.checklist[item.id] !== undefined);
    
    if (!allItemsChecked) {
      alert('Please complete all inspection items before marking as complete');
      return;
    }

    const hasFailures = Object.values(state.checklist).includes('fail');
    if (hasFailures && !state.notes) {
      alert('Please add notes explaining any failed items');
      return;
    }

    const newState = {
      ...state,
      completedAt: new Date().toISOString(),
      completedBy: 'current_user', // Replace with actual user
    };
    setState(newState);
    onStateChange(newState);

    // Trigger notification
    fetch(`/api/workspace/${orderId}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'pre_mix_complete',
        status: hasFailures ? 'issues_found' : 'passed',
        notes: state.notes,
      }),
    });
  };

  const isComplete = state.completedAt !== null;
  const progress = (Object.keys(state.checklist).length / inspectionItems.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Inspection Progress</span>
          <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Inspection Checklist */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Inspection Checklist</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {inspectionItems.map((item) => (
            <div key={item.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">{item.label}</h4>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleChecklistChange(item.id, 'pass')}
                    disabled={isComplete}
                    className={`p-2 rounded-lg transition-colors ${
                      state.checklist[item.id] === 'pass'
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-500'
                    } ${isComplete ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <CheckCircleIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleChecklistChange(item.id, 'fail')}
                    disabled={isComplete}
                    className={`p-2 rounded-lg transition-colors ${
                      state.checklist[item.id] === 'fail'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500'
                    } ${isComplete ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <XCircleIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Inspection Notes</h3>
        <textarea
          value={state.notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          disabled={isComplete}
          placeholder="Add any notes or observations..."
          className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      {/* Photo Upload */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Photos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {state.photos.map((photo: any, index: number) => (
            <div key={index} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
              <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
            </div>
          ))}
          {!isComplete && (
            <label className="relative aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 cursor-pointer flex items-center justify-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                className="sr-only"
              />
              <div className="text-center">
                <CameraIcon className="mx-auto w-6 h-6 text-gray-400" />
                <span className="mt-2 block text-xs text-gray-500">Add Photo</span>
              </div>
            </label>
          )}
        </div>
      </div>

      {/* Complete Button */}
      {!isComplete && (
        <div className="flex justify-end">
          <button
            onClick={handleComplete}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Complete Inspection
          </button>
        </div>
      )}

      {/* Completion Status */}
      {isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">Inspection Completed</p>
              <p className="text-sm text-green-700">
                By {state.completedBy} on {new Date(state.completedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
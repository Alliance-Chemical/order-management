'use client';

import { useState } from 'react';
import { CheckCircleIcon, CameraIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/hooks/use-toast';
import { notifyWorkspace } from '@/app/actions/workspace';

interface PreMixInspectionProps {
  orderId: string;
  initialState?: Partial<PreMixInspectionState>;
  onStateChange: (state: PreMixInspectionState) => void;
}

interface LidPhoto {
  url: string;
  name: string;
  timestamp: string;
}

type InspectionChecklist = Record<string, boolean>;

interface PreMixInspectionState {
  datePerformed: string;
  invoiceNumber: string;
  inspector: string;
  packingSlip: InspectionChecklist;
  lotNumbers: string;
  productInspection: InspectionChecklist;
  lidPhotos: LidPhoto[];
  notes: string;
  completedAt: string | null;
  completedBy: string | null;
}

const packingSlipItems = [
  { id: 'ship_to_match', label: 'Ship to match' },
  { id: 'ship_via', label: 'Ship Via' },
  { id: 'ship_date', label: 'Ship Date' },
  { id: 'po_number', label: 'P.O. Number' },
  { id: 'signature_label', label: 'Signature Label' },
  { id: 'freight', label: 'Freight' },
];

// COA handling is managed separately via Documents; no COA status in this form.

const productInspectionItems = [
  { id: 'check_label_info', label: 'Check label information (ACS / Tech / UN # / PG)' },
  { id: 'lid_inspection', label: 'Lid (Bleach, Hydrogen Peroxide, Ammonium)' },
  { id: 'ghs_labels', label: 'GHS Labels' },
];

export default function PreMixInspection({ orderId, initialState, onStateChange }: PreMixInspectionProps) {
  const { toast } = useToast();

  const [state, setState] = useState<PreMixInspectionState>({
    datePerformed: initialState?.datePerformed ?? new Date().toISOString().split('T')[0],
    invoiceNumber: initialState?.invoiceNumber ?? '',
    inspector: initialState?.inspector ?? '',
    packingSlip: initialState?.packingSlip ?? {},
    lotNumbers: initialState?.lotNumbers ?? '',
    // COA status removed from supervisor pre-mix form
    productInspection: initialState?.productInspection ?? {},
    lidPhotos: initialState?.lidPhotos ?? [],
    notes: initialState?.notes ?? '',
    completedAt: initialState?.completedAt ?? null,
    completedBy: initialState?.completedBy ?? null,
  });

  const handlePackingSlipChange = (itemId: string, checked: boolean) => {
    const newState = {
      ...state,
      packingSlip: {
        ...state.packingSlip,
        [itemId]: checked,
      },
    };
    setState(newState);
    onStateChange(newState);
  };

  const handleProductInspectionChange = (itemId: string, checked: boolean) => {
    const newState = {
      ...state,
      productInspection: {
        ...state.productInspection,
        [itemId]: checked,
      },
    };
    setState(newState);
    onStateChange(newState);
  };

  const handleFieldChange = (
    field: 'datePerformed' | 'invoiceNumber' | 'inspector' | 'lotNumbers',
    value: string
  ) => {
    const newState = { ...state, [field]: value };
    setState(newState);
    onStateChange(newState);
  };

  const handleNotesChange = (notes: string) => {
    const newState = { ...state, notes };
    setState(newState);
    onStateChange(newState);
  };

  const handleLidPhotoUpload = async (file: File) => {
    // In a real app, upload to S3 here
    const photoUrl = URL.createObjectURL(file);
    const newState = {
      ...state,
      lidPhotos: [...state.lidPhotos, { url: photoUrl, name: file.name, timestamp: new Date().toISOString() }],
    };
    setState(newState);
    onStateChange(newState);
  };

  const handleComplete = async () => {
    // Check required fields
    if (!state.datePerformed) {
      toast({
        title: "Error",
        description: "Please enter the date performed",
        variant: "destructive"
      })
      return;
    }
    
    if (!state.invoiceNumber) {
      toast({
        title: "Error",
        description: "Please enter the invoice number",
        variant: "destructive"
      })
      return;
    }
    
    if (!state.inspector) {
      toast({
        title: "Error",
        description: "Please enter the inspector name",
        variant: "destructive"
      })
      return;
    }
    
    if (!state.lotNumbers) {
      toast({
        title: "Error",
        description: "Please enter the lot numbers",
        variant: "destructive"
      })
      return;
    }
    
    // COA status is no longer collected here
    
    // Check if lid inspection was selected and photos are required
    if (state.productInspection['lid_inspection'] && state.lidPhotos.length === 0) {
      toast({
        title: "Error",
        description: "Please take photos of the lids for verification",
        variant: "destructive"
      })
      return;
    }

    const newState = {
      ...state,
      completedAt: new Date().toISOString(),
      completedBy: 'current_user', // Replace with actual user
    };
    setState(newState);
    onStateChange(newState);

    // Trigger notification using server action
    const hasFailures = false; // You may need to calculate this based on inspection results
    const result = await notifyWorkspace(orderId, {
      type: 'pre_mix_complete',
      status: hasFailures ? 'issues_found' : 'passed',
      notes: state.notes,
    });

    if (!result.success) {
      console.error('Failed to send notification:', result.error);
    }
  };

  const isComplete = state.completedAt !== null;
  const requiredFieldsCount = 4; // datePerformed, invoiceNumber, inspector, lotNumbers
  const completedRequiredFields = [state.datePerformed, state.invoiceNumber, state.inspector, state.lotNumbers].filter(field => field && field.length > 0).length;
  const packingSlipProgress = Object.values(state.packingSlip).filter(Boolean).length / packingSlipItems.length;
  const productInspectionProgress = Object.values(state.productInspection).filter(Boolean).length / productInspectionItems.length;
  const overallProgress = ((completedRequiredFields / requiredFieldsCount) + packingSlipProgress + productInspectionProgress) / 3 * 100;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Inspection Progress</span>
          <span className="text-sm text-gray-500">{Math.round(overallProgress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Basic Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <CalendarIcon className="w-5 h-5 mr-2" />
          Basic Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Performed <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={state.datePerformed}
              onChange={(e) => handleFieldChange('datePerformed', e.target.value)}
              disabled={isComplete}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice # <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={state.invoiceNumber}
              onChange={(e) => handleFieldChange('invoiceNumber', e.target.value)}
              disabled={isComplete}
              placeholder="Enter invoice number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inspector <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={state.inspector}
              onChange={(e) => handleFieldChange('inspector', e.target.value)}
              disabled={isComplete}
              placeholder="Enter inspector name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Packing Slip */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Packing Slip <span className="text-red-500">*</span></h3>
        </div>
        <div className="divide-y divide-gray-200">
          {packingSlipItems.map((item) => (
            <div key={item.id} className="px-6 py-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.packingSlip[item.id] || false}
                  onChange={(e) => handlePackingSlipChange(item.id, e.target.checked)}
                  disabled={isComplete}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <span className="ml-3 text-sm font-medium text-gray-900">{item.label}</span>
                {state.packingSlip[item.id] && (
                  <CheckCircleIcon className="w-5 h-5 text-green-500 ml-auto" />
                )}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Lot Numbers */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lot #'s <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={state.lotNumbers}
              onChange={(e) => handleFieldChange('lotNumbers', e.target.value)}
              disabled={isComplete}
              placeholder="Enter lot numbers"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Inspect Products */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Inspect Products <span className="text-red-500">*</span></h3>
        </div>
        <div className="divide-y divide-gray-200">
          {productInspectionItems.map((item) => (
            <div key={item.id} className="px-6 py-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.productInspection[item.id] || false}
                  onChange={(e) => handleProductInspectionChange(item.id, e.target.checked)}
                  disabled={isComplete}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <span className="ml-3 text-sm font-medium text-gray-900">{item.label}</span>
                {state.productInspection[item.id] && (
                  <CheckCircleIcon className="w-5 h-5 text-green-500 ml-auto" />
                )}
              </label>
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

      {/* Lid Photo Verification */}
      {state.productInspection['lid_inspection'] && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CameraIcon className="w-5 h-5 mr-2" />
            Lid Verification Photos
            <span className="text-red-500 ml-1">*</span>
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Take photos to verify that lids are clean and properly secured, especially for chemicals like Bleach, Hydrogen Peroxide, and Ammonium.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {state.lidPhotos.map((photo, index) => (
              <div key={index} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  Lid {index + 1}
                </div>
              </div>
            ))}
            {!isComplete && (
              <label className="relative aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 cursor-pointer flex items-center justify-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleLidPhotoUpload(e.target.files[0])}
                  className="sr-only"
                />
                <div className="text-center">
                  <CameraIcon className="mx-auto w-6 h-6 text-gray-400" />
                  <span className="mt-2 block text-xs text-gray-500">Add Lid Photo</span>
                </div>
              </label>
            )}
          </div>
        </div>
      )}

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

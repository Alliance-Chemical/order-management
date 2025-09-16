'use client';

import { useState, useEffect } from 'react';
import { 
  TruckIcon,
  PlusIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon
} from '@heroicons/react/24/solid';
import ProgressBar from '@/components/ui/ProgressBar';
import { useToast } from '@/hooks/use-toast';

interface FreightClassification {
  id: string;
  description: string;
  nmfcCode?: string;
  freightClass: string;
  isHazmat: boolean;
  hazmatClass?: string;
  packingGroup?: string;
  packagingInstructions?: string;
  specialHandling?: string;
  minDensity?: number;
  maxDensity?: number;
  createdAt: string;
  updatedAt: string;
}

interface ClassificationFormData {
  description: string;
  nmfcCode: string;
  freightClass: string;
  isHazmat: boolean;
  hazmatClass: string;
  packingGroup: string;
  packagingInstructions: string;
  specialHandling: string;
  minDensity: string;
  maxDensity: string;
}

const FREIGHT_CLASSES = [
  '50', '55', '60', '65', '70', '77.5', '85', '92.5', 
  '100', '110', '125', '150', '175', '200', '250', '300', '400', '500'
];

const HAZMAT_CLASSES = [
  { value: '1', label: 'Class 1 - Explosives' },
  { value: '2.1', label: 'Class 2.1 - Flammable Gas' },
  { value: '2.2', label: 'Class 2.2 - Non-Flammable Gas' },
  { value: '2.3', label: 'Class 2.3 - Toxic Gas' },
  { value: '3', label: 'Class 3 - Flammable Liquid' },
  { value: '4.1', label: 'Class 4.1 - Flammable Solid' },
  { value: '4.2', label: 'Class 4.2 - Spontaneously Combustible' },
  { value: '4.3', label: 'Class 4.3 - Dangerous When Wet' },
  { value: '5.1', label: 'Class 5.1 - Oxidizer' },
  { value: '5.2', label: 'Class 5.2 - Organic Peroxide' },
  { value: '6.1', label: 'Class 6.1 - Toxic' },
  { value: '6.2', label: 'Class 6.2 - Infectious Substance' },
  { value: '7', label: 'Class 7 - Radioactive' },
  { value: '8', label: 'Class 8 - Corrosive' },
  { value: '9', label: 'Class 9 - Miscellaneous' },
];

const PACKING_GROUPS = ['I', 'II', 'III'];

export default function ChemicalsPage() {
  const { toast } = useToast()
  const [classifications, setClassifications] = useState<FreightClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHazmatOnly, setShowHazmatOnly] = useState(false);
  const [selectedFreightClass, setSelectedFreightClass] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClassification, setEditingClassification] = useState<FreightClassification | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<ClassificationFormData>({
    description: '',
    nmfcCode: '',
    freightClass: '',
    isHazmat: false,
    hazmatClass: '',
    packingGroup: '',
    packagingInstructions: '',
    specialHandling: '',
    minDensity: '',
    maxDensity: '',
  });

  useEffect(() => {
    loadClassifications();
  }, []);

  const loadClassifications = async () => {
    try {
      const params = new URLSearchParams();
      params.append('limit', '200');

      const response = await fetch(`/api/freight-classifications?${params}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Failed to load classifications:', error);
        setClassifications([]);
        return;
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setClassifications(data);
      } else {
        console.warn('Unexpected freight classification payload shape:', data);
        setClassifications([]);
      }
    } catch (error) {
      console.error('Error loading classifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (classification?: FreightClassification) => {
    if (classification) {
      setEditingClassification(classification);
      setFormData({
        description: classification.description,
        nmfcCode: classification.nmfcCode || '',
        freightClass: classification.freightClass,
        isHazmat: classification.isHazmat,
        hazmatClass: classification.hazmatClass || '',
        packingGroup: classification.packingGroup || '',
        packagingInstructions: classification.packagingInstructions || '',
        specialHandling: classification.specialHandling || '',
        minDensity: classification.minDensity?.toString() || '',
        maxDensity: classification.maxDensity?.toString() || '',
      });
    } else {
      setEditingClassification(null);
      setFormData({
        description: '',
        nmfcCode: '',
        freightClass: '',
        isHazmat: false,
        hazmatClass: '',
        packingGroup: '',
        packagingInstructions: '',
        specialHandling: '',
        minDensity: '',
        maxDensity: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClassification(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = {
        ...formData,
        minDensity: formData.minDensity ? parseFloat(formData.minDensity) : null,
        maxDensity: formData.maxDensity ? parseFloat(formData.maxDensity) : null,
        ...(editingClassification && { id: editingClassification.id }),
      };

      const response = await fetch('/api/freight-classifications', {
        method: editingClassification ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await loadClassifications();
        closeModal();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: `Error: ${error.error}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error saving classification:', error);
      toast({
        title: "Error",
        description: "Error saving classification. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSaving(false);
    }
  };

  const getFilteredClassifications = () => {
    return classifications.filter(classification => {
      const matchesSearch = searchQuery === '' || 
        classification.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (classification.nmfcCode && classification.nmfcCode.includes(searchQuery)) ||
        classification.freightClass.includes(searchQuery) ||
        (classification.hazmatClass && classification.hazmatClass.includes(searchQuery));
      
      const matchesHazmat = !showHazmatOnly || classification.isHazmat;
      const matchesFreightClass = !selectedFreightClass || classification.freightClass === selectedFreightClass;
      
      return matchesSearch && matchesHazmat && matchesFreightClass;
    });
  };

  const filteredClassifications = getFilteredClassifications();
  const hazmatCount = filteredClassifications.filter(c => c.isHazmat).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-full max-w-md px-4">
          <ProgressBar
            value={30}
            label="Loading freight classifications"
            showPercentage={false}
            variant="default"
            animated={true}
          />
          <p className="text-gray-600 text-center mt-4">Loading freight classifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <TruckIcon className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Freight Classifications</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage NMFC codes and hazmat classifications for chemical shipping
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{filteredClassifications.length} classifications</span>
              <span className="text-sm font-medium text-red-600">{hazmatCount} hazmat</span>
              <button
                onClick={() => openModal()}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-green-700"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Classification
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by description, NMFC code, freight class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <select
                value={selectedFreightClass}
                onChange={(e) => setSelectedFreightClass(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All Classes</option>
                {FREIGHT_CLASSES.map(fc => (
                  <option key={fc} value={fc}>Class {fc}</option>
                ))}
              </select>
              
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={showHazmatOnly}
                  onChange={(e) => setShowHazmatOnly(e.target.checked)}
                  className="mr-2"
                />
                Hazmat Only
              </label>
            </div>
          </div>
        </div>

        {/* Classifications Table */}
        <div className="mt-6 bg-white shadow-lg rounded-lg overflow-hidden">
          {filteredClassifications.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <TruckIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-lg">No classifications found</p>
              <p className="text-sm mt-2">Add freight classifications to enable proper chemical shipping</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Classification
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Freight Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      NMFC Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hazmat Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Density Range
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredClassifications.map((classification) => (
                    <tr key={classification.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{classification.description}</div>
                        {classification.specialHandling && (
                          <div className="text-xs text-gray-500 mt-1">
                            Special: {classification.specialHandling}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          Class {classification.freightClass}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {classification.nmfcCode || 'Not specified'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {classification.isHazmat ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                              HAZMAT
                            </span>
                            {classification.hazmatClass && (
                              <div className="text-xs text-red-600">Class {classification.hazmatClass}</div>
                            )}
                            {classification.packingGroup && (
                              <div className="text-xs text-red-600">PG {classification.packingGroup}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Non-hazmat</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(classification.minDensity || classification.maxDensity) ? (
                          <div>
                            {classification.minDensity && `${classification.minDensity}`}
                            {(classification.minDensity && classification.maxDensity) && ' - '}
                            {classification.maxDensity && `${classification.maxDensity}`}
                            {(classification.minDensity || classification.maxDensity) && ' lbs/ft³'}
                          </div>
                        ) : (
                          'Not specified'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {classification.packagingInstructions && (
                            <button
                              title="View packaging instructions"
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <DocumentTextIcon className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openModal(classification)}
                            className="text-green-600 hover:text-green-900"
                            title="Edit classification"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingClassification ? 'Edit Classification' : 'Add New Classification'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description *</label>
                  <input
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., Paint, Varnish, Lacquer - Non-Hazardous"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Freight Class *</label>
                    <select
                      required
                      value={formData.freightClass}
                      onChange={(e) => setFormData({...formData, freightClass: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">Select freight class...</option>
                      {FREIGHT_CLASSES.map(fc => (
                        <option key={fc} value={fc}>Class {fc}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">NMFC Code</label>
                    <input
                      type="text"
                      value={formData.nmfcCode}
                      onChange={(e) => setFormData({...formData, nmfcCode: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="e.g., 46020"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isHazmat"
                    checked={formData.isHazmat}
                    onChange={(e) => setFormData({...formData, isHazmat: e.target.checked})}
                    className="mr-2"
                  />
                  <label htmlFor="isHazmat" className="text-sm font-medium text-gray-700">
                    Hazardous Material (DOT regulated)
                  </label>
                </div>

                {formData.isHazmat && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <h4 className="text-sm font-medium text-red-800 mb-3">Hazmat Classification Details</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-red-700">Hazmat Class *</label>
                        <select
                          required={formData.isHazmat}
                          value={formData.hazmatClass}
                          onChange={(e) => setFormData({...formData, hazmatClass: e.target.value})}
                          className="mt-1 block w-full border border-red-300 rounded-md px-3 py-2 focus:ring-red-500 focus:border-red-500"
                        >
                          <option value="">Select hazmat class...</option>
                          {HAZMAT_CLASSES.map(hc => (
                            <option key={hc.value} value={hc.value}>{hc.label}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-red-700">Packing Group</label>
                        <select
                          value={formData.packingGroup}
                          onChange={(e) => setFormData({...formData, packingGroup: e.target.value})}
                          className="mt-1 block w-full border border-red-300 rounded-md px-3 py-2 focus:ring-red-500 focus:border-red-500"
                        >
                          <option value="">Select packing group...</option>
                          {PACKING_GROUPS.map(pg => (
                            <option key={pg} value={pg}>Packing Group {pg}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Min Density (lbs/ft³)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.minDensity}
                      onChange={(e) => setFormData({...formData, minDensity: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Max Density (lbs/ft³)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.maxDensity}
                      onChange={(e) => setFormData({...formData, maxDensity: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Packaging Instructions</label>
                  <textarea
                    value={formData.packagingInstructions}
                    onChange={(e) => setFormData({...formData, packagingInstructions: e.target.value})}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., DOT specification packaging required - UN rated containers"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Special Handling Requirements</label>
                  <textarea
                    value={formData.specialHandling}
                    onChange={(e) => setFormData({...formData, specialHandling: e.target.value})}
                    rows={2}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., Keep away from heat sources, store in cool, dry place"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : (editingClassification ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

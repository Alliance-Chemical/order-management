'use client';

import { useState, useEffect } from 'react';
import { 
  BeakerIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/solid';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  packagingType?: string;
  unitsPerPackage: number;
  unitContainerType?: string;
  isHazardous: boolean;
  casNumber?: string;
  unNumber?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductFormData {
  sku: string;
  name: string;
  description: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  packagingType: string;
  unitsPerPackage: string;
  unitContainerType: string;
  isHazardous: boolean;
  casNumber: string;
  unNumber: string;
  isActive: boolean;
}

export default function ProductsPage() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHazardousOnly, setShowHazardousOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<ProductFormData>({
    sku: '',
    name: '',
    description: '',
    weight: '',
    length: '',
    width: '',
    height: '',
    packagingType: '',
    unitsPerPackage: '1',
    unitContainerType: '',
    isHazardous: false,
    casNumber: '',
    unNumber: '',
    isActive: true,
  });

  useEffect(() => {
    loadProducts();
  }, [showInactive]);

  const loadProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (showInactive) params.append('active', 'false');
      params.append('limit', '200');
      
      const response = await fetch(`/api/products?${params}`);
      const data = await response.json();
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        weight: product.weight?.toString() || '',
        length: product.length?.toString() || '',
        width: product.width?.toString() || '',
        height: product.height?.toString() || '',
        packagingType: product.packagingType || '',
        unitsPerPackage: product.unitsPerPackage.toString(),
        unitContainerType: product.unitContainerType || '',
        isHazardous: product.isHazardous,
        casNumber: product.casNumber || '',
        unNumber: product.unNumber || '',
        isActive: product.isActive,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        sku: '',
        name: '',
        description: '',
        weight: '',
        length: '',
        width: '',
        height: '',
        packagingType: '',
        unitsPerPackage: '1',
        unitContainerType: '',
        isHazardous: false,
        casNumber: '',
        unNumber: '',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = {
        ...formData,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        length: formData.length ? parseFloat(formData.length) : null,
        width: formData.width ? parseFloat(formData.width) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        unitsPerPackage: parseInt(formData.unitsPerPackage) || 1,
        ...(editingProduct && { id: editingProduct.id }),
      };

      const response = await fetch('/api/products', {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await loadProducts();
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
      console.error('Error saving product:', error);
      toast({
        title: "Error",
        description: "Error saving product. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Are you sure you want to deactivate ${product.sku}?`)) return;
    
    try {
      const response = await fetch(`/api/products?id=${product.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        await loadProducts();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: `Error: ${error.error}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error",
        description: "Error deleting product. Please try again.",
        variant: "destructive"
      })
    }
  };

  const getFilteredProducts = () => {
    return products.filter(product => {
      const matchesSearch = searchQuery === '' || 
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.casNumber && product.casNumber.includes(searchQuery)) ||
        (product.unNumber && product.unNumber.includes(searchQuery));
      
      const matchesHazardous = !showHazardousOnly || product.isHazardous;
      
      return matchesSearch && matchesHazardous;
    });
  };

  const filteredProducts = getFilteredProducts();
  const hazardousCount = filteredProducts.filter(p => p.isHazardous).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chemical products...</p>
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
              <BeakerIcon className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Chemical Products</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage chemical product catalog for freight shipping
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{filteredProducts.length} products</span>
              <span className="text-sm font-medium text-red-600">{hazardousCount} hazardous</span>
              <button
                onClick={() => openModal()}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Product
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
                placeholder="Search by SKU, name, CAS number, UN number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={showHazardousOnly}
                  onChange={(e) => setShowHazardousOnly(e.target.checked)}
                  className="mr-2"
                />
                Hazardous Only
              </label>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="mr-2"
                />
                Show Inactive
              </label>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="mt-6 bg-white shadow-lg rounded-lg overflow-hidden">
          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <BeakerIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-lg">No products found</p>
              <p className="text-sm mt-2">Add chemical products to enable freight classifications</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chemical Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Physical
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Packaging
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.sku}</div>
                          <div className="text-sm text-gray-700">{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-gray-500 mt-1">{product.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {product.isHazardous && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                              HAZMAT
                            </span>
                          )}
                          {product.casNumber && (
                            <div className="text-xs text-gray-600">CAS: {product.casNumber}</div>
                          )}
                          {product.unNumber && (
                            <div className="text-xs text-gray-600">UN: {product.unNumber}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.weight && <div>Weight: {product.weight} lbs</div>}
                        {(product.length && product.width && product.height) && (
                          <div>Dims: {product.length}"×{product.width}"×{product.height}"</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{product.packagingType || 'Not specified'}</div>
                        <div>{product.unitsPerPackage} units/package</div>
                        {product.unitContainerType && <div>{product.unitContainerType}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          product.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => openModal(product)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit product"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="text-red-600 hover:text-red-900"
                            title="Deactivate product"
                          >
                            <TrashIcon className="h-4 w-4" />
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
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">SKU *</label>
                    <input
                      type="text"
                      required
                      value={formData.sku}
                      onChange={(e) => setFormData({...formData, sku: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!!editingProduct}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={2}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isHazardous"
                    checked={formData.isHazardous}
                    onChange={(e) => setFormData({...formData, isHazardous: e.target.checked})}
                    className="mr-2"
                  />
                  <label htmlFor="isHazardous" className="text-sm font-medium text-gray-700">
                    Hazardous Material (Requires DOT compliance)
                  </label>
                </div>

                {formData.isHazardous && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <div>
                      <label className="block text-sm font-medium text-red-700">CAS Number</label>
                      <input
                        type="text"
                        value={formData.casNumber}
                        onChange={(e) => setFormData({...formData, casNumber: e.target.value})}
                        className="mt-1 block w-full border border-red-300 rounded-md px-3 py-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="e.g., 64-17-5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-red-700">UN Number *</label>
                      <input
                        type="text"
                        required={formData.isHazardous}
                        value={formData.unNumber}
                        onChange={(e) => setFormData({...formData, unNumber: e.target.value})}
                        className="mt-1 block w-full border border-red-300 rounded-md px-3 py-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="e.g., UN1170"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Weight (lbs)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.weight}
                      onChange={(e) => setFormData({...formData, weight: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Length (in)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.length}
                      onChange={(e) => setFormData({...formData, length: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Width (in)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.width}
                      onChange={(e) => setFormData({...formData, width: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Height (in)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.height}
                      onChange={(e) => setFormData({...formData, height: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Packaging Type</label>
                    <select
                      value={formData.packagingType}
                      onChange={(e) => setFormData({...formData, packagingType: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select packaging...</option>
                      <option value="Drum">Drum</option>
                      <option value="Pail">Pail</option>
                      <option value="Jug">Jug</option>
                      <option value="Bottle">Bottle</option>
                      <option value="Bag">Bag</option>
                      <option value="Box">Box</option>
                      <option value="Cylinder">Cylinder</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Units per Package</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.unitsPerPackage}
                      onChange={(e) => setFormData({...formData, unitsPerPackage: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Container Type</label>
                    <input
                      type="text"
                      value={formData.unitContainerType}
                      onChange={(e) => setFormData({...formData, unitContainerType: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 5-gallon pail"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    className="mr-2"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Active Product
                  </label>
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : (editingProduct ? 'Update' : 'Create')}
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
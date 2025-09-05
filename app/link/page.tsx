'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  MagnifyingGlassIcon,
  LinkIcon,
  BeakerIcon,
  TruckIcon
} from '@heroicons/react/24/solid';

interface Product {
  productId: string;
  sku: string;
  name: string;
  description?: string;
  isHazardous: boolean;
  casNumber?: string;
  unNumber?: string;
  packagingType?: string;
  unitContainerType?: string;
}

interface FreightClassification {
  id: string;
  description: string;
  freightClass: string;
  nmfcCode?: string;
  isHazmat: boolean;
  hazmatClass?: string;
  packingGroup?: string;
  packagingInstructions?: string;
  specialHandling?: string;
}

interface ProductLink {
  linkId: string;
  productId: string;
  classificationId: string;
  isApproved: boolean;
  confidenceScore?: number;
  linkSource: string;
  productSku: string;
  productName: string;
  classificationDescription: string;
  freightClass: string;
  isHazmat: boolean;
  createdAt?: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  createdBy?: string | null;
}

export default function LinkPage() {
  const [unlinkedProducts, setUnlinkedProducts] = useState<Product[]>([]);
  const [classifications, setClassifications] = useState<FreightClassification[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState<string>('');
  const [showHazardousOnly, setShowHazardousOnly] = useState(false);
  const [recentLinks, setRecentLinks] = useState<ProductLink[]>([]);
  const [approveOnSave, setApproveOnSave] = useState<boolean>(true);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState<boolean>(false);

  // Load initial data
  useEffect(() => {
    loadUnlinkedProducts();
    loadClassifications();
    loadRecentLinks();
  }, [showHazardousOnly]);

  const loadUnlinkedProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (showHazardousOnly) params.append('hazardous', 'true');
      params.append('limit', '50');
      
      const response = await fetch(`/api/product-links/unlinked?${params}`);
      const data = await response.json();
      setUnlinkedProducts(data.products || []);
    } catch (error) {
      console.error('Error loading unlinked products:', error);
    }
  };

  const loadClassifications = async () => {
    try {
      const response = await fetch('/api/freight-classifications?limit=100');
      const data = await response.json();
      setClassifications(data || []);
    } catch (error) {
      console.error('Error loading classifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentLinks = async () => {
    try {
      const response = await fetch('/api/product-links?limit=10');
      const data = await response.json();
      setRecentLinks(data || []);
    } catch (error) {
      console.error('Error loading recent links:', error);
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString();
    } catch {
      return '';
    }
  };

  const handleApproveLink = async (linkId: string) => {
    if (!linkId || approvingIds.has(linkId)) return;
    setApprovingIds(prev => new Set(prev).add(linkId));
    try {
      const res = await fetch('/api/product-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: linkId, isApproved: true, approvedBy: 'ui/link' })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.error || 'Approve failed');
      }
      await loadRecentLinks();
      await loadUnlinkedProducts();
    } catch (e) {
      console.error('Approve link error:', e);
      toast({ title: 'Approve failed', description: 'Could not approve link', variant: 'destructive' });
    } finally {
      setApprovingIds(prev => {
        const next = new Set(prev);
        next.delete(linkId);
        return next;
      });
    }
  };

  const handleApproveAllPending = async () => {
    const pending = recentLinks.filter(l => !l.isApproved);
    if (pending.length === 0 || bulkApproving) return;
    if (!confirm(`Approve all pending links (${pending.length})?`)) return;
    setBulkApproving(true);
    // Optimistically mark as approving to disable buttons
    setApprovingIds(prev => {
      const next = new Set(prev);
      for (const l of pending) next.add(l.linkId);
      return next;
    });
    try {
      const res = await fetch('/api/product-links/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: pending.map(p => p.linkId), approvedBy: 'ui/link/bulk' })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.error || 'Batch approve failed');
      }
      toast({ title: 'Approved', description: `Approved ${pending.length} links` });
      await loadRecentLinks();
      await loadUnlinkedProducts();
    } catch (e) {
      console.error('Bulk approve error:', e);
      toast({ title: 'Batch approve failed', description: 'Some links may remain pending', variant: 'destructive' });
    } finally {
      setBulkApproving(false);
      setApprovingIds(prev => {
        const next = new Set(prev);
        for (const l of pending) next.delete(l.linkId);
        return next;
      });
    }
  };

  const handleProductSelect = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const filteredProducts = getFilteredProducts();
      setSelectedProducts(new Set(filteredProducts.map(p => p.productId)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleBulkLink = async () => {
    if (!selectedClassification || selectedProducts.size === 0) {
      toast({ title: 'Selection required', description: 'Select products and a classification', variant: 'destructive' });
      return;
    }

    setLinking(true);
    
    try {
      // Create links for selected products
      const linkPromises = Array.from(selectedProducts).map(productId =>
        fetch('/api/product-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            classificationId: selectedClassification,
            linkSource: 'manual',
            isApproved: approveOnSave,
            createdBy: 'ui/link',
          }),
        })
      );

      const results = await Promise.all(linkPromises);
      const successful = results.filter(r => r.ok).length;
      const failed = results.length - successful;

      if (successful > 0) {
        toast({ title: 'Links created', description: `${successful} linked${failed ? `, ${failed} failed` : ''}` });
        
        // Reload data
        setSelectedProducts(new Set());
        setSelectedClassification('');
        await loadUnlinkedProducts();
        await loadRecentLinks();
      } else {
        toast({ title: 'No links created', description: 'Check product/classification compatibility', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error creating bulk links:', error);
      toast({ title: 'Create failed', description: 'Error creating links', variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

  const getFilteredProducts = () => {
    return unlinkedProducts.filter(product => {
      const matchesSearch = searchQuery === '' || 
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.casNumber && product.casNumber.includes(searchQuery)) ||
        (product.unNumber && product.unNumber.includes(searchQuery));
      
      return matchesSearch;
    });
  };

  const filteredProducts = getFilteredProducts();
  const selectedClassificationData = classifications.find(c => c.id === selectedClassification);
  const hasHazardousSelection = Array.from(selectedProducts).some(id => 
    unlinkedProducts.find(p => p.productId === id)?.isHazardous
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chemical classification system...</p>
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
              <LinkIcon className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Product Classification Linking</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Map chemical products to freight classifications for DOT compliance
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">
                {unlinkedProducts.length} unlinked products
              </span>
              <span className="text-sm font-medium text-red-600">
                {unlinkedProducts.filter(p => p.isHazardous).length} hazardous
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Products Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-4 bg-blue-600 text-white">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold flex items-center">
                    <BeakerIcon className="h-6 w-6 mr-2" />
                    Unlinked Products ({filteredProducts.length})
                  </h2>
                  <div className="flex items-center space-x-3">
                    <label className="flex items-center text-sm" aria-label="Filter hazardous products only" title="Filter hazardous products only">
                      <input
                        type="checkbox"
                        checked={showHazardousOnly}
                        onChange={(e) => setShowHazardousOnly(e.target.checked)}
                        className="mr-2"
                      />
                      Hazardous Only
                    </label>
                  </div>
                </div>
              </div>
              
              {/* Search and Bulk Actions */}
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products by SKU, name, CAS number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {filteredProducts.length > 0 && (
                    <label className="flex items-center whitespace-nowrap" aria-label="Select all filtered products" title="Select all filtered products">
                      <input
                        type="checkbox"
                        checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="mr-2"
                      />
                      Select All ({filteredProducts.length})
                    </label>
                  )}
                </div>
              </div>

              {/* Products List */}
              <div className="max-h-96 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <BeakerIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-lg">No unlinked products found</p>
                    <p className="text-sm mt-1">All products have been classified</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredProducts.map((product) => (
                      <div key={product.productId} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.productId)}
                            onChange={(e) => handleProductSelect(product.productId, e.target.checked)}
                            className="mt-1 mr-3"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900">{product.sku}</p>
                              {product.isHazardous && (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                                  <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                                  HAZMAT
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 mt-1">{product.name}</p>
                            
                            {(product.casNumber || product.unNumber) && (
                              <div className="flex space-x-4 mt-2 text-xs text-gray-500">
                                {product.casNumber && <span>CAS: {product.casNumber}</span>}
                                {product.unNumber && <span>UN: {product.unNumber}</span>}
                              </div>
                            )}
                            
                            {product.packagingType && (
                              <p className="text-xs text-gray-500 mt-1">Packaging: {product.packagingType}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Classification and Action Panel */}
          <div className="space-y-6">
            
            {/* Classification Selection */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-4 bg-green-600 text-white">
                <h2 className="text-xl font-semibold flex items-center">
                  <TruckIcon className="h-6 w-6 mr-2" />
                  Freight Classification
                </h2>
              </div>
              
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Classification
                </label>
                <select
                  value={selectedClassification}
                  onChange={(e) => setSelectedClassification(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Choose a classification...</option>
                  {classifications.map((classification) => (
                    <option key={classification.id} value={classification.id}>
                      Class {classification.freightClass} - {classification.description}
                      {classification.isHazmat && ' (HAZMAT)'}
                    </option>
                  ))}
                </select>
                
                {selectedClassificationData && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-md">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><strong>Freight Class:</strong> {selectedClassificationData.freightClass}</div>
                      {selectedClassificationData.nmfcCode && (
                        <div><strong>NMFC:</strong> {selectedClassificationData.nmfcCode}</div>
                      )}
                      {selectedClassificationData.isHazmat && (
                        <>
                          <div className="col-span-2 text-red-600">
                            <strong>⚠️ HAZMAT Classification</strong>
                          </div>
                          {selectedClassificationData.hazmatClass && (
                            <div><strong>Class:</strong> {selectedClassificationData.hazmatClass}</div>
                          )}
                          {selectedClassificationData.packingGroup && (
                            <div><strong>Packing Group:</strong> {selectedClassificationData.packingGroup}</div>
                          )}
                        </>
                      )}
                    </div>
                    
                    {selectedClassificationData.specialHandling && (
                      <div className="mt-3 text-sm">
                        <strong>Special Handling:</strong>
                        <p className="text-gray-600 mt-1">{selectedClassificationData.specialHandling}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Safety Warning */}
                {hasHazardousSelection && selectedClassificationData && !selectedClassificationData.isHazmat && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-start">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5 mr-2" />
                      <div className="text-sm text-red-700">
                        <strong>Safety Warning:</strong> You've selected hazardous products but a non-hazmat classification. 
                        This may violate DOT regulations.
                      </div>
                    </div>
                  </div>
                )}

                {/* Approve toggle + Link Button */}
                <div className="mt-4 flex items-center justify-between">
                  <label className="flex items-center text-sm text-gray-700" aria-label="Approve on save" title="Approve on save">
                    <input
                      type="checkbox"
                      checked={approveOnSave}
                      onChange={(e) => setApproveOnSave(e.target.checked)}
                      className="mr-2"
                    />
                    Approve on save
                  </label>
                  <span className="text-xs text-gray-500">
                    {approveOnSave ? 'Approved links are used immediately' : 'Unapproved links require review'}
                  </span>
                </div>

                {/* Link Button */}
                <button
                  onClick={handleBulkLink}
                  disabled={linking || !selectedClassification || selectedProducts.size === 0}
                  className="w-full mt-6 bg-green-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  aria-label="Link selected products"
                  title="Link selected products"
                >
                  {linking ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating Links...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-5 w-5 mr-2" />
                      Link {selectedProducts.size} Products
                    </>
                  )}
                </button>

                {!approveOnSave && (
                  <p className="mt-3 text-xs text-gray-500 text-center">
                    Links will be created as pending and won’t be used until approved
                  </p>
                )}
              </div>
            </div>

            {/* Recent Links */}
            {recentLinks.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-600 text-white flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Recent Links</h2>
                  {(() => {
                    const pendingCount = recentLinks.filter(l => !l.isApproved).length;
                    return (
                      <button
                        onClick={handleApproveAllPending}
                        disabled={pendingCount === 0 || bulkApproving}
                        className={`text-xs px-3 py-1 rounded ${pendingCount === 0 || bulkApproving ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white`}
                        title={pendingCount === 0 ? 'No pending links to approve' : 'Approve all pending links'}
                      >
                        {bulkApproving ? 'Approving…' : `Approve All Pending (${pendingCount})`}
                      </button>
                    );
                  })()}
                </div>
                    <div className="max-h-64 overflow-y-auto">
                      {recentLinks.slice(0, 5).map((link) => (
                        <div key={link.linkId} className="p-4 border-b border-gray-200">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{link.productSku}</p>
                              <p className="text-xs text-gray-500">→ Class {link.freightClass}</p>
                              <div className="mt-1 text-xs text-gray-500">
                                <span className="mr-3">
                                  Linked: {formatDateTime(link.createdAt) || '—'}{link.createdBy ? ` by ${link.createdBy}` : ''}
                                </span>
                                {link.isApproved && (
                                  <span>
                                    Approved: {formatDateTime(link.approvedAt) || '—'}{link.approvedBy ? ` by ${link.approvedBy}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center ml-4 space-x-3">
                              {link.isApproved ? (
                                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                              ) : (
                                <>
                                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
                                  <button
                                    onClick={() => handleApproveLink(link.linkId)}
                                    disabled={approvingIds.has(link.linkId)}
                                    className="text-xs bg-green-600 text-white px-2 py-1 rounded disabled:opacity-50"
                                    aria-label={`Approve link for ${link.productSku}`}
                                    title={`Approve link for ${link.productSku}`}
                                  >
                                    {approvingIds.has(link.linkId) ? 'Approving…' : 'Approve'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

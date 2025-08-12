'use client';

import { useState, useEffect } from 'react';
import { BeakerIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface ShopifyProduct {
  id: string;
  title: string;
}

interface SourceContainerSelectorProps {
  productName: string;
  quantity: number;
  onSelect: (selection: any) => void;
  existingSource?: any; // For duplicating an existing source
}

export default function SourceContainerSelector({ 
  productName, 
  quantity, 
  onSelect,
  existingSource 
}: SourceContainerSelectorProps) {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [sourceType, setSourceType] = useState<'drum55' | 'tote275' | 'tote330'>('tote275');
  const [sourceId, setSourceId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(1);

  useEffect(() => {
    fetchProducts();
    
    // Pre-fill if duplicating an existing source
    if (existingSource) {
      setSelectedProduct({
        id: existingSource.productId,
        title: existingSource.productTitle || existingSource.chemicalName
      });
      setSourceType(existingSource.containerType || existingSource.sourceType);
      setSourceId(existingSource.sourceId || existingSource.shortCode || '');
    }
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/shopify/sync-products');
      const data = await response.json();
      
      if (data.success && data.products) {
        // Group by base product (not variants)
        const uniqueProducts = new Map<string, ShopifyProduct>();
        
        data.products.forEach((product: any) => {
          const baseTitle = product.title.replace(/\s*-\s*\d+.*$/g, '').trim(); // Remove size variations
          if (!uniqueProducts.has(baseTitle)) {
            uniqueProducts.set(baseTitle, {
              id: product.id,
              title: baseTitle
            });
          }
        });
        
        setProducts(Array.from(uniqueProducts.values()));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Advanced search algorithm with fuzzy matching and relevance scoring
  const getFilteredAndScoredProducts = () => {
    if (!searchTerm.trim()) {
      // If no search term, show most common chemicals first
      const commonChemicals = [
        'sodium hypochlorite', 'sodium hydroxide', 'sulfuric acid', 
        'hydrochloric acid', 'citric acid', 'd-limonene', 'isopropyl alcohol',
        'hydrogen peroxide', 'acetic acid', 'phosphoric acid'
      ];
      
      return products.sort((a, b) => {
        const aIsCommon = commonChemicals.some(c => a.title.toLowerCase().includes(c));
        const bIsCommon = commonChemicals.some(c => b.title.toLowerCase().includes(c));
        if (aIsCommon && !bIsCommon) return -1;
        if (!aIsCommon && bIsCommon) return 1;
        return a.title.localeCompare(b.title);
      }).slice(0, 10); // Show only top 10 when not searching
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/);
    
    // Score each product based on match quality
    const scoredProducts = products.map(product => {
      const titleLower = product.title.toLowerCase();
      let score = 0;
      
      // Exact match gets highest score
      if (titleLower === searchLower) {
        score += 1000;
      }
      
      // Starts with search term gets high score
      if (titleLower.startsWith(searchLower)) {
        score += 500;
      }
      
      // Contains exact search term
      if (titleLower.includes(searchLower)) {
        score += 200;
      }
      
      // All search words present (for multi-word searches)
      const allWordsPresent = searchWords.every(word => titleLower.includes(word));
      if (allWordsPresent) {
        score += 100 * searchWords.length;
      }
      
      // Some search words present
      const wordsPresent = searchWords.filter(word => titleLower.includes(word)).length;
      score += 20 * wordsPresent;
      
      // Fuzzy match for typos (simple Levenshtein-like scoring)
      const minLength = Math.min(searchLower.length, titleLower.length);
      const maxLength = Math.max(searchLower.length, titleLower.length);
      if (maxLength > 0) {
        let matches = 0;
        for (let i = 0; i < minLength; i++) {
          if (titleLower[i] === searchLower[i]) matches++;
        }
        score += (matches / maxLength) * 50;
      }
      
      return { product, score };
    });
    
    // Filter out products with no match and sort by score
    return scoredProducts
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15) // Show max 15 results
      .map(item => item.product);
  };
  
  const filteredProducts = getFilteredAndScoredProducts();
  
  // Highlight matching text in product title
  const highlightMatch = (text: string) => {
    if (!searchTerm.trim()) return text;
    
    const searchLower = searchTerm.toLowerCase();
    const textLower = text.toLowerCase();
    const index = textLower.indexOf(searchLower);
    
    if (index === -1) {
      // Try to highlight individual words
      const searchWords = searchLower.split(/\s+/);
      let result = text;
      searchWords.forEach(word => {
        const regex = new RegExp(`(${word})`, 'gi');
        result = result.replace(regex, '<mark class="bg-yellow-200 font-semibold">$1</mark>');
      });
      return result;
    }
    
    const before = text.slice(0, index);
    const match = text.slice(index, index + searchTerm.length);
    const after = text.slice(index + searchTerm.length);
    return `${before}<mark class="bg-yellow-200 font-semibold">${match}</mark>${after}`;
  };

  // Removed auto-matching - let users choose their own product

  const handleConfirm = () => {
    if (!selectedProduct) {
      alert('Please select a product');
      return;
    }

    const containerSize = sourceType === 'drum55' ? '55gal' : sourceType === 'tote275' ? '275gal' : '330gal';
    
    const selections = [];
    for (let i = 0; i < duplicateCount; i++) {
      const idSuffix = duplicateCount > 1 && sourceId ? `${sourceId}-${i + 1}` : sourceId;
      selections.push({
        id: idSuffix ? `${sourceType}-${idSuffix}` : `${selectedProduct.id}-${containerSize}-${Date.now()}-${i}`,
        chemicalName: selectedProduct.title,
        productId: selectedProduct.id,
        sourceType,
        sourceId: idSuffix || '',
        containerType: sourceType,
        shortCode: idSuffix || '',
        productTitle: selectedProduct.title
      });
    }

    onSelect(selections);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
          <BeakerIcon className="h-6 w-6 mr-2 text-blue-600" />
          Assign Source Container
        </h3>
        <p className="text-sm text-gray-600">
          Specify which bulk container to fill {quantity} {productName} from
        </p>
      </div>

      {/* Product Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          1. Select Product
        </label>
        
        {/* Show selected product if one is selected */}
        {selectedProduct && (
          <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900">{selectedProduct.title}</p>
              <p className="text-xs text-gray-600">ID: {String(selectedProduct.id).slice(-8)}</p>
            </div>
            <button
              onClick={() => {
                setSelectedProduct(null);
                setSearchTerm('');
                setSearchFocused(false);
              }}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Change
            </button>
          </div>
        )}
        
        {/* Always show search input */}
        <div className="relative mb-2">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder={selectedProduct ? "Search to change product..." : "Type to search (e.g., 'sodium hypo', 'HCl', 'sulfuric')"}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoComplete="off"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Search results with better UX */}
        {(searchFocused || searchTerm) && (
        <div className="relative">
          <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg bg-white shadow-sm">
            {filteredProducts.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {searchTerm ? `No products found for "${searchTerm}"` : 'Start typing to search products'}
                {searchTerm && (
                  <p className="text-sm mt-2">Try searching for: sodium, acid, alcohol, glycol</p>
                )}
              </div>
            ) : (
              <>
                {!searchTerm && (
                  <div className="px-3 py-2 bg-gray-50 border-b text-xs text-gray-600 font-medium">
                    COMMONLY USED CHEMICALS
                  </div>
                )}
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setSearchTerm('');
                      setSearchFocused(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                      selectedProduct?.id === product.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div 
                          className="font-medium text-gray-900"
                          dangerouslySetInnerHTML={{ __html: highlightMatch(product.title) }}
                        />
                        <div className="text-xs text-gray-500 mt-0.5">ID: {String(product.id).slice(-8)}</div>
                      </div>
                      {selectedProduct?.id === product.id && (
                        <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
                {filteredProducts.length === 15 && searchTerm && (
                  <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-600 text-center">
                    Showing top 15 results. Type more to refine search.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Source Type Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          2. Source Container Type
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => setSourceType('drum55')}
            className={`flex-1 py-3 px-3 rounded-lg border-2 transition-colors ${
              sourceType === 'drum55' 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-2xl mb-1">🛢️</div>
            <div className="font-medium">55 Gal Drum</div>
            <div className="text-xs text-gray-600">Standard Drum</div>
          </button>
          <button
            onClick={() => setSourceType('tote275')}
            className={`flex-1 py-3 px-3 rounded-lg border-2 transition-colors ${
              sourceType === 'tote275' 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-2xl mb-1">📦</div>
            <div className="font-medium">275 Gal Tote</div>
            <div className="text-xs text-gray-600">IBC Tote</div>
          </button>
          <button
            onClick={() => setSourceType('tote330')}
            className={`flex-1 py-3 px-3 rounded-lg border-2 transition-colors ${
              sourceType === 'tote330' 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-2xl mb-1">📦</div>
            <div className="font-medium">330 Gal Tote</div>
            <div className="text-xs text-gray-600">Bulk Tote</div>
          </button>
        </div>
      </div>

      {/* Source ID Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          3. Source Container ID <span className="text-gray-400 font-normal">(Optional)</span>
        </label>
        <input
          type="text"
          placeholder={`Enter ${sourceType.startsWith('tote') ? 'tote' : 'drum'} ID (e.g., ${sourceType.startsWith('tote') ? 'T-001' : 'D-001'})`}
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value.toUpperCase())}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
        />
        <p className="mt-1 text-xs text-gray-500">
          If available, enter the ID from the physical label on the {sourceType.startsWith('tote') ? 'tote' : 'drum'}
        </p>
      </div>

      {/* Summary */}
      {selectedProduct && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-900">
            Source Assignment Summary:
          </p>
          <p className="text-sm text-green-700 mt-1">
            Product: {selectedProduct.title} (ID: {selectedProduct.id})
          </p>
          <p className="text-sm text-green-700">
            Source: {sourceType === 'drum55' ? '55 Gal Drum' : sourceType === 'tote275' ? '275 Gal Tote' : '330 Gal Tote'}{sourceId ? ` #${sourceId}` : ''}
          </p>
        </div>
      )}

      {/* Duplicate Control */}
      {selectedProduct && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="block text-sm font-medium text-blue-900 mb-2">
            Number of Duplicate Containers
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDuplicateCount(Math.max(1, duplicateCount - 1))}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="number"
              min="1"
              max="20"
              value={duplicateCount}
              onChange={(e) => setDuplicateCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="w-20 text-center px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setDuplicateCount(Math.min(20, duplicateCount + 1))}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {existingSource ? 'Creating duplicates of the existing source container' : 
             duplicateCount > 1 ? `Will create ${duplicateCount} identical source containers` : 
             'Adjust to create multiple identical source containers'}
          </p>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleConfirm}
        disabled={!selectedProduct}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          selectedProduct
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {duplicateCount > 1 ? `Confirm ${duplicateCount} Source Assignments` : 'Confirm Source Assignment'}
      </button>
    </div>
  );
}
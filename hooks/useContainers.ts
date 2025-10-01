'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type {
  Product,
  ContainerType,
  EditingContainer,
  ContainerEditForm,
  VariantWithProduct,
  ContainerStats
} from '@/types/containers';

export function useContainers() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<EditingContainer | null>(null);
  const [editForm, setEditForm] = useState<ContainerEditForm>(getDefaultEditForm());

  useEffect(() => {
    fetchProducts();
  }, []);

  function getDefaultEditForm(): ContainerEditForm {
    return {
      containerMaterial: 'poly',
      containerType: '',
      capacity: '',
      capacityUnit: 'gallons',
      length: '',
      width: '',
      height: '',
      emptyWeight: '',
      maxGrossWeight: '',
      freightClass: '',
      nmfcCode: '',
      unRating: '',
      hazmatApproved: false,
      isStackable: true,
      maxStackHeight: 1,
      isReusable: true,
      requiresLiner: false,
      notes: '',
    };
  }

  async function fetchProducts() {
    try {
      setLoading(true);
      const response = await fetch('/api/shopify/products-with-containers');
      const data = await response.json();

      if (data.success) {
        setProducts(data.products);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch products',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      toast({
        title: 'Error',
        description: 'Error fetching products',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  // Get all variants across all products with product info
  const allVariants: VariantWithProduct[] = products.flatMap(product => 
    product.variants.map(variant => ({
      ...variant,
      productTitle: product.title,
      productId: product.id,
    }))
  );

  // Filter variants based on search and material
  const filteredVariants = allVariants.filter(variant => {
    const matchesSearch = !searchTerm || 
      variant.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variant.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variant.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMaterial = materialFilter === 'all' || 
      (materialFilter === 'configured' && variant.containerType) ||
      (materialFilter === 'unconfigured' && !variant.containerType) ||
      (variant.containerType?.containerMaterial === materialFilter);

    return matchesSearch && matchesMaterial;
  });

  // Calculate stats
  const stats: ContainerStats = {
    totalVariants: allVariants.length,
    configured: allVariants.filter(v => v.containerType).length,
    metalContainers: allVariants.filter(v => v.containerType?.containerMaterial === 'metal').length,
    polyContainers: allVariants.filter(v => v.containerType?.containerMaterial === 'poly').length,
  };

  async function handleSingleMaterialToggle(containerId: string, material: 'metal' | 'poly') {
    // Optimistic update: immediately update the UI
    const previousProducts = [...products];

    // Update the local state optimistically
    setProducts(prevProducts =>
      prevProducts.map(product => ({
        ...product,
        variants: product.variants.map(variant => {
          if (variant.containerType?.id === containerId) {
            return {
              ...variant,
              containerType: {
                ...variant.containerType,
                containerMaterial: material,
              },
            };
          }
          return variant;
        }),
      }))
    );

    try {
      const response = await fetch(`/api/container-types/${containerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          containerMaterial: material,
          updatedBy: 'user-selection',
        }),
      });

      if (response.ok) {
        // Success - the optimistic update was correct
        toast({
          title: 'Success',
          description: 'Material updated successfully',
        });
        // Optionally refresh to ensure consistency
        await fetchProducts();
      } else {
        // Revert optimistic update on error
        setProducts(previousProducts);
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to update material',
          variant: 'destructive',
        });
      }
    } catch (err) {
      // Revert optimistic update on error
      setProducts(previousProducts);
      console.error('Error updating material:', err);
      toast({
        title: 'Error',
        description: 'Error updating material',
        variant: 'destructive',
      });
    }
  }

  async function handleBulkMaterialToggle(material: 'metal' | 'poly') {
    if (selectedVariants.size === 0) return;

    try {
      const containerIds = Array.from(selectedVariants)
        .map(variantId => {
          const variant = allVariants.find(v => v.id === variantId);
          return variant?.containerType?.id;
        })
        .filter(Boolean);

      if (containerIds.length === 0) {
        toast({
          title: 'Warning',
          description: 'No configured containers selected',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/container-types', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggleMaterial',
          ids: containerIds,
          data: { material }
        }),
      });

      if (response.ok) {
        await fetchProducts();
        setSelectedVariants(new Set());
        toast({
          title: 'Success',
          description: `Updated ${containerIds.length} containers to ${material}`,
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update materials',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error updating materials:', err);
      toast({
        title: 'Error',
        description: 'Error updating materials',
        variant: 'destructive',
      });
    }
  }

  function openEditDialog(variant: VariantWithProduct) {
    setEditingContainer({
      variantId: variant.id,
      productTitle: variant.productTitle,
      variantTitle: variant.title,
      sku: variant.sku,
      containerType: variant.containerType,
    });

    // Pre-populate form with existing data or defaults
    if (variant.containerType) {
      setEditForm({
        containerMaterial: variant.containerType.containerMaterial,
        containerType: variant.containerType.containerType || '',
        capacity: variant.containerType.capacity || '',
        capacityUnit: variant.containerType.capacityUnit || 'gallons',
        length: variant.containerType.length || '',
        width: variant.containerType.width || '',
        height: variant.containerType.height || '',
        emptyWeight: variant.containerType.emptyWeight || '',
        maxGrossWeight: variant.containerType.maxGrossWeight || '',
        freightClass: variant.containerType.freightClass || '',
        nmfcCode: variant.containerType.nmfcCode || '',
        unRating: variant.containerType.unRating || '',
        hazmatApproved: variant.containerType.hazmatApproved || false,
        isStackable: variant.containerType.isStackable !== false,
        maxStackHeight: variant.containerType.maxStackHeight || 1,
        isReusable: variant.containerType.isReusable !== false,
        requiresLiner: variant.containerType.requiresLiner || false,
        notes: variant.containerType.notes || '',
      });
    } else {
      setEditForm(getDefaultEditForm());
    }

    setIsEditDialogOpen(true);
  }

  async function handleSaveContainer() {
    if (!editingContainer) return;

    try {
      const isUpdate = !!editingContainer.containerType;
      const url = isUpdate 
        ? `/api/container-types/${editingContainer.containerType!.id}`
        : '/api/container-types';
      
      const method = isUpdate ? 'PUT' : 'POST';

      const body = {
        ...editForm,
        shopifyProductId: products.find(p => p.variants.some(v => v.id === editingContainer.variantId))?.id,
        shopifyVariantId: editingContainer.variantId,
        shopifyTitle: editingContainer.productTitle,
        shopifyVariantTitle: editingContainer.variantTitle,
        shopifySku: editingContainer.sku,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchProducts();
        setIsEditDialogOpen(false);
        setEditingContainer(null);
        toast({
          title: 'Success',
          description: isUpdate ? 'Container updated successfully' : 'Container created successfully',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to save container',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error saving container:', err);
      toast({
        title: 'Error',
        description: 'Error saving container',
        variant: 'destructive',
      });
    }
  }

  function toggleVariantSelection(variantId: string) {
    const newSelection = new Set(selectedVariants);
    if (newSelection.has(variantId)) {
      newSelection.delete(variantId);
    } else {
      newSelection.add(variantId);
    }
    setSelectedVariants(newSelection);
  }

  function selectAllVisible() {
    setSelectedVariants(new Set(filteredVariants.map(v => v.id)));
  }

  function clearSelection() {
    setSelectedVariants(new Set());
  }

  return {
    // State
    products,
    loading,
    searchTerm,
    setSearchTerm,
    materialFilter,
    setMaterialFilter,
    selectedVariants,
    isEditDialogOpen,
    setIsEditDialogOpen,
    editingContainer,
    setEditingContainer,
    editForm,
    setEditForm,
    
    // Computed
    allVariants,
    filteredVariants,
    stats,
    
    // Functions
    fetchProducts,
    handleSingleMaterialToggle,
    handleBulkMaterialToggle,
    openEditDialog,
    handleSaveContainer,
    toggleVariantSelection,
    selectAllVisible,
    clearSelection,
  };
}
'use client';

import { Package } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useContainers } from '@/hooks/useContainers';
import ContainerStats from '@/components/containers/ContainerStats';
import ContainerFilters from '@/components/containers/ContainerFilters';
import ContainerTable from '@/components/containers/ContainerTable';

// Code-split the edit dialog for better performance
const ContainerEditDialog = dynamic(
  () => import('@/components/containers/ContainerEditDialog'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-center text-gray-600">Loading editor...</p>
        </div>
      </div>
    ),
  }
);

export default function ContainersPage() {
  const {
    // State
    loading,
    searchTerm,
    setSearchTerm,
    materialFilter,
    setMaterialFilter,
    selectedVariants,
    isEditDialogOpen,
    setIsEditDialogOpen,
    editingContainer,
    editForm,
    setEditForm,
    
    // Computed
    allVariants,
    filteredVariants,
    stats,
    
    // Functions
    handleSingleMaterialToggle,
    handleBulkMaterialToggle,
    openEditDialog,
    handleSaveContainer,
    toggleVariantSelection,
    selectAllVisible,
    clearSelection,
  } = useContainers();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Package className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-2">Loading products...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Container Management</h1>
        <p className="text-gray-600">
          Manage container types and materials for all Shopify product variants
        </p>
      </div>

      <ContainerStats stats={stats} />
      
      <ContainerFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        materialFilter={materialFilter}
        setMaterialFilter={setMaterialFilter}
        selectedVariants={selectedVariants}
        filteredVariantsCount={filteredVariants.length}
        onBulkMaterialToggle={handleBulkMaterialToggle}
        onSelectAllVisible={selectAllVisible}
        onClearSelection={clearSelection}
      />
      
      <ContainerTable
        filteredVariants={filteredVariants}
        allVariantsCount={allVariants.length}
        selectedVariants={selectedVariants}
        onToggleVariantSelection={toggleVariantSelection}
        onSelectAllVisible={selectAllVisible}
        onClearSelection={clearSelection}
        onSingleMaterialToggle={handleSingleMaterialToggle}
        onOpenEditDialog={openEditDialog}
      />
      
      <ContainerEditDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        editingContainer={editingContainer}
        editForm={editForm}
        setEditForm={setEditForm}
        onSave={handleSaveContainer}
      />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Package, Edit, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ContainerType {
  id: string;
  containerMaterial: string;
  containerType: string | null;
  capacity: string | null;
  capacityUnit: string;
  length: string | null;
  width: string | null;
  height: string | null;
  emptyWeight: string | null;
  maxGrossWeight: string | null;
  freightClass: string | null;
  nmfcCode: string | null;
  unRating: string | null;
  hazmatApproved: boolean;
  isStackable: boolean;
  maxStackHeight: number | null;
  isReusable: boolean;
  requiresLiner: boolean;
  notes: string | null;
  isActive: boolean;
}

interface Variant {
  id: string;
  title: string;
  sku: string;
  price?: string;
  option1?: string;
  containerType?: ContainerType | null;
}

interface Product {
  id: string;
  title: string;
  variants: Variant[];
}

interface EditingContainer {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  containerType?: ContainerType | null;
}

export default function ContainersPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [error, setError] = useState('');
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<EditingContainer | null>(null);

  // Form state for editing container
  const [editForm, setEditForm] = useState({
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
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/shopify/products-with-containers');
      const data = await response.json();

      if (data.success) {
        setProducts(data.products);
        setError('');
      } else {
        setError('Failed to fetch products');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Error fetching products');
    } finally {
      setLoading(false);
    }
  };

  // Get all variants across all products
  const allVariants = products.flatMap(product => 
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

  const handleSingleMaterialToggle = async (containerId: string, material: 'metal' | 'poly') => {
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
        await fetchProducts();
        setError('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update material');
      }
    } catch (err) {
      console.error('Error updating material:', err);
      setError('Error updating material');
    }
  };

  const handleBulkMaterialToggle = async (material: 'metal' | 'poly') => {
    if (selectedVariants.size === 0) return;

    try {
      const containerIds = Array.from(selectedVariants)
        .map(variantId => {
          const variant = allVariants.find(v => v.id === variantId);
          return variant?.containerType?.id;
        })
        .filter(Boolean);

      if (containerIds.length === 0) {
        setError('No configured containers selected');
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
        setError('');
      } else {
        setError('Failed to update materials');
      }
    } catch (err) {
      console.error('Error updating materials:', err);
      setError('Error updating materials');
    }
  };

  const openEditDialog = (variant: any) => {
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
      // Reset to defaults for new container
      setEditForm({
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
      });
    }

    setIsEditDialogOpen(true);
  };

  const handleSaveContainer = async () => {
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
        setError('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save container');
      }
    } catch (err) {
      console.error('Error saving container:', err);
      setError('Error saving container');
    }
  };

  const toggleVariantSelection = (variantId: string) => {
    const newSelection = new Set(selectedVariants);
    if (newSelection.has(variantId)) {
      newSelection.delete(variantId);
    } else {
      newSelection.add(variantId);
    }
    setSelectedVariants(newSelection);
  };

  const selectAllVisible = () => {
    setSelectedVariants(new Set(filteredVariants.map(v => v.id)));
  };

  const clearSelection = () => {
    setSelectedVariants(new Set());
  };

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

      {error && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{allVariants.length}</div>
            <div className="text-sm text-gray-600">Total Variants</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {allVariants.filter(v => v.containerType).length}
            </div>
            <div className="text-sm text-gray-600">Configured</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {allVariants.filter(v => v.containerType?.containerMaterial === 'metal').length}
            </div>
            <div className="text-sm text-gray-600">Metal Containers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {allVariants.filter(v => v.containerType?.containerMaterial === 'poly').length}
            </div>
            <div className="text-sm text-gray-600">Poly Containers</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Products/Variants/SKU</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Search by product name, variant, or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="material-filter">Filter by Material</Label>
              <Select value={materialFilter} onValueChange={setMaterialFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="configured">Configured</SelectItem>
                  <SelectItem value="unconfigured">Not Configured</SelectItem>
                  <SelectItem value="metal">Metal</SelectItem>
                  <SelectItem value="poly">Poly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedVariants.size > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">
                  {selectedVariants.size} variant(s) selected
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkMaterialToggle('metal')}
                    className="text-blue-600"
                  >
                    <ToggleLeft className="w-4 h-4 mr-1" />
                    Set to Metal
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkMaterialToggle('poly')}
                    className="text-orange-600"
                  >
                    <ToggleRight className="w-4 h-4 mr-1" />
                    Set to Poly
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearSelection}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={selectAllVisible}>
              Select All Visible ({filteredVariants.length})
            </Button>
            <Button size="sm" variant="outline" onClick={clearSelection}>
              Clear Selection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Variants & Container Types</CardTitle>
          <CardDescription>
            Showing {filteredVariants.length} of {allVariants.length} variants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={filteredVariants.length > 0 && filteredVariants.every(v => selectedVariants.has(v.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectAllVisible();
                        } else {
                          clearSelection();
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Container Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Freight Class</TableHead>
                  <TableHead>UN Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVariants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedVariants.has(variant.id)}
                        onChange={() => toggleVariantSelection(variant.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {variant.productTitle}
                    </TableCell>
                    <TableCell>{variant.title}</TableCell>
                    <TableCell>
                      <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">
                        {variant.sku || 'N/A'}
                      </code>
                    </TableCell>
                    <td className="border border-gray-200 p-3">
                      {variant.containerType ? (
                        <select
                          value={variant.containerType.containerMaterial}
                          onChange={(e) => handleSingleMaterialToggle(variant.containerType!.id, e.target.value as 'metal' | 'poly')}
                          className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            variant.containerType.containerMaterial === 'metal' 
                              ? 'bg-blue-50 text-blue-800' 
                              : 'bg-orange-50 text-orange-800'
                          }`}
                        >
                          <option value="poly">Poly</option>
                          <option value="metal">Metal</option>
                        </select>
                      ) : (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          Not Set
                        </span>
                      )}
                    </td>
                    <TableCell>
                      {variant.containerType?.containerType || '-'}
                    </TableCell>
                    <TableCell>
                      {variant.containerType?.capacity ? 
                        `${variant.containerType.capacity} ${variant.containerType.capacityUnit}` : '-'}
                    </TableCell>
                    <TableCell>
                      {variant.containerType?.length && variant.containerType?.width && variant.containerType?.height ?
                        `${variant.containerType.length}"×${variant.containerType.width}"×${variant.containerType.height}"` : '-'}
                    </TableCell>
                    <TableCell>
                      {variant.containerType?.freightClass || '-'}
                    </TableCell>
                    <TableCell>
                      {variant.containerType?.unRating || '-'}
                    </TableCell>
                    <TableCell>
                      {variant.containerType ? (
                        <div className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-600 mr-1" />
                          <span className="text-green-600 text-sm">Configured</span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <AlertCircle className="h-4 w-4 text-orange-600 mr-1" />
                          <span className="text-orange-600 text-sm">Not Configured</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(variant)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        {variant.containerType ? 'Edit' : 'Configure'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredVariants.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No variants found matching your criteria
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Container Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContainer?.containerType ? 'Edit' : 'Configure'} Container Type
            </DialogTitle>
            <DialogDescription>
              {editingContainer?.productTitle} - {editingContainer?.variantTitle}
              {editingContainer?.sku && (
                <span className="block text-sm mt-1">
                  SKU: <code className="bg-gray-100 px-1 py-0.5 rounded">{editingContainer.sku}</code>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Basic Properties */}
            <div className="space-y-4">
              <h4 className="font-medium">Basic Properties</h4>
              
              <div>
                <Label>Container Material</Label>
                <Select 
                  value={editForm.containerMaterial} 
                  onValueChange={(value) => setEditForm({...editForm, containerMaterial: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poly">Poly</SelectItem>
                    <SelectItem value="metal">Metal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Container Type</Label>
                <Input
                  value={editForm.containerType}
                  onChange={(e) => setEditForm({...editForm, containerType: e.target.value})}
                  placeholder="e.g., drum, tote, pail, carboy"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Capacity</Label>
                  <Input
                    type="number"
                    value={editForm.capacity}
                    onChange={(e) => setEditForm({...editForm, capacity: e.target.value})}
                    placeholder="55"
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select 
                    value={editForm.capacityUnit} 
                    onValueChange={(value) => setEditForm({...editForm, capacityUnit: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gallons">Gallons</SelectItem>
                      <SelectItem value="liters">Liters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Dimensions & Weight */}
            <div className="space-y-4">
              <h4 className="font-medium">Dimensions & Weight</h4>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Length (in)</Label>
                  <Input
                    type="number"
                    value={editForm.length}
                    onChange={(e) => setEditForm({...editForm, length: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Width (in)</Label>
                  <Input
                    type="number"
                    value={editForm.width}
                    onChange={(e) => setEditForm({...editForm, width: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Height (in)</Label>
                  <Input
                    type="number"
                    value={editForm.height}
                    onChange={(e) => setEditForm({...editForm, height: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Empty Weight (lbs)</Label>
                  <Input
                    type="number"
                    value={editForm.emptyWeight}
                    onChange={(e) => setEditForm({...editForm, emptyWeight: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Max Gross Weight (lbs)</Label>
                  <Input
                    type="number"
                    value={editForm.maxGrossWeight}
                    onChange={(e) => setEditForm({...editForm, maxGrossWeight: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Freight & Shipping */}
            <div className="space-y-4">
              <h4 className="font-medium">Freight & Shipping</h4>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Freight Class</Label>
                  <Input
                    value={editForm.freightClass}
                    onChange={(e) => setEditForm({...editForm, freightClass: e.target.value})}
                    placeholder="e.g., 55, 60, 65"
                  />
                </div>
                <div>
                  <Label>NMFC Code</Label>
                  <Input
                    value={editForm.nmfcCode}
                    onChange={(e) => setEditForm({...editForm, nmfcCode: e.target.value})}
                    placeholder="e.g., 156000"
                  />
                </div>
              </div>

              <div>
                <Label>UN Rating</Label>
                <Input
                  value={editForm.unRating}
                  onChange={(e) => setEditForm({...editForm, unRating: e.target.value})}
                  placeholder="e.g., UN/1A1/X1.4/150/19"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={editForm.hazmatApproved}
                  onCheckedChange={(checked) => setEditForm({...editForm, hazmatApproved: checked})}
                />
                <Label>Hazmat Approved</Label>
              </div>
            </div>

            {/* Operational Properties */}
            <div className="space-y-4">
              <h4 className="font-medium">Operational Properties</h4>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editForm.isStackable}
                    onCheckedChange={(checked) => setEditForm({...editForm, isStackable: checked})}
                  />
                  <Label>Stackable</Label>
                </div>
                <div>
                  <Label>Max Stack Height</Label>
                  <Input
                    type="number"
                    value={editForm.maxStackHeight}
                    onChange={(e) => setEditForm({...editForm, maxStackHeight: parseInt(e.target.value) || 1})}
                    min="1"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={editForm.isReusable}
                  onCheckedChange={(checked) => setEditForm({...editForm, isReusable: checked})}
                />
                <Label>Reusable</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={editForm.requiresLiner}
                  onCheckedChange={(checked) => setEditForm({...editForm, requiresLiner: checked})}
                />
                <Label>Requires Liner</Label>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                  placeholder="Additional notes about this container..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveContainer}>
              {editingContainer?.containerType ? 'Update' : 'Create'} Container Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
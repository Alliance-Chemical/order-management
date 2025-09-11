'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, CheckCircle2, AlertCircle } from 'lucide-react';
import type { VariantWithProduct } from '@/types/containers';

interface ContainerTableProps {
  filteredVariants: VariantWithProduct[];
  allVariantsCount: number;
  selectedVariants: Set<string>;
  onToggleVariantSelection: (variantId: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onSingleMaterialToggle: (containerId: string, material: 'metal' | 'poly') => void;
  onOpenEditDialog: (variant: VariantWithProduct) => void;
}

export default function ContainerTable({
  filteredVariants,
  allVariantsCount,
  selectedVariants,
  onToggleVariantSelection,
  onSelectAllVisible,
  onClearSelection,
  onSingleMaterialToggle,
  onOpenEditDialog,
}: ContainerTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Variants & Container Types</CardTitle>
        <CardDescription>
          Showing {filteredVariants.length} of {allVariantsCount} variants
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
                        onSelectAllVisible();
                      } else {
                        onClearSelection();
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
                      onChange={() => onToggleVariantSelection(variant.id)}
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
                  <TableCell>
                    {variant.containerType ? (
                      <select
                        value={variant.containerType.containerMaterial}
                        onChange={(e) => onSingleMaterialToggle(variant.containerType!.id, e.target.value as 'metal' | 'poly')}
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
                  </TableCell>
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
                      onClick={() => onOpenEditDialog(variant)}
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
  );
}
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ToggleLeft, ToggleRight } from 'lucide-react';

interface ContainerFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  materialFilter: string;
  setMaterialFilter: (filter: string) => void;
  selectedVariants: Set<string>;
  filteredVariantsCount: number;
  onBulkMaterialToggle: (material: 'metal' | 'poly') => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
}

export default function ContainerFilters({
  searchTerm,
  setSearchTerm,
  materialFilter,
  setMaterialFilter,
  selectedVariants,
  filteredVariantsCount,
  onBulkMaterialToggle,
  onSelectAllVisible,
  onClearSelection,
}: ContainerFiltersProps) {
  return (
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
                  onClick={() => onBulkMaterialToggle('metal')}
                  className="text-blue-600"
                >
                  <ToggleLeft className="w-4 h-4 mr-1" />
                  Set to Metal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBulkMaterialToggle('poly')}
                  className="text-orange-600"
                >
                  <ToggleRight className="w-4 h-4 mr-1" />
                  Set to Poly
                </Button>
                <Button size="sm" variant="ghost" onClick={onClearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={onSelectAllVisible}>
            Select All Visible ({filteredVariantsCount})
          </Button>
          <Button size="sm" variant="outline" onClick={onClearSelection}>
            Clear Selection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
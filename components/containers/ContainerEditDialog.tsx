'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import type { EditingContainer, ContainerEditForm } from '@/types/containers';

interface ContainerEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingContainer: EditingContainer | null;
  editForm: ContainerEditForm;
  setEditForm: (form: ContainerEditForm) => void;
  onSave: () => void;
}

export default function ContainerEditDialog({
  isOpen,
  onOpenChange,
  editingContainer,
  editForm,
  setEditForm,
  onSave,
}: ContainerEditDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                <Label className="flex items-center gap-2">
                  Freight Class
                  <InfoTooltip
                    title="Freight Class"
                    content="NMFC freight classification (50-500). Determines shipping costs based on density, handling, and liability. Lower numbers = denser/cheaper shipping."
                    example="55, 60, 65, 70"
                  />
                </Label>
                <Input
                  value={editForm.freightClass}
                  onChange={(e) => setEditForm({...editForm, freightClass: e.target.value})}
                  placeholder="e.g., 55, 60, 65"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  NMFC Code
                  <InfoTooltip
                    title="NMFC Code"
                    content="National Motor Freight Classification code. A standardized system to classify freight for LTL shipping."
                    example="156000"
                  />
                </Label>
                <Input
                  value={editForm.nmfcCode}
                  onChange={(e) => setEditForm({...editForm, nmfcCode: e.target.value})}
                  placeholder="e.g., 156000"
                />
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                UN Rating
                <InfoTooltip
                  title="UN Rating"
                  content="UN performance rating for hazmat packaging. Format: UN / Container Type / Packing Group / Max Weight (kg) / Year. Required for shipping hazardous materials."
                  example="UN/1A1/X1.4/150/19"
                />
              </Label>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            {editingContainer?.containerType ? 'Update' : 'Create'} Container Type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
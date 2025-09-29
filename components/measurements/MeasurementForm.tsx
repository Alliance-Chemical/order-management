'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ScaleIcon, CubeIcon } from '@heroicons/react/24/outline';
import type { MeasurementEntry } from '@/hooks/useFinalMeasurements';

type EditableMeasurementField = 'weight' | 'weightUnit' | 'length' | 'width' | 'height' | 'dimensionUnit';

interface MeasurementFormProps {
  entry: MeasurementEntry;
  onUpdate: (field: EditableMeasurementField, value: string) => void;
  title?: string;
}

export function MeasurementForm({ entry, onUpdate, title }: MeasurementFormProps) {
  const weightInputId = `weight-input-${entry.id}`;
  const lengthInputId = `length-${entry.id}`;
  const widthInputId = `width-${entry.id}`;
  const heightInputId = `height-${entry.id}`;
  const weightUnitId = `weight-unit-${entry.id}`;
  const dimensionUnitId = `dimension-unit-${entry.id}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center mb-4">
            <ScaleIcon className="h-5 w-5 text-gray-500 mr-2" />
            <h3 className="text-lg font-medium">{title ? `${title} Weight` : 'Weight'}</h3>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor={weightInputId}>Weight</Label>
              <Input
                id={weightInputId}
                type="number"
                step="0.1"
                value={entry.weight}
                onChange={(e) => onUpdate('weight', e.target.value)}
                placeholder="0.0"
                className="text-lg"
              />
            </div>
            <div className="w-24">
              <Label htmlFor={weightUnitId}>Unit</Label>
              <select
                id={weightUnitId}
                value={entry.weightUnit}
                onChange={(e) => onUpdate('weightUnit', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center mb-4">
            <CubeIcon className="h-5 w-5 text-gray-500 mr-2" />
            <h3 className="text-lg font-medium">{title ? `${title} Dimensions` : 'Dimensions'}</h3>
          </div>
          <div className="space-y-3">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor={lengthInputId}>Length</Label>
                <Input
                  id={lengthInputId}
                  type="number"
                  step="0.1"
                  value={entry.length}
                  onChange={(e) => onUpdate('length', e.target.value)}
                  placeholder="0.0"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor={widthInputId}>Width</Label>
                <Input
                  id={widthInputId}
                  type="number"
                  step="0.1"
                  value={entry.width}
                  onChange={(e) => onUpdate('width', e.target.value)}
                  placeholder="0.0"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor={heightInputId}>Height</Label>
                <Input
                  id={heightInputId}
                  type="number"
                  step="0.1"
                  value={entry.height}
                  onChange={(e) => onUpdate('height', e.target.value)}
                  placeholder="0.0"
                />
              </div>
              <div className="w-20">
                <Label htmlFor={dimensionUnitId}>Unit</Label>
                <select
                  id={dimensionUnitId}
                  value={entry.dimensionUnit}
                  onChange={(e) => onUpdate('dimensionUnit', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="in">in</option>
                  <option value="cm">cm</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

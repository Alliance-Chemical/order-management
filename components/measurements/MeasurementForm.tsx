'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ScaleIcon, CubeIcon } from '@heroicons/react/24/outline';

interface MeasurementFormProps {
  measurements: {
    weight: string;
    weightUnit: string;
    length: string;
    width: string;
    height: string;
    dimensionUnit: string;
  };
  onUpdate: (field: string, value: string) => void;
}

export function MeasurementForm({ measurements, onUpdate }: MeasurementFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center mb-4">
            <ScaleIcon className="h-5 w-5 text-gray-500 mr-2" />
            <h3 className="text-lg font-medium">Weight</h3>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="weight-input">Weight</Label>
              <Input
                id="weight-input"
                type="number"
                step="0.1"
                value={measurements.weight}
                onChange={(e) => onUpdate('weight', e.target.value)}
                placeholder="0.0"
                className="text-lg"
              />
            </div>
            <div className="w-24">
              <Label htmlFor="weight-unit">Unit</Label>
              <select
                id="weight-unit"
                value={measurements.weightUnit}
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
            <h3 className="text-lg font-medium">Dimensions</h3>
          </div>
          <div className="space-y-3">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="length">Length</Label>
                <Input
                  id="length"
                  type="number"
                  step="0.1"
                  value={measurements.length}
                  onChange={(e) => onUpdate('length', e.target.value)}
                  placeholder="0.0"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="width">Width</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  value={measurements.width}
                  onChange={(e) => onUpdate('width', e.target.value)}
                  placeholder="0.0"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="height">Height</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  value={measurements.height}
                  onChange={(e) => onUpdate('height', e.target.value)}
                  placeholder="0.0"
                />
              </div>
              <div className="w-20">
                <Label htmlFor="dim-unit">Unit</Label>
                <select
                  id="dim-unit"
                  value={measurements.dimensionUnit}
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
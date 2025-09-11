'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TruckIcon, CubeIcon } from '@heroicons/react/24/outline';

interface MeasurementModeTabsProps {
  mode: 'single' | 'pallets';
  onChange: (mode: 'single' | 'pallets') => void;
  children: {
    single: React.ReactNode;
    pallets: React.ReactNode;
  };
}

export function MeasurementModeTabs({ mode, onChange, children }: MeasurementModeTabsProps) {
  return (
    <Tabs value={mode} onValueChange={(v) => onChange(v as 'single' | 'pallets')}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="single" className="flex items-center gap-2">
          <CubeIcon className="h-4 w-4" />
          Single Container
        </TabsTrigger>
        <TabsTrigger value="pallets" className="flex items-center gap-2">
          <TruckIcon className="h-4 w-4" />
          Multiple Pallets
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="single" className="mt-6">
        {children.single}
      </TabsContent>
      
      <TabsContent value="pallets" className="mt-6">
        {children.pallets}
      </TabsContent>
    </Tabs>
  );
}
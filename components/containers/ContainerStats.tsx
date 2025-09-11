'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { ContainerStats } from '@/types/containers';

interface ContainerStatsProps {
  stats: ContainerStats;
}

export default function ContainerStats({ stats }: ContainerStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{stats.totalVariants}</div>
          <div className="text-sm text-gray-600">Total Variants</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-green-600">
            {stats.configured}
          </div>
          <div className="text-sm text-gray-600">Configured</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-blue-600">
            {stats.metalContainers}
          </div>
          <div className="text-sm text-gray-600">Metal Containers</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-orange-600">
            {stats.polyContainers}
          </div>
          <div className="text-sm text-gray-600">Poly Containers</div>
        </CardContent>
      </Card>
    </div>
  );
}
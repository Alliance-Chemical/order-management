'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';

interface QualityRecord {
  id: string;
  checkType: string;
  result: string;
  checkedBy: string;
  checkedAt: string;
  notes?: string;
}

interface QualityDashboardProps {
  workspaceId: string;
}

const CHECK_TYPE_LABELS = {
  'concentration_verify': 'Concentration Verification',
  'container_inspect': 'Container Inspection',
  'label_check': 'Label Check',
  'pre_ship_inspection': 'Pre-Ship Inspection',
  'batch_quality': 'Batch Quality Check',
};

const RESULT_CONFIG = {
  'pass': { label: 'Pass', icon: CheckCircle, color: 'text-green-600', variant: 'default' as const },
  'fail': { label: 'Fail', icon: XCircle, color: 'text-red-600', variant: 'destructive' as const },
  'conditional': { label: 'Conditional', icon: AlertCircle, color: 'text-yellow-600', variant: 'warning' as const },
};

export default function QualityDashboard({ workspaceId }: QualityDashboardProps) {
  const [qualityRecords, setQualityRecords] = useState<QualityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQualityRecords();
  }, [workspaceId]);

  const fetchQualityRecords = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/quality?type=quality-records&workspaceId=${workspaceId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch quality records');
      }

      const data = await response.json();

      if (data.success) {
        setQualityRecords(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch quality records');
      }
    } catch (err) {
      console.error('Error fetching quality records:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch quality records');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 animate-spin" />
          <span>Loading quality records...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // Calculate summary stats
  const totalChecks = qualityRecords.length;
  const passedChecks = qualityRecords.filter(r => r.result === 'pass').length;
  const failedChecks = qualityRecords.filter(r => r.result === 'fail').length;
  const conditionalChecks = qualityRecords.filter(r => r.result === 'conditional').length;
  const passRate = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Checks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalChecks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{passRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{passedChecks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedChecks + conditionalChecks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Records List */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Records</CardTitle>
          <CardDescription>
            ISO 9001 compliance tracking for this order
          </CardDescription>
        </CardHeader>
        <CardContent>
          {qualityRecords.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Quality Records</h3>
              <p className="text-gray-500">
                Quality checks will appear here once recorded during inspections.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {qualityRecords.map((record) => {
                const resultConfig = RESULT_CONFIG[record.result as keyof typeof RESULT_CONFIG];
                const ResultIcon = resultConfig?.icon || CheckCircle;

                return (
                  <div
                    key={record.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-start gap-3">
                      <ResultIcon className={`h-5 w-5 mt-0.5 ${resultConfig?.color || 'text-gray-400'}`} />
                      <div>
                        <div className="font-medium">
                          {CHECK_TYPE_LABELS[record.checkType as keyof typeof CHECK_TYPE_LABELS] || record.checkType}
                        </div>
                        <div className="text-sm text-gray-500">
                          By {record.checkedBy} • {new Date(record.checkedAt).toLocaleString()}
                        </div>
                        {record.notes && (
                          <div className="text-sm text-gray-600 mt-1">
                            {record.notes}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant={resultConfig?.variant || 'default'}>
                      {resultConfig?.label || record.result}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
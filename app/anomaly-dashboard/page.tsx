'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ExclamationTriangleIcon, 
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ShieldExclamationIcon 
} from '@heroicons/react/24/outline';
import { useToast } from '@/hooks/use-toast';

type HighRiskCombination = {
  product: string;
  customer: string;
  predicted_failure_rate: number;
  common_issues?: string[];
};

type RiskPattern = {
  pattern: string;
  risk_score: number;
  affected_products?: string[];
  recommendation?: string;
};

type AlertEntry = {
  product?: string;
  customer?: string;
  risk?: number;
  action?: string;
};

type AnalysisSummary = {
  period: string;
  dataPoints: number;
  uniqueProducts: number;
  uniqueCustomers: number;
};

type AnomalyDashboardResponse = {
  success: boolean;
  analysis?: AnalysisSummary;
  riskPatterns?: RiskPattern[];
  highRiskCombinations?: HighRiskCombination[];
  alerts?: AlertEntry[];
};

export default function AnomalyDashboard() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnomalyDashboardResponse | null>(null);
  const [selectedDays, setSelectedDays] = useState(30);

  const runAnalysis = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/anomaly-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: selectedDays, runAnalysis: true })
      });
      
      const data = await response.json() as AnomalyDashboardResponse;
      if (data.success) {
        setAnalysisData(data);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        title: "Error",
        description: "Failed to run anomaly detection",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false);
    }
  }, [selectedDays, toast]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                AI Anomaly Detection Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Predictive analysis powered by Google Gemini AI
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <select
                value={selectedDays}
                onChange={(e) => setSelectedDays(Number(e.target.value))}
                className="border rounded-lg px-4 py-2"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              
              <button
                onClick={runAnalysis}
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Analyzing...' : 'Run Analysis'}
              </button>
            </div>
          </div>
        </div>

        {analysisData && (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Data Points</p>
                    <p className="text-2xl font-bold">{analysisData.analysis?.dataPoints || 0}</p>
                  </div>
                  <ChartBarIcon className="h-10 w-10 text-blue-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Risk Patterns</p>
                    <p className="text-2xl font-bold">{analysisData.riskPatterns?.length || 0}</p>
                  </div>
                  <ArrowTrendingUpIcon className="h-10 w-10 text-yellow-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">High Risk Items</p>
                    <p className="text-2xl font-bold">{analysisData.highRiskCombinations?.length || 0}</p>
                  </div>
                  <ExclamationTriangleIcon className="h-10 w-10 text-red-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Alerts</p>
                    <p className="text-2xl font-bold">{analysisData.alerts?.length || 0}</p>
                  </div>
                  <ShieldExclamationIcon className="h-10 w-10 text-purple-500" />
                </div>
              </div>
            </div>

            {/* High Risk Combinations */}
            {analysisData.highRiskCombinations?.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4 text-red-600">
                  ⚠️ High Risk Product-Customer Combinations
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Product</th>
                        <th className="px-4 py-2 text-left">Customer</th>
                        <th className="px-4 py-2 text-left">Predicted Failure Rate</th>
                        <th className="px-4 py-2 text-left">Common Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analysisData.highRiskCombinations ?? []).map((combo, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-4 py-3">{combo.product}</td>
                          <td className="px-4 py-3">{combo.customer}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-sm font-medium ${
                              combo.predicted_failure_rate > 0.5 
                                ? 'bg-red-100 text-red-800'
                                : combo.predicted_failure_rate > 0.3
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {(combo.predicted_failure_rate * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {combo.common_issues?.join(', ') || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Risk Patterns */}
            {analysisData.riskPatterns?.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Identified Risk Patterns</h2>
                <div className="space-y-4">
                  {(analysisData.riskPatterns ?? []).map((pattern, i) => (
                    <div key={i} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{pattern.pattern}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {pattern.recommendation}
                          </p>
                          <div className="mt-2 text-xs text-gray-500">
                            Affects: {pattern.affected_products?.join(', ') || 'Multiple products'}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            pattern.risk_score > 70 
                              ? 'bg-red-100 text-red-800'
                              : pattern.risk_score > 40
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            Risk: {pattern.risk_score}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {analysisData.recommendations?.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 text-blue-900">
                  AI Recommendations
                </h2>
                <ul className="space-y-2">
                  {analysisData.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface InspectionState {
  orderId: string;
  orderNumber: string;
  workflowPhase: string;
  status: string;
  currentStep?: string;
  completedSteps?: string[];
  queuedItems?: any[];
  lastSync?: string;
}

export default function AdminDebugPanel() {
  const { toast } = useToast()
  const [inspections, setInspections] = useState<InspectionState[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<InspectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchInspectionStates();
    const interval = setInterval(fetchInspectionStates, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchInspectionStates = async () => {
    try {
      // Fetch active workspaces
      const response = await fetch('/api/admin/debug/inspections');
      if (response.ok) {
        const data = await response.json();
        setInspections(data.inspections || []);
      }
      
      // Also check local storage for offline queue
      const queue = localStorage.getItem('inspection_queue');
      if (queue) {
        const queuedItems = JSON.parse(queue);
        if (queuedItems.length > 0) {
          setInspections(prev => [...prev, {
            orderId: 'OFFLINE',
            orderNumber: 'Queued Items',
            workflowPhase: 'offline',
            status: 'queued',
            queuedItems
          }]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch inspection states:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearInspection = async (orderId: string) => {
    if (orderId === 'OFFLINE') {
      // Clear offline queue
      localStorage.removeItem('inspection_queue');
      fetchInspectionStates();
      return;
    }

    try {
      const response = await fetch(`/api/admin/debug/clear/${orderId}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        fetchInspectionStates();
        setSelectedInspection(null);
      }
    } catch (error) {
      console.error('Failed to clear inspection:', error);
    }
  };

  const resetDemo = async () => {
    if (!confirm('This will reset all demo data. Continue?')) return;
    
    try {
      const response = await fetch('/api/demo/reset', {
        method: 'POST'
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Demo data reset successfully!"
        })
        fetchInspectionStates();
      }
    } catch (error) {
      console.error('Failed to reset demo:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Admin Debug Panel</h1>
          <div className="animate-pulse">
            <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
            <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Debug Panel</h1>
          <div className="flex gap-4">
            <button
              onClick={resetDemo}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              Reset Demo Data
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Back to App
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Inspections List */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Active Inspections</h2>
            
            {inspections.length === 0 ? (
              <p className="text-gray-500">No active inspections</p>
            ) : (
              <div className="space-y-3">
                {inspections.map((inspection) => (
                  <div
                    key={inspection.orderId}
                    onClick={() => setSelectedInspection(inspection)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedInspection?.orderId === inspection.orderId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">
                          Order #{inspection.orderNumber}
                        </div>
                        <div className="text-sm text-gray-600">
                          Phase: {inspection.workflowPhase}
                        </div>
                        <div className="text-sm text-gray-600">
                          Status: <span className={`font-medium ${
                            inspection.status === 'active' ? 'text-green-600' :
                            inspection.status === 'queued' ? 'text-yellow-600' :
                            'text-gray-600'
                          }`}>{inspection.status}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearInspection(inspection.orderId);
                        }}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inspection Details */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Inspection Details</h2>
            
            {selectedInspection ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Order ID</label>
                  <div className="font-mono">{selectedInspection.orderId}</div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Current Step</label>
                  <div>{selectedInspection.currentStep || 'N/A'}</div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Completed Steps</label>
                  <div className="mt-1">
                    {selectedInspection.completedSteps?.length ? (
                      <ul className="space-y-1">
                        {selectedInspection.completedSteps.map((step, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-sm">{step}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-500">No steps completed</span>
                    )}
                  </div>
                </div>
                
                {selectedInspection.queuedItems && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Queued Items</label>
                    <div className="mt-1 p-2 bg-yellow-50 rounded">
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(selectedInspection.queuedItems, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                
                <div className="pt-4 flex gap-2">
                  <button
                    onClick={() => {
                      if (selectedInspection.orderId !== 'OFFLINE') {
                        router.push(`/workspace/${selectedInspection.orderId}`);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    disabled={selectedInspection.orderId === 'OFFLINE'}
                  >
                    Go to Workspace
                  </button>
                  <button
                    onClick={() => clearInspection(selectedInspection.orderId)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Force Clear
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Select an inspection to view details</p>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">System Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{inspections.length}</div>
              <div className="text-sm text-gray-600">Active Inspections</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {navigator.onLine ? 'Online' : 'Offline'}
              </div>
              <div className="text-sm text-gray-600">Connection Status</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {localStorage.getItem('inspection_queue') ? 
                  JSON.parse(localStorage.getItem('inspection_queue')!).length : 0}
              </div>
              <div className="text-sm text-gray-600">Queued Items</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {process.env.NODE_ENV}
              </div>
              <div className="text-sm text-gray-600">Environment</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
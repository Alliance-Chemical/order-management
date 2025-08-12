'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { WorkspaceData, ViewMode, WorkerStep, InspectionResults } from '@/lib/types/worker-view';

// Import worker view components
import EntryScreen from '@/components/workspace/worker-view/EntryScreen';
import InspectionScreen from '@/components/workspace/worker-view/InspectionScreen';

// Import existing supervisor view components
import OrderOverview from '@/components/workspace/OrderOverview';
import PreMixInspection from '@/components/workspace/supervisor-view/PreMixInspection';
import PreShipInspection from '@/components/workspace/supervisor-view/PreShipInspection';
import DocumentsHub from '@/components/workspace/DocumentsHub';
import ActivityTimeline from '@/components/workspace/ActivityTimeline';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function WorkspacePage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('worker'); // Default to worker view
  const [workerStep, setWorkerStep] = useState<WorkerStep>('entry');
  const [activeTab, setActiveTab] = useState('overview'); // For supervisor view
  const [selectedItem, setSelectedItem] = useState<any>(null); // Track which item is being inspected

  useEffect(() => {
    fetchWorkspace();
    const interval = setInterval(fetchWorkspace, 30000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchWorkspace = async () => {
    try {
      const response = await fetch(`/api/workspace/${orderId}`, {
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY || '',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setWorkspace(data);
      } else {
        // If no data, set a test workspace for demo
        setWorkspace({
          id: orderId,
          orderId: parseInt(orderId),
          orderNumber: orderId,
          status: 'active',
          workflowPhase: orderId === '12345' ? 'pre_mix' : 'pending', // Demo mode for order 12345
          shipstationData: orderId === '12345' ? {
            shipTo: {
              name: 'Test Customer Inc.',
              company: 'Alliance Chemical Test',
              street1: '123 Test Street',
              city: 'Test City',
              state: 'TX',
              postalCode: '12345',
              country: 'US',
              phone: '555-0123'
            },
            items: [
              {
                name: 'D-Limonene 99%',
                quantity: 5,
                sku: 'DL-99-5GAL'
              },
              {
                name: 'Isopropyl Alcohol 70%',
                quantity: 10,
                sku: 'IPA-70-1GAL'
              }
            ]
          } : {},
          moduleStates: {},
          documents: [],
          activities: [],
          totalDocumentSize: 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch workspace:', error);
      // Set test workspace on error for demo
      setWorkspace({
        id: orderId,
        orderId: parseInt(orderId),
        orderNumber: orderId,
        status: 'active',
        workflowPhase: orderId === '12345' ? 'pre_mix' : 'pending', // Demo mode for order 12345
        shipstationData: orderId === '12345' ? {
          shipTo: {
            name: 'Test Customer Inc.',
            company: 'Alliance Chemical Test',
            street1: '123 Test Street',
            city: 'Test City',
            state: 'TX',
            postalCode: '12345',
            country: 'US',
            phone: '555-0123'
          },
          items: [
            {
              name: 'D-Limonene 99%',
              quantity: 5,
              sku: 'DL-99-5GAL'
            },
            {
              name: 'Isopropyl Alcohol 70%',
              quantity: 10,
              sku: 'IPA-70-1GAL'
            }
          ]
        } : {},
        moduleStates: {},
        documents: [],
        activities: [],
        totalDocumentSize: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModuleStateChange = async (module: string, state: Record<string, any>) => {
    try {
      const response = await fetch(`/api/workspace/${orderId}/module`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY || '',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ module, state }),
      });

      if (response.ok && workspace) {
        setWorkspace({
          ...workspace,
          moduleStates: {
            ...workspace.moduleStates,
            [module]: state,
          },
        });
      }
    } catch (error) {
      console.error('Failed to update module state:', error);
    }
  };

  const handleWorkerInspectionComplete = async (results: InspectionResults) => {
    if (!workspace) return;
    
    // Save inspection results
    const module = workspace.workflowPhase === 'pre_mix' ? 'pre_mix' : 'pre_ship';
    await handleModuleStateChange(module, results as unknown as Record<string, any>);
    
    // Move to complete state
    setWorkerStep('complete');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Workspace Not Found</h1>
          <p className="mt-2 text-xl text-slate-600">Order ID: {orderId}</p>
        </div>
      </div>
    );
  }

  // Worker View Routing based on workflowPhase
  if (viewMode === 'worker') {
    // Determine if we should show worker view based on workflowPhase
    if (workspace.workflowPhase === 'pre_mix' || workspace.workflowPhase === 'pre_ship') {
      if (workerStep === 'entry') {
        return (
          <EntryScreen 
            workspace={workspace}
            onStart={() => setWorkerStep('inspection')}
            onSwitchToSupervisor={() => setViewMode('supervisor')}
            onSelectItem={(item) => {
              setSelectedItem(item);
              setWorkerStep('inspection');
            }}
          />
        );
      } else if (workerStep === 'inspection') {
        // Get inspection items based on workflow phase
        // Dynamically adjust inspection items based on workflow assignments
        const sourceAssignments = (workspace.moduleStates as any)?.sourceAssignments || [];
        const hasDirectResellItems = sourceAssignments.some((a: any) => a.workflowType === 'direct_resell');
        const hasPumpAndFillItems = sourceAssignments.some((a: any) => a.workflowType === 'pump_and_fill');
        
        // Build inspection items based on workflow types
        let inspectionItems = [];
        if (workspace.workflowPhase === 'pre_mix') {
          // Only include source scanning for pump & fill items
          if (hasPumpAndFillItems) {
            inspectionItems.push(
              { id: 'scan_source_qr', label: 'Scan Source QR', description: 'Scan QR code on source container' },
              { id: 'verify_source_chemical', label: 'Verify Source Chemical', description: 'Confirm source container matches expected chemical' }
            );
          }
          
          // Common inspection steps for all workflows
          inspectionItems.push(
            { id: 'container_condition', label: 'Container Condition', description: 'Check for damage, leaks, or contamination' },
            { id: 'label_verification', label: 'Label Verification', description: 'Verify product labels match order' },
            { id: 'quantity_check', label: 'Quantity Check', description: 'Confirm correct quantity of containers' },
            { id: 'scan_destination_qr', label: 'Scan Destination QR', description: 'Scan QR code on each destination container' },
            { id: 'hazmat_placards', label: 'Hazmat Placards', description: 'Verify proper hazmat labeling if required' },
            { id: 'seal_integrity', label: 'Seal Integrity', description: 'Check all seals are intact' }
          );
        } else {
          inspectionItems = [
          { id: 'final_container_check', label: 'Final Container Check', description: 'Verify containers are clean and sealed' },
          { id: 'shipping_labels', label: 'Shipping Labels', description: 'Confirm all shipping labels are correct' },
          { id: 'pallet_stability', label: 'Pallet Stability', description: 'Check pallet is stable and properly wrapped' },
          { id: 'documentation_complete', label: 'Documentation Complete', description: 'All required documents are included' },
          { id: 'weight_verification', label: 'Weight Verification', description: 'Verify total weight matches order' },
          ];
        }

        // If a specific item was selected, show only that item
        const itemsToInspect = selectedItem ? [selectedItem] : (workspace.shipstationData?.items || []);
        
        return (
          <InspectionScreen
            orderId={orderId}
            orderNumber={workspace.orderNumber}
            customerName={workspace.shipstationData?.shipTo?.name}
            orderItems={itemsToInspect}
            workflowPhase={workspace.workflowPhase}
            workflowType={workspace.workflowType}
            items={inspectionItems}
            onComplete={(results) => {
              handleWorkerInspectionComplete(results);
              // After completing inspection for this item, go back to task list
              setSelectedItem(null);
              setWorkerStep('entry');
            }}
            onSwitchToSupervisor={() => setViewMode('supervisor')}
          />
        );
      } else {
        // Complete state
        return (
          <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="text-center">
              <div className="mb-6">
                <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h1 className="text-4xl font-bold text-slate-900 mb-4">Inspection Complete!</h1>
              <p className="text-xl text-slate-600 mb-8">Order #{workspace.orderNumber} has been processed</p>
              <button
                onClick={() => {
                  setWorkerStep('entry');
                  fetchWorkspace(); // Refresh data
                }}
                className="px-8 py-4 bg-green-600 text-white text-xl font-bold rounded-lg hover:bg-green-700"
              >
                START NEW INSPECTION
              </button>
            </div>
          </div>
        );
      }
    }
  }

  // Supervisor View (Original tabbed interface)
  const tabs = [
    { id: 'overview', label: 'Overview', component: OrderOverview },
    { id: 'pre_mix', label: 'Pre-Mix', component: PreMixInspection },
    { id: 'pre_ship', label: 'Pre-Ship', component: PreShipInspection },
    { id: 'documents', label: 'Documents', component: DocumentsHub },
    { id: 'activity', label: 'Activity', component: ActivityTimeline },
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || OrderOverview;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* View Mode Toggle */}
      <div className="bg-indigo-600 text-white px-4 py-2">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span className="text-sm font-medium">Current View: Supervisor</span>
          <button
            onClick={() => {
              setViewMode('worker');
              setWorkerStep('entry');
            }}
            className="text-sm underline hover:no-underline"
          >
            Switch to Worker View
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Order #{workspace.orderNumber}
                </h1>
                <div className="mt-1 flex items-center gap-4 text-sm text-slate-500">
                  <span>ID: {workspace.orderId}</span>
                  {workspace.shipstationData?.orderDate && (
                    <>
                      <span>•</span>
                      <span>{new Date(workspace.shipstationData.orderDate).toLocaleDateString()}</span>
                    </>
                  )}
                  {workspace.status && (
                    <>
                      <span>•</span>
                      <span className={classNames(
                        'px-2 py-0.5 rounded-md text-xs font-medium',
                        workspace.status === 'active' ? 'bg-green-100 text-green-700' :
                        workspace.status === 'ready_to_ship' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      )}>
                        {workspace.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">
                  Export
                </button>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                  Process Order
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 py-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={classNames(
                  activeTab === tab.id
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-white text-slate-600 border-transparent hover:bg-slate-50',
                  'px-4 py-2 rounded-lg text-sm font-medium border transition-all'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ActiveComponent
          orderId={orderId}
          workspace={workspace}
          initialState={workspace.moduleStates?.[activeTab] || {}}
          onStateChange={(state: Record<string, any>) => handleModuleStateChange(activeTab, state)}
        />
      </main>
    </div>
  );
}
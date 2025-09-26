'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { WorkspaceData, ViewMode, AgentStep, InspectionResults } from '@/lib/types/agent-view';
import { buildInspectionItems } from '@/lib/inspection/items';
import { getWorkspace, updateWorkspaceModuleState } from '@/app/actions/workspace';

// Import worker view components
import EntryScreen from '@/components/workspace/agent-view/EntryScreen';
import ResilientInspectionScreen from '@/components/workspace/agent-view/ResilientInspectionScreen';
import { ConnectionStatus } from '@/components/ui/connection-status';

// Import existing supervisor view components
import OrderOverview from '@/components/workspace/OrderOverview';
import PreMixInspection from '@/components/workspace/supervisor-view/PreMixInspection';
import PreShipInspection from '@/components/workspace/supervisor-view/PreShipInspection';
import DocumentsHub from '@/components/workspace/DocumentsHub';
import ActivityTimeline from '@/components/workspace/ActivityTimeline';
import PrintPreparationModalSimplified from '@/components/desktop/PrintPreparationModalSimplified';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const WORKER_VIEW_PHASES = new Set<WorkspaceData['workflowPhase']>([
  'pending',
  'planning',
  'pre_mix',
  'pre_ship',
  'ready',
  'ready_to_ship',
  'shipping'
]);

const MODULE_STATE_ALIASES: Record<string, string[]> = {
  pre_mix: ['pre_mix', 'preMix'],
  pre_ship: ['pre_ship', 'preShip'],
};

const resolveWorkerInspectionPhase = (
  phase: WorkspaceData['workflowPhase']
): 'pre_mix' | 'pre_ship' => (
  phase === 'pre_ship' || phase === 'ready_to_ship' || phase === 'shipping'
    ? 'pre_ship'
    : 'pre_mix'
);

export default function WorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const orderId = params.orderId as string;
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const viewQuery = searchParams?.get('view');
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    viewQuery === 'supervisor' ? 'supervisor' : 'worker'
  );
  const [workerStep, setWorkerStep] = useState<AgentStep>(() => {
    const hasQrParam = Boolean(searchParams?.get('sc'));
    const explicitWorkerView = searchParams?.get('view') === 'worker';
    return hasQrParam || explicitWorkerView ? 'inspection' : 'entry';
  });
  const [activeTab, setActiveTab] = useState('overview'); // For supervisor view
  const [selectedItem, setSelectedItem] = useState<any>(null); // Track which item is being inspected
  const [showPrintModal, setShowPrintModal] = useState(false);
  const autoStartRef = useRef(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  useEffect(() => {
    const queryMode: ViewMode = viewQuery === 'supervisor' ? 'supervisor' : 'worker';
    setViewMode((current) => (current === queryMode ? current : queryMode));
  }, [viewQuery]);

  useEffect(() => {
    const hasQrParam = Boolean(searchParams?.get('sc'));
    const explicitWorkerView = searchParams?.get('view') === 'worker';
    const shouldAutoStart = (hasQrParam || explicitWorkerView) && viewMode === 'worker';

    if (shouldAutoStart && workerStep === 'entry' && !autoStartRef.current) {
      autoStartRef.current = true;
      setWorkerStep('inspection');
    }
  }, [searchParams, viewMode, workerStep]);

  const updateViewMode = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      const params = new URLSearchParams(searchParams ? searchParams.toString() : '');

      if (mode === 'worker') {
        params.delete('view');
      } else {
        params.set('view', mode);
      }

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const switchToSupervisor = useCallback(() => {
    updateViewMode('supervisor');
  }, [updateViewMode]);

  const switchToWorker = useCallback(() => {
    setWorkerStep('entry');
    setRedirectCountdown(null);
    updateViewMode('worker');
  }, [updateViewMode]);

  useEffect(() => {
    fetchWorkspace();
    const interval = setInterval(fetchWorkspace, 30000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchWorkspace = async () => {
    try {
      const result = await getWorkspace(orderId);
      
      if (result.success && result.workspace) {
        setWorkspace(result.workspace);
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
      const aliases = MODULE_STATE_ALIASES[module];
      const canonicalKey = aliases ? aliases[0] : module;

      // Update local state immediately for responsiveness
      setWorkspace((current) => {
        if (!current) {
          return current;
        }

        const updatedModuleStates: Record<string, unknown> = {
          ...current.moduleStates,
          [canonicalKey]: state,
        };

        if (aliases) {
          for (const alias of aliases) {
            if (alias !== canonicalKey && alias in updatedModuleStates) {
              delete updatedModuleStates[alias];
            }
          }
        }

        return {
          ...current,
          moduleStates: updatedModuleStates,
        };
      });

      // Save to database
      const result = await updateWorkspaceModuleState(orderId, module, state);
      if (!result.success) {
        console.error('Failed to save module state:', result.error);
        // Could show a toast notification here
      }
    } catch (error) {
      console.error('Failed to update module state:', error);
    }
  };

  const handleWorkerInspectionComplete = async (results: InspectionResults) => {
    if (!workspace) return;

    // Save inspection results
    const workflowModule = resolveWorkerInspectionPhase(workspace.workflowPhase);
    await handleModuleStateChange(workflowModule, results as unknown as Record<string, any>);

    // Move to complete state
    setWorkerStep('complete');
    setRedirectCountdown(3);
  };

  useEffect(() => {
    if (workerStep !== 'complete') {
      if (redirectCountdown !== null) {
        setRedirectCountdown(null);
      }
      return;
    }

    if (redirectCountdown === null) {
      return;
    }

    if (redirectCountdown <= 0) {
      setRedirectCountdown(null);
      router.push('/');
      return;
    }

    const timer = setTimeout(() => {
      setRedirectCountdown((current) => (current !== null ? Math.max(0, current - 1) : current));
    }, 1000);

    return () => clearTimeout(timer);
  }, [workerStep, redirectCountdown, router]);

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

  const workerInspectionPhase = resolveWorkerInspectionPhase(workspace.workflowPhase);
  const canShowWorkerView = WORKER_VIEW_PHASES.has(workspace.workflowPhase);
  const workerWorkspace: WorkspaceData = canShowWorkerView
    ? { ...workspace, workflowPhase: workerInspectionPhase }
    : workspace;

  // Worker View Routing based on workflowPhase
  if (viewMode === 'worker') {
    if (canShowWorkerView) {
      if (workerStep === 'entry') {
        return (
          <>
          <EntryScreen 
            workspace={workerWorkspace}
            onStart={() => setWorkerStep('inspection')}
            onSwitchToSupervisor={switchToSupervisor}
            onSelectItem={(item) => {
              setSelectedItem(item);
              setWorkerStep('inspection');
            }}
          />
          <ConnectionStatus />
          </>
        );
      } else if (workerStep === 'inspection') {
        // Build inspection items via shared helper
        const inspectionItems = buildInspectionItems(workerWorkspace as any);

        // If a specific item was selected, show only that item
        const itemsToInspect = selectedItem ? [selectedItem] : (workspace.shipstationData?.items || []);
        
        return (
          <>
          <ResilientInspectionScreen
            orderId={orderId}
            orderNumber={workspace.orderNumber}
            customerName={workspace.shipstationData?.shipTo?.name}
            orderItems={itemsToInspect}
            workflowPhase={workerInspectionPhase}
            workflowType={workspace.workflowType}
            items={inspectionItems}
            workspace={workerWorkspace}
            onComplete={(results) => {
              handleWorkerInspectionComplete(results);
              // Clear any item selection; redirect handled after completion
              setSelectedItem(null);
            }}
            onSwitchToSupervisor={switchToSupervisor}
          />
          <ConnectionStatus />
          </>
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
              <p className="text-xl text-slate-600 mb-4">Order #{workspace.orderNumber} has been processed</p>
              <p className="text-sm text-slate-500 mb-8">
                Returning to the order queue{redirectCountdown !== null ? ` in ${redirectCountdown} ${redirectCountdown === 1 ? 'second' : 'seconds'}` : ' shortly'}.
              </p>
              <button
                onClick={() => {
                  setRedirectCountdown(null);
                  router.push('/');
                }}
                className="px-8 py-4 bg-green-600 text-white text-xl font-bold rounded-lg hover:bg-green-700"
              >
                RETURN TO ORDER QUEUE
              </button>
            </div>
          </div>
        );
      }
    }

    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md text-center space-y-4 px-6">
          <h1 className="text-2xl font-semibold text-slate-900">Supervisor Phase Active</h1>
          <p className="text-sm text-slate-600">
            Worker tools unlock when an order is in Pre-Mix or Pre-Ship. The current phase is
            {' '}
            <span className="font-medium text-slate-800">{workspace.workflowPhase.replace('_', ' ')}</span>.
            Switch to the Supervisor View to continue.
          </p>
          <button
            onClick={switchToSupervisor}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Go to Supervisor View
          </button>
        </div>
      </div>
    );
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
            onClick={switchToWorker}
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
                <button
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                  onClick={() => setShowPrintModal(true)}
                >
                  Print Labels
                </button>
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
          initialState={(() => {
            const aliases = MODULE_STATE_ALIASES[activeTab];
            if (aliases) {
              for (const key of aliases) {
                const candidate = workspace.moduleStates?.[key];
                if (candidate) {
                  return candidate;
                }
              }
            }
            return workspace.moduleStates?.[activeTab] || {};
          })()}
          onStateChange={(state: Record<string, any>) => handleModuleStateChange(activeTab, state)}
          onStateChangeAction={(state: Record<string, any>) => handleModuleStateChange(activeTab, state)}
        />
      </main>

      {/* Supervisor: Print Labels Modal */}
      {showPrintModal && (
        <PrintPreparationModalSimplified
          order={{
            orderId: workspace.orderId,
            orderNumber: workspace.orderNumber,
            items: workspace.shipstationData?.items || []
          }}
          onClose={() => setShowPrintModal(false)}
          onPrintComplete={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { WorkspaceData, ViewMode, InspectionResults } from '@/lib/types/agent-view';
import EntryScreen from '@/components/workspace/agent-view/EntryScreen';
import ResilientInspectionScreen from '@/components/workspace/agent-view/ResilientInspectionScreen';
import { ConnectionStatus } from '@/components/ui/connection-status';
import OrderOverview from '@/components/workspace/OrderOverview';
import PreMixInspection from '@/components/workspace/supervisor-view/PreMixInspection';
import PreShipInspection from '@/components/workspace/supervisor-view/PreShipInspection';
import DocumentsHub from '@/components/workspace/DocumentsHub';
import ActivityTimeline from '@/components/workspace/ActivityTimeline';
import ErrorBoundary from '@/components/error-boundary';
import { buildInspectionItems } from '@/lib/inspection/items';

type WorkerStep = 'entry' | 'inspection' | 'complete';

interface WorkspaceContentProps {
  workspace: WorkspaceData;
  orderId: string;
  onModuleStateChange: (module: string, state: Record<string, any>) => Promise<void>;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function WorkspaceContent({ workspace, orderId, onModuleStateChange }: WorkspaceContentProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('worker');
  const [workerStep, setWorkerStep] = useState<WorkerStep>('entry');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const handleWorkerInspectionComplete = async (results: InspectionResults) => {
    const workflowModule = workspace.workflowPhase === 'pre_mix' ? 'pre_mix' : 'pre_ship';
    await onModuleStateChange(workflowModule, results as unknown as Record<string, any>);
    setWorkerStep('complete');
  };

  // Worker View Routing
  if (viewMode === 'worker') {
    if (workspace.workflowPhase === 'pre_mix' || workspace.workflowPhase === 'pre_ship') {
      return (
        <ErrorBoundary>
          {workerStep === 'entry' ? (
            <>
              <EntryScreen 
                workspace={workspace}
                onStart={() => setWorkerStep('inspection')}
                onSwitchToSupervisor={() => setViewMode('supervisor')}
                onSelectItem={(item) => {
                  setSelectedItem(item);
                  setWorkerStep('inspection');
                }}
              />
              <ConnectionStatus />
            </>
          ) : workerStep === 'inspection' ? (
            <>
              <ResilientInspectionScreen
                orderId={orderId}
                orderNumber={workspace.orderNumber}
                customerName={workspace.shipstationData?.shipTo?.name}
                orderItems={selectedItem ? [selectedItem] : (workspace.shipstationData?.items || [])}
                workflowPhase={workspace.workflowPhase}
                workflowType={workspace.workflowType}
                items={buildInspectionItems(workspace as any, selectedItem)}
                onComplete={(results) => {
                  handleWorkerInspectionComplete(results);
                  setSelectedItem(null);
                  setWorkerStep('entry');
                }}
                onSwitchToSupervisor={() => setViewMode('supervisor')}
              />
              <ConnectionStatus />
            </>
          ) : (
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
                  }}
                  className="px-8 py-4 bg-green-600 text-white text-xl font-bold rounded-lg hover:bg-green-700"
                >
                  START NEW INSPECTION
                </button>
              </div>
            </div>
          )}
        </ErrorBoundary>
      );
    }
  }

  // Supervisor View
  const tabs = [
    { id: 'overview', label: 'Overview', component: OrderOverview },
    { id: 'pallets', label: 'Pallets', component: OrderOverview, testId: 'pallets-tab' },
    { id: 'qr', label: 'QR Codes', component: OrderOverview, testId: 'qr-tab' },
    { id: 'pre_mix', label: 'Pre-Mix', component: PreMixInspection },
    { id: 'pre_ship', label: 'Pre-Ship', component: PreShipInspection },
    { id: 'documents', label: 'Documents', component: DocumentsHub },
    { id: 'activity', label: 'Activity', component: ActivityTimeline },
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || OrderOverview;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50">
        {/* View Mode Toggle */}
        <div className="bg-indigo-600 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Current View: Supervisor</span>
              <div data-testid="supervisor-view" className="hidden"></div>
            </div>
            <button
              data-testid="view-toggle"
              onClick={() => {
                setViewMode('worker');
                setWorkerStep('entry');
              }}
              className="text-sm underline hover:no-underline"
              aria-pressed={viewMode === 'supervisor'}
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
                <div data-testid="collaboration-indicator" className="flex items-center gap-2">
                  {/* Collaboration indicator will show active users */}
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
                  data-testid={tab.testId}
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
            onStateChange={(state: Record<string, any>) => onModuleStateChange(activeTab, state)}
          />
        </main>
      </div>
    </ErrorBoundary>
  );
}

// (builder extracted to lib/inspection/items)

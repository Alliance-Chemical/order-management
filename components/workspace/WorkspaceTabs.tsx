import { useWorkspaceStore } from '@/lib/stores/workspace-store';

const tabs = [
  { 
    id: 'overview', 
    name: 'Overview',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  { 
    id: 'pre-mix', 
    name: 'Pre-Mix',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    )
  },
  { 
    id: 'pre-ship', 
    name: 'Pre-Ship',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  },
  { 
    id: 'documents', 
    name: 'Documents',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  { 
    id: 'activity', 
    name: 'Activity',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
];

export function WorkspaceTabs() {
  const { currentModule, setCurrentModule, workspace } = useWorkspaceStore();

  const getTabBadge = (tabId: string) => {
    if (!workspace) return null;
    
    switch(tabId) {
      case 'documents':
        const docCount = workspace.documents?.length || 0;
        if (docCount > 0) {
          return (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {docCount}
            </span>
          );
        }
        break;
      case 'activity':
        const recentActivity = workspace.activityLog?.filter((a: { performedAt: string | number | Date }) => {
          const activityTime = new Date(a.performedAt);
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return activityTime > hourAgo;
        }).length || 0;
        if (recentActivity > 0) {
          return (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {recentActivity} new
            </span>
          );
        }
        break;
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-6">
      <nav className="flex divide-x divide-gray-200" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = currentModule === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentModule(tab.id)}
              className={`
                group relative min-w-0 flex-1 overflow-hidden bg-white py-4 px-4 text-sm font-medium text-center hover:bg-gray-50 focus:z-10 transition-colors
                ${isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}
              `}
            >
              <span className="flex items-center justify-center">
                <span className={`${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'} transition-colors`}>
                  {tab.icon}
                </span>
                <span className="ml-2">{tab.name}</span>
                {getTabBadge(tab.id)}
              </span>
              <span
                aria-hidden="true"
                className={`
                  absolute inset-x-0 bottom-0 h-0.5 transition-colors
                  ${isActive ? 'bg-indigo-600' : 'bg-transparent'}
                `}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
}

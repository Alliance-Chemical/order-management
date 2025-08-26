import { create } from 'zustand';
import { OrderWorkspace, WorkspaceModule, DocumentFile, Activity } from '@/lib/types/workspace';

interface WorkspaceState {
  workspace: OrderWorkspace | null;
  currentModule: string;
  activities: Activity[];
  isLoading: boolean;
  isSyncing: boolean;
  setWorkspace: (workspace: OrderWorkspace) => void;
  setCurrentModule: (module: string) => void;
  updateModuleState: (module: string, state: any) => void;
  addActivity: (activity: Activity) => void;
  setLoading: (loading: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  addDocument: (document: DocumentFile) => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspace: null,
  currentModule: 'overview',
  activities: [],
  isLoading: false,
  isSyncing: false,
  
  setWorkspace: (workspace) => set({ workspace }),
  
  setCurrentModule: (module) => set({ currentModule: module }),
  
  updateModuleState: (module, state) => set((prev) => {
    if (!prev.workspace) return prev;
    
    const updatedModules = prev.workspace.modules.map(m => 
      m.id === module ? { ...m, state } : m
    );
    
    return {
      workspace: {
        ...prev.workspace,
        modules: updatedModules,
      },
    };
  }),
  
  addActivity: (activity) => set((prev) => ({
    activities: [activity, ...prev.activities].slice(0, 50),
  })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  
  addDocument: (document) => set((prev) => {
    if (!prev.workspace) return prev;
    
    const docs = { ...prev.workspace.documents };
    if (document.type in docs) {
      (docs as any)[document.type] = [...(docs as any)[document.type], document];
    }
    
    return {
      workspace: {
        ...prev.workspace,
        documents: docs,
      },
    };
  }),
  
  reset: () => set({
    workspace: null,
    currentModule: 'overview',
    activities: [],
    isLoading: false,
    isSyncing: false,
  }),
}));
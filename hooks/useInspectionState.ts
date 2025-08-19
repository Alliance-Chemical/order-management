import { useState, useEffect, useCallback, useRef } from 'react';
import { InspectionItem } from '@/lib/types/agent-view';

interface InspectionState {
  currentIndex: number;
  results: Record<string, 'pass' | 'fail'>;
  notes: Record<string, string>;
  scannedQRs: Record<string, string>;
  startedAt: string;
  lastUpdatedAt: string;
  workflowPhase: string;
  orderId: string;
}

interface UseInspectionStateOptions {
  orderId: string;
  workflowPhase: string;
  items: InspectionItem[];
  onComplete?: (results: Record<string, 'pass' | 'fail'>, notes: Record<string, string>) => void;
  enablePersistence?: boolean;
}

/**
 * Custom hook for managing inspection state with persistence and recovery
 * Handles offline scenarios, page refreshes, and provides undo capabilities
 */
export function useInspectionState({
  orderId,
  workflowPhase,
  items,
  onComplete,
  enablePersistence = true
}: UseInspectionStateOptions) {
  const storageKey = `inspection_${orderId}_${workflowPhase}`;
  const [isRestored, setIsRestored] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Initialize state with restored values or defaults
  const initializeState = (): InspectionState => {
    if (!enablePersistence) {
      return {
        currentIndex: 0,
        results: {},
        notes: {},
        scannedQRs: {},
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        workflowPhase,
        orderId
      };
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as InspectionState;
        // Validate stored state is still relevant (not older than 24 hours)
        const lastUpdate = new Date(parsed.lastUpdatedAt);
        const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceUpdate < 24 && parsed.orderId === orderId && parsed.workflowPhase === workflowPhase) {
          setIsRestored(true);
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to restore inspection state:', error);
    }

    return {
      currentIndex: 0,
      results: {},
      notes: {},
      scannedQRs: {},
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      workflowPhase,
      orderId
    };
  };

  const [state, setState] = useState<InspectionState>(initializeState);
  const [history, setHistory] = useState<InspectionState[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // Persist state changes with debouncing
  const persistState = useCallback((newState: InspectionState) => {
    if (!enablePersistence) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce saves to avoid excessive localStorage writes
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          ...newState,
          lastUpdatedAt: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Failed to persist inspection state:', error);
        // Could trigger a user notification here
      }
    }, 500);
  }, [storageKey, enablePersistence]);

  // Update state and maintain history
  const updateState = useCallback((updates: Partial<InspectionState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      
      // Add to history for undo capability (keep last 10 states)
      setHistory(h => [...h.slice(-9), prev]);
      setCanUndo(true);
      
      // Persist the new state
      persistState(newState);
      
      return newState;
    });
  }, [persistState]);

  // Navigate to specific step
  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < items.length) {
      updateState({ currentIndex: index });
    }
  }, [items.length, updateState]);

  // Move to next step
  const nextStep = useCallback(() => {
    const newIndex = state.currentIndex + 1;
    if (newIndex < items.length) {
      updateState({ currentIndex: newIndex });
    } else if (onComplete) {
      // Inspection complete
      onComplete(state.results, state.notes);
      clearState();
    }
  }, [state.currentIndex, state.results, state.notes, items.length, updateState, onComplete]);

  // Move to previous step
  const previousStep = useCallback(() => {
    const newIndex = state.currentIndex - 1;
    if (newIndex >= 0) {
      updateState({ currentIndex: newIndex });
    }
  }, [state.currentIndex, updateState]);

  // Record inspection result for current step
  const recordResult = useCallback((itemId: string, result: 'pass' | 'fail', note?: string) => {
    const updates: Partial<InspectionState> = {
      results: { ...state.results, [itemId]: result }
    };
    
    if (note) {
      updates.notes = { ...state.notes, [itemId]: note };
    }
    
    updateState(updates);
  }, [state.results, state.notes, updateState]);

  // Record QR scan
  const recordQRScan = useCallback((stepId: string, qrData: string) => {
    updateState({
      scannedQRs: { ...state.scannedQRs, [stepId]: qrData }
    });
  }, [state.scannedQRs, updateState]);

  // Undo last action
  const undo = useCallback(() => {
    if (history.length > 0) {
      const previousState = history[history.length - 1];
      setState(previousState);
      setHistory(h => h.slice(0, -1));
      setCanUndo(history.length > 1);
      persistState(previousState);
    }
  }, [history, persistState]);

  // Clear inspection state
  const clearState = useCallback(() => {
    if (enablePersistence) {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.error('Failed to clear inspection state:', error);
      }
    }
    setState(initializeState());
    setHistory([]);
    setCanUndo(false);
    setIsRestored(false);
  }, [storageKey, enablePersistence]);

  // Check if a step has been completed
  const isStepCompleted = useCallback((itemId: string) => {
    return itemId in state.results;
  }, [state.results]);

  // Get progress percentage
  const getProgress = useCallback(() => {
    const completedSteps = Object.keys(state.results).length;
    return (completedSteps / items.length) * 100;
  }, [state.results, items.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    currentIndex: state.currentIndex,
    currentItem: items[state.currentIndex],
    results: state.results,
    notes: state.notes,
    scannedQRs: state.scannedQRs,
    progress: getProgress(),
    isRestored,
    canUndo,
    
    // Navigation
    goToStep,
    nextStep,
    previousStep,
    
    // Actions
    recordResult,
    recordQRScan,
    undo,
    clearState,
    
    // Utilities
    isStepCompleted,
    getProgress
  };
}
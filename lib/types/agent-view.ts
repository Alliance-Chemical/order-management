// Worker View Type Definitions

export interface InspectionItem {
  id: string;
  label: string;
  description: string;
}

export interface InspectionResults {
  checklist: Record<string, 'pass' | 'fail'>;
  notes: string;
  completedAt: string;
  completedBy: string;
  photos?: Array<{
    url: string;
    name: string;
    timestamp: string;
  }>;
}

export interface EntryScreenProps {
  workspace: WorkspaceData;
  onStart: () => void;
  onSwitchToSupervisor: () => void;
}

export interface InspectionScreenProps {
  orderId: string;
  orderNumber?: string;
  customerName?: string;
  orderItems?: Array<{
    name: string;
    quantity: number;
    sku?: string;
    unitPrice?: number;
    isDiscount?: boolean;
    customAttributes?: Array<{
      name: string;
      value: string;
    }>;
  }>;
  workflowPhase: string;
  workflowType?: string;
  items: InspectionItem[];
  onComplete: (results: InspectionResults) => void;
  onSwitchToSupervisor: () => void;
}

export interface IssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  item: InspectionItem;
  workflowPhase: string;
  onIssueReported: (reason: string) => void;
}

export interface WorkspaceData {
  id: string;
  orderId: number;
  orderNumber: string;
  status: 'pending' | 'active' | 'ready_to_ship' | 'shipped' | 'completed';
  workflowType?: 'pump_and_fill' | 'direct_resell';
  workflowPhase: 'pending' | 'pre_mix' | 'pre_ship' | 'ready' | 'shipped';
  shipstationData: {
    orderDate?: string;
    shipTo?: {
      name: string;
      company?: string;
      street1?: string;
      street2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      phone?: string;
    };
    items?: Array<{
      name: string;
      quantity: number;
      sku?: string;
      unitPrice?: number;
      isDiscount?: boolean;
      customAttributes?: Array<{
        name: string;
        value: string;
      }>;
      weight?: {
        value: number;
        units: string;
      };
    }>;
    weight?: {
      value: number;
      units: string;
    };
    customerEmail?: string;
    customerNotes?: string;
    internalNotes?: string;
  };
  moduleStates: Record<string, unknown>;
  documents: Array<{
    id: string;
    fileName: string;
    fileType: string;
    uploadedAt: string;
    uploadedBy: string;
    s3Url?: string;
    s3Key?: string;
    fileSize?: number;
  }>;
  activities: Array<{
    id: string;
    activityType: string;
    activityDescription: string;
    performedBy: string;
    performedAt: string;
    module?: string;
    metadata?: Record<string, unknown>;
  }>;
  totalDocumentSize: number;
  createdAt?: string;
  updatedAt?: string;
  lastAccessedAt?: string;
  lastShipstationSync?: string;
}

export type ViewMode = 'worker' | 'supervisor';
export type WorkerStep = 'entry' | 'inspection' | 'complete';

export interface WorkerViewState {
  viewMode: ViewMode;
  workerStep: WorkerStep;
  currentInspectionIndex?: number;
  inspectionResults?: Partial<InspectionResults>;
}

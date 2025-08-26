export interface WorkspaceModule {
  id: string;
  name: string;
  icon?: string;
  enabled: boolean;
  state: Record<string, any>;
}

export interface OrderWorkspace {
  id: string;
  orderId: number;
  orderNumber: string;
  workspaceUrl: string;
  modules: WorkspaceModule[];
  documents: WorkspaceDocuments;
  alerts: AlertConfig[];
  status: WorkspaceStatus;
  workflowPhase: WorkflowPhase;
  shipstationData?: any;
  lastShipstationSync?: Date;
  currentUsers: string[];
}

export interface WorkspaceDocuments {
  coa: DocumentFile[];
  sds: DocumentFile[];
  other: DocumentFile[];
}

export interface DocumentFile {
  id: string;
  name: string;
  type: DocumentType;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export type DocumentType = 'coa' | 'sds' | 'packing_slip' | 'other';

export interface AlertConfig {
  id: string;
  type: AlertType;
  enabled: boolean;
  recipients: AlertRecipient[];
  triggerConditions: Record<string, any>;
  cooldownMinutes: number;
}

export type AlertType = 'ready_to_pump' | 'ready_to_ship' | 'issue' | 'document_uploaded';

export interface AlertRecipient {
  type: 'sms' | 'email';
  value: string;
}

export type WorkspaceStatus = 'active' | 'archived' | 'deleted';
export type WorkflowPhase = 'pre_mix' | 'mixing' | 'pre_ship' | 'ready_to_ship' | 'shipped';

export interface QRCode {
  id: string;
  type: QRType;
  code: string;
  shortCode?: string;
  orderId: number;
  orderNumber?: string;
  containerNumber?: number;
  chemicalName?: string;
  url: string;
  scanCount: number;
  isActive: boolean;
}

export type QRType = 'order_master' | 'container' | 'batch';

export interface Activity {
  id: string;
  type: string;
  description?: string;
  performedBy: string;
  performedAt: Date;
  module?: string;
  metadata?: Record<string, any>;
  changes?: Record<string, any>;
}
/**
 * Shared TypeScript interfaces for components
 * Centralizes common types to improve type safety and reduce duplication
 */

// Order and Item Types
export interface OrderItem {
  lineItemKey?: string;
  sku?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  imageUrl?: string;
  orderItemId?: string;
}

export interface ShipToAddress {
  name?: string;
  company?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

export interface ShipstationData {
  orderNumber?: string;
  orderStatus?: string;
  shipTo?: ShipToAddress;
  items?: OrderItem[];
}

// Freight Types
export interface FreightCarrier {
  name: string;
  confidence: number;
  reasoning: string;
}

export interface FreightService {
  type: string;
  confidence: number;
  reasoning: string;
}

export interface FreightAccessorial {
  type: string;
  recommended: boolean;
  confidence: number;
  reasoning: string;
}

export interface EstimatedCost {
  low: number;
  high: number;
  average: number;
}

export interface EstimatedTransitDays {
  min: number;
  max: number;
  typical: number;
}

export interface FreightSuggestion {
  carrier: FreightCarrier;
  service: FreightService;
  accessorials: FreightAccessorial[];
  estimatedCost?: EstimatedCost;
  estimatedTransitDays?: EstimatedTransitDays;
  overallConfidence: number;
  aiInsights: string[];
}

// RAG/Classification Types
export interface ClassificationData {
  un_number?: string;
  proper_shipping_name?: string;
  hazard_class?: string;
  packing_group?: string;
  labels?: string;
  erg_guide?: string;
  confidence?: number;
  exemption_reason?: string;
}

export interface SearchResult {
  text: string;
  metadata?: {
    unNumber?: string;
    hazardClass?: string;
  };
}

export interface RAGResponse {
  success: boolean;
  error?: string;
  classification?: ClassificationData;
  results?: SearchResult[];
  message?: string;
}

// Inspection Types
export interface Container {
  id: string;
  number: number;
  scanned: boolean;
  inspected: boolean;
  issues: string[];
  qrData?: string;
}

export interface InspectionQuestion {
  id: string;
  label: string;
  icon: string;
}

export interface CapturedPhoto {
  base64: string;
  url: string;
  lotNumbers: string[];
  timestamp: string;
}

// Common Component Props
export type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link'
  | 'warehouse-go'
  | 'warehouse-stop'
  | 'warehouse-caution'
  | 'warehouse-info'
  | 'go'
  | 'stop'
  | 'caution'
  | 'info'
  | 'neutral'
  | 'primary';

export type ButtonSize =
  | 'default'
  | 'sm'
  | 'lg'
  | 'icon'
  | 'warehouse'
  | 'warehouse-xl'
  | 'base'
  | 'small'
  | 'medium'
  | 'large'
  | 'xlarge'
  | 'md'
  | 'xl';

export type HapticType = 'light' | 'success' | 'warning' | 'error';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type WorkflowType = 'pump_and_fill' | 'direct_resell';

export type WorkflowPhase = 'pre_mix' | 'pre_ship' | 'warehouse' | 'freight';

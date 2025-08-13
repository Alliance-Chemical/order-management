export interface SourceAssignment {
  itemId: string;
  itemName: string;
  workflowType: 'pump_and_fill' | 'direct_resell';
  sourceContainerId?: string;
  sourceContainerName?: string;
  targetConcentration?: number;
  requiredVolume?: number;
  dilutionRequired?: boolean;
}

export interface ModuleState {
  sourceAssignments?: SourceAssignment[];
  completedItems?: string[];
  notes?: string;
  [key: string]: unknown;
}

export interface HighRiskCombination {
  product: string;
  customer: string;
  riskLevel: 'high' | 'medium' | 'low';
  reason: string;
  occurrences: number;
}

export interface RiskPattern {
  pattern: string;
  description: string;
  affectedProducts: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendations: string[];
}

export interface AnalysisData {
  highRiskCombinations: HighRiskCombination[];
  riskPatterns: RiskPattern[];
  summary: {
    totalOrders: number;
    totalIssues: number;
    riskScore: number;
  };
}

export interface QRRecord {
  id: string;
  qrType: string;
  qrCode: string;
  orderNumber?: string;
  containerNumber?: number;
  chemicalName?: string;
  encodedData: {
    url: string;
    type: string;
    orderId?: number;
    containerId?: string;
    [key: string]: unknown;
  };
}
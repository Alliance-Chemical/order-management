import { z } from 'zod';

export const CRUZ_STEP_ORDER = [
  'scan_qr',
  'inspection_info',
  'verify_packing_label',
  'verify_product_label',
  'lot_number',
  'lot_extraction',
] as const;

export type CruzStepId = (typeof CRUZ_STEP_ORDER)[number];

export type CruzRunStatus =
  | 'active'
  | 'completed'
  | 'hold'
  | 'canceled'
  | 'needs_reverify';

export const CONTAINER_TYPES = ['drum', 'pail', 'tote', 'other'] as const;
export type ContainerType = (typeof CONTAINER_TYPES)[number];

export const CRUZ_INSPECTION_RUN_VERSION = 1;

export interface InspectionPhoto {
  id: string;
  name: string;
  uploadedAt: string;
  documentId?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface ScanQrStepPayload {
  qrValue: string;
  qrValidated: boolean;
  qrWorkspaceId?: string;
  qrCodeId?: string;
  shortCode?: string;
  validatedAt: string;
}

export interface InspectionInfoStepPayload {
  orderNumber: string;
  datePerformed: string;
  timePerformed: string;
  inspector: string;
  notes?: string;
}

export interface VerifyPackingLabelStepPayload {
  shipToOk: boolean;
  companyOk: boolean;
  orderNumberOk: boolean;
  productDescriptionOk: boolean;
  gate1Outcome: 'PASS' | 'FAIL';
  mismatchReason?: string;
  photos: InspectionPhoto[];
  completedAt: string;
}

export interface VerifyProductLabelStepPayload {
  gradeOk: boolean;
  unOk: boolean;
  pgOk: boolean;
  lidOk: boolean;
  ghsOk: boolean;
  gate2Outcome: 'PASS' | 'FAIL';
  issueReason?: string;
  photos: InspectionPhoto[];
  completedAt: string;
}

export interface LotNumberEntry {
  id: string;
  lotRaw: string;
}

export interface LotNumberStepPayload {
  lots: LotNumberEntry[];
  sameForAll?: boolean;
  completedAt: string;
}

export interface ConfirmedLotEntry extends LotNumberEntry {
  confirmed: boolean;
}

export interface LotExtractionStepPayload {
  lots: ConfirmedLotEntry[];
  parseMode: 'none';
  completedAt: string;
}

export type CruzStepPayloadMap = {
  scan_qr: ScanQrStepPayload;
  inspection_info: InspectionInfoStepPayload;
  verify_packing_label: VerifyPackingLabelStepPayload;
  verify_product_label: VerifyProductLabelStepPayload;
  lot_number: LotNumberStepPayload;
  lot_extraction: LotExtractionStepPayload;
};

export type CruzStepPayload = CruzStepPayloadMap[CruzStepId];

export interface StepHistoryEntry {
  id: string;
  runId: string;
  stepId: CruzStepId;
  outcome: 'PASS' | 'FAIL' | 'HOLD' | 'REVERT';
  recordedAt: string;
  recordedBy: string;
  payload: Partial<CruzStepPayload>;
}

export interface CruzInspectionRun {
  id: string;
  createdAt: string;
  updatedAt: string;
  qrCodeId?: string;
  qrValue?: string;
  shortCode?: string;
  itemKey?: string;
  sku?: string;
  materialName?: string;
  containerType: ContainerType;
  containerCount: number;
  currentStepId: CruzStepId;
  status: CruzRunStatus;
  steps: Partial<{ [K in CruzStepId]: CruzStepPayloadMap[K] }>;
  history: StepHistoryEntry[];
  totals?: {
    unitsPassed?: number;
    unitsFailed?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface CruzInspectionTotals {
  runsCreated?: number;
  runsCompleted?: number;
  runsOnHold?: number;
}

export interface CruzInspectionState {
  version: number;
  runsById: Record<string, CruzInspectionRun>;
  runOrder: string[];
  totals?: CruzInspectionTotals;
  completedAt?: string;
  completedBy?: string;
}

export const DEFAULT_CRUZ_STATE: CruzInspectionState = {
  version: CRUZ_INSPECTION_RUN_VERSION,
  runsById: {},
  runOrder: [],
  totals: {
    runsCreated: 0,
    runsCompleted: 0,
    runsOnHold: 0,
  },
};

export function normalizeInspectionState(raw: unknown): CruzInspectionState {
  if (!raw || typeof raw !== 'object') {
    return structuredClone(DEFAULT_CRUZ_STATE);
  }

  const state = raw as Partial<CruzInspectionState>;

  return {
    version: state.version ?? CRUZ_INSPECTION_RUN_VERSION,
    runsById: state.runsById ?? {},
    runOrder: Array.isArray(state.runOrder) ? state.runOrder : [],
    totals: state.totals ?? structuredClone(DEFAULT_CRUZ_STATE.totals!),
    completedAt: state.completedAt,
    completedBy: state.completedBy,
  };
}

function randomString(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createRunId(): string {
  const globalCrypto = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (globalCrypto?.randomUUID) {
    return `run_${globalCrypto.randomUUID()}`;
  }
  return `run_${Date.now().toString(36)}_${randomString()}`;
}

export function getStepIndex(stepId: CruzStepId): number {
  return CRUZ_STEP_ORDER.indexOf(stepId);
}

export function getNextStepId(current: CruzStepId): CruzStepId | null {
  const idx = getStepIndex(current);
  if (idx < 0) return null;
  return CRUZ_STEP_ORDER[idx + 1] ?? null;
}

export function getPreviousStepId(current: CruzStepId): CruzStepId | null {
  const idx = getStepIndex(current);
  if (idx <= 0) return null;
  return CRUZ_STEP_ORDER[idx - 1] ?? null;
}

export function isValidStepTransition(
  fromStep: CruzStepId,
  toStep: CruzStepId
): boolean {
  const fromIdx = getStepIndex(fromStep);
  const toIdx = getStepIndex(toStep);
  return toIdx === fromIdx + 1;
}

export function computeRunStatusAfterStep(
  run: CruzInspectionRun,
  stepId: CruzStepId,
  payload: CruzStepPayload,
  outcome: 'PASS' | 'FAIL' | 'HOLD'
): CruzRunStatus {
  if (outcome === 'FAIL') {
    return 'needs_reverify';
  }

  if (stepId === 'lot_extraction' && outcome === 'PASS') {
    return 'completed';
  }

  return run.status === 'hold' ? 'hold' : 'active';
}

export function getActiveRuns(state: CruzInspectionState): CruzInspectionRun[] {
  return state.runOrder
    .map((id) => state.runsById[id])
    .filter((run): run is CruzInspectionRun => Boolean(run));
}

const photoSchema = z.object({
  id: z.string(),
  name: z.string(),
  uploadedAt: z.string(),
  documentId: z.string().optional(),
  url: z.string().optional(),
});

const scanQrSchema = z.object({
  qrValue: z.string().min(1),
  qrValidated: z.literal(true),
  qrWorkspaceId: z.string().optional(),
  qrCodeId: z.string().optional(),
  shortCode: z.string().optional(),
  validatedAt: z.string(),
});

const inspectionInfoSchema = z.object({
  orderNumber: z.string().min(1),
  datePerformed: z.string().min(1),
  timePerformed: z.string().min(1),
  inspector: z.string().min(1),
  notes: z.string().optional(),
});

const verifyPackingSchema = z
  .object({
    shipToOk: z.boolean(),
    companyOk: z.boolean(),
    orderNumberOk: z.boolean(),
    productDescriptionOk: z.boolean(),
    gate1Outcome: z.literal('PASS').or(z.literal('FAIL')),
    mismatchReason: z.string().optional(),
    photos: z.array(photoSchema),
    completedAt: z.string(),
  })
  .superRefine((data, ctx) => {
    const allChecksTrue = data.shipToOk && data.companyOk && data.orderNumberOk && data.productDescriptionOk;
    if (data.gate1Outcome === 'PASS' && !allChecksTrue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PASS requires every checklist item to be confirmed.',
        path: ['gate1Outcome'],
      });
    }

    if (data.gate1Outcome === 'FAIL') {
      const mismatchReason = data.mismatchReason?.trim();
      if (!mismatchReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide a mismatch reason when marking FAIL.',
          path: ['mismatchReason'],
        });
      }

      if (data.photos.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Photo evidence is required when documenting mismatches.',
          path: ['photos'],
        });
      }
    }
  });

const verifyProductSchema = z
  .object({
    gradeOk: z.boolean(),
    unOk: z.boolean(),
    pgOk: z.boolean(),
    lidOk: z.boolean(),
    ghsOk: z.boolean(),
    gate2Outcome: z.literal('PASS').or(z.literal('FAIL')),
    issueReason: z.string().optional(),
    photos: z.array(photoSchema).min(1),
    completedAt: z.string(),
  })
  .superRefine((data, ctx) => {
    const allChecksTrue = data.gradeOk && data.unOk && data.pgOk && data.lidOk && data.ghsOk;
    if (data.gate2Outcome === 'PASS' && !allChecksTrue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PASS requires every checklist item to be confirmed.',
        path: ['gate2Outcome'],
      });
    }

    if (data.gate2Outcome === 'FAIL') {
      const issueReason = data.issueReason?.trim();
      if (!issueReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Describe the problem when marking FAIL.',
          path: ['issueReason'],
        });
      }
    }
  });

const lotNumberSchema = z.object({
  lots: z.array(
    z.object({
      id: z.string(),
      lotRaw: z.string().min(1),
    })
  ).min(1),
  sameForAll: z.boolean().optional(),
  completedAt: z.string(),
});

const lotExtractionSchema = z.object({
  lots: z.array(
    z.object({
      id: z.string(),
      lotRaw: z.string().min(1),
      confirmed: z.literal(true),
    })
  ).min(1),
  parseMode: z.literal('none'),
  completedAt: z.string(),
});

export function validateStepPayload(stepId: CruzStepId, payload: unknown) {
  switch (stepId) {
    case 'scan_qr':
      return scanQrSchema.parse(payload);
    case 'inspection_info':
      return inspectionInfoSchema.parse(payload);
    case 'verify_packing_label':
      return verifyPackingSchema
        .superRefine((data, ctx) => {
          if (data.gate1Outcome === 'FAIL') {
            if (!data.mismatchReason?.trim()) {
              ctx.addIssue({
                path: ['mismatchReason'],
                code: z.ZodIssueCode.custom,
                message: 'Mismatch reason required on FAIL',
              });
            }
            if (data.photos.length === 0) {
              ctx.addIssue({
                path: ['photos'],
                code: z.ZodIssueCode.custom,
                message: 'At least one photo is required on FAIL',
              });
            }
          }
        })
        .parse(payload);
    case 'verify_product_label':
      return verifyProductSchema
        .superRefine((data, ctx) => {
          if (data.gate2Outcome === 'FAIL' && !data.issueReason?.trim()) {
            ctx.addIssue({
              path: ['issueReason'],
              code: z.ZodIssueCode.custom,
              message: 'Issue reason required on FAIL',
            });
          }
          if (data.photos.length === 0) {
            ctx.addIssue({
              path: ['photos'],
              code: z.ZodIssueCode.custom,
              message: 'Provide photos when recording this step',
            });
          }
        })
        .parse(payload);
    case 'lot_number':
      return lotNumberSchema.parse(payload);
    case 'lot_extraction':
      return lotExtractionSchema.parse(payload);
    default:
      return payload;
  }
}

export function isRunComplete(run: CruzInspectionRun): boolean {
  return run.status === 'completed';
}

export function summarizeCompletion(state: CruzInspectionState) {
  const runs = getActiveRuns(state);
  const total = runs.length;
  const completed = runs.filter(isRunComplete).length;
  const canceled = runs.filter((run) => run.status === 'canceled').length;
  return { total, completed, canceled };
}

export function ensureRunOrder(state: CruzInspectionState) {
  state.runOrder = state.runOrder.filter((id) => Boolean(state.runsById[id]));
  for (const id of Object.keys(state.runsById)) {
    if (!state.runOrder.includes(id)) {
      state.runOrder.push(id);
    }
  }
}

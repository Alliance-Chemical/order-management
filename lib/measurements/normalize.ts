type DimensionUnit = 'IN' | 'CM';
type WeightUnit = 'LBS' | 'KG';

export type NormalizedFinalMeasurements = {
  mode: 'single' | 'pallets';
  measuredBy: string;
  measuredAt: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    units: DimensionUnit;
  };
  weight?: {
    value: number;
    units: WeightUnit;
  };
  entries?: Array<Record<string, unknown>>;
  entryCount?: number;
  scannedContainer?: string | null;
  pallets?: Array<Record<string, unknown>>;
  palletCount?: number;
  totalWeight?: number;
};

export interface NormalizeMeasurementsOptions {
  userId: string;
  timestamp?: string;
}

const DIMENSION_UNIT_DEFAULT: DimensionUnit = 'IN';
const WEIGHT_UNIT_DEFAULT: WeightUnit = 'LBS';

function toPositiveNumber(value: unknown): number | null {
  const num = typeof value === 'string' ? Number(value.trim()) : Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function normalizeDimensionUnit(input: unknown): DimensionUnit {
  if (typeof input !== 'string') return DIMENSION_UNIT_DEFAULT;
  const normalized = input.trim().toUpperCase();
  switch (normalized) {
    case 'IN':
    case 'INCH':
    case 'INCHES':
      return 'IN';
    case 'CM':
    case 'CENTIMETER':
    case 'CENTIMETERS':
      return 'CM';
    default:
      return DIMENSION_UNIT_DEFAULT;
  }
}

function normalizeWeightUnit(input: unknown): WeightUnit {
  if (typeof input !== 'string') return WEIGHT_UNIT_DEFAULT;
  const normalized = input.trim().toUpperCase();
  switch (normalized) {
    case 'LB':
    case 'LBS':
    case 'POUND':
    case 'POUNDS':
      return 'LBS';
    case 'KG':
    case 'KGS':
    case 'KILOGRAM':
    case 'KILOGRAMS':
      return 'KG';
    default:
      return WEIGHT_UNIT_DEFAULT;
  }
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): T {
  const output = { ...input } as Record<string, unknown>;
  Object.keys(output).forEach((key) => {
    if (output[key] === undefined) {
      delete output[key];
    }
  });
  return output as T;
}

export function normalizeFinalMeasurementsPayload(
  raw: unknown,
  options: NormalizeMeasurementsOptions
): NormalizedFinalMeasurements {
  const data = (raw ?? {}) as Record<string, unknown>;

  const mode = data.mode === 'pallets' ? 'pallets' : 'single';
  const measuredBy = typeof data.measuredBy === 'string' && data.measuredBy.trim().length
    ? data.measuredBy.trim()
    : options.userId;
  const measuredAt = typeof data.measuredAt === 'string' && data.measuredAt.trim().length
    ? data.measuredAt
    : options.timestamp ?? new Date().toISOString();

  const normalized: NormalizedFinalMeasurements = {
    mode,
    measuredBy,
    measuredAt,
  };

  if (mode === 'pallets') {
    const pallets = Array.isArray(data.pallets)
      ? data.pallets.filter(Boolean).map((pallet) => pallet as Record<string, unknown>)
      : [];

    normalized.pallets = pallets.length ? pallets : undefined;

    const palletCount = toPositiveNumber(data.palletCount);
    if (palletCount !== null) {
      normalized.palletCount = palletCount;
    } else if (pallets.length) {
      normalized.palletCount = pallets.length;
    }

    const totalWeight = toPositiveNumber(data.totalWeight);
    if (totalWeight !== null) {
      normalized.totalWeight = totalWeight;
    }

    return pruneUndefined(normalized);
  }

  const dimensionData = (data.dimensions ?? {}) as Record<string, unknown>;
  const length = toPositiveNumber(dimensionData.length);
  const width = toPositiveNumber(dimensionData.width);
  const height = toPositiveNumber(dimensionData.height);

  if (length !== null && width !== null && height !== null) {
    normalized.dimensions = {
      length,
      width,
      height,
      units: normalizeDimensionUnit(dimensionData.units),
    };
  }

  const weightData = (data.weight ?? {}) as Record<string, unknown>;
  const weightValue = toPositiveNumber(weightData.value);
  if (weightValue !== null) {
    normalized.weight = {
      value: weightValue,
      units: normalizeWeightUnit(weightData.units),
    };
  }

  if (Array.isArray(data.entries) && data.entries.length) {
    normalized.entries = data.entries.map((entry) => entry as Record<string, unknown>);
  }

  const entryCount = toPositiveNumber(data.entryCount ?? (normalized.entries?.length ?? null));
  if (entryCount !== null) {
    normalized.entryCount = entryCount;
  }

  if (data.scannedContainer === null) {
    normalized.scannedContainer = null;
  } else if (typeof data.scannedContainer === 'string' && data.scannedContainer.trim().length) {
    normalized.scannedContainer = data.scannedContainer.trim();
  }

  return pruneUndefined(normalized);
}

export function buildMeasurementSummary(measurements: NormalizedFinalMeasurements) {
  const dimensionsSummary = measurements.dimensions
    ? `${measurements.dimensions.length} × ${measurements.dimensions.width} × ${measurements.dimensions.height} ${measurements.dimensions.units}`
    : 'Not recorded';

  const weightSummary = measurements.weight
    ? `${measurements.weight.value} ${measurements.weight.units}`
    : 'Not recorded';

  return { dimensionsSummary, weightSummary };
}

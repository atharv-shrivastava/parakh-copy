export interface SampleSizeRule {
  minLotSizeExclusive?: number;
  maxLotSizeInclusive?: number;
  sampleSize: number;
}

/**
 * Fifth Schedule sampling rules as currently represented by the Rules Engine.
 *
 * IMPORTANT: the engine does not infer a legal sampling result from an
 * individual package. This table only determines the number of packages
 * required when a Rule 19 inspection is actually being performed.
 *
 * The current consolidated legal text must be re-verified against the
 * authoritative amendment history before this becomes enforcement-grade.
 */
export const FIFTH_SCHEDULE_SAMPLE_RULES: readonly SampleSizeRule[] = [
  { maxLotSizeInclusive: 4000, sampleSize: 50 },
  { minLotSizeExclusive: 4000, sampleSize: 80 },
];

export function requiredSampleSize(lotSize: number): number | undefined {
  if (!Number.isInteger(lotSize) || lotSize <= 0) return undefined;
  return lotSize <= 4000 ? 50 : 80;
}

export interface SamplingPlan {
  lotSize: number;
  requiredSampleSize: number;
  randomSelectionRequired: true;
  selectionDistribution: 'representative-stock-positions';
}

export function createSamplingPlan(lotSize: number): SamplingPlan | undefined {
  const sampleSize = requiredSampleSize(lotSize);
  if (sampleSize === undefined) return undefined;
  return {
    lotSize,
    requiredSampleSize: sampleSize,
    randomSelectionRequired: true,
    selectionDistribution: 'representative-stock-positions',
  };
}

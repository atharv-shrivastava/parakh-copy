export interface SampleSizeRule {
  minLotSizeInclusive: number;
  maxLotSizeInclusive?: number;
  sampleSize: number;
  correctionFactor: number;
  maxPackagesAboveMpeBelowTwiceMpe: number;
}

/**
 * Fifth Schedule, effective from 1 January 2018 under G.S.R. 629(E).
 *
 * The sampling table is a Rule 19 inspection procedure. It does not by itself
 * establish package compliance. The correction factor is consumed by the
 * Sixth Schedule corrected-average calculation.
 */
export const FIFTH_SCHEDULE_SAMPLE_RULES: readonly SampleSizeRule[] = [
  { minLotSizeInclusive: 100, maxLotSizeInclusive: 500, sampleSize: 50, correctionFactor: 0.379, maxPackagesAboveMpeBelowTwiceMpe: 3 },
  { minLotSizeInclusive: 501, maxLotSizeInclusive: 3200, sampleSize: 80, correctionFactor: 0.295, maxPackagesAboveMpeBelowTwiceMpe: 5 },
  { minLotSizeInclusive: 3201, sampleSize: 125, correctionFactor: 0.234, maxPackagesAboveMpeBelowTwiceMpe: 7 },
];

export function samplingRuleForLot(lotSize: number): SampleSizeRule | undefined {
  if (!Number.isInteger(lotSize) || lotSize < 100) return undefined;
  return FIFTH_SCHEDULE_SAMPLE_RULES.find(rule =>
    lotSize >= rule.minLotSizeInclusive &&
    (rule.maxLotSizeInclusive === undefined || lotSize <= rule.maxLotSizeInclusive)
  );
}

export function requiredSampleSize(lotSize: number): number | undefined {
  return samplingRuleForLot(lotSize)?.sampleSize;
}

export interface SamplingPlan extends SampleSizeRule {
  lotSize: number;
  randomSelectionRequired: true;
  selectionDistribution: 'representative-stock-positions';
}

export function createSamplingPlan(lotSize: number): SamplingPlan | undefined {
  const rule = samplingRuleForLot(lotSize);
  if (!rule) return undefined;
  return {
    ...rule,
    lotSize,
    randomSelectionRequired: true,
    selectionDistribution: 'representative-stock-positions',
  };
}

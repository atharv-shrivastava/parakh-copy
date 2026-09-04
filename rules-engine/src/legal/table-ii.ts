export type TableIIUnit = 'm' | 'm2' | 'number';

export interface TableIIMpeResult {
  applicable: boolean;
  tolerance?: number;
  deficiency?: number;
  withinTolerance?: boolean;
  reason?: string;
}

/** First Schedule, Table II: length 2% up to 10m and 1% thereafter; area 4% up to 10m² and 1% thereafter; number 2%. */
export function firstScheduleTableII(kind: TableIIUnit, declared: number, actual: number): TableIIMpeResult {
  if (!Number.isFinite(declared) || !Number.isFinite(actual) || declared <= 0 || actual < 0) {
    return { applicable: false, reason: 'Declared and actual values must be finite and non-negative, with a positive declaration.' };
  }
  let rate: number;
  if (kind === 'm') rate = declared <= 10 ? 0.02 : 0.01;
  else if (kind === 'm2') rate = declared <= 10 ? 0.04 : 0.01;
  else rate = 0.02;
  const tolerance = declared * rate;
  const deficiency = declared - actual;
  return { applicable: true, tolerance, deficiency, withinTolerance: deficiency <= tolerance };
}

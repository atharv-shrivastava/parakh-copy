export const RULE_26_PAN_MASALA_EXCLUSION_EFFECTIVE_FROM = '2026-02-01';
export function panMasalaRule26ExclusionApplies(inspectionDate: string): boolean {
  return inspectionDate.slice(0, 10) >= RULE_26_PAN_MASALA_EXCLUSION_EFFECTIVE_FROM;
}

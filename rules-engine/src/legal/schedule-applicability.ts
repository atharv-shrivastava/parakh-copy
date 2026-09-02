import { isSecondScheduleStandard, normalizeQuantity } from './schedules.js';

/**
 * The Second Schedule was omitted by G.S.R. 226(E), with the amended
 * provisions taking effect from 1 October 2022. It therefore cannot be
 * evaluated as a current-rule requirement after that date.
 */
export const SECOND_SCHEDULE_END_DATE = '2022-09-30';
export const SECOND_SCHEDULE_OMISSION_EFFECTIVE_DATE = '2022-10-01';

export function secondScheduleApplicableOn(inspectionDate: string): boolean {
  return inspectionDate.slice(0, 10) <= SECOND_SCHEDULE_END_DATE;
}

export function evaluateHistoricalSecondSchedule(
  inspectionDate: string,
  commodity: string,
  quantity: number,
  unit: string
): ReturnType<typeof isSecondScheduleStandard> {
  if (!secondScheduleApplicableOn(inspectionDate)) {
    return {
      applicable: false,
      compliant: true,
      description: 'Second Schedule was omitted with effect from 1 October 2022; no current Rule 5 standard-size finding is generated.'
    };
  }

  const normalized = normalizeQuantity(quantity, unit);
  if (!normalized) {
    return { applicable: false, compliant: false, description: 'Quantity could not be normalized for historical Second Schedule evaluation.' };
  }

  return isSecondScheduleStandard(commodity, normalized.value, normalized.unit);
}

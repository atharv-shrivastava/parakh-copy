export const SECOND_SCHEDULE_EFFECTIVE_UNTIL = '2022-09-30';

/**
 * The Second Schedule ceased to apply when the Rule 5/Second Schedule
 * omission took effect on 1 October 2022. Keep the schedule data for
 * historical inspections only.
 */
export function secondScheduleAppliesOn(inspectionDate: string): boolean {
  return inspectionDate.slice(0, 10) <= SECOND_SCHEDULE_EFFECTIVE_UNTIL;
}

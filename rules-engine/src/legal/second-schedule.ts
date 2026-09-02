export const SECOND_SCHEDULE_EFFECTIVE_UNTIL = '2022-11-30';

/** The Second Schedule ceased to apply from 1 December 2022. */
export function secondScheduleAppliesOn(inspectionDate: string): boolean {
  return inspectionDate.slice(0, 10) <= SECOND_SCHEDULE_EFFECTIVE_UNTIL;
}

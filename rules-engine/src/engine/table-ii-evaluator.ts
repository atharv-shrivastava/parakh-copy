import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

const SOURCE = SOURCES.PRINCIPAL_2011;

type Kind = 'length' | 'area' | 'number';

type MeasurementInput = {
  declared: number;
  actual: number;
  unit?: string;
};

function pathValue(input: unknown, field: string): unknown {
  return field.split('.').reduce<unknown>((value, part) => {
    if (value == null || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[part];
  }, input);
}

function evidenceValue(request: InspectionRequest, fields: string[]): unknown {
  for (const field of fields) {
    const direct = pathValue(request, field);
    if (direct !== undefined) return direct;
    const evidence = request.evidence.find((item) => item.field === field);
    if (evidence) return evidence.normalizedValue ?? evidence.rawValue;
  }
  return undefined;
}

function asMeasurement(value: unknown): MeasurementInput | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const declared = Number(item.declared ?? item.declaredValue ?? item.declaredQuantity);
  const actual = Number(item.actual ?? item.actualValue ?? item.actualQuantity);
  if (!Number.isFinite(declared) || !Number.isFinite(actual) || declared < 0 || actual < 0) return undefined;
  return { declared, actual, unit: typeof item.unit === 'string' ? item.unit : undefined };
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function convert(value: number, unit: string | undefined, kind: Kind): number | undefined {
  const normalized = (unit ?? '').trim().toLowerCase();
  if (kind === 'length') {
    if (!normalized || ['m', 'meter', 'meters'].includes(normalized)) return value;
    if (['cm', 'centimeter', 'centimeters'].includes(normalized)) return value / 100;
    if (['mm', 'millimeter', 'millimeters'].includes(normalized)) return value / 1000;
  }
  if (kind === 'area') {
    if (!normalized || ['m2', 'm²', 'sqm', 'square metre', 'square meter'].includes(normalized)) return value;
    if (['cm2', 'cm²', 'sq cm', 'sqcm'].includes(normalized)) return value / 10000;
    if (['mm2', 'mm²', 'sq mm', 'sqmm'].includes(normalized)) return value / 1_000_000;
  }
  if (kind === 'number') {
    if (!normalized || ['number', 'unit', 'piece', 'pieces', 'pair', 'pairs', 'set', 'sets'].includes(normalized)) return value;
  }
  return undefined;
}

function makeFinding(
  status: EvaluationStatus,
  kind: Kind,
  field: string,
  message: string,
  reason?: string,
  missingEvidence?: string[],
): Finding {
  return {
    findingId: `PCR-FIRST-SCHEDULE-TII-${kind.toUpperCase()}`,
    ruleId: 'PCR-FIRST-SCHEDULE-TABLE-II',
    ruleCode: 'PCR-FIRST-SCHEDULE-TABLE-II',
    ruleNumber: 'First Schedule Table II',
    ruleVersion: 1,
    status,
    field,
    message,
    violationReason: reason,
    missingEvidence,
    legalReferences: [SOURCE],
    severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH',
    requiresLegalReview: false,
  };
}

function evaluateMeasurement(kind: Kind, input: MeasurementInput, field: string): Finding {
  const declared = convert(input.declared, input.unit, kind);
  const actual = convert(input.actual, input.unit, kind);

  if (declared === undefined || actual === undefined) {
    return makeFinding(
      'UNABLE_TO_VERIFY',
      kind,
      field,
      `The supplied ${kind} measurement uses an unsupported or missing unit, so Table II MPE cannot be applied reliably.`,
      undefined,
      [`${field}.unit`],
    );
  }

  const mpeRate = kind === 'length' ? (declared <= 10 ? 0.02 : 0.01) : kind === 'area' ? (declared <= 10 ? 0.04 : 0.01) : 0.02;
  const mpe = declared * mpeRate;
  const deficiency = declared - actual;

  if (actual >= declared) {
    return makeFinding(
      'PASS',
      kind,
      field,
      `The measured ${kind} is not deficient. Table II MPE is concerned with deficiency, so the supplied measurement does not establish a deficiency violation.`,
    );
  }

  if (deficiency > mpe) {
    return makeFinding(
      'VIOLATION',
      kind,
      field,
      `The measured ${kind} is deficient by ${deficiency}; the applicable Table II maximum permissible error is ${mpe}.`,
      'The measured deficiency exceeds the applicable First Schedule Table II maximum permissible error.',
    );
  }

  return makeFinding(
    'PASS',
    kind,
    field,
    `The measured ${kind} deficiency of ${deficiency} is within the applicable Table II maximum permissible error of ${mpe}.`,
  );
}

export function tableIIFinding(request: InspectionRequest): Finding | null {
  const length = asMeasurement(evidenceValue(request, ['measurements.length', 'measurement.length', 'dimensions.length']));
  if (length) return evaluateMeasurement('length', length, 'measurements.length');

  const area = asMeasurement(evidenceValue(request, ['measurements.area', 'measurement.area', 'dimensions.area']));
  if (area) return evaluateMeasurement('area', area, 'measurements.area');

  const count = asMeasurement(evidenceValue(request, ['measurements.number', 'measurement.number', 'quantity.number']));
  if (count) return evaluateMeasurement('number', count, 'measurements.number');

  const declaredNumber = asNumber(evidenceValue(request, ['measurements.declaredNumber', 'measurement.declaredNumber']));
  const actualNumber = asNumber(evidenceValue(request, ['measurements.actualNumber', 'measurement.actualNumber']));
  if (declaredNumber !== undefined || actualNumber !== undefined) {
    if (declaredNumber === undefined || actualNumber === undefined) {
      return makeFinding(
        'UNABLE_TO_VERIFY',
        'number',
        'measurements.number',
        'Table II number-based MPE requires both declared and actual number values.',
        undefined,
        ['measurements.declaredNumber', 'measurements.actualNumber'],
      );
    }
    return evaluateMeasurement('number', { declared: declaredNumber, actual: actualNumber }, 'measurements.number');
  }

  return null;
}

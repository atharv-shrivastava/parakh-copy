import type { Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

const SOURCE = SOURCES.PRINCIPAL_2011;

function finding(id: string, code: string, number: string, status: Finding['status'], field: string, message: string, reason?: string, missing?: string[]): Finding {
  return {
    findingId: id,
    ruleId: code,
    ruleCode: code,
    ruleNumber: number,
    ruleVersion: 1,
    status,
    field,
    message,
    violationReason: reason,
    missingEvidence: missing,
    legalReferences: [SOURCE],
    severity: status === 'VIOLATION' ? 'HIGH' : 'INFO',
    requiresLegalReview: false,
  };
}

function value(r: InspectionRequest, ...fields: string[]): unknown {
  for (const field of fields) {
    const direct = field.split('.').reduce<unknown>((v, p) =>
      v !== null && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined,
      r,
    );
    if (direct !== undefined) return direct;
    const evidence = r.evidence.find(e => e.field === field);
    if (evidence) return evidence.normalizedValue ?? evidence.rawValue;
  }
  return undefined;
}

/**
 * Rules 29 and 30 describe the administrative registration records used by
 * Legal Metrology authorities. They are not inferred from package artwork.
 * The engine evaluates them only when explicit administrative evidence is
 * supplied.
 */
export function rules29To30Findings(r: InspectionRequest): Finding[] {
  const out: Finding[] = [];

  const registerAvailable = value(
    r,
    'administrative.rule29RegisterAvailable',
    'rule29RegisterAvailable',
  );

  if (registerAvailable !== undefined) {
    if (registerAvailable === true || String(registerAvailable).toLowerCase() === 'true') {
      out.push(finding(
        'PCR-R29-PASS',
        'PCR-R29',
        '29',
        'PASS',
        'administrative.rule29RegisterAvailable',
        'The supplied administrative evidence indicates that the Rule 29 register is available for public inspection.',
      ));
    } else {
      out.push(finding(
        'PCR-R29-VIOLATION',
        'PCR-R29',
        '29',
        'VIOLATION',
        'administrative.rule29RegisterAvailable',
        'The supplied administrative evidence indicates that the Rule 29 register is not available for the required public inspection.',
        'Rule 29 requires the register referred to in Rule 29(1) to be open to public inspection without fee.',
      ));
    }
  }

  const listCompiled = value(
    r,
    'administrative.rule30StateWiseListCompiled',
    'rule30StateWiseListCompiled',
  );

  if (listCompiled !== undefined) {
    if (listCompiled === true || String(listCompiled).toLowerCase() === 'true') {
      out.push(finding(
        'PCR-R30-PASS',
        'PCR-R30',
        '30',
        'PASS',
        'administrative.rule30StateWiseListCompiled',
        'The supplied administrative evidence indicates that the Rule 30 State-wise registered-manufacturer/packer list has been compiled.',
      ));
    } else {
      out.push(finding(
        'PCR-R30-UNVERIFIED',
        'PCR-R30',
        '30',
        'UNABLE_TO_VERIFY',
        'administrative.rule30StateWiseListCompiled',
        'The supplied administrative evidence does not establish the required Rule 30 State-wise list compilation.',
        undefined,
        ['administrative.rule30StateWiseListCompiled'],
      ));
    }
  }

  return out;
}

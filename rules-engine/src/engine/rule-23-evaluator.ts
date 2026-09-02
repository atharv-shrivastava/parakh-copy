import type { EvaluationStatus, Finding, InspectionRequest } from '../../domain/types.js';
import { SOURCES } from '../legal/sources.js';

function value(r: InspectionRequest, field: string): unknown {
  const direct = field.split('.').reduce<unknown>((v, key) =>
    v != null && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined,
    r,
  );
  if (direct !== undefined) return direct;
  const item = r.evidence.find(e => e.field === field);
  return item?.normalizedValue ?? item?.rawValue;
}

function bool(r: InspectionRequest, field: string): boolean | undefined {
  const v = value(r, field);
  if (v === true || String(v).toLowerCase() === 'true') return true;
  if (v === false || String(v).toLowerCase() === 'false') return false;
  return undefined;
}

function finding(id: string, status: EvaluationStatus, field: string, message: string, reason?: string, missing?: string[]): Finding {
  return {
    findingId: id, ruleId: 'PCR-R23', ruleCode: 'PCR-R23', ruleNumber: '23', ruleVersion: 1,
    status, field, message, violationReason: reason, missingEvidence: missing,
    legalReferences: [SOURCES.PRINCIPAL_2011], severity: status === 'VIOLATION' ? 'CRITICAL' : 'HIGH', requiresLegalReview: false,
  };
}

export function rule23Findings(r: InspectionRequest): Finding[] {
  const applies = r.context === 'physical_package' || r.context === 'both';
  if (!applies) return [];
  const deceptive = bool(r, 'rule23.deceptivePackage');
  const quantityAgrees = bool(r, 'rule23.quantityAgreesWithDeclaration');
  const repackedRelabeled = bool(r, 'rule23.repackedAndRelabeled');
  const largerDimensionsJustified = bool(r, 'rule23.largerDimensionsJustified');
  const visualInspection = bool(r, 'rule23.visualInspectionPerformed');
  if (visualInspection !== true) return [finding('PCR-R23-VISUAL-UNVERIFIED','UNABLE_TO_VERIFY','rule23.visualInspectionPerformed','Rule 23 requires assessment of whether package design gives an exaggerated or misleading impression of quantity; visual inspection evidence was not supplied.',undefined,['rule23.visualInspectionPerformed'])];
  if (deceptive === undefined) return [finding('PCR-R23-DECEPTIVE-UNVERIFIED','UNABLE_TO_VERIFY','rule23.deceptivePackage','Visual inspection was recorded, but the evidence does not establish whether the package is deceptive within Rule 23.',undefined,['rule23.deceptivePackage'])];
  if (!deceptive) return [finding('PCR-R23-PASS','PASS','rule23.deceptivePackage','The supplied visual inspection does not identify a deceptive package under Rule 23.')];
  if (largerDimensionsJustified === true) return [finding('PCR-R23-JUSTIFIED-DIMENSIONS','PASS','rule23.largerDimensionsJustified','The larger package dimensions are supported by evidence of protection of the commodity or machine-filling requirements, the express Rule 23 exception.')];
  if (quantityAgrees === undefined) return [finding('PCR-R23-QUANTITY-UNVERIFIED','UNABLE_TO_VERIFY','rule23.quantityAgreesWithDeclaration','The package was visually identified as potentially deceptive, but quantity determination was not supplied to establish the Rule 23 condition.',undefined,['rule23.quantityAgreesWithDeclaration'])];
  if (!quantityAgrees) return [finding('PCR-R23-QUANTITY-MISMATCH','UNABLE_TO_VERIFY','rule23.quantityAgreesWithDeclaration','The quantity does not agree with the declaration, so the specific Rule 23 deceptive-package procedure cannot be applied as a standalone finding; the applicable quantity deficiency rules must be evaluated separately.','Rule 23 specifically addresses packages whose contained quantity agrees with the declaration but whose design creates an exaggerated or misleading impression.')];
  if (repackedRelabeled === true) return [finding('PCR-R23-REMEDIATED-PASS','PASS','rule23.repackedAndRelabeled','The deceptive package was recorded as repacked and relabelled in accordance with the required standards.')];
  if (repackedRelabeled === undefined) return [finding('PCR-R23-REMEDIATION-UNVERIFIED','UNABLE_TO_VERIFY','rule23.repackedAndRelabeled','A deceptive package with quantity agreeing with its declaration was identified, but the inspection record does not establish whether it was repacked and relabelled.',undefined,['rule23.repackedAndRelabeled'])];
  return [finding('PCR-R23-VIOLATION','VIOLATION','rule23.repackedAndRelabeled','A deceptive package was identified with quantity agreeing with the declaration, and the required repacking and relabelling was not recorded.','Rule 23 requires a deceptive package to be repacked and relabelled; failure permits seizure and appropriate punitive action.')];
}

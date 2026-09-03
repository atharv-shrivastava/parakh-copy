export const OFFENCE_OCCURRENCES = ["FIRST", "SECOND", "SUBSEQUENT"];

const DEFAULT_PENALTIES = {
  "36(1)": {
    provision: "Legal Metrology Act, 2009, Section 36(1)",
    sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2102",
    first: { action: "IMPROVEMENT_NOTICE", min: 0, max: 0, label: "Improvement notice" },
    second: { action: "PENALTY", min: 0, max: 500000, label: "Penalty up to ₹5,00,000" },
    subsequent: { action: "PENALTY_OR_IMPRISONMENT", min: 2500000, max: 5000000, imprisonmentMaxMonths: 12, label: "₹25,00,000 to ₹50,00,000, or imprisonment up to 1 year, or both" },
  },
  "36(2)": {
    provision: "Legal Metrology Act, 2009, Section 36(2)",
    sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2102",
    first: { action: "PENALTY", min: 10000, max: 100000, label: "₹10,000 to ₹1,00,000" },
    second: { action: "PENALTY", min: 0, max: 500000, label: "Penalty up to ₹5,00,000" },
    subsequent: { action: "PENALTY_OR_IMPRISONMENT", min: 0, max: 5000000, imprisonmentMaxMonths: 12, label: "Penalty up to ₹50,00,000, or imprisonment up to 1 year, or both" },
  },
  "RULE32": {
    provision: "Legal Metrology (Packaged Commodities) Rules, 2011, Rule 32",
    sourceUrl: "https://upload.indiacode.nic.in/showfile?actid=AC_CH_60_1205_00002_00002_1560405527490&filename=9_the_legal_metrology_%28package_commodities%29_rules%2C_2011.pdf&type=rule",
    first: { action: "PENALTY", min: 5000, max: 5000, label: "Fine of ₹5,000" },
    second: { action: "PENALTY", min: 5000, max: 5000, label: "Fine of ₹5,000" },
    subsequent: { action: "PENALTY", min: 5000, max: 5000, label: "Fine of ₹5,000" },
  },
};

const RULE32_DEFAULT_RULE_NUMBERS = new Set(["4", "6(1)(a)", "6(1)(d)", "10"]);

function textBlob(finding) {
  return JSON.stringify({
    ruleId: finding?.ruleId,
    ruleCode: finding?.ruleCode,
    ruleNumber: finding?.ruleNumber,
    message: finding?.message,
    violationReason: finding?.violationReason,
    legalReferences: finding?.legalReferences,
    legalSources: finding?.legalSources,
  }).toLowerCase();
}

export function getDefaultPenalty(finding) {
  const ruleNumber = String(finding?.ruleNumber || "").trim().toLowerCase();
  if (RULE32_DEFAULT_RULE_NUMBERS.has(ruleNumber)) return DEFAULT_PENALTIES.RULE32;

  const text = textBlob(finding);
  if (text.includes("36(2)") || text.includes("section 36(2)")) return DEFAULT_PENALTIES["36(2)"];
  if (text.includes("36(1)") || text.includes("section 36(1)")) return DEFAULT_PENALTIES["36(1)"];
  if (text.includes("rule 32") || text.includes("rules 27 to 31")) return DEFAULT_PENALTIES.RULE32;
  return null;
}

export function getConfiguredPenalty(finding, activeRules = []) {
  const key = String(finding?.ruleId || finding?.ruleCode || finding?.ruleNumber || "").toLowerCase();
  const matching = activeRules.find((rule) => [rule.ruleId, rule.ruleCode, rule.ruleNumber].some((value) => String(value || "").toLowerCase() === key));
  return matching?.definition?.penalty?.enabled ? matching.definition.penalty : getDefaultPenalty(finding);
}

export function occurrenceDetails(penalty, occurrence) {
  if (!penalty) return null;
  const entry = penalty[occurrence.toLowerCase()] || penalty.subsequent;
  if (!entry) return null;
  return { ...entry, provision: penalty.provision, sourceUrl: penalty.sourceUrl || null };
}

export function calculatePenalty(findings, activeRules = [], occurrence = "SECOND") {
  const rows = findings.map((finding) => {
    const penalty = getConfiguredPenalty(finding, activeRules);
    const detail = occurrenceDetails(penalty, occurrence);
    return { finding, penalty, detail };
  });
  const applicable = rows.filter((row) => row.detail);
  const minTotal = applicable.reduce((sum, row) => sum + Number(row.detail.min || 0), 0);
  const maxTotal = applicable.reduce((sum, row) => sum + Number(row.detail.max || 0), 0);
  const hasUnknown = rows.some((row) => !row.detail);
  return { rows, applicable, minTotal, maxTotal, hasUnknown, occurrence };
}

export function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

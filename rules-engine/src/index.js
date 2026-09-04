export function evaluateProduct(product, rules = []) {
  const findings = [];
  for (const rule of rules) {
    if (typeof rule.check !== "function") continue;
    const result = rule.check(product);
    findings.push({
      ruleId: rule.id,
      ruleVersion: rule.version ?? "1",
      status: result?.status ?? "REVIEW",
      message: result?.message ?? "Rule evaluation requires review",
      evidence: result?.evidence ?? [],
    });
  }
  return { product, findings };
}

export function createRule({ id, version = "1", check }) {
  if (!id || typeof check !== "function") throw new TypeError("A rule id and check function are required");
  return Object.freeze({ id, version, check });
}

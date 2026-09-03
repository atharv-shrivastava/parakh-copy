import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/auth";
import "../styles/admin-rules.css";

const API_URL = "http://localhost:5000/api";
const CATEGORIES = ["APPLICABILITY","GENERAL_DECLARATION","NET_QUANTITY","MRP","DATE","DIMENSIONS","PRESENTATION","MANUFACTURER_PACKER_IMPORTER","E_COMMERCE","REGISTRATION","STANDARD_QUANTITY","MEASUREMENT","COMMODITY_SPECIFIC","PROCEDURAL"];
const SEVERITIES = ["CRITICAL","HIGH","MEDIUM","LOW","INFO"];
const OPERATORS = ["EXISTS","NOT_EXISTS","EQUALS","NOT_EQUALS","REGEX_MATCH","IN_NUMERIC_RANGE","GREATER_THAN","LESS_THAN","GREATER_THAN_OR_EQUAL","LESS_THAN_OR_EQUAL","VALID_CURRENCY","VALID_DATE_FORMAT","VALID_UNIT","IN_LIST","IN_SCHEDULE_II_STANDARD","WITHIN_FIRST_SCHEDULE_MPE","EVIDENCE_CONFIDENCE","DATE_RANGE","PACKAGE_TYPE","COMMODITY_TYPE","CONTEXT_TYPE","CONFLICT_EXISTS","VISUAL_CHECK"];
const CONTEXTS = ["physical_package","ecommerce_listing","both"];
const PACKAGE_TYPES = ["retail","wholesale","multi_unit","group","combination"];
const CONSUMER_TYPES = ["general","industrial","institutional"];

const emptyPenalty = {
  enabled: false,
  currency: "INR",
  provision: "",
  sourceUrl: "",
  first: { action: "", min: 0, max: 0, label: "" },
  second: { action: "", min: 0, max: 0, label: "" },
  subsequent: { action: "", min: 0, max: 0, label: "" },
};

const section36_1 = {
  enabled: true,
  currency: "INR",
  provision: "Legal Metrology Act, 2009, Section 36(1)",
  sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2102",
  first: { action: "IMPROVEMENT_NOTICE", min: 0, max: 0, label: "Improvement notice" },
  second: { action: "PENALTY", min: 0, max: 500000, label: "Penalty up to ₹5,00,000" },
  subsequent: { action: "PENALTY_OR_IMPRISONMENT", min: 2500000, max: 5000000, imprisonmentMaxMonths: 12, label: "₹25,00,000 to ₹50,00,000, or imprisonment up to 1 year, or both" },
};
const section36_2 = {
  enabled: true,
  currency: "INR",
  provision: "Legal Metrology Act, 2009, Section 36(2)",
  sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2102",
  first: { action: "PENALTY", min: 10000, max: 100000, label: "₹10,000 to ₹1,00,000" },
  second: { action: "PENALTY", min: 0, max: 500000, label: "Penalty up to ₹5,00,000" },
  subsequent: { action: "PENALTY_OR_IMPRISONMENT", min: 0, max: 5000000, imprisonmentMaxMonths: 12, label: "Penalty up to ₹50,00,000, or imprisonment up to 1 year, or both" },
};

function blankDefinition() {
  return {
    ruleId: "", ruleCode: "", ruleNumber: "", subclause: "", title: "", description: "", category: "GENERAL_DECLARATION", defaultSeverity: "MEDIUM", enabled: true,
    penalty: { ...emptyPenalty, first: { ...emptyPenalty.first }, second: { ...emptyPenalty.second }, subsequent: { ...emptyPenalty.subsequent } },
    versions: [{ version: 1, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveUntil: null, status: "ACTIVE", legalSources: [], applicabilityCriteria: { contexts: ["physical_package"] }, conditions: [{ conditionId: "condition-1", targetField: "declarations.productName", operator: "EXISTS", expectedValue: null, visualCheckRequired: false, minimumConfidence: 0.6, errorMessage: "Required declaration could not be verified.", violationReason: "Required declaration is missing." }] }],
  };
}

function normalizeRule(rule) {
  const definition = rule?.definition && typeof rule.definition === "object" ? rule.definition : {};
  const penalty = definition.penalty && typeof definition.penalty === "object" ? definition.penalty : emptyPenalty;
  return { ...blankDefinition(), ...definition, penalty: { ...emptyPenalty, ...penalty, first: { ...emptyPenalty.first, ...(penalty.first || {}) }, second: { ...emptyPenalty.second, ...(penalty.second || {}) }, subsequent: { ...emptyPenalty.subsequent, ...(penalty.subsequent || {}) } }, ruleId: rule.ruleId, ruleCode: rule.ruleCode, ruleNumber: rule.ruleNumber, subclause: rule.subclause || definition.subclause || "", title: rule.title, description: rule.description, category: rule.category, defaultSeverity: rule.defaultSeverity, enabled: rule.enabled };
}

function pretty(value) { return JSON.stringify(value ?? null, null, 2); }
function parseJson(text, label) { try { return JSON.parse(text); } catch { throw new Error(`${label} contains invalid JSON.`); } }

export default function AdminRules() {
  const [rules, setRules] = useState([]); const [selectedId, setSelectedId] = useState(""); const [draft, setDraft] = useState(blankDefinition()); const [search, setSearch] = useState(""); const [showEditor, setShowEditor] = useState(false); const [versionsText, setVersionsText] = useState(pretty(blankDefinition().versions)); const [penaltyText, setPenaltyText] = useState(pretty(blankDefinition().penalty)); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { setMessage(""); const response = await apiFetch(`${API_URL}/admin/rules`); const data = await response.json().catch(() => []); if (!response.ok) throw new Error(data.error || "Unable to load rules"); setRules(data); }
  useEffect(() => { load().catch((e) => setMessage(e.message)); }, []);
  const filtered = useMemo(() => rules.filter((rule) => `${rule.ruleCode} ${rule.ruleNumber} ${rule.title} ${rule.category}`.toLowerCase().includes(search.toLowerCase())), [rules, search]);
  function startNew() { const value = blankDefinition(); setSelectedId(""); setDraft(value); setVersionsText(pretty(value.versions)); setPenaltyText(pretty(value.penalty)); setShowEditor(true); setMessage(""); }
  function startEdit(rule) { const value = normalizeRule(rule); setSelectedId(rule.id); setDraft(value); setVersionsText(pretty(value.versions)); setPenaltyText(pretty(value.penalty)); setShowEditor(true); setMessage(""); }
  function update(key, value) { setDraft((current) => ({ ...current, [key]: value })); }
  function loadPenaltyTemplate(template) { setPenaltyText(pretty(template)); setDraft((current) => ({ ...current, penalty: template })); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const versions = parseJson(versionsText, "Rule versions"); const penalty = parseJson(penaltyText, "Penalty schedule");
      if (!Array.isArray(versions) || !versions.length) throw new Error("Rule versions must be a non-empty JSON array.");
      for (const version of versions) { if (!Array.isArray(version.conditions)) throw new Error(`Version ${version.version} must contain a conditions array.`); if (!Array.isArray(version.legalSources)) throw new Error(`Version ${version.version} must contain a legalSources array.`); if (!version.applicabilityCriteria || typeof version.applicabilityCriteria !== "object") throw new Error(`Version ${version.version} must contain applicabilityCriteria.`); }
      if (typeof penalty !== "object" || Array.isArray(penalty)) throw new Error("Penalty schedule must be a JSON object.");
      const definition = { ...draft, versions, penalty, enabled: Boolean(draft.enabled) }; const payload = { ...definition, definition };
      const url = selectedId ? `${API_URL}/admin/rules/${selectedId}` : `${API_URL}/admin/rules`; const response = await apiFetch(url, { method: selectedId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Unable to save rule"); setMessage("Rule saved. Penalty metadata is now available to inspector calculations."); setShowEditor(false); await load();
    } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  async function disableRule(rule) { if (!window.confirm(`Disable ${rule.ruleCode}? Historical inspections will remain intact.`)) return; setBusy(true); setMessage(""); try { const response = await apiFetch(`${API_URL}/admin/rules/${rule.id}`, { method: "DELETE" }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Unable to disable rule"); setMessage(data.message || "Rule disabled."); await load(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }

  return <div className="admin-rules-page"><div className="page-header"><p className="eyebrow">ADMINISTRATION</p><h1>Compliance Rules</h1><p>Manage versioned rule definitions, legal sources and statutory penalty schedules.</p></div>
    <div className="admin-rules-toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rule code, number, title..." /><button className="primary-button" type="button" onClick={startNew}>Add Rule</button></div>
    {message && <div className="status-message">{message}</div>}
    <div className="admin-rules-layout"><section className="admin-rules-list">{filtered.map((rule) => <article className={`rule-card ${rule.enabled ? "" : "is-disabled"}`} key={rule.id} onClick={() => startEdit(rule)}><div><strong>{rule.ruleCode}</strong><span>Rule {rule.ruleNumber}</span></div><h3>{rule.title}</h3><p>{rule.category} · {rule.defaultSeverity}</p><small>{rule.enabled ? "ACTIVE" : "DISABLED"}{rule.isBuiltin ? " · BUILT-IN" : " · ADMIN"}{rule.definition?.penalty?.enabled ? " · PENALTY CONFIGURED" : ""}</small><div className="rule-card-actions"><button type="button" onClick={(e) => { e.stopPropagation(); startEdit(rule); }}>Edit</button>{rule.enabled && <button type="button" onClick={(e) => { e.stopPropagation(); disableRule(rule); }}>Disable</button>}</div></article>)}{!filtered.length && <div className="empty-state">No matching rules.</div>}</section>
      {showEditor && <form className="admin-rules-editor" onSubmit={save}><div className="editor-header"><div><p className="eyebrow">{selectedId ? "EDIT RULE" : "NEW RULE"}</p><h2>{selectedId ? "Edit Rule" : "Add Rule"}</h2></div><button type="button" onClick={() => setShowEditor(false)}>Close</button></div>
        <div className="rule-form-grid"><label>Rule ID<input value={draft.ruleId} onChange={(e) => update("ruleId", e.target.value)} required /></label><label>Rule code<input value={draft.ruleCode} onChange={(e) => update("ruleCode", e.target.value)} required /></label><label>Rule number<input value={draft.ruleNumber} onChange={(e) => update("ruleNumber", e.target.value)} required /></label><label>Sub-clause<input value={draft.subclause || ""} onChange={(e) => update("subclause", e.target.value)} /></label><label>Category<select value={draft.category} onChange={(e) => update("category", e.target.value)}>{CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></label><label>Severity<select value={draft.defaultSeverity} onChange={(e) => update("defaultSeverity", e.target.value)}>{SEVERITIES.map((x) => <option key={x}>{x}</option>)}</select></label><label className="span-2">Title<input value={draft.title} onChange={(e) => update("title", e.target.value)} required /></label><label className="span-2">Description<textarea value={draft.description} onChange={(e) => update("description", e.target.value)} required /></label></div>
        <label className="rule-enabled"><input type="checkbox" checked={draft.enabled} onChange={(e) => update("enabled", e.target.checked)} /> Enabled</label>
        <div className="editor-help">Conditions and legal sources remain versioned JSON. Penalty data is stored alongside the rule and used by the inspector penalty calculator.</div>
        <div className="rule-json-reference"><strong>Penalty templates</strong><div className="editor-template-actions"><button type="button" className="secondary-button" onClick={() => loadPenaltyTemplate(section36_1)}>Section 36(1)</button><button type="button" className="secondary-button" onClick={() => loadPenaltyTemplate(section36_2)}>Section 36(2)</button></div></div>
        <label>Penalty / Enforcement JSON<textarea className="json-editor" value={penaltyText} onChange={(e) => setPenaltyText(e.target.value)} spellCheck="false" /></label>
        <div className="rule-json-reference"><strong>Penalty shape</strong><code>{pretty({ enabled: true, currency: "INR", provision: "Legal Metrology Act, 2009, Section 36(1)", sourceUrl: "https://...", first: { action: "IMPROVEMENT_NOTICE", min: 0, max: 0, label: "Improvement notice" }, second: { action: "PENALTY", min: 0, max: 500000, label: "Penalty up to ₹5,00,000" }, subsequent: { action: "PENALTY_OR_IMPRISONMENT", min: 2500000, max: 5000000, imprisonmentMaxMonths: 12, label: "₹25,00,000 to ₹50,00,000, or imprisonment up to 1 year, or both" } })}</code></div>
        <label>Rule Versions JSON<textarea className="json-editor" value={versionsText} onChange={(e) => setVersionsText(e.target.value)} spellCheck="false" /></label>
        <div className="rule-json-reference"><strong>Applicability fields used by the engine</strong><span>contexts: {CONTEXTS.join(", ")}</span><span>packageTypes: {PACKAGE_TYPES.join(", ")}</span><span>consumerTypes: {CONSUMER_TYPES.join(", ")}</span><span>plus included/excluded commodities, quantity limits and nested conditions.</span></div>
        <div className="rule-json-reference"><strong>Condition object</strong><code>{pretty({ conditionId: "r-example", targetField: "declarations.mrp", operator: "VALID_CURRENCY", expectedValue: null, visualCheckRequired: false, minimumConfidence: 0.6, errorMessage: "MRP could not be verified.", violationReason: "MRP is missing or invalid." })}</code></div>
        <div className="rule-json-reference"><strong>Legal source object</strong><code>{pretty({ sourceId: "SRC-001", notification: "...", title: "...", date: "2026-01-01", effectiveFrom: "2026-01-01", effectiveUntil: null, rule: "6(1)(e)", subclause: "...", sourceDocument: "...", sourcePage: 1, sourceUrl: "https://...", excerpt: "...", verificationStatus: "VERIFIED" })}</code></div>
        <div className="editor-actions"><button type="button" className="secondary-button" onClick={() => setShowEditor(false)}>Cancel</button><button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving..." : "Save Rule"}</button></div>
      </form>}
    </div></div>;
}

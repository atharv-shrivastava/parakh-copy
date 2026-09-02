import { useEffect, useState } from "react";
import { apiFetch, getUser } from "../lib/auth";
import "../styles/reports.css";

const API_URL = "http://localhost:5000/api";

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function violationFindings(stored) {
  const findings = stored?.compliance?.findings;
  return Array.isArray(findings) ? findings.filter((f) => String(f?.status || "").toUpperCase() === "VIOLATION") : [];
}

function Reports() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const user = getUser();

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("query", query.trim());
        if (status !== "ALL") params.set("status", status);
        const r = await apiFetch(`${API_URL}/products/history${params.toString() ? `?${params}` : ""}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load reports");
        setProducts(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, status]);

  async function print(p) {
    try {
      const r = await apiFetch(`${API_URL}/products/${p.id}`);
      const full = await r.json();
      if (!r.ok) throw new Error(full.error || "Could not load product report");

      const shop = full.inspections?.[0]?.shop;
      const inspector = full.inspections?.[0]?.worker?.name || full.owner?.name || user?.name || "Not recorded";
      const inspectionDate = new Date(full.inspections?.[0]?.inspectedAt || full.createdAt).toLocaleString();
      const path = [full.category?.parent?.parent?.parent, full.category?.parent?.parent, full.category?.parent, full.category]
        .filter(Boolean).map((x) => x.name).join(" → ");
      const stored = parseJson(full.ocrData, null);
      const violations = violationFindings(stored);
      const reason = violations.length
        ? violations.map((f) => `<li><strong>${escapeHtml(f.ruleNumber || "Rule")}</strong>${f.message ? `: ${escapeHtml(f.message)}` : ""}${f.violationReason ? `<div class="reason">${escapeHtml(f.violationReason)}</div>` : ""}</li>`).join("")
        : `<li>No Rules Engine violations were recorded for this product.</li>`;

      const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>PARAKH Report - ${escapeHtml(full.productName)}</title>
<style>
@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:0;line-height:1.45;font-size:12px}header{border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:18px}h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 10px}p{margin:4px 0}.muted{color:#6b7280}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.box{border:1px solid #d1d5db;border-radius:7px;padding:10px;min-height:52px}.label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:3px}.value{font-weight:600}.violation-box{border:1px solid #dc2626;background:#fef2f2;border-radius:7px;padding:12px}.violation-list{margin:0;padding-left:20px}.violation-list li{margin:0 0 10px}.reason{margin-top:3px;color:#7f1d1d}.footer{border-top:1px solid #d1d5db;margin-top:24px;padding-top:10px;color:#6b7280;font-size:10px}@media print{.no-print{display:none}}
</style></head><body>
<header><h1>PARAKH Product Inspection Report</h1><p class="muted">Generated ${escapeHtml(new Date().toLocaleString())}</p></header>
<h2>Product Details</h2><div class="grid">
<div class="box"><div class="label">Product</div><div class="value">${escapeHtml(full.productName)}</div></div>
<div class="box"><div class="label">Brand / Manufacturer</div><div class="value">${escapeHtml(full.brandName || "Not recorded")}</div></div>
<div class="box"><div class="label">Category</div><div class="value">${escapeHtml(path || full.category?.name || "Not recorded")}</div></div>
<div class="box"><div class="label">MRP</div><div class="value">${full.mrp == null ? "Not recorded" : `₹${escapeHtml(full.mrp)}`}</div></div>
<div class="box"><div class="label">Net Quantity</div><div class="value">${escapeHtml(`${full.netQuantity || "Not recorded"} ${full.unit || ""}`)}</div></div>
<div class="box"><div class="label">Barcode</div><div class="value">${escapeHtml(full.barcode || "Not recorded")}</div></div>
<div class="box"><div class="label">Shop</div><div class="value">${escapeHtml(shop?.name || "Not recorded")}</div></div>
<div class="box"><div class="label">Inspection Date</div><div class="value">${escapeHtml(inspectionDate)}</div></div>
</div>
<h2>User / Inspector Details</h2><div class="grid">
<div class="box"><div class="label">Name</div><div class="value">${escapeHtml(inspector)}</div></div>
<div class="box"><div class="label">Email</div><div class="value">${escapeHtml(full.owner?.email || user?.email || "Not recorded")}</div></div>
<div class="box"><div class="label">Role</div><div class="value">${escapeHtml(user?.role || "USER")}</div></div>
<div class="box"><div class="label">Compliance Status</div><div class="value">${escapeHtml(full.complianceStatus || "NEEDS_REVIEW")}</div></div>
</div>
<h2>Rules Violated by This Product</h2><div class="violation-box"><ul class="violation-list">${reason}</ul></div>
<div class="footer">This report contains only the product, signed-in inspector, and Rules Engine violations associated with this inspection record. PARAKH automated findings are decision-support evidence and remain subject to inspection authority verification.</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`;

      const w = window.open("", "_blank", "noopener,noreferrer,width=980,height=900");
      if (!w) throw new Error("Your browser blocked the report window. Allow pop-ups for this site.");
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e) {
      setError(e.message || "Could not generate the report");
    }
  }

  return <div className="reports-page">
    <div className="page-header"><p className="eyebrow">REPORTS</p><h1>Inspection Reports</h1><p>Search an inspection and print a clean A4 report containing the product, inspector and only its recorded rule violations.</p></div>
    <div className="reports-toolbar">
      <label className="reports-search"><span>Search</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Product, brand, category, shop or barcode..." /></label>
      <label className="reports-filter"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All statuses</option><option value="OKAY">Okay</option><option value="VIOLATION">Violation</option><option value="NEEDS_REVIEW">Needs review</option></select></label>
      <button className="reports-clear" type="button" onClick={() => { setQuery(""); setStatus("ALL"); }}>Clear</button>
    </div>
    {loading && <p className="reports-loading">Loading reports...</p>}
    {error && <div className="status-message">{error}</div>}
    {!loading && !error && !products.length && <div className="status-message">No reports match the current search and filter.</div>}
    {!loading && !error && products.map((p) => <div className="report-card" key={p.id}>
      <div><h3>{p.productName}</h3><p>{p.brandName || "Brand not recorded"} · {p.category?.name || "Uncategorised"} · {p.inspections?.[0]?.shop?.name || "No shop"}</p><div className="report-meta"><span>MRP ₹{p.mrp ?? "-"}</span><span>{p.netQuantity || "-"} {p.unit || ""}</span><span>{p.complianceStatus}</span><span>{p.owner?.name || user?.name || "User"}</span></div></div>
      <button className="report-button" onClick={() => print(p)}>Print / Save PDF</button>
    </div>)}
  </div>;
}

export default Reports;

import { useEffect, useMemo, useState } from "react";
import { apiFetch, getUser } from "../lib/auth";
import { downloadProductPdf } from "../lib/productPdf";
import "../styles/reports.css";
const API_URL = "http://localhost:5000/api";
function Reports() {
  const [products, setProducts] = useState([]); const [query, setQuery] = useState(""); const [status, setStatus] = useState("ALL"); const [brand, setBrand] = useState(""); const [shop, setShop] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const user = getUser();
  useEffect(() => { let alive = true; apiFetch(`${API_URL}/products/history`).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not load reports"); if (alive) setProducts(Array.isArray(data) ? data : []); }).catch((e) => alive && setError(e.message)).finally(() => alive && setLoading(false)); return () => { alive = false; }; }, []);
  const shown = useMemo(() => products.filter((p) => { const inspection = p.inspections?.[0]; const text = `${p.productName || ""} ${p.brandName || ""} ${p.category?.name || ""} ${inspection?.shop?.name || ""} ${p.barcode || ""}`.toLowerCase(); return (!query.trim() || text.includes(query.trim().toLowerCase())) && (status === "ALL" || p.complianceStatus === status) && (!brand.trim() || (p.brandName || "").toLowerCase().includes(brand.trim().toLowerCase())) && (!shop.trim() || (inspection?.shop?.name || "").toLowerCase().includes(shop.trim().toLowerCase())); }), [products, query, status, brand, shop]);
  function clear() { setQuery(""); setStatus("ALL"); setBrand(""); setShop(""); }
  async function downloadReport(p) {
    try {
      const r = await apiFetch(`${API_URL}/products/${p.id}`);
      const full = await r.json();
      if (!r.ok) throw new Error(full.error || "Could not load product report");
      let stored = null;
      try { stored = full.ocrData ? JSON.parse(full.ocrData) : null; } catch {}
      const violations = Array.isArray(stored?.compliance?.findings)
        ? stored.compliance.findings.filter((f) => String(f?.status || "").toUpperCase() === "VIOLATION")
        : [];
      await downloadProductPdf({ product: full, user, violations });
    } catch (e) {
      setError(e.message || "Could not generate the report");
    }
  }
  return <div className="reports-page"><div className="page-header"><p className="eyebrow">REPORTS</p><h1>Inspection Reports</h1><p>Search an inspection and download a product-specific PDF containing product details, inspector details and only its recorded Rules Engine violations.</p></div><div className="reports-toolbar reports-toolbar-wide"><label className="reports-search"><span>Search</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Product, category, shop or barcode..." /></label><label className="reports-filter"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All statuses</option><option value="OKAY">Okay</option><option value="VIOLATION">Violation</option><option value="NEEDS_REVIEW">Needs review</option></select></label><label className="reports-search"><span>Brand</span><input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Any brand" /></label><label className="reports-search"><span>Shop</span><input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Any shop" /></label><button className="reports-clear" type="button" onClick={clear}>Clear</button></div>{loading && <p className="reports-loading">Loading reports...</p>}{error && <div className="status-message">{error}</div>}{!loading && !error && !shown.length && <div className="status-message">No reports match the current filters.</div>}{!loading && !error && shown.map((p) => <div className="report-card" key={p.id}><div><h3>{p.productName}</h3><p>{p.brandName || "Brand not recorded"} · {p.category?.name || "Uncategorised"} · {p.inspections?.[0]?.shop?.name || "No shop"}</p><div className="report-meta"><span>MRP Rs. {p.mrp ?? "-"}</span><span>{p.netQuantity || "-"} {p.unit || ""}</span><span>{p.complianceStatus}</span><span>{p.owner?.name || user?.name || "User"}</span></div></div><button className="report-button" type="button" onClick={() => downloadReport(p)}>Download PDF</button></div>)}</div>;
}
export default Reports;

import { useEffect, useMemo, useState } from "react";
import { apiFetch, getUser } from "../lib/auth";
import "../styles/reports.css";

const API_URL = "http://localhost:5000/api";

function parseImages(value, fallback) {
  if (Array.isArray(value)) return value.length ? value : fallback ? [fallback] : [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length ? parsed : fallback ? [fallback] : [];
    } catch {
      return fallback ? [fallback] : [];
    }
  }
  return fallback ? [fallback] : [];
}

function Reports() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const user = getUser();

  useEffect(() => {
    apiFetch(`${API_URL}/products/history`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load reports");
        setProducts(data);
      })
      .catch((e) => setError(e.message));
  }, []);

  const shown = useMemo(() => products.filter((p) =>
    `${p.productName} ${p.brandName || ""} ${p.category?.name || ""} ${p.inspections?.[0]?.shop?.name || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  ), [products, query]);

  function print(p) {
    const shop = p.inspections?.[0]?.shop;
    const inspector = p.owner?.name || p.inspections?.[0]?.worker?.name || user?.name || "Not recorded";
    const path = [
      p.category?.parent?.parent?.parent,
      p.category?.parent?.parent,
      p.category?.parent,
      p.category,
    ].filter(Boolean).map((x) => x.name).join(" → ");
    const images = parseImages(p.imageUrls, p.imageUrl);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>PARAKH Report - ${p.productName}</title><style>
      body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:900px;margin:auto}
      h1{margin:0 0 6px}.muted{color:#666}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0}.box{border:1px solid #ddd;padding:12px;border-radius:8px}
      .images{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.images img{width:100%;aspect-ratio:1;object-fit:cover;border:1px solid #ddd;border-radius:8px}
      .status{font-weight:700}.violation{color:#b42318}
      @media(max-width:650px){.grid{grid-template-columns:1fr}.images{grid-template-columns:repeat(2,1fr)}}
    </style></head><body>
      <h1>PARAKH Inspection Report</h1>
      <div class="muted">Inspector/User: ${inspector} · Generated: ${new Date().toLocaleString()}</div>
      <div class="grid">
        <div class="box"><b>Product</b><br>${p.productName}</div>
        <div class="box"><b>Brand / Manufacturer</b><br>${p.brandName || "Not recorded"}</div>
        <div class="box"><b>Category</b><br>${path || "Not recorded"}</div>
        <div class="box"><b>MRP</b><br>₹${p.mrp ?? "Not recorded"}</div>
        <div class="box"><b>Net Quantity</b><br>${p.netQuantity || "Not recorded"} ${p.unit || ""}</div>
        <div class="box"><b>Shop</b><br>${shop?.name || "Not recorded"}</div>
        <div class="box"><b>Compliance</b><br><span class="status ${p.complianceStatus === "VIOLATION" ? "violation" : ""}">${p.complianceStatus || "NEEDS_REVIEW"}</span><br>${p.violationReason || "No compliance note recorded."}</div>
        <div class="box"><b>Barcode</b><br>${p.barcode || "Not recorded"}</div>
      </div>
      <h2>Evidence Images</h2><div class="images">${images.map((src) => `<img src="${src}" alt="Package evidence">`).join("")}</div>
      <p class="muted">Inspection date: ${new Date(p.inspections?.[0]?.inspectedAt || p.createdAt).toLocaleString()}</p>
      <script>window.onload=()=>window.print()</script>
    </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { setError("Your browser blocked the report window. Allow pop-ups for this site."); return; }
    w.document.write(html);
    w.document.close();
  }

  return <div className="reports-page">
    <div className="page-header"><p className="eyebrow">REPORTS</p><h1>Inspection Reports</h1><p>Downloadable print-to-PDF reports with product, compliance, shop, evidence and user profile details.</p></div>
    <div className="reports-toolbar"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product, category or shop..." /></div>
    {error && <div className="status-message">{error}</div>}
    {!error && !shown.length && <div className="status-message">No reports match this search.</div>}
    {shown.map((p) => <div className="report-card" key={p.id}>
      <div><h3>{p.productName}</h3><p>{p.brandName || "Brand not recorded"} · {p.category?.name || "Uncategorised"} · {p.inspections?.[0]?.shop?.name || "No shop"}</p><div className="report-meta"><span>MRP ₹{p.mrp ?? "-"}</span><span>{p.netQuantity || "-"} {p.unit || ""}</span><span>{p.complianceStatus}</span><span>{p.owner?.name || user?.name || "User"}</span></div></div>
      <button className="report-button" onClick={() => print(p)}>Download / Print PDF</button>
    </div>)}
  </div>;
}

export default Reports;

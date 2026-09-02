import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, getUser } from "../lib/auth";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`${API_URL}/products/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Product not found");
        setProduct(data);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const images = useMemo(() => {
    if (!product) return [];
    const value = parseJson(product.imageUrls, []);
    return Array.isArray(value) && value.length ? value : product.imageUrl ? [product.imageUrl] : [];
  }, [product]);

  const stored = useMemo(() => parseJson(product?.ocrData, null), [product]);
  const ocr = stored?.ocr && typeof stored.ocr === "object" ? stored.ocr : stored;
  const compliance = stored?.compliance && typeof stored.compliance === "object" ? stored.compliance : null;
  const violations = Array.isArray(compliance?.findings)
    ? compliance.findings.filter((finding) => String(finding?.status || "").toUpperCase() === "VIOLATION")
    : [];
  const complianceError = stored?.complianceError || null;

  if (error) return <div className="products-page"><p>{error}</p></div>;
  if (!product) return <div className="products-page"><p>Loading product...</p></div>;

  const status = product.complianceStatus || "NEEDS_REVIEW";
  const shop = product.inspections?.[0]?.shop;
  const inspector = product.inspections?.[0]?.worker?.name || product.owner?.name || getUser()?.name || "Unknown";
  const path = [product.category?.parent?.parent?.parent, product.category?.parent?.parent, product.category?.parent, product.category]
    .filter(Boolean).map((x) => x.name).join(" → ");

  async function remove() {
    if (!window.confirm(`Delete ${product.productName}?`)) return;
    const r = await apiFetch(`${API_URL}/products/${id}`, { method: "DELETE" });
    const data = await r.json();
    if (!r.ok) return setError(data.error || "Delete failed");
    navigate(`/products/category/${product.categoryId}`);
  }

  async function downloadPdf() {
    const reasonItems = violations.length
      ? violations.map((f) => `<li><strong>${escapeHtml(f.ruleNumber || "Rule")}</strong>${f.message ? `: ${escapeHtml(f.message)}` : ""}${f.violationReason ? `<div class="reason">${escapeHtml(f.violationReason)}</div>` : ""}</li>`).join("")
      : "<li>No Rules Engine violations were recorded for this product.</li>";
    const inspectionDate = new Date(product.inspections?.[0]?.inspectedAt || product.createdAt).toLocaleString();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>PARAKH Report - ${escapeHtml(product.productName)}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:0;line-height:1.45;font-size:12px}header{border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:18px}h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 10px}p{margin:4px 0}.muted{color:#6b7280}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.box{border:1px solid #d1d5db;border-radius:7px;padding:10px;min-height:52px}.label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:3px}.value{font-weight:600}.violation-box{border:1px solid #dc2626;background:#fef2f2;border-radius:7px;padding:12px}.violation-list{margin:0;padding-left:20px}.violation-list li{margin:0 0 10px}.reason{margin-top:3px;color:#7f1d1d}.footer{border-top:1px solid #d1d5db;margin-top:24px;padding-top:10px;color:#6b7280;font-size:10px}</style></head><body><header><h1>PARAKH Product Inspection Report</h1><p class="muted">Generated ${escapeHtml(new Date().toLocaleString())}</p></header><h2>Product Details</h2><div class="grid"><div class="box"><div class="label">Product</div><div class="value">${escapeHtml(product.productName)}</div></div><div class="box"><div class="label">Brand / Manufacturer</div><div class="value">${escapeHtml(product.brandName || "Not recorded")}</div></div><div class="box"><div class="label">Category</div><div class="value">${escapeHtml(path || product.category?.name || "Not recorded")}</div></div><div class="box"><div class="label">MRP</div><div class="value">${product.mrp == null ? "Not recorded" : `₹${escapeHtml(product.mrp)}`}</div></div><div class="box"><div class="label">Net Quantity</div><div class="value">${escapeHtml(`${product.netQuantity || "Not recorded"} ${product.unit || ""}`)}</div></div><div class="box"><div class="label">Barcode</div><div class="value">${escapeHtml(product.barcode || "Not recorded")}</div></div><div class="box"><div class="label">Shop</div><div class="value">${escapeHtml(shop?.name || "Not recorded")}</div></div><div class="box"><div class="label">Inspection Date</div><div class="value">${escapeHtml(inspectionDate)}</div></div></div><h2>User / Inspector Details</h2><div class="grid"><div class="box"><div class="label">Name</div><div class="value">${escapeHtml(inspector)}</div></div><div class="box"><div class="label">Email</div><div class="value">${escapeHtml(product.owner?.email || getUser()?.email || "Not recorded")}</div></div><div class="box"><div class="label">Role</div><div class="value">${escapeHtml(getUser()?.role || "USER")}</div></div><div class="box"><div class="label">Compliance Status</div><div class="value">${escapeHtml(status)}</div></div></div><h2>Rules Violated by This Product</h2><div class="violation-box"><ul class="violation-list">${reasonItems}</ul></div><div class="footer">This report is limited to this product and its associated inspection record. Automated Rules Engine findings are decision-support evidence and remain subject to inspector verification.</div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`;
    const w = window.open("", "_blank", "noopener,noreferrer,width=980,height=900");
    if (!w) return setError("Your browser blocked the report window. Allow pop-ups for this site.");
    w.document.open(); w.document.write(html); w.document.close();
  }

  return <div className="products-page">
    <Link to={`/products/category/${product.categoryId}`} className="back-link">← Back to {product.category?.name}</Link>
    <div className="page-header"><p className="eyebrow">REGISTERED PRODUCT</p><h1>{product.productName}</h1><p>{product.brandName || "Company not recorded"}</p><p>{path}</p></div>
    {images.length > 0 && <section className="product-categories"><div className="section-heading"><div><h2>Uploaded package images</h2><p>{images.length} retained evidence image(s).</p></div></div><div className="product-image-gallery">{images.map((src, i) => <img key={i} src={src} alt={`Package evidence ${i + 1}`} />)}</div></section>}
    <section className="product-actions"><div className={`compliance-badge ${status.toLowerCase()}`}>{status}</div><h2>Inspection</h2><p>{product.violationReason || "No inspection note recorded."}</p><p><strong>Shop:</strong> {shop?.name || "Not recorded"}</p><p><strong>Inspector/User:</strong> {inspector}</p><p><strong>Date:</strong> {new Date(product.inspections?.[0]?.inspectedAt || product.createdAt).toLocaleString()}</p><button className="secondary-action" onClick={downloadPdf}>Print / Save PDF</button><button className="delete-category-button" onClick={remove}>Delete product</button></section>
    <section className="product-categories"><div className="section-heading"><div><h2>Product details</h2></div></div><div className="ocr-details-grid"><div><strong>Final category</strong><span>{path || product.category?.name}</span></div><div><strong>Quantity</strong><span>{product.netQuantity || "Not recorded"} {product.unit || ""}</span></div><div><strong>MRP</strong><span>{product.mrp == null ? "Not recorded" : `₹${product.mrp}`}</span></div><div><strong>Barcode</strong><span>{product.barcode || "Not recorded"}</span></div><div><strong>Shop</strong><span>{shop?.name || "Not recorded"}</span></div><div><strong>User profile</strong><span>{product.owner?.name || inspector}</span></div></div></section>
    {compliance && <section className="product-categories"><div className="section-heading"><div><h2>Rules Engine assessment</h2><p>{compliance.engineVersion || "Legal Metrology engine"} · {compliance.ruleSetVersion || "Current rule set"}</p></div></div><div className="ocr-details-grid"><div><strong>Overall status</strong><span>{compliance.overallStatus || status}</span></div><div><strong>Rules evaluated</strong><span>{compliance.summary?.totalRulesEvaluated ?? compliance.findings?.length ?? 0}</span></div><div><strong>Passed</strong><span>{compliance.summary?.passed ?? 0}</span></div><div><strong>Violations</strong><span>{compliance.summary?.violations ?? 0}</span></div><div><strong>Unable to verify</strong><span>{compliance.summary?.unableToVerify ?? 0}</span></div><div><strong>Audit hash</strong><span className="break-anywhere">{compliance.auditHash || "Not available"}</span></div></div>{compliance.findings?.length > 0 && <div className="rules-findings">{compliance.findings.map((finding) => <div className={`finding-row ${finding.status.toLowerCase()}`} key={finding.findingId}><strong>{finding.ruleNumber} · {finding.status}</strong><span>{finding.message}</span>{finding.violationReason && <small>{finding.violationReason}</small>}</div>)}</div>}</section>}
    {complianceError && <div className="status-message">Rules Engine could not be reached during this inspection: {complianceError.message}</div>}
    {ocr && <section className="product-categories"><div className="section-heading"><div><h2>OCR declarations</h2><p>Structured OCR evidence retained with this registration.</p></div></div><div className="ocr-details-grid">{Object.entries(ocr).filter(([key, value]) => key !== "rawText" && value && typeof value === "object" && value.status === "found").map(([key, value]) => <div key={key}><strong>{key.replace(/([A-Z])/g, " $1")}</strong><span>{String(value.value)}</span>{typeof value.confidence === "number" && <small>{Math.round(value.confidence * 100)}% confidence</small>}</div>)}</div>{ocr.rawText && <details><summary>Raw OCR text</summary><pre className="ocr-raw-text">{ocr.rawText}</pre></details>}</section>}
  </div>;
}

export default ProductDetails;

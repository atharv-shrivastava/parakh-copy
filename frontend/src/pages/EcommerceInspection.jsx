import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/ecommerce.css";

const API_URL = "http://localhost:5000/api";
const MAX_IMAGES = 6;
const EDITABLE_FIELDS = [["productName", "Product name"], ["brand", "Brand / Manufacturer"], ["description", "Description"], ["netQuantity", "Net quantity"], ["unit", "Unit"], ["mrp", "MRP / Price"], ["sku", "SKU / MPN"], ["gtin", "GTIN / Barcode"], ["countryOfOrigin", "Country of origin"]];

function flatten(nodes, path = []) { return nodes.flatMap((node) => { const next = [...path, node]; return [{ ...node, path: next }, ...flatten(node.children || [], next)]; }); }
function displayFindingStatus(finding) { return String(finding?.status || "").toUpperCase(); }

export default function EcommerceInspection() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [listing, setListing] = useState(null);
  const [ocr, setOcr] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [selectedViolations, setSelectedViolations] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`${API_URL}/categories/tree/all?sourceType=ECOMMERCE`)
      .then(async (response) => {
        const data = await response.json().catch(() => []);
        if (!response.ok) throw new Error(data?.error || "Could not load e-commerce categories");
        setCategories(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  const imageUrls = (listing?.imageUrls || []).slice(0, MAX_IMAGES);
  const findings = useMemo(() => compliance?.findings || [], [compliance]);
  const violationFindings = useMemo(() => findings.filter((finding) => displayFindingStatus(finding) === "VIOLATION"), [findings]);
  const allViolationsSelected = violationFindings.length > 0 && violationFindings.every((finding) => selectedViolations.includes(String(finding.findingId)));
  const finalCategories = useMemo(() => flatten(categories).filter((category) => category.isFinalProductType), [categories]);

  function setSelectedDefaults(result) {
    setSelectedViolations((result?.findings || []).filter((finding) => displayFindingStatus(finding) === "VIOLATION").map((finding) => String(finding.findingId)));
  }

  async function inspectListing(event) {
    event.preventDefault();
    const value = url.trim();
    if (!/^https?:\/\/\S+$/i.test(value)) {
      setError("Enter a valid public product listing URL.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("Fetching the public listing and collecting its product data and images...");
    setListing(null);
    setOcr(null);
    setCompliance(null);
    setCategoryId("");
    setSelectedViolations([]);
    try {
      const response = await apiFetch(API_URL + "/products/ecommerce/analyze-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: value }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not inspect the listing.");
      setListing(data.listing || null);
      setOcr(data.ocr || null);
      setCompliance(data.compliance || null);
      setSelectedDefaults(data.compliance);
      setMessage("Listing data and images were collected. Review the extracted fields and findings before saving.");
    } catch (e) {
      setError(e.message || "E-commerce inspection failed.");
    } finally {
      setBusy(false);
    }
  }

  function updateListing(key, value) { setListing((current) => ({ ...current, [key]: value })); }

  async function reevaluate() {
    if (!listing?.url) return;
    setBusy(true);
    setError("");
    try {
      const overrides = Object.fromEntries(EDITABLE_FIELDS.map(([key]) => [key, listing[key] ?? ""]));
      const response = await apiFetch(`${API_URL}/products/ecommerce/evaluate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listing, ocr, overrides }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not re-run the Rules Engine.");
      setListing(data.listing || listing);
      setCompliance(data.compliance || null);
      setSelectedDefaults(data.compliance);
      setMessage("Edited data was re-checked by the Rules Engine. Select only the violations you want attached to the inspection.");
    } catch (e) {
      setError(e.message || "Rules Engine re-check failed.");
    } finally {
      setBusy(false);
    }
  }

  function toggleViolation(id) {
    const key = String(id);
    setSelectedViolations((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function toggleAllViolations() {
    setSelectedViolations(allViolationsSelected ? [] : violationFindings.map((finding) => String(finding.findingId)));
  }

  async function saveProduct() {
    if (!listing?.url) return;
    if (!categoryId) return setError("Select an e-commerce final product category before saving.");
    if (!listing.productName?.trim()) return setError("Product name is required.");
    setSaving(true);
    setError("");
    setMessage("Saving the reviewed e-commerce product...");
    try {
      const selected = finalCategories.find((category) => category.id === categoryId);
      const website = listing.websiteName || new URL(listing.url).hostname.replace(/^www\./i, "");
      const payload = { categoryId, brandName: listing.brand || "", productName: listing.productName, description: listing.description || "", netQuantity: listing.netQuantity || "", unit: listing.unit || "", mrp: listing.mrp || "", barcode: listing.gtin || "", imageUrls, ocrData: { provider: "ecommerce_public_listing", ocr, compliance, listing, complianceReview: { selectedViolationIds: selectedViolations } }, acceptedFindingIds: selectedViolations, shopName: website, shopAddress: "", shopCity: "", shopState: "", notes: `E-commerce listing reviewed from ${listing.url}. Final category: ${selected?.path?.map((item) => item.name).join(" → ") || ""}`, sourceType: "ECOMMERCE", sourceUrl: listing.url, sourceWebsiteName: website };
      const response = await apiFetch(`${API_URL}/products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save e-commerce product.");
      navigate(`/products/item/${data.product?.id || data.id}`);
    } catch (e) {
      setError(e.message || "Could not save e-commerce product.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="ecommerce-page">
    <div className="page-header"><p className="eyebrow">E-COMMERCE INSPECTION</p><h1>Inspect Product Listing</h1><p>Enter a public listing URL. PARAKH retrieves public product data and images, cross-checks the images with OCR, and runs the e-commerce Rules Engine.</p><p><Link to="/ecommerce-products">View saved e-commerce products →</Link></p></div>
    <form className="ecommerce-panel ecommerce-url-form" onSubmit={inspectListing}><label className="ecommerce-url-field"><span>Product listing URL</span><input className="ecommerce-url-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/product/..." disabled={busy || saving} /></label><button className="primary-button ecommerce-inspect-button" type="submit" disabled={busy || saving}>{busy ? "Inspecting listing..." : "Inspect Listing"}</button><small>Use public pages and sources that permit automated retrieval. Protected pages, private URLs and login-only content are not accessed.</small></form>
    {error && <div className="status-message">{error}</div>}{message && !error && <div className="status-message">{message}</div>}
    {listing && <section className="ecommerce-panel"><div className="section-heading"><div><h2>Extracted Product Data</h2><p>{listing.sourceTitle || listing.title || "Public product listing"} · <a href={listing.url} target="_blank" rel="noreferrer">Open source page</a></p></div></div><div className="ecommerce-edit-grid">{EDITABLE_FIELDS.map(([key, label]) => <label key={key} className={key === "description" ? "full-width" : ""}><span>{label}</span>{key === "description" ? <textarea value={listing[key] || ""} onChange={(e) => updateListing(key, e.target.value)} /> : <input value={listing[key] || ""} onChange={(e) => updateListing(key, e.target.value)} />}</label>)}<label><span>Website</span><input value={listing.websiteName || ""} readOnly /></label><label><span>Country-of-origin filter evidence</span><select value={listing.filterEvidence ? "true" : "false"} onChange={(e) => updateListing("filterEvidence", e.target.value === "true")}><option value="true">Detected on listing page</option><option value="false">Not established</option></select></label><label className="full-width"><span>E-commerce final product category *</span><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Select e-commerce final category</option>{finalCategories.map((category) => <option key={category.id} value={category.id}>{category.path.map((item) => item.name).join(" → ")}</option>)}</select></label></div><div className="ecommerce-edit-actions"><button type="button" className="secondary-action" onClick={reevaluate} disabled={busy || saving}>Re-run Rules Engine</button><button type="button" className="primary-button" onClick={saveProduct} disabled={saving || busy}>{saving ? "Saving..." : "Save E-commerce Product"}</button></div></section>}
    {imageUrls.length > 0 && <section className="ecommerce-panel"><div className="section-heading"><div><h2>Listing Images Retrieved</h2><p>Public product images collected from the listing page.</p></div></div><div className="ecommerce-images">{imageUrls.map((imageUrl, index) => <div className="ecommerce-image" key={imageUrl}><img src={imageUrl} alt={"Listing product " + (index + 1)} /><span>Image {index + 1}</span></div>)}</div></section>}
    {ocr && <section className="ecommerce-panel"><div className="section-heading"><div><h2>Image OCR Cross-check</h2><p>Retrieved product images were passed through OCR for cross-checking.</p></div></div><div className="ecommerce-fields">{["productName", "brandName", "countryOfOrigin", "mrp", "netQuantity", "unit", "manufacturer"].map((key) => <div key={key}><strong>{key.replace(/([A-Z])/g, " $1")}</strong><span>{ocr?.[key]?.value || "Not established"}</span></div>)}</div></section>}
    {compliance && <section className="ecommerce-panel"><div className="section-heading"><div><h2>Rules Engine Result</h2><p>E-commerce listing context. Findings remain inspection support information and may require officer/legal review.</p></div></div><div className="ecommerce-result-summary"><div><span>Status</span><strong>{compliance.overallStatus || "REVIEW"}</strong></div><div><span>Violations selected</span><strong>{selectedViolations.length}</strong></div><div><span>Unable to verify</span><strong>{compliance.summary?.unableToVerify ?? 0}</strong></div></div>{violationFindings.length > 0 && <div className="ecommerce-selection-bar"><button type="button" className="violation-select-button" onClick={toggleAllViolations}>{allViolationsSelected ? "Deselect all violations" : "Select all violations"}</button><span>{selectedViolations.length} of {violationFindings.length} violations selected</span></div>}<div className="ecommerce-findings">{findings.map((finding, index) => { const isViolation = displayFindingStatus(finding) === "VIOLATION"; const selectedFinding = selectedViolations.includes(String(finding.findingId)); return <article className={`${isViolation ? "ecommerce-finding-row violation" : "ecommerce-finding-row"} ${selectedFinding ? "selected" : ""}`} key={finding.findingId || index}>{isViolation && <button type="button" className={`violation-row-toggle ${selectedFinding ? "selected" : ""}`} onClick={() => toggleViolation(finding.findingId)} aria-pressed={selectedFinding}>{selectedFinding ? "Selected" : "Select"}</button>}<div><strong>{finding.ruleNumber || finding.ruleCode || "Rule"}</strong><span>{finding.message}</span>{finding.violationReason && <small>{finding.violationReason}</small>}</div></article>; })}</div></section>}
  </div>;
}

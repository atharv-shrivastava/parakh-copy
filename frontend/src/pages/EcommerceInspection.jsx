import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/ecommerce.css";

const API_URL = "http://localhost:5000/api";
const MAX_IMAGES = 6;
const EDITABLE_FIELDS = [
  ["productName", "Product name"],
  ["brand", "Brand / Manufacturer"],
  ["manufacturer", "Manufacturer"],
  ["manufacturerAddress", "Manufacturer address"],
  ["packer", "Packer"],
  ["packerAddress", "Packer address"],
  ["marketer", "Marketer"],
  ["importer", "Importer"],
  ["netQuantity", "Net quantity"],
  ["unit", "Unit"],
  ["mrp", "MRP / Price"],
  ["currency", "Currency"],
  ["sku", "SKU / MPN"],
  ["gtin", "GTIN / Barcode"],
  ["batchNumber", "Batch / Lot"],
  ["dateOfManufacture", "Manufacturing date"],
  ["dateOfPacking", "Packing date"],
  ["bestBefore", "Best before"],
  ["expiryDate", "Expiry date"],
  ["consumerCarePhone", "Consumer care phone"],
  ["consumerCareEmail", "Consumer care email"],
  ["countryOfOrigin", "Country of origin"],
  ["fssaiLicenseNumber", "FSSAI license"],
  ["description", "Description"],
];

function flatten(nodes, path = []) {
  return nodes.flatMap((node) => {
    const next = [...path, node];
    return [{ ...node, path: next }, ...flatten(node.children || [], next)];
  });
}

function displayFindingStatus(finding) {
  return String(finding?.status || "").toUpperCase();
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function parseWrittenListingText(text) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!source) return {};
  const quantity = firstMatch(source, [
    /(?:net\s+(?:quantity|content)|net\s+wt\.?|item\s+(?:weight|quantity)|weight)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?\s*(?:kg|g|gram|grams|mg|ml|l|litre|liter|litres|liters|pcs?|pieces?))\b/i,
    /\b([0-9]+(?:\.[0-9]+)?\s*(?:kg|g|mg|ml|l|litre|liter))\b/i,
  ]);
  const mrp = firstMatch(source, [/(?:maximum\s+retail\s+price|m\.r\.p\.?|mrp)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i]);
  const brand = firstMatch(source, [/(?:brand|brand\s+name)\s*[:\-]\s*([^|;,]{2,80})/i]);
  const manufacturer = firstMatch(source, [/(?:manufacturer|manufactured\s+by)\s*[:\-]\s*([^|;]{3,160})/i]);
  const origin = firstMatch(source, [/(?:country\s+of\s+origin|country\s+of\s+manufacture)\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{2,50})/i]);
  const barcode = firstMatch(source, [/(?:barcode|ean|gtin)\s*[:\-]?\s*([0-9]{8,18})\b/i]);
  const normalizedQuantity = quantity || "";
  const unit = normalizedQuantity ? (normalizedQuantity.match(/[a-z]+$/i)?.[0] || "") : "";
  return { netQuantity: normalizedQuantity, unit, mrp, brand, manufacturer, countryOfOrigin: origin, gtin: barcode, listingText: source };
}

function ocrValue(result, key) {
  const field = result?.[key];
  if (field?.value == null || String(field.value).trim() === "") return "";
  const status = String(field.status || "").toLowerCase();
  return ["found", "needs_review", "referenced_inner_pack"].includes(status) ? String(field.value) : "";
}

function mergeListingWithOcr(listing, ocr) {
  if (!ocr) return listing;
  const next = { ...listing };
  const mappings = {
    productName: "productName",
    brand: "brandName",
    manufacturer: "manufacturer",
    manufacturerAddress: "manufacturerAddress",
    packer: "packer",
    packerAddress: "packerAddress",
    marketer: "marketer",
    importer: "importer",
    netQuantity: "netQuantity",
    unit: "unit",
    mrp: "mrp",
    currency: "currency",
    gtin: "barcode",
    batchNumber: "batchNumber",
    dateOfManufacture: "dateOfManufacture",
    dateOfPacking: "dateOfPacking",
    bestBefore: "bestBefore",
    expiryDate: "expiryDate",
    consumerCarePhone: "consumerCarePhone",
    consumerCareEmail: "consumerCareEmail",
    countryOfOrigin: "countryOfOrigin",
    fssaiLicenseNumber: "fssaiLicenseNumber",
  };
  for (const [listingKey, ocrKey] of Object.entries(mappings)) {
    const value = ocrValue(ocr, ocrKey);
    if (value) next[listingKey] = next[listingKey] || value;
  }
  const declarations = Array.isArray(ocr?.otherDeclarations) ? ocr.otherDeclarations.filter(Boolean) : [];
  if ((!next.description || !String(next.description).trim()) && declarations.length) next.description = declarations.join("\n");
  next.ocrMerged = true;
  return next;
}

export default function EcommerceInspection() {
  const navigate = useNavigate();
  const controllerRef = useRef(null);
  const [url, setUrl] = useState("");
  const [listing, setListing] = useState(null);
  const [ocr, setOcr] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedViolations, setSelectedViolations] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`${API_URL}/categories/tree/all?sourceType=ECOMMERCE`)
      .then(async (r) => {
        const d = await r.json().catch(() => []);
        if (!r.ok) throw new Error(d?.error || "Could not load e-commerce categories");
        setCategories(Array.isArray(d) ? d : []);
      })
      .catch((e) => setError(e.message));
    return () => controllerRef.current?.abort();
  }, []);

  const imageUrls = (listing?.imageUrls || []).slice(0, MAX_IMAGES);
  const findings = useMemo(() => compliance?.findings || [], [compliance]);
  const violationFindings = useMemo(() => findings.filter((f) => displayFindingStatus(f) === "VIOLATION"), [findings]);
  const allViolationsSelected = violationFindings.length > 0 && violationFindings.every((f) => selectedViolations.includes(String(f.findingId)));
  const finalCategories = useMemo(() => flatten(categories).filter((c) => c.isFinalProductType && c.sourceType === "ECOMMERCE"), [categories]);
  const filteredFinalCategories = useMemo(() => {
    const query = categoryFilter.trim().toLowerCase();
    if (!query) return finalCategories;
    return finalCategories.filter((category) => category.path.some((node) => String(node.name || "").toLowerCase().includes(query)));
  }, [categoryFilter, finalCategories]);

  function resetState({ clearUrl = true, text = "" } = {}) {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (clearUrl) setUrl("");
    setListing(null);
    setOcr(null);
    setCompliance(null);
    setCategoryId("");
    setCategoryFilter("");
    setSelectedViolations([]);
    setError("");
    setMessage(text);
    setBusy(false);
  }

  function cancelInspection() {
    resetState({ clearUrl: false, text: "Inspection cancelled. The current draft was discarded." });
  }

  function setSelectedDefaults(result) {
    setSelectedViolations((result?.findings || []).filter((f) => displayFindingStatus(f) === "VIOLATION").map((f) => String(f.findingId)));
  }

  async function inspectListing(event) {
    event.preventDefault();
    const value = url.trim();
    if (!/^https?:\/\/\S+$/i.test(value)) return setError("Enter a valid public product listing URL.");
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setBusy(true); setError(""); setMessage("Fetching the listing and preparing shared OCR evidence...");
    setListing(null); setOcr(null); setCompliance(null); setCategoryId(""); setCategoryFilter(""); setSelectedViolations([]);
    try {
      const response = await apiFetch(`${API_URL}/products/ecommerce/analyze-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not inspect the listing.");

      const written = parseWrittenListingText(data.listing?.text);
      let sameEngineOcr = data.ocr || null;
      const sourceImages = Array.isArray(data.listing?.imageUrls) ? data.listing.imageUrls.slice(0, MAX_IMAGES) : [];
      if (sourceImages.length) {
        setMessage("Listing data found. Running the same PARAKH Fast OCR engine against the product images...");
        const ocrResponse = await apiFetch(`${API_URL}/products/ecommerce-ocr/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrls: sourceImages }),
          signal: controller.signal,
        });
        const ocrPayload = await ocrResponse.json().catch(() => ({}));
        if (ocrResponse.ok && ocrPayload.result) sameEngineOcr = ocrPayload.result;
      }

      const listingWithWritten = {
        ...(data.listing || {}),
        ...Object.fromEntries(Object.entries(written).filter(([key, item]) => key !== "listingText" && item && !data.listing?.[key])),
        listingText: written.listingText || data.listing?.text || "",
      };
      const mergedListing = mergeListingWithOcr(listingWithWritten, sameEngineOcr);
      setOcr(sameEngineOcr);
      setListing(mergedListing);

      setMessage("Website fields and package OCR were merged. Running the Rules Engine with the combined evidence...");
      const overrides = Object.fromEntries(EDITABLE_FIELDS.map(([key]) => [key, mergedListing[key] ?? ""]));
      const check = await apiFetch(`${API_URL}/products/ecommerce/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing: mergedListing, ocr: sameEngineOcr, overrides }),
        signal: controller.signal,
      });
      const checked = await check.json().catch(() => ({}));
      if (!check.ok) throw new Error(checked.error || "Rules Engine evaluation failed.");
      setListing(checked.listing || mergedListing);
      setCompliance(checked.compliance || data.compliance || null);
      setSelectedDefaults(checked.compliance || data.compliance);
      setMessage("E-commerce analysis complete. Website data and the shared OCR engine are available together for editing and review.");
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e.message || "E-commerce inspection failed.");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setBusy(false);
    }
  }

  function updateListing(key, value) {
    setListing((current) => ({ ...current, [key]: value }));
  }

  async function reevaluate() {
    if (!listing?.url) return;
    setBusy(true); setError("");
    try {
      const overrides = Object.fromEntries(EDITABLE_FIELDS.map(([key]) => [key, listing[key] ?? ""]));
      const response = await apiFetch(`${API_URL}/products/ecommerce/evaluate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listing, ocr, overrides }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not re-run the Rules Engine.");
      setListing(data.listing || listing); setCompliance(data.compliance || null); setSelectedDefaults(data.compliance); setMessage("Edited website and OCR-backed fields were re-checked by the Rules Engine.");
    } catch (e) { setError(e.message || "Rules Engine re-check failed."); }
    finally { setBusy(false); }
  }

  function toggleViolation(id) {
    const key = String(id);
    setSelectedViolations((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function toggleAllViolations() {
    setSelectedViolations(allViolationsSelected ? [] : violationFindings.map((f) => String(f.findingId)));
  }

  async function saveProduct() {
    if (!listing?.url) return;
    const selected = finalCategories.find((c) => c.id === categoryId);
    if (!selected || selected.sourceType !== "ECOMMERCE" || !selected.isFinalProductType) return setError("Select an E-commerce final product category before saving.");
    if (!listing.productName?.trim()) return setError("Product name is required.");
    setSaving(true); setError(""); setMessage("Saving the reviewed e-commerce product...");
    try {
      const website = listing.websiteName || new URL(listing.url).hostname.replace(/^www\./i, "");
      const payload = {
        categoryId,
        brandName: listing.brand || ocrValue(ocr, "brandName") || "",
        productName: listing.productName || ocrValue(ocr, "productName"),
        description: listing.description || "",
        netQuantity: listing.netQuantity || ocrValue(ocr, "netQuantity") || "",
        unit: listing.unit || ocrValue(ocr, "unit") || "",
        mrp: listing.mrp || ocrValue(ocr, "mrp") || "",
        barcode: listing.gtin || ocrValue(ocr, "barcode") || "",
        imageUrls,
        ocrData: {
          provider: "ecommerce_shared_fast_ocr",
          ocr,
          compliance,
          listing,
          writtenListingText: listing.listingText || listing.text || "",
          complianceReview: { selectedViolationIds: selectedViolations },
        },
        acceptedFindingIds: selectedViolations,
        shopName: website,
        shopAddress: "",
        shopCity: "",
        shopState: "",
        notes: `E-commerce listing reviewed from ${listing.url}. Final category: ${selected.path?.map((x) => x.name).join(" → ") || selected.name}`,
        sourceType: "ECOMMERCE",
        sourceUrl: listing.url,
        sourceWebsiteName: website,
      };
      const response = await apiFetch(`${API_URL}/products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save e-commerce product.");
      const productId = data.product?.id || data.id;
      if (!productId) throw new Error("Product was saved but no product ID was returned.");
      navigate(`/ecommerce-products`);
    } catch (e) { setError(e.message || "Could not save e-commerce product."); }
    finally { setSaving(false); }
  }

  return <div className="ecommerce-page">
    <div className="page-header">
      <p className="eyebrow">E-COMMERCE INSPECTION</p>
      <h1>Inspect Product Listing</h1>
      <p>Enter a public listing URL. PARAKH reads the website fields and cross-checks the retrieved product images with the same Fast OCR engine used by package scanning.</p>
      <p><Link to="/ecommerce-products">View saved e-commerce products →</Link></p>
    </div>

    <form className="ecommerce-panel ecommerce-url-form" onSubmit={inspectListing}>
      <label className="ecommerce-url-field"><span>Product listing URL</span><input className="ecommerce-url-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/product/..." disabled={busy || saving} /></label>
      <div className="ecommerce-edit-actions">
        <button className="primary-button ecommerce-inspect-button" type="submit" disabled={busy || saving}>{busy ? "Inspecting listing..." : "Inspect Listing"}</button>
        {busy && <button className="secondary-action" type="button" onClick={cancelInspection}>Cancel</button>}
        <button className="secondary-action" type="button" onClick={() => resetState({ clearUrl: true, text: "E-commerce analyzer reset." })} disabled={busy || saving}>Reset</button>
      </div>
      <small>Use public pages and sources that permit automated retrieval. Protected pages, private URLs and login-only content are not accessed.</small>
    </form>

    {error && <div className="status-message">{error}</div>}{message && !error && <div className="status-message">{message}</div>}

    {listing && <section className="ecommerce-panel">
      <div className="section-heading"><div><h2>Combined Product Data</h2><p>Website-stated values and package OCR values are merged here. Every field remains editable before registration.</p></div></div>
      <div className="ecommerce-edit-grid">
        {EDITABLE_FIELDS.map(([key, label]) => <label key={key} className={key === "description" ? "full-width" : ""}><span>{label}</span>{key === "description" ? <textarea value={listing[key] || ""} onChange={(e) => updateListing(key, e.target.value)} /> : <input value={listing[key] || ""} onChange={(e) => updateListing(key, e.target.value)} />}</label>)}
        <label><span>Website</span><input value={listing.websiteName || ""} readOnly /></label>
        <label><span>Country-of-origin filter evidence</span><select value={listing.filterEvidence ? "true" : "false"} onChange={(e) => updateListing("filterEvidence", e.target.value === "true")}><option value="true">Detected on listing page</option><option value="false">Not established</option></select></label>
        <label className="full-width"><span>Filter e-commerce final product categories</span><input value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} placeholder="Search category or subcategory" /></label>
        <label className="full-width"><span>E-commerce final product category *</span><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Select e-commerce final category</option>{filteredFinalCategories.map((c) => <option key={c.id} value={c.id}>{c.path.map((x) => x.name).join(" → ")}</option>)}</select></label>
      </div>
      <div className="ecommerce-edit-actions"><button type="button" className="secondary-action" onClick={reevaluate} disabled={busy || saving}>Re-run Rules Engine</button><button type="button" className="primary-button" onClick={saveProduct} disabled={saving || busy}>{saving ? "Saving..." : "Register E-commerce Product"}</button></div>
    </section>}

    {imageUrls.length > 0 && <section className="ecommerce-panel"><div className="section-heading"><div><h2>Listing Images</h2><p>These images are also sent through the shared Fast OCR engine so website and package evidence are available together.</p></div></div><div className="ecommerce-images">{imageUrls.map((imageUrl, index) => <div className="ecommerce-image" key={imageUrl}><img src={imageUrl} alt={`Listing product ${index + 1}`} /><span>Image {index + 1}</span></div>)}</div></section>}

    {ocr && <section className="ecommerce-panel"><div className="section-heading"><div><h2>Shared Fast OCR Cross-check</h2><p>Same OCR pipeline as physical package scanning: PaddleOCR detection plus PARAKH semantic/reconciliation processing.</p></div></div><div className="ecommerce-fields">{["productName", "brandName", "manufacturer", "countryOfOrigin", "mrp", "netQuantity", "unit", "batchNumber", "dateOfManufacture", "expiryDate", "barcode"].map((key) => <div key={key}><strong>{key.replace(/([A-Z])/g, " $1")}</strong><span>{ocrValue(ocr, key) || "Not established"}</span></div>)}</div></section>}

    {compliance && <section className="ecommerce-panel"><div className="section-heading"><div><h2>Rules Engine Result</h2><p>E-commerce listing context. Findings use the combined website fields and image evidence and remain inspection support information.</p></div></div><div className="ecommerce-result-summary"><div><span>Status</span><strong>{compliance.overallStatus || "REVIEW"}</strong></div><div><span>Violations selected</span><strong>{selectedViolations.length}</strong></div><div><span>Unable to verify</span><strong>{compliance.summary?.unableToVerify ?? 0}</strong></div></div>{violationFindings.length > 0 && <div className="ecommerce-selection-bar"><button type="button" className="violation-select-button" onClick={toggleAllViolations}>{allViolationsSelected ? "Deselect all violations" : "Select all violations"}</button><span>{selectedViolations.length} of {violationFindings.length} violations selected</span></div>}<div className="ecommerce-findings">{findings.map((finding, index) => { const isViolation = displayFindingStatus(finding) === "VIOLATION"; const selectedFinding = selectedViolations.includes(String(finding.findingId)); return <article className={`${isViolation ? "ecommerce-finding-row violation" : "ecommerce-finding-row"} ${selectedFinding ? "selected" : ""}`} key={finding.findingId || index}>{isViolation && <button type="button" className={`violation-row-toggle ${selectedFinding ? "selected" : ""}`} onClick={() => toggleViolation(finding.findingId)} aria-pressed={selectedFinding}>{selectedFinding ? "Selected" : "Select"}</button>}<div><strong>{finding.ruleNumber || finding.ruleCode || "Rule"}</strong><span>{finding.message}</span>{finding.violationReason && <small>{finding.violationReason}</small>}</div></article>; })}</div></section>}
  </div>;
}

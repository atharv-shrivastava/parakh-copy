import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/ecommerce.css";

const API_URL = "http://localhost:5000/api";
const MAX_IMAGES = 6;
const EDITABLE_FIELDS = [
  ["productName", "Product name"], ["brand", "Brand / Manufacturer"], ["manufacturer", "Manufacturer"],
  ["manufacturerAddress", "Manufacturer address"], ["packer", "Packer"], ["packerAddress", "Packer address"],
  ["marketer", "Marketer"], ["importer", "Importer"], ["netQuantity", "Net quantity"], ["unit", "Unit"],
  ["mrp", "MRP / Price"], ["currency", "Currency"], ["sku", "SKU / MPN"], ["gtin", "GTIN / Barcode"],
  ["batchNumber", "Batch / Lot"], ["dateOfManufacture", "Manufacturing date"], ["dateOfPacking", "Packing date"],
  ["bestBefore", "Best before"], ["expiryDate", "Expiry date"], ["consumerCarePhone", "Consumer care phone"],
  ["consumerCareEmail", "Consumer care email"], ["countryOfOrigin", "Country of origin"],
  ["fssaiLicenseNumber", "FSSAI license"], ["description", "Description"],
];

const ENGINE_RULE_OPTIONS = [
  ["PCR-R4", "4", "Mandatory declarations on pre-packaged commodities", "Packages must carry the declarations required by the Rules before being pre-packed for sale, distribution or delivery, subject to the rule explanations."],
  ["PCR-R6-1-A", "6(1)(a)", "Manufacturer, packer and importer declaration", "The package must declare the responsible manufacturer/packer identity and applicable importer information."],
  ["PCR-R6-1-B", "6(1)(b)", "Common or generic name", "The package shall bear the common or generic name of the commodity."],
  ["PCR-R6-1-C", "6(1)(c)", "Net quantity declaration", "The package shall declare net quantity in the prescribed standard unit or by number where appropriate."],
  ["PCR-R6-1-D", "6(1)(d)", "Month and year declaration", "The package shall declare the month and year of manufacture, pre-packing or import, subject to commodity-specific exceptions."],
  ["PCR-R6-1-E", "6(1)(e)", "Retail sale price", "The package shall bear the retail sale price in the manner required by the Rules."],
  ["PCR-R6-1-F", "6(1)(f)", "Dimensions where relevant", "Where size is relevant, the prescribed dimensions shall be declared."],
  ["PCR-R6-2", "6(2)", "Consumer complaint contact", "Consumer complaint contact details shall be declared as prescribed."],
  ["PCR-R6-3", "6(3)", "Restrictions on separate stickers", "Required declarations shall not be made by prohibited separate stickers; permitted revised MRP stickers are subject to their own conditions."],
  ["PCR-R7", "7", "Principal display panel and declaration dimensions", "Declarations on the principal display panel must meet the prescribed presentation and size requirements."],
  ["PCR-R8", "8", "Declarations on principal display panel", "Required declarations shall appear on the principal display panel in the prescribed manner."],
  ["PCR-R9", "9", "Legibility and language of declarations", "Declarations must be legible, prominent and presented in the permitted manner."],
  ["PCR-R10", "10", "Manufacturer/packer/importer address presentation", "The responsible entity name and complete address shall be declared in the prescribed manner."],
  ["PCR-R12-6", "12(6)", "Quantity expression must not be exaggerated or misleading", "Quantity expressions must not create an exaggerated, misleading or inadequate impression."],
  ["PCR-R6-10A-2026", "6(10A)", "Country-of-origin filter for imported products on e-commerce", "The e-commerce country-of-origin filter requirement is governed by dated 2026 amendments."],
  ["PCR-R26-A-PAN-MASALA", "26(a)", "Pan masala exception", "The specified Rule 26(a) clause does not apply to pan masala."],
];

function flatten(nodes, path = []) {
  return nodes.flatMap((node) => {
    const next = [...path, node];
    return [{ ...node, path: next }, ...flatten(node.children || [], next)];
  });
}

function displayFindingStatus(finding) { return String(finding?.status || "").toUpperCase(); }

function ruleMeta(finding) {
  const code = String(finding?.ruleCode || "");
  const number = String(finding?.ruleNumber || "");
  const known = ENGINE_RULE_OPTIONS.find(([knownCode, knownNumber]) => knownCode === code || knownNumber === number);
  return {
    code: known?.[0] || code || number || "RULE",
    number: known?.[1] || number,
    title: known?.[2] || finding?.title || "Legal Metrology requirement",
    statement: known?.[3] || finding?.description || finding?.message || "Applicable legal requirement must be satisfied.",
  };
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
  const unit = quantity ? (quantity.match(/[a-z]+$/i)?.[0] || "") : "";
  return { netQuantity: quantity || "", unit, mrp, brand, manufacturer, countryOfOrigin: origin, gtin: barcode, listingText: source };
}

function ocrValue(result, key) {
  const field = result?.[key];
  const value = field?.value;
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const status = String(field?.status || "").toLowerCase();
  if (["not_detected", "absent", "not_found", "unknown"].includes(status)) return "";
  return String(value).trim();
}

function mergeListingWithOcr(listing, ocr) {
  if (!ocr) return { ...listing, ocrMerged: false };
  const next = { ...listing };
  const mappings = {
    productName: "productName", brand: "brandName", manufacturer: "manufacturer", manufacturerAddress: "manufacturerAddress",
    packer: "packer", packerAddress: "packerAddress", marketer: "marketer", importer: "importer",
    netQuantity: "netQuantity", unit: "unit", mrp: "mrp", currency: "currency", gtin: "barcode", batchNumber: "batchNumber",
    dateOfManufacture: "dateOfManufacture", dateOfPacking: "dateOfPacking", bestBefore: "bestBefore", expiryDate: "expiryDate",
    consumerCarePhone: "consumerCarePhone", consumerCareEmail: "consumerCareEmail", countryOfOrigin: "countryOfOrigin",
    fssaiLicenseNumber: "fssaiLicenseNumber",
  };
  for (const [listingKey, ocrKey] of Object.entries(mappings)) {
    const value = ocrValue(ocr, ocrKey);
    if (value && (!next[listingKey] || !String(next[listingKey]).trim())) next[listingKey] = value;
  }
  const declarations = Array.isArray(ocr?.otherDeclarations) ? ocr.otherDeclarations.map((x) => typeof x === "string" ? x : x?.text).filter(Boolean) : [];
  if (declarations.length) {
    const existing = String(next.description || "").trim();
    next.description = existing ? `${existing}\n${declarations.join("\n")}` : declarations.join("\n");
  }
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
  const [manualViolations, setManualViolations] = useState([]);
  const [manualRuleCode, setManualRuleCode] = useState("");
  const [manualRuleNumber, setManualRuleNumber] = useState("");
  const [manualViolationReason, setManualViolationReason] = useState("");
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
      .catch((e) => setError(e.message || "Could not load e-commerce categories"));
    return () => controllerRef.current?.abort();
  }, []);

  const imageUrls = (listing?.imageUrls || []).slice(0, MAX_IMAGES);
  const findings = useMemo(() => compliance?.findings || [], [compliance]);
  const violationFindings = useMemo(() => findings.filter((f) => displayFindingStatus(f) === "VIOLATION"), [findings]);
  const allViolationsSelected = violationFindings.length > 0 && violationFindings.every((f) => selectedViolations.includes(String(f.findingId)));
  const finalCategories = useMemo(() => flatten(categories).filter((c) => c.isFinalProductType && c.sourceType === "ECOMMERCE"), [categories]);
  const filteredFinalCategories = useMemo(() => {
    const query = categoryFilter.trim().toLowerCase();
    return query ? finalCategories.filter((category) => category.path.some((node) => String(node.name || "").toLowerCase().includes(query))) : finalCategories;
  }, [categoryFilter, finalCategories]);
  const selectedManualRule = useMemo(() => ENGINE_RULE_OPTIONS.find(([code]) => code === manualRuleCode) || null, [manualRuleCode]);

  function resetState({ clearUrl = true, text = "E-commerce analyzer reset." } = {}) {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (clearUrl) setUrl("");
    setListing(null); setOcr(null); setCompliance(null); setCategoryId(""); setCategoryFilter("");
    setSelectedViolations([]); setManualViolations([]); setManualRuleCode(""); setManualRuleNumber(""); setManualViolationReason("");
    setError(""); setMessage(text); setBusy(false);
  }

  function cancelInspection() { resetState({ clearUrl: false, text: "Inspection cancelled. The current draft was discarded." }); }

  function setSelectedDefaults(result) {
    setSelectedViolations((result?.findings || []).filter((f) => displayFindingStatus(f) === "VIOLATION").map((f) => String(f.findingId)));
  }

  async function inspectListing(event) {
    event.preventDefault();
    const value = url.trim();
    if (!/^https?:\/\/\S+$/i.test(value)) return setError("Enter a valid public product listing URL.");
    const controller = new AbortController();
    controllerRef.current?.abort(); controllerRef.current = controller;
    setBusy(true); setError(""); setMessage("Fetching listing data and product images...");
    setListing(null); setOcr(null); setCompliance(null); setCategoryId(""); setCategoryFilter(""); setSelectedViolations([]); setManualViolations([]); setManualRuleCode(""); setManualRuleNumber(""); setManualViolationReason("");
    try {
      const response = await apiFetch(`${API_URL}/products/ecommerce/analyze-url`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: value }), signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not inspect the listing.");
      const written = parseWrittenListingText(data.listing?.text);
      let extractedOcr = data.ocr || null;
      const listingWithWritten = {
        ...(data.listing || {}),
        ...Object.fromEntries(Object.entries(written).filter(([key, item]) => key !== "listingText" && item && !data.listing?.[key])),
        listingText: written.listingText || data.listing?.text || "",
      };

      const sourceImages = Array.isArray(listingWithWritten.imageUrls) ? listingWithWritten.imageUrls.slice(0, MAX_IMAGES) : [];
      if (sourceImages.length) {
        setMessage(`Running shared Fast OCR + AI semantic analysis on ${sourceImages.length} product image${sourceImages.length === 1 ? "" : "s"}...`);
        const ocrResponse = await apiFetch(`${API_URL}/products/ecommerce-ocr/images`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrls: sourceImages }), signal: controller.signal,
        });
        const ocrPayload = await ocrResponse.json().catch(() => ({}));
        if (!ocrResponse.ok) throw new Error(ocrPayload.error || "The shared OCR engine could not process the listing images.");
        if (!ocrPayload.result) throw new Error("The shared OCR engine returned no product fields.");
        extractedOcr = ocrPayload.result;
      } else if (!extractedOcr) {
        throw new Error("The listing page did not expose downloadable product images for OCR.");
      }

      const mergedListing = mergeListingWithOcr(listingWithWritten, extractedOcr);
      setOcr(extractedOcr); setListing(mergedListing);
      setMessage("OCR + AI semantic extraction completed. Checking the combined listing against the Rules Engine...");

      const overrides = Object.fromEntries(EDITABLE_FIELDS.map(([key]) => [key, mergedListing[key] ?? ""]));
      const check = await apiFetch(`${API_URL}/products/ecommerce/evaluate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing: mergedListing, ocr: extractedOcr, overrides }), signal: controller.signal,
      });
      const checked = await check.json().catch(() => ({}));
      if (!check.ok) throw new Error(checked.error || "Rules Engine evaluation failed.");
      setListing(checked.listing || mergedListing);
      setCompliance(checked.compliance || data.compliance || null);
      setSelectedDefaults(checked.compliance || data.compliance);
      setMessage("E-commerce analysis complete. Website data, OCR and AI semantic evidence are combined; review the rule findings before registration.");
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e.message || "E-commerce inspection failed.");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setBusy(false);
    }
  }

  function updateListing(key, value) { setListing((current) => ({ ...current, [key]: value })); }

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
      setListing(data.listing || listing); setCompliance(data.compliance || null); setSelectedDefaults(data.compliance);
      setMessage("Edited product data was re-checked by the Rules Engine.");
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

  function addManualViolation() {
    const isCustom = manualRuleCode === "CUSTOM";
    const selectedRule = selectedManualRule;
    const number = isCustom ? manualRuleNumber.trim() : selectedRule?.[1];
    const title = isCustom ? "Custom / other Legal Metrology rule" : selectedRule?.[2];
    const statement = isCustom ? "Rule statement supplied by the inspector for the selected custom rule number." : selectedRule?.[3];
    const code = isCustom ? `CUSTOM-${number || "OTHER"}` : selectedRule?.[0];
    const reason = manualViolationReason.trim();
    if (!number) return setError("Enter the custom rule number, such as 32.");
    if (!selectedRule && !isCustom) return setError("Select a Rules Engine category before adding a violation.");
    if (!reason) return setError("Describe the observed violation before adding it.");
    const findingId = `MANUAL-${crypto.randomUUID()}`;
    setManualViolations((current) => [...current, { findingId, ruleCode: code, ruleNumber: number, title, ruleStatement: statement, status: "VIOLATION", severity: "REVIEW", message: reason, violationReason: reason }]);
    setManualRuleCode(""); setManualRuleNumber(""); setManualViolationReason("");
    setMessage(`Manual violation added under Rule ${number}.`);
  }

  function removeManualViolation(id) {
    setManualViolations((current) => current.filter((finding) => finding.findingId !== id));
  }

  async function saveProduct() {
    if (!listing?.url) return;
    const selected = finalCategories.find((c) => c.id === categoryId);
    if (!selected || selected.sourceType !== "ECOMMERCE" || !selected.isFinalProductType) return setError("Select an E-commerce final product category before saving.");
    if (!listing.productName?.trim()) return setError("Product name is required.");
    setSaving(true); setError(""); setMessage("Registering the reviewed e-commerce product...");
    try {
      const website = listing.websiteName || new URL(listing.url).hostname.replace(/^www\./i, "");
      const finalViolationIds = [...selectedViolations, ...manualViolations.map((finding) => finding.findingId)];
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
        ocrData: { provider: "ecommerce_shared_fast_ocr_ai", ocr, compliance, listing, writtenListingText: listing.listingText || listing.text || "", complianceReview: { selectedViolationIds: finalViolationIds, manualViolations } },
        acceptedFindingIds: finalViolationIds,
        shopName: website, shopAddress: "", shopCity: "", shopState: "",
        notes: `E-commerce listing reviewed from ${listing.url}. Final category: ${selected.path?.map((x) => x.name).join(" → ") || selected.name}`,
        sourceType: "ECOMMERCE", sourceUrl: listing.url, sourceWebsiteName: website,
        complianceStatus: finalViolationIds.length ? "VIOLATION" : "OKAY",
        violationReason: [...findings.filter((f) => selectedViolations.includes(String(f.findingId))), ...manualViolations].map((finding) => {
          const meta = ruleMeta(finding);
          return `Rule ${meta.number || meta.code}: ${finding.message || finding.violationReason || meta.title}`;
        }).join(" | "),
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
      <p className="eyebrow">E-COMMERCE INSPECTION</p><h1>Inspect Product Listing</h1>
      <p>Enter a public listing URL. PARAKH combines website data with the same RapidOCR + AI semantic pipeline used for package scanning, then sends the evidence to the Rules Engine.</p>
      <p><Link to="/ecommerce-products">View saved e-commerce products →</Link></p>
    </div>

    <form className="ecommerce-panel ecommerce-url-form" onSubmit={inspectListing}>
      <label className="ecommerce-url-field"><span>Product listing URL</span><input className="ecommerce-url-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/product/..." disabled={busy || saving} /></label>
      <div className="ecommerce-edit-actions"><button className="primary-button ecommerce-inspect-button" type="submit" disabled={busy || saving}>{busy ? "Inspecting listing..." : "Inspect Listing"}</button>{busy && <button className="secondary-action" type="button" onClick={cancelInspection}>Cancel</button>}<button className="secondary-action" type="button" onClick={() => resetState()} disabled={busy || saving}>Reset</button></div>
      <small>Use public pages and sources that permit automated retrieval. Protected pages, private URLs and login-only content are not accessed.</small>
    </form>

    {error && <div className="status-message error">{error}</div>}{message && !error && <div className="status-message">{message}</div>}

    {listing && <section className="ecommerce-panel">
      <div className="section-heading"><div><h2>Combined Product Data</h2><p>Website-stated, OCR-extracted and AI-interpreted values are combined here. Every field remains editable before registration.</p></div></div>
      <div className="ecommerce-edit-grid">
        {EDITABLE_FIELDS.map(([key, label]) => <label key={key} className={key === "description" ? "full-width" : ""}><span>{label}</span>{key === "description" ? <textarea value={listing[key] || ""} onChange={(e) => updateListing(key, e.target.value)} /> : <input value={listing[key] || ""} onChange={(e) => updateListing(key, e.target.value)} />}</label>)}
        <label><span>Website</span><input value={listing.websiteName || ""} readOnly /></label>
        <label><span>Country-of-origin filter evidence</span><select value={listing.filterEvidence ? "true" : "false"} onChange={(e) => updateListing("filterEvidence", e.target.value === "true")}><option value="true">Detected on listing page</option><option value="false">Not established</option></select></label>
        <label className="full-width"><span>Filter e-commerce final product categories</span><input value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} placeholder="Search category or subcategory" /></label>
        <label className="full-width"><span>E-commerce final product category *</span><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Select e-commerce final category</option>{filteredFinalCategories.map((c) => <option key={c.id} value={c.id}>{c.path.map((x) => x.name).join(" → ")}</option>)}</select></label>
      </div>
      <div className="ecommerce-edit-actions"><button type="button" className="secondary-action" onClick={reevaluate} disabled={busy || saving}>Re-run Rules Engine</button><button type="button" className="primary-button" onClick={saveProduct} disabled={saving || busy}>{saving ? "Registering..." : "Register E-commerce Product"}</button></div>
    </section>}

    {imageUrls.length > 0 && <section className="ecommerce-panel"><div className="section-heading"><div><h2>Listing Images</h2><p>These images are sent through the shared RapidOCR + AI semantic pipeline.</p></div></div><div className="ecommerce-images">{imageUrls.map((imageUrl, index) => <div className="ecommerce-image" key={imageUrl}><img src={imageUrl} alt={`Listing product ${index + 1}`} /><span>Image {index + 1}</span></div>)}</div></section>}

    {ocr && <section className="ecommerce-panel"><div className="section-heading"><div><h2>RapidOCR + AI Semantic Extraction</h2><p>Raw package text is combined with AI semantic interpretation so values can be inferred from context, not just exact adjacent labels.</p></div></div><div className="ecommerce-fields">{["productName", "brandName", "manufacturer", "manufacturerAddress", "countryOfOrigin", "mrp", "netQuantity", "unit", "batchNumber", "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate", "barcode", "consumerCarePhone", "consumerCareEmail", "fssaiLicenseNumber"].map((key) => <div key={key}><strong>{key.replace(/([A-Z])/g, " $1")}</strong><span>{ocrValue(ocr, key) || "Not established"}</span></div>)}</div></section>}

    {compliance && <section className="ecommerce-panel">
      <div className="section-heading"><div><h2>Rules Engine Result</h2><p>Detected violations use the actual Rules Engine category and rule number. Extracted MRP, quantity and other values are data; they are not violations by themselves.</p></div></div>
      <div className="ecommerce-result-summary"><div><span>Status</span><strong>{(selectedViolations.length || manualViolations.length) ? "VIOLATION" : (compliance.overallStatus || "REVIEW")}</strong></div><div><span>Violations selected</span><strong>{selectedViolations.length + manualViolations.length}</strong></div><div><span>Unable to verify</span><strong>{compliance.summary?.unableToVerify ?? 0}</strong></div></div>

      {violationFindings.length > 0 && <div className="ecommerce-selection-bar"><button type="button" className="violation-select-button" onClick={toggleAllViolations}>{allViolationsSelected ? "Deselect all violations" : "Select all violations"}</button><span>{selectedViolations.length} of {violationFindings.length} engine violations selected</span></div>}

      {violationFindings.length > 0 && <div className="ecommerce-findings"><h3>Detected engine violations</h3>{violationFindings.map((finding, index) => { const meta = ruleMeta(finding); const selectedFinding = selectedViolations.includes(String(finding.findingId)); return <details className="ecommerce-finding-row violation" key={finding.findingId || index} open={selectedFinding}><summary><input type="checkbox" checked={selectedFinding} onChange={() => toggleViolation(finding.findingId)} onClick={(event) => event.stopPropagation()} /><span><strong>Rule {meta.number || meta.code}</strong><small>{meta.code} · {finding.severity || "REVIEW"}</small><em>{meta.title}</em></span></summary><div className="ecommerce-rule-detail"><strong>Rule statement</strong><p>{meta.statement}</p><strong>Detected issue</strong><p>{finding.message || finding.violationReason || "The Rules Engine detected a non-compliance condition."}</p></div></details>; })}</div>}

      <div className="ecommerce-manual-rule-panel">
        <h3>Add violation by Rules Engine category</h3>
        <p>Select the rule number/category first, then describe what was observed. This creates an auditable finding with the rule reference instead of an unlabelled note.</p>
        <label><span>Rules Engine category</span><select value={manualRuleCode} onChange={(event) => { setManualRuleCode(event.target.value); if (event.target.value !== "CUSTOM") setManualRuleNumber(""); }}><option value="">Select a rule category</option>{ENGINE_RULE_OPTIONS.map(([code, number, title]) => <option key={code} value={code}>Rule {number} · {title} ({code})</option>)}<option value="CUSTOM">Custom / other rule number</option></select></label>
        {selectedManualRule && <div className="ecommerce-rule-statement"><strong>Rule {selectedManualRule[1]} statement</strong><span>{selectedManualRule[3]}</span></div>}
        {manualRuleCode === "CUSTOM" && <label><span>Custom rule number / category</span><input value={manualRuleNumber} onChange={(event) => setManualRuleNumber(event.target.value)} placeholder="Example: 32" /></label>}
        {manualRuleCode === "CUSTOM" && <div className="ecommerce-rule-statement"><strong>Custom rule statement</strong><span>Enter the exact applicable statement in the observation field below. PARAKH will not invent legal wording for a rule that is not in the configured engine.</span></div>}
        <label><span>Violation statement / observation</span><textarea value={manualViolationReason} onChange={(event) => setManualViolationReason(event.target.value)} placeholder="Example: Country of origin is not shown in the mandatory online product information." /></label>
        <button type="button" className="secondary-action" onClick={addManualViolation}>Add violation</button>
        {manualViolations.map((finding) => <details className="ecommerce-finding-row manual" key={finding.findingId}>
          <summary><span><strong>Rule {finding.ruleNumber}</strong><small>{finding.ruleCode} · Inspector/manual finding</small><em>{finding.title}</em></span></summary>
          <div className="ecommerce-rule-detail"><strong>Rule statement</strong><p>{finding.ruleStatement}</p><strong>Observation</strong><p>{finding.message}</p><button type="button" className="secondary-action" onClick={() => removeManualViolation(finding.findingId)}>Remove</button></div>
        </details>)}
        <div className="ecommerce-selection-count">Manual violations: <strong>{manualViolations.length}</strong></div>
      </div>

      {findings.length === 0 && <div className="ecommerce-findings"><p>No Rules Engine findings were returned. This is not the same thing as proof of compliance.</p></div>}
    </section>}
  </div>;
}

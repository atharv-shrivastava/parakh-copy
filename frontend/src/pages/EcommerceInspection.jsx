import { useState } from "react";
import { apiFetch } from "../lib/auth";
import "../styles/ecommerce.css";

const OCR_URL = "http://localhost:8080";
const MAX_IMAGES = 6;

function fieldValue(result, key) {
  const field = result?.[key];
  return field?.status === "found" && field.value != null ? String(field.value) : "";
}

export default function EcommerceInspection() {
  const [url, setUrl] = useState("");
  const [isImported, setIsImported] = useState("unknown");
  const [filterStatus, setFilterStatus] = useState("unknown");
  const [images, setImages] = useState([]);
  const [ocr, setOcr] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function addImages(event) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/")).slice(0, MAX_IMAGES);
    setImages(files.map((file) => ({ file, url: URL.createObjectURL(file) })));
    setOcr(null); setCompliance(null); setError("");
    setMessage(files.length ? "Listing screenshots ready for analysis." : "");
    event.target.value = "";
  }

  function removeImage(index) {
    const current = images[index];
    if (current?.url) URL.revokeObjectURL(current.url);
    setImages(images.filter((_, i) => i !== index));
    setOcr(null); setCompliance(null);
  }

  async function analyze() {
    if (!images.length) return setError("Upload at least one e-commerce listing screenshot.");
    setBusy(true); setError(""); setMessage("Analyzing the listing screenshot...");
    try {
      const fd = new FormData();
      images.forEach(({ file }) => fd.append("images", file));
      const ocrResponse = await apiFetch(`${OCR_URL}/api/ocr/analyze`, { method: "POST", body: fd });
      const ocrData = await ocrResponse.json().catch(() => ({}));
      if (!ocrResponse.ok || !ocrData.result) throw new Error(ocrData.error || "Could not analyze the listing screenshot.");
      const extracted = ocrData.result;
      const filterEvidence = filterStatus === "unknown" ? null : { evidenceId: crypto.randomUUID(), field: "ecommerce.countryOfOriginFilter", rawValue: filterStatus === "present", normalizedValue: filterStatus === "present", confidence: 1, source: "MANUAL_INPUT", timestamp: new Date().toISOString() };
      const evidence = [filterEvidence, { evidenceId: crypto.randomUUID(), field: "declarations.countryOfOrigin", rawValue: fieldValue(extracted, "countryOfOrigin"), normalizedValue: fieldValue(extracted, "countryOfOrigin"), confidence: Number(extracted?.countryOfOrigin?.confidence || 0), source: "OCR", timestamp: new Date().toISOString() }].filter(Boolean);
      const metadata = { brandName: fieldValue(extracted, "brandName") || undefined, genericName: fieldValue(extracted, "productName") || undefined, commodityCategory: fieldValue(extracted, "productName") || "packaged commodity", consumerType: "general", isImported: isImported === "yes" ? true : isImported === "no" ? false : undefined, countryOfOrigin: fieldValue(extracted, "countryOfOrigin") || undefined, packageType: "retail" };
      const request = { inspectionId: crypto.randomUUID(), productId: crypto.randomUUID(), inspectionDate: new Date().toISOString().slice(0, 10), context: "ecommerce_listing", productMetadata: metadata, evidence, declarations: { productName: fieldValue(extracted, "productName"), brandName: fieldValue(extracted, "brandName"), countryOfOrigin: fieldValue(extracted, "countryOfOrigin") }, administrative: { sourceUrl: url.trim() || null, sourceType: "ecommerce_listing_screenshot" } };
      const resultResponse = await apiFetch(`${OCR_URL}/api/ocr/evaluate-structured`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      const result = await resultResponse.json().catch(() => ({}));
      if (!resultResponse.ok) throw new Error(result.error || "Rules Engine evaluation failed.");
      setOcr({ ...extracted, sourceUrl: url.trim() || null, provider: ocrData.provider || "OCR" });
      setCompliance(result.compliance || result);
      setMessage("E-commerce listing analysis complete.");
    } catch (e) { setError(e.message || "E-commerce analysis failed."); } finally { setBusy(false); }
  }

  return <div className="ecommerce-page">
    <div className="page-header"><p className="eyebrow">E-COMMERCE INSPECTION</p><h1>Inspect Product Listing</h1><p>Upload marketplace/listing screenshots and run the Legal Metrology Rules Engine in e-commerce context.</p></div>
    <section className="ecommerce-panel"><div className="ecommerce-form">
      <label>Listing URL<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/product/..." /></label>
      <label>Imported product?<select value={isImported} onChange={(e) => setIsImported(e.target.value)}><option value="unknown">Not established</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label>Country-of-origin filter visible/searchable?<select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}><option value="unknown">Not checked</option><option value="present">Yes</option><option value="absent">No</option></select></label>
    </div><div className="ecommerce-upload"><label className="secondary-button">Upload Listing Screenshots<input type="file" accept="image/*" multiple hidden onChange={addImages}/></label><span>{images.length}/{MAX_IMAGES} screenshots</span></div></section>
    {images.length > 0 && <section className="ecommerce-panel"><div className="section-heading"><div><h2>Evidence</h2><p>Keep screenshots showing listing details and filter controls.</p></div></div><div className="ecommerce-images">{images.map(({url,file}, index) => <div className="ecommerce-image" key={file.name + index}><img src={url} alt={"Listing evidence " + (index + 1)}/><button type="button" onClick={() => removeImage(index)}>Remove</button><span>{file.name}</span></div>)}</div><button className="primary-button" type="button" disabled={busy} onClick={analyze}>{busy ? "Analyzing..." : "Analyze Listing"}</button></section>}
    {error && <div className="status-message">{error}</div>}{message && !error && <div className="status-message">{message}</div>}
    {ocr && <section className="ecommerce-panel"><div className="section-heading"><div><h2>Extracted Listing Details</h2><p>{ocr.provider || "OCR"} · {ocr.sourceUrl || "Screenshot source"}</p></div></div><div className="ecommerce-fields">{["productName","brandName","countryOfOrigin","mrp","netQuantity","unit","manufacturer"].map((key) => <div key={key}><strong>{key.replace(/([A-Z])/g, " $1")}</strong><span>{fieldValue(ocr, key) || "Not established"}</span></div>)}</div></section>}
    {compliance && <section className="ecommerce-panel"><div className="section-heading"><div><h2>Rules Engine Result</h2><p>Context: e-commerce listing. Findings are support information and may require officer/legal review.</p></div></div><div className="ecommerce-result-summary"><div><span>Status</span><strong>{compliance.overallStatus || "REVIEW"}</strong></div><div><span>Violations</span><strong>{compliance.summary?.violations ?? 0}</strong></div><div><span>Unable to verify</span><strong>{compliance.summary?.unableToVerify ?? 0}</strong></div></div><div className="ecommerce-findings">{(compliance.findings || []).map((finding, index) => <article key={finding.findingId || index}><strong>{finding.ruleNumber || finding.ruleCode}</strong><span>{finding.message}</span>{finding.violationReason && <small>{finding.violationReason}</small>}</article>)}</div></section>}
  </div>;
}
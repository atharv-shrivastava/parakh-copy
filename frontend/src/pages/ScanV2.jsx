import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/auth";
import "../styles/scan.css";

const API_URL = "http://localhost:5000/api";
const OCR_URL = "http://localhost:8080";
const MAX_IMAGES = 4;
const MAX_PUTER_IMAGE_SIZE = 10 * 1024 * 1024;
const OCR_FIELDS = ["productName", "brandName", "manufacturer", "manufacturerAddress", "packer", "packerAddress", "importer", "importerAddress", "netQuantity", "unit", "mrp", "currency", "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate", "batchNumber", "consumerCarePhone", "consumerCareEmail", "countryOfOrigin", "fssaiLicenseNumber", "barcode"];
const EMPTY_FORM = { brandName: "", productName: "", description: "", netQuantity: "", unit: "", mrp: "", barcode: "", shopName: "", shopAddress: "", shopCity: "", shopState: "", notes: "" };

function flattenCategories(nodes, path = []) {
  return nodes.flatMap((node) => {
    const next = [...path, node];
    return [{ ...node, path: next }, ...flattenCategories(node.children || [], next)];
  });
}

function fieldValue(result, key) {
  const field = result?.[key];
  return field?.status === "found" && field.value != null ? String(field.value) : "";
}

function normalizePuter(candidate, rawText) {
  const result = {};
  for (const key of OCR_FIELDS) {
    const field = candidate?.[key];
    result[key] = field && typeof field === "object"
      ? { value: field.value ?? null, raw: field.raw ?? null, confidence: Number(field.confidence) || 0, evidence: field.evidence ?? null, status: ["found", "absent", "unreadable", "ambiguous"].includes(field.status) ? field.status : "absent" }
      : { value: null, raw: null, confidence: 0, evidence: null, status: "absent" };
  }
  result.otherDeclarations = Array.isArray(candidate?.otherDeclarations) ? candidate.otherDeclarations : [];
  result.declarationEvidence = Array.isArray(candidate?.declarationEvidence) ? candidate.declarationEvidence : [];
  result.rawText = typeof candidate?.rawText === "string" && candidate.rawText.trim() ? candidate.rawText : rawText;
  result.warnings = Array.isArray(candidate?.warnings) ? candidate.warnings : [];
  result.unreadableFields = Array.isArray(candidate?.unreadableFields) ? candidate.unreadableFields : [];
  result.needsReview = Boolean(candidate?.needsReview) || OCR_FIELDS.some((key) => ["unreadable", "ambiguous"].includes(result[key].status) || result[key].status === "found" && result[key].confidence < 0.6);
  return result;
}

function extractJson(text) {
  const source = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = source.indexOf("{");
  if (start < 0) throw new Error("Puter did not return structured OCR JSON.");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("Puter returned incomplete structured OCR JSON.");
}

function readVisualInspection() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem("parakhVisualInspection") || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function fileToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not prepare the image for storage.");
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

async function runGemini(files) {
  const fd = new FormData();
  files.forEach((file) => fd.append("images", file));
  const response = await apiFetch(`${OCR_URL}/api/ocr/analyze`, { method: "POST", body: fd });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Gemini OCR service unavailable.");
  if (!data.result) throw new Error("Gemini OCR returned no structured result.");
  return { result: data.result, provider: data.provider || "gemini", model: data.model || "Gemini 3 Flash" };
}

async function runPuter(files) {
  const puter = window.puter;
  if (!puter?.ai?.img2txt) throw new Error("Puter.js OCR fallback is not available.");
  const chunks = await Promise.all(files.map(async (file, index) => {
    if (file.size > MAX_PUTER_IMAGE_SIZE) throw new Error(`Image ${index + 1} exceeds Puter OCR's 10 MB limit.`);
    return `[IMAGE ${index + 1}]\\n${String(await puter.ai.img2txt(file) || "").trim()}`;
  }));
  const rawText = chunks.filter(Boolean).join("\\n\\n");
  if (!rawText.trim()) throw new Error("Puter OCR found no readable text.");
  if (!puter.ai.chat) return { result: normalizePuter({}, rawText), provider: "puter-js", model: "img2txt fallback" };
  const prompt = `Convert this OCR text into PARAKH structured OCR JSON. Never invent data. Every field must be {value,raw,confidence,evidence,status}; status is found, absent, unreadable or ambiguous. Return only valid JSON. Fields: ${OCR_FIELDS.join(", ")}. Also return otherDeclarations, declarationEvidence, rawText, warnings, unreadableFields, needsReview. For declarationEvidence, use imageIndex 0-based based on the [IMAGE N] markers and provide visible declaration type, text, confidence, and normalized boundingBox when you can locate it. Use null for boundingBox when location cannot be determined. OCR text:\n\n${rawText}`;
  const response = await puter.ai.chat(prompt, { model: "gpt-5.6-luna", max_tokens: 5000 });
  const content = response?.message?.content || response?.content || response?.text || "";
  return { result: normalizePuter(JSON.parse(extractJson(content)), rawText), provider: "puter-js", model: "fallback" };
}

async function runOcr(files) {
  try {
    return await runGemini(files);
  } catch (geminiError) {
    const fallback = await runPuter(files);
    return { ...fallback, fallbackReason: geminiError.message };
  }
}

export default function ScanV2() {
  const videoRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [ocr, setOcr] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [complianceError, setComplianceError] = useState(null);
  const [acceptedFindingIds, setAcceptedFindingIds] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [providerInfo, setProviderInfo] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch(`${API_URL}/categories/tree/all?sourceType=OFFLINE`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load offline categories");
        return response.json();
      })
      .then(setCategories)
      .catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => () => {
    if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
  }, []);

  const flat = flattenCategories(categories);
  const finalCategories = flat.filter((category) => category.isFinalProductType);
  const selected = flat.find((category) => category.id === selectedCategoryId);
  const violations = compliance?.findings?.filter((finding) => finding.status === "VIOLATION") || [];
  const accepted = violations.filter((finding) => acceptedFindingIds.includes(finding.findingId));

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addFiles(input) {
    const files = Array.from(input || []).filter((file) => file instanceof File && file.type.startsWith("image/"));
    setImages((current) => [...current, ...files.slice(0, MAX_IMAGES - current.length).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    setOcr(null);
    setCompliance(null);
    setComplianceError(null);
    setAcceptedFindingIds([]);
    setProviderInfo(null);
    setSelectedCategoryId("");
    window.sessionStorage.removeItem("parakhDeclarationEvidence");
    setMessage("Images ready for analysis.");
  }

  async function openCamera() {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) return setCameraError("Camera access is unavailable. Use Upload Images instead.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (error) {
      setCameraError(error.name === "NotAllowedError" ? "Camera permission was denied." : "Could not open the camera.");
    }
  }

  function closeCamera() {
    if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }

  function capture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return setCameraError("Camera is still starting. Try again.");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return setCameraError("Could not capture the image.");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return setCameraError("Could not capture the image.");
      addFiles([new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" })]);
      closeCamera();
    }, "image/jpeg", 0.88);
  }

  function remove(index) {
    setImages((current) => current.filter((item, i) => {
      if (i === index) URL.revokeObjectURL(item.url);
      return i !== index;
    }));
    setOcr(null);
    setCompliance(null);
    setAcceptedFindingIds([]);
    setProviderInfo(null);
    setSelectedCategoryId("");
  }

  async function analyze() {
    if (!images.length) return setMessage("Add at least one package image first.");
    setAnalyzing(true);
    setMessage("Trying Gemini 3 Flash OCR...");
    try {
      const info = await runOcr(images.map((item) => item.file));
      const extracted = info.result;
      window.sessionStorage.setItem("parakhDeclarationEvidence", JSON.stringify(extracted.declarationEvidence || []));
      window.dispatchEvent(new CustomEvent("parakh:declaration-evidence", { detail: extracted.declarationEvidence || [] }));
      const visualInspection = readVisualInspection();
      setProviderInfo(info);
      setMessage(info.provider === "gemini" ? `OCR completed with ${info.model}. Running Rules Engine...` : "Gemini was unavailable, so Puter.js fallback completed OCR. Running Rules Engine...");
      const response = await apiFetch(`${OCR_URL}/api/ocr/evaluate-structured`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ocr: extracted,
          visualFlags: visualInspection ? {
            readability: visualInspection.readability,
            readable: visualInspection.readable,
            textDetected: visualInspection.textDetected,
            placementReview: visualInspection.placementReview,
            fontSizeCalibrated: visualInspection.fontSizeCalibrated,
            estimatedTextHeightMm: visualInspection.estimatedTextHeightMm,
            declarationCoverageScreened: visualInspection.declarationCoverageScreened,
          } : {},
          inspectionId: crypto.randomUUID(),
          productId: crypto.randomUUID(),
          inspectionDate: new Date().toISOString().slice(0, 10),
          context: "physical_package",
          commodityCategory: "packaged commodity",
          consumerType: "general",
          isImported: false,
          packageType: "retail",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Rules Engine evaluation failed");
      setOcr(extracted);
      setCompliance(data.compliance || null);
      setComplianceError(data.complianceError || null);
      setAcceptedFindingIds((data.compliance?.findings || []).filter((finding) => finding.status === "VIOLATION").map((finding) => finding.findingId));
      setForm((current) => ({
        ...current,
        brandName: fieldValue(extracted, "brandName") || fieldValue(extracted, "manufacturer"),
        productName: fieldValue(extracted, "productName"),
        netQuantity: fieldValue(extracted, "netQuantity"),
        unit: fieldValue(extracted, "unit"),
        mrp: fieldValue(extracted, "mrp"),
        barcode: fieldValue(extracted, "barcode"),
        description: [extracted.rawText, ...(extracted.otherDeclarations || [])].filter(Boolean).join("\n"),
      }));
      setSelectedCategoryId("");
      setShowRegistration(true);
      setMessage(info.fallbackReason ? `Gemini failed, so Puter.js fallback was used: ${info.fallbackReason}` : "Gemini OCR and Rules Engine analysis complete. Select an offline category before registration.");
    } catch (error) {
      setMessage(error.message || "OCR analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  function toggle(id) {
    setAcceptedFindingIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function save(event) {
    event.preventDefault();
    if (!selectedCategoryId) return setMessage("Select an offline final category before saving.");
    if (!form.shopName.trim()) return setMessage("Shop name is required.");
    setSaving(true);
    try {
      const imageUrls = await Promise.all(images.map((item) => fileToDataUrl(item.file)));
      const visualInspection = readVisualInspection();
      const response = await apiFetch(`${API_URL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          categoryId: selectedCategoryId,
          sourceType: "OFFLINE",
          imageUrls,
          acceptedFindingIds,
          ocrData: { ocr, compliance, complianceError, providerInfo, visualInspection },
          complianceStatus: accepted.length ? "VIOLATION" : "OKAY",
          violationReason: accepted.map((finding) => finding.message || finding.violationReason || finding.ruleCode).join(" | "),
          inspectionDate: new Date().toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save product");
      const id = data.product?.id || data.id;
      if (!id) throw new Error("Product was saved but its ID was not returned.");
      window.location.href = `/products/item/${id}`;
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="scan-page">
    <div className="page-header">
      <p className="eyebrow">PRODUCT INSPECTION</p>
      <h1>Scan Product</h1>
      <p>Capture or upload package images, extract declarations with Gemini 3 Flash, review Rules Engine findings, then register the inspection.</p>
    </div>

    <section className="scan-area">
      <div className="scan-icon">⌁</div>
      <h2>Capture or upload package images</h2>
      <p>Use the camera or choose up to {MAX_IMAGES} images showing different sides.</p>
      <div className="scan-upload-actions">
        <button type="button" className="primary-button" onClick={openCamera}>Open Camera</button>
        <label className="secondary-button scan-file-button">Upload Images<input type="file" accept="image/*" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} hidden /></label>
      </div>
      <p className="scan-limit">{images.length}/{MAX_IMAGES} images selected</p>
      {cameraError && <div className="status-message">{cameraError}</div>}
    </section>

    {cameraOpen && <div className="camera-overlay" role="dialog" aria-modal="true"><div className="camera-modal"><div className="camera-header"><h2>Capture package image</h2><button type="button" onClick={closeCamera}>Close</button></div><video ref={videoRef} className="camera-video" autoPlay playsInline muted /><div className="camera-actions"><button type="button" className="primary-button" onClick={capture}>Capture Photo</button><button type="button" className="secondary-button" onClick={closeCamera}>Cancel</button></div></div></div>}

    {images.length > 0 && <section className="scan-review"><div className="section-heading"><div><h2>Evidence images</h2><p>All selected images are retained with the registered product.</p></div></div><div className="scan-image-grid">{images.map(({ url, file }, index) => <div className="scan-image-card" key={`${file.name}-${index}`}><img src={url} alt={`Package evidence ${index + 1}`} /><button type="button" onClick={() => remove(index)}>Remove</button><span>{file.name}</span></div>)}</div><button type="button" className="primary-button" onClick={analyze} disabled={analyzing}>{analyzing ? "Analyzing..." : "Analyze Images"}</button></section>}

    {providerInfo && <section className="ocr-status-grid"><div><strong>OCR provider</strong><span>{providerInfo.provider === "gemini" ? "Gemini 3 Flash" : "Puter.js fallback"}</span></div><div><strong>Model</strong><span>{providerInfo.model}</span></div><div><strong>Accepted violations</strong><span>{accepted.length}/{violations.length}</span></div></section>}

    {ocr && <section className="scan-review"><div className="section-heading"><div><h2>OCR extraction and rule review</h2><p>Correct OCR values and deselect false-positive violations before registration.</p></div></div><div className="ocr-fields-grid">{Object.entries(ocr).filter(([key, value]) => key !== "rawText" && value && typeof value === "object" && value.status === "found").map(([key, value]) => <div key={key}><strong>{key.replace(/([A-Z])/g, " $1")}</strong><span>{String(value.value)}</span><small>{Math.round(Number(value.confidence || 0) * 100)}% confidence</small></div>)}</div>{complianceError && <div className="status-message">Rules Engine: {complianceError.message}</div>}{compliance?.summary && <div className="ocr-summary">Rules: {compliance.summary.totalRulesEvaluated} · Passed: {compliance.summary.passed} · Violations: {compliance.summary.violations} · Unable to verify: {compliance.summary.unableToVerify}</div>}{violations.length > 0 && <div className="rule-review-panel"><div className="section-heading"><div><h3>Inspector review</h3><p>Uncheck a false positive. The original engine finding remains in the audit record.</p></div></div>{violations.map((finding) => <label className="rule-review-row" key={finding.findingId}><input type="checkbox" checked={acceptedFindingIds.includes(finding.findingId)} onChange={() => toggle(finding.findingId)} /><span><strong>{finding.ruleCode || finding.ruleNumber}</strong><small>{finding.ruleNumber ? `Rule ${finding.ruleNumber} · ` : ""}{finding.severity || "REVIEW"}</small><em>{finding.message || finding.violationReason || "Violation detected"}</em></span></label>)}<div className="ocr-summary">Accepted violations: <strong>{accepted.length}</strong> of {violations.length}</div></div>}</section>}

    {!showRegistration && <section className="scan-review registration-form"><div className="section-heading"><div><h2>Register product</h2><p>Manual registration still retains images but skips OCR.</p></div></div><button type="button" className="primary-button" onClick={() => setShowRegistration(true)}>Register Manually</button></section>}

    {showRegistration && <form className="scan-review registration-form" onSubmit={save}><div className="section-heading"><div><h2>Register offline product</h2><p>Select from your available offline categories, review the extracted data, then save.</p></div></div><div className="registration-grid"><label>Product name<input value={form.productName} onChange={(event) => update("productName", event.target.value)} required /></label><label>Brand / manufacturer<input value={form.brandName} onChange={(event) => update("brandName", event.target.value)} /></label><label>Net quantity<input value={form.netQuantity} onChange={(event) => update("netQuantity", event.target.value)} /></label><label>Unit<input value={form.unit} onChange={(event) => update("unit", event.target.value)} /></label><label>MRP<input type="number" min="0" step="0.01" value={form.mrp} onChange={(event) => update("mrp", event.target.value)} /></label><label>Barcode<input value={form.barcode} onChange={(event) => update("barcode", event.target.value)} /></label><label>Offline final category<select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)} required><option value="">Select an offline final category</option>{finalCategories.map((category) => <option value={category.id} key={category.id}>{category.path.map((item) => item.name).join(" → ")}</option>)}</select></label><label>Shop name<input value={form.shopName} onChange={(event) => update("shopName", event.target.value)} required /></label><label>Shop address<input value={form.shopAddress} onChange={(event) => update("shopAddress", event.target.value)} /></label><label>City<input value={form.shopCity} onChange={(event) => update("shopCity", event.target.value)} /></label><label>State<input value={form.shopState} onChange={(event) => update("shopState", event.target.value)} /></label><label className="span-2">Description<textarea value={form.description} onChange={(event) => update("description", event.target.value)} /></label><label className="span-2">Inspector notes<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label></div><div className="ocr-status-grid"><div><strong>Final status</strong><span>{accepted.length ? "VIOLATION" : compliance?.summary?.unableToVerify || ocr?.needsReview ? "NEEDS_REVIEW" : "OKAY"}</span></div><div><strong>Accepted violations</strong><span>{accepted.length}</span></div><div><strong>Images retained</strong><span>{images.length}</span></div></div><div className="scan-upload-actions"><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : "Register Offline Product"}</button><button type="button" className="secondary-button" onClick={() => setShowRegistration(false)}>Back</button></div></form>}

    {message && <div className="status-message">{message}</div>}
  </div>;
}

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/auth";
import ScanVisualCheck from "../components/ScanVisualCheck";
import "../styles/scan.css";

const API_URL = "http://localhost:5000/api";
const OCR_URL = "http://localhost:5000";
const MAX_IMAGES = 4;
const OCR_FIELDS = ["productName", "brandName", "manufacturer", "manufacturerAddress", "marketer", "packer", "packerAddress", "importer", "importerAddress", "netQuantity", "unit", "mrp", "currency", "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate", "batchNumber", "consumerCarePhone", "consumerCareEmail", "countryOfOrigin", "fssaiLicenseNumber", "barcode"];
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

async function runOcr(files) {
  const fd = new FormData();
  files.forEach((file) => fd.append("images", file));
  const response = await apiFetch(`${OCR_URL}/api/ocr/analyze`, { method: "POST", body: fd });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || data.error || data.message || "Local OCR service unavailable.");
  }
  if (!data.result) throw new Error("Local OCR returned no structured result.");
  return {
    result: data.result,
    provider: data.provider || "local-rules",
    model: data.model || "local declaration mapper",
    semantic: data.semantic || data.result.semantic || null,
    detectionProvider: data.detectionProvider || "paddleocr",
    detectionProviders: data.detectionProviders || ["paddleocr"],
    fallbackReason: data.fallbackReason || null,
  };
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
    setMessage("Running local PaddleOCR + declaration mapping...");
    try {
      const info = await runOcr(images.map((item) => item.file));
      const extracted = info.result;
      window.sessionStorage.setItem("parakhDeclarationEvidence", JSON.stringify(extracted.declarationEvidence || []));
      window.dispatchEvent(new CustomEvent("parakh:declaration-evidence", { detail: extracted.declarationEvidence || [] }));
      const visualInspection = readVisualInspection();
      setProviderInfo(info);
      const semanticLabel = info.semantic?.provider === "gliner2-local"
        ? "GLiNER2 local semantic mapper"
        : "Local declaration mapper";
      const detectionLabel = info.detectionProviders?.length
        ? info.detectionProviders.join(" + ")
        : info.detectionProvider || "PaddleOCR";
      const providerMessage = `${semanticLabel} + ${detectionLabel} completed. Running Rules Engine...`;
      setMessage(providerMessage);
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
      setMessage(info.fallbackReason ? `${providerMessage.replace("Running Rules Engine...", "Rules Engine completed.")} ${info.fallbackReason}` : "Local OCR and Rules Engine evaluation complete. Select an offline category before registration.");
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
      <p>Capture or upload package images, detect printed text with local PaddleOCR and map only relevant declarations with the local semantic layer, review Rules Engine findings, then register the inspection.</p>
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

    {images.length > 0 && <ScanVisualCheck />}

    {providerInfo && <section className="ocr-status-grid"><div><strong>Semantic mapper</strong><span>{providerInfo.semantic?.provider === "gemini" ? `${providerInfo.model || "Gemini"}` : providerInfo.semantic?.provider === "openai" ? `${providerInfo.model || "OpenAI"}` : providerInfo.semantic?.provider === "local" ? "Local declaration mapper" : providerInfo.provider || "fallback"}</span></div><div><strong>Text detection</strong><span>{providerInfo.detectionProviders?.length ? providerInfo.detectionProviders.join(" + ") : providerInfo.detectionProvider || "Unavailable"}</span></div><div><strong>Accepted violations</strong><span>{accepted.length}/{violations.length}</span></div></section>}

    {ocr && <section className="scan-review"><div className="section-heading"><div><h2>OCR extraction and rule review</h2><p>Correct OCR values and deselect false-positive violations before registration.</p></div></div><div className="ocr-fields-grid">{Object.entries(ocr).filter(([key, value]) => key !== "rawText" && key !== "semantic" && value && typeof value === "object" && value.status === "found").map(([key, value]) => <div key={key}><strong>{key.replace(/([A-Z])/g, " $1")}</strong><span>{String(value.value)}</span><small>{Math.round(Number(value.confidence || 0) * 100)}% confidence</small></div>)}</div>{complianceError && <div className="status-message">Rules Engine: {complianceError.message || complianceError}</div>}{compliance?.summary && <div className="ocr-summary">Rules: {compliance.summary.totalRulesEvaluated} · Passed: {compliance.summary.passed} · Violations: {compliance.summary.violations} · Unable to verify: {compliance.summary.unableToVerify}</div>}{violations.length > 0 && <div className="rule-review-panel"><div className="section-heading"><div><h3>Inspector review</h3><p>Uncheck a false positive. The original engine finding remains in the audit record.</p></div></div>{violations.map((finding) => <label className="rule-review-row" key={finding.findingId}><input type="checkbox" checked={acceptedFindingIds.includes(finding.findingId)} onChange={() => toggle(finding.findingId)} /><span><strong>{finding.ruleCode || finding.ruleNumber}</strong><small>{finding.ruleNumber ? `Rule ${finding.ruleNumber} · ` : ""}{finding.severity || "REVIEW"}</small><em>{finding.message || finding.violationReason || "Violation detected"}</em></span></label>)}<div className="ocr-summary">Accepted violations: <strong>{accepted.length}</strong> of {violations.length}</div></div>}</section>}

    {!showRegistration && <section className="scan-review registration-form"><div className="section-heading"><div><h2>Register product</h2><p>Manual registration still retains images but skips OCR.</p></div></div><button type="button" className="primary-button" onClick={() => setShowRegistration(true)}>Register Manually</button></section>}

    {showRegistration && <form className="scan-review registration-form" onSubmit={save}><div className="section-heading"><div><h2>Register offline product</h2><p>Select from your available offline categories, review the extracted data, then save.</p></div></div><div className="registration-grid"><label>Product name<input value={form.productName} onChange={(event) => update("productName", event.target.value)} required /></label><label>Brand / manufacturer<input value={form.brandName} onChange={(event) => update("brandName", event.target.value)} /></label><label>Net quantity<input value={form.netQuantity} onChange={(event) => update("netQuantity", event.target.value)} /></label><label>Unit<input value={form.unit} onChange={(event) => update("unit", event.target.value)} /></label><label>MRP<input type="number" min="0" step="0.01" value={form.mrp} onChange={(event) => update("mrp", event.target.value)} /></label><label>Barcode<input value={form.barcode} onChange={(event) => update("barcode", event.target.value)} /></label><label>Offline final category<select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)} required><option value="">Select an offline final category</option>{finalCategories.map((category) => <option value={category.id} key={category.id}>{category.path.map((item) => item.name).join(" → ")}</option>)}</select></label><label>Shop name<input value={form.shopName} onChange={(event) => update("shopName", event.target.value)} required /></label><label>Shop address<input value={form.shopAddress} onChange={(event) => update("shopAddress", event.target.value)} /></label><label>City<input value={form.shopCity} onChange={(event) => update("shopCity", event.target.value)} /></label><label>State<input value={form.shopState} onChange={(event) => update("shopState", event.target.value)} /></label><label className="span-2">Description<textarea value={form.description} onChange={(event) => update("description", event.target.value)} /></label><label className="span-2">Inspector notes<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label></div><div className="ocr-status-grid"><div><strong>Final status</strong><span>{accepted.length ? "VIOLATION" : compliance?.summary?.unableToVerify || ocr?.needsReview ? "NEEDS_REVIEW" : "OKAY"}</span></div><div><strong>Accepted violations</strong><span>{accepted.length}</span></div><div><strong>Images retained</strong><span>{images.length}</span></div></div><div className="scan-upload-actions"><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : "Register Offline Product"}</button><button type="button" className="secondary-button" onClick={() => setShowRegistration(false)}>Back</button></div></form>}

    {message && <div className="status-message">{message}</div>}
  </div>;
}

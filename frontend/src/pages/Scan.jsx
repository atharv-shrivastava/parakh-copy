import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/scan.css";

const API_URL = "http://localhost:5000/api";
const OCR_URL = "http://localhost:8080/api/ocr/analyze-and-evaluate";
const MAX_IMAGES = 4;
const emptyForm = { brandName: "", productName: "", description: "", netQuantity: "", unit: "", mrp: "", barcode: "", shopName: "", shopAddress: "", shopCity: "", shopState: "", notes: "" };

function flattenCategories(nodes, path = []) {
  return nodes.flatMap((node) => {
    const next = [...path, node];
    return [{ ...node, path: next }, ...flattenCategories(node.children || [], next)];
  });
}

function fieldValue(result, key) {
  const field = result?.[key];
  return field?.status === "found" && field.value !== null && field.value !== undefined ? String(field.value) : "";
}

async function fileToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not prepare the image for storage.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

function Scan() {
  const videoRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [ocr, setOcr] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const OCR_CLIENT_TIMEOUT_MS = 135000;

  useEffect(() => {
    apiFetch(`${API_URL}/categories/tree/all`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 401 ? "Please sign in first." : "Unable to load categories");
        return r.json();
      })
      .then(setCategories)
      .catch((e) => setMessage(e.message));
  }, []);

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      images.forEach((item) => {
        if (item?.url) URL.revokeObjectURL(item.url);
      });
    };
  }, [images]);

  const flatCategories = flattenCategories(categories);
  const finalCategories = flatCategories.filter((c) => Boolean(c.isFinalProductType) || !(c.children?.length));
  const selectedCategory = flatCategories.find((c) => c.id === selectedCategoryId);
  const suggestedCategory = useMemo(() => {
    const text = `${ocr?.rawText || ""} ${fieldValue(ocr, "productName")} ${fieldValue(ocr, "brandName")}`.toLowerCase();
    if (!text.trim()) return null;
    return finalCategories
      .filter((c) => text.includes(c.name.toLowerCase()) || text.includes(c.slug.replaceAll("-", " ")))
      .sort((a, b) => b.name.length - a.name.length)[0] || null;
  }, [ocr, finalCategories]);

  function addFiles(files) {
    const selected = Array.from(files || []).filter((file) => file instanceof File && file.type.startsWith("image/"));
    if (!selected.length) return;

    setImages((current) => {
      const remaining = MAX_IMAGES - current.length;
      if (remaining <= 0) return current;
      const accepted = selected.slice(0, remaining).map((file) => ({ file, url: URL.createObjectURL(file) }));
      return [...current, ...accepted];
    });

    if (images.length + selected.length > MAX_IMAGES) {
      setMessage(`You can retain a maximum of ${MAX_IMAGES} images.`);
      return;
    }

    setOcr(null);
    setCompliance(null);
    setMessage("Images ready for analysis.");
  }

  function handleImages(event) {
    addFiles(event.target.files);
    event.target.value = "";
  }

  async function openCamera() {
    setCameraError("");
    setMessage("");
    if (images.length >= MAX_IMAGES) return setMessage(`You can retain a maximum of ${MAX_IMAGES} images.`);
    if (!navigator.mediaDevices?.getUserMedia) return setCameraError("Camera access is not available in this browser. Use Upload Images instead.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e) {
      setCameraError(e.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access for localhost." : "Could not open the camera. Check that a webcam is available.");
    }
  }

  function closeCamera() {
    if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return setCameraError("Camera is still starting. Try again in a moment.");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return setCameraError("Could not capture the image.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return setCameraError("Could not capture the image.");
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      addFiles([file]);
      closeCamera();
    }, "image/jpeg", 0.88);
  }

  function removeImage(index) {
    setImages((current) => {
      const target = current[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return current.filter((_, i) => i !== index);
    });
    setOcr(null);
    setCompliance(null);
  }

  async function analyzeImages() {
    if (!images.length) return setMessage("Add at least one package image first.");
    setAnalyzing(true);
    setMessage("OCR service is extracting declarations and running the Rules Engine assessment...");
    try {
      const fd = new FormData();
      images.forEach(({ file }) => fd.append("images", file));
      fd.append("inspectionId", crypto.randomUUID());
      fd.append("productId", crypto.randomUUID());
      fd.append("inspectionDate", new Date().toISOString().slice(0, 10));
      fd.append("context", "physical_package");
      fd.append("commodityCategory", selectedCategory?.name || "packaged commodity");
      fd.append("consumerType", "general");
      fd.append("isImported", "false");
      fd.append("packageType", "retail");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OCR_CLIENT_TIMEOUT_MS);
      let response;
      try {
        response = await fetch(OCR_URL, { method: "POST", body: fd, signal: controller.signal });
      } catch (error) {
        if (error?.name === "AbortError") throw new Error("OCR analysis timed out. Check that Gemini and the Rules Engine are running, then try again.");
        throw new Error(`Could not reach OCR service: ${error.message}`);
      } finally {
        clearTimeout(timeout);
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Inspection analysis failed");
      setOcr(data.ocr);
      setCompliance(data.compliance || null);
      setForm((current) => ({
        ...current,
        brandName: fieldValue(data.ocr, "brandName") || fieldValue(data.ocr, "manufacturer"),
        productName: fieldValue(data.ocr, "productName"),
        netQuantity: fieldValue(data.ocr, "netQuantity"),
        unit: fieldValue(data.ocr, "unit"),
        mrp: fieldValue(data.ocr, "mrp"),
        barcode: fieldValue(data.ocr, "barcode"),
        description: [data.ocr.rawText, ...(data.ocr.otherDeclarations || [])].filter(Boolean).join("\n"),
      }));
      setMessage("Analysis complete. Review and register the product.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  function updateForm(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function saveProduct(event) {
    event.preventDefault();
    if (!selectedCategoryId || !selectedCategory) return setMessage("Final category is required.");
    if (!selectedCategory.isFinalProductType && selectedCategory.children?.length) return setMessage("Select a final category. Final categories cannot contain subcategories.");
    if (!form.shopName.trim()) return setMessage("Shop name is required.");
    setSaving(true);
    try {
      const imageUrls = await Promise.all(images.map(({ file }) => fileToDataUrl(file)));
      const rulesStatus = compliance?.overallStatus;
      const status = rulesStatus === "VIOLATION" || rulesStatus === "FAIL" ? "VIOLATION" : ocr?.needsReview ? "NEEDS_REVIEW" : "OKAY";
      const reason = status === "VIOLATION" ? "Rules Engine reported one or more compliance violations." : ocr?.needsReview ? "OCR contains low-confidence or unreadable fields and requires review." : "Automated OCR and Rules Engine assessment completed.";
      const response = await apiFetch(`${API_URL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, categoryId: selectedCategoryId, imageUrls, ocrData: ocr, complianceStatus: status, violationReason: reason, inspectionDate: new Date().toISOString() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save product");
      window.location.href = `/products/item/${data.id}`;
    } catch (e) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="scan-page">
    <div className="page-header"><p className="eyebrow">PRODUCT INSPECTION</p><h1>Scan Product</h1><p>Capture or upload package images, extract declarations, run the Legal Metrology Rules Engine, then register the inspected product.</p></div>
    <section className="scan-area"><div className="scan-icon">⌁</div><h2>Capture or upload package images</h2><p>Use the camera or choose up to {MAX_IMAGES} images showing different sides of the package.</p><div className="scan-upload-actions"><button type="button" className="primary-button" onClick={openCamera}>Open Camera</button><label className="secondary-button scan-file-button">Upload Images<input type="file" accept="image/*" multiple onChange={handleImages} hidden /></label></div><p className="scan-limit">{images.length}/{MAX_IMAGES} images selected</p>{cameraError && <div className="status-message">{cameraError}</div>}</section>
    {cameraOpen && <div className="camera-overlay" role="dialog" aria-modal="true"><div className="camera-modal"><div className="camera-header"><h2>Capture package image</h2><button type="button" onClick={closeCamera}>Close</button></div><video ref={videoRef} className="camera-video" autoPlay playsInline muted /><div className="camera-actions"><button type="button" className="primary-button" onClick={capturePhoto}>Capture Photo</button><button type="button" className="secondary-button" onClick={closeCamera}>Cancel</button></div></div></div>}
    {images.length > 0 && <section className="scan-review"><div className="section-heading"><div><h2>Evidence images</h2><p>All selected images will be retained on the registered product.</p></div></div><div className="scan-image-grid">{images.map(({ url, file }, i) => <div className="scan-image-card" key={`${file.name}-${i}`}><img src={url} alt={`Package evidence ${i + 1}`} /><button type="button" onClick={() => removeImage(i)}>Remove</button><span>{file.name}</span></div>)}</div><button type="button" className="primary-button" onClick={analyzeImages} disabled={analyzing}>{analyzing ? "Analyzing..." : "Analyze Images"}</button></section>}
    {ocr && <section className="scan-review"><div className="section-heading"><div><h2>OCR extraction and Rules Engine result</h2><p>Correct any OCR mistake before registration.</p></div></div><div className="ocr-status-grid"><div><strong>Rules Engine</strong><span>{compliance?.overallStatus || "Not evaluated"}</span></div><div><strong>OCR confidence</strong><span>{ocr.needsReview ? "Review required" : "Confident"}</span></div><div><strong>Unreadable fields</strong><span>{ocr.unreadableFields?.length || 0}</span></div></div>{compliance?.summary && <div className="ocr-summary">Rules: {compliance.summary.totalRulesEvaluated} · Passed: {compliance.summary.passed} · Violations: {compliance.summary.violations} · Unable to verify: {compliance.summary.unableToVerify}</div>}{compliance?.violations?.length > 0 && <div className="status-message">{compliance.violations.map((v, i) => <div key={i}>{v.message || v.reason || JSON.stringify(v)}</div>)}</div>}<label>Raw OCR<textarea value={ocr.rawText || ""} onChange={(e) => setOcr((c) => ({ ...c, rawText: e.target.value }))} /></label>{suggestedCategory && <div className="scan-suggestion"><span>Suggested final category: <strong>{suggestedCategory.path.map((x) => x.name).join(" → ")}</strong></span><button type="button" className="secondary-button" onClick={() => setSelectedCategoryId(suggestedCategory.id)}>Use suggestion</button></div>}</section>}
    {ocr && <form className="scan-review registration-form" onSubmit={saveProduct}><div className="section-heading"><div><h2>Register product</h2><p>OCR fills these fields, but manual correction is allowed.</p></div></div><div className="form-grid"><label>Brand / Manufacturer *<input required value={form.brandName} onChange={(e) => updateForm("brandName", e.target.value)} /></label><label>Product name *<input required value={form.productName} onChange={(e) => updateForm("productName", e.target.value)} /></label><label>Quantity / volume / pieces *<input required value={form.netQuantity} onChange={(e) => updateForm("netQuantity", e.target.value)} /></label><label>Unit *<select required value={form.unit} onChange={(e) => updateForm("unit", e.target.value)}><option value="">Select</option><option value="mg">mg</option><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="pcs">pcs</option><option value="dozen">dozen</option><option value="m">m</option></select></label><label>MRP *<input required type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => updateForm("mrp", e.target.value)} /></label><label>Barcode<input value={form.barcode} onChange={(e) => updateForm("barcode", e.target.value)} /></label><label className="full-width">Final category *<select required value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}><option value="">Select a final category</option>{finalCategories.map((c) => <option key={c.id} value={c.id}>{c.path.map((x) => x.name).join(" → ")}</option>)}</select></label><label>Shop name *<input required value={form.shopName} onChange={(e) => updateForm("shopName", e.target.value)} /></label><label>Shop address<input value={form.shopAddress} onChange={(e) => updateForm("shopAddress", e.target.value)} /></label><label>City<input value={form.shopCity} onChange={(e) => updateForm("shopCity", e.target.value)} /></label><label>State<input value={form.shopState} onChange={(e) => updateForm("shopState", e.target.value)} /></label><label className="full-width">Notes<textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} /></label></div><button className="primary-button" disabled={saving}>{saving ? "Registering..." : "Register Product"}</button></form>}
    {message && <div className="status-message">{message}</div>}<Link className="back-link" to="/history">View inspection history →</Link>
  </div>;
}

export default Scan;

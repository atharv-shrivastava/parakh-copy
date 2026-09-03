import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/auth";
import "../styles/visual-verification.css";

const API_URL = "http://localhost:5000/api";
const OCR_URL = "http://localhost:8080";
const MAX_IMAGES = 4;
const TARGET_FIELDS = ["productName", "brandName", "netQuantity", "mrp", "manufacturer", "manufacturerAddress", "importer", "importerAddress", "consumerCarePhone", "consumerCareEmail", "countryOfOrigin"];

function fieldText(field) {
  return field?.status === "found" && field?.value != null ? String(field.value) : "";
}

function collectBox(field) {
  const evidence = Array.isArray(field?.evidence) ? field.evidence : [];
  for (const item of evidence) {
    const box = item?.boundingBox || item?.bbox || item?.box;
    if (box && ["left", "top", "width", "height"].every((key) => Number.isFinite(Number(box[key])))) {
      return { left: Number(box.left), top: Number(box.top), width: Number(box.width), height: Number(box.height) };
    }
  }
  return null;
}

async function imageMetrics(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) { bitmap.close(); throw new Error("Could not inspect image pixels."); }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0; let sumSq = 0; let edges = 0; let samples = 0; let lapSum = 0; let lapSq = 0;
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const g = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      gray[y * width + x] = g; sum += g; sumSq += g * g; samples += 1;
    }
  }
  const mean = sum / samples;
  const variance = Math.max(0, sumSq / samples - mean * mean);
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const i = y * width + x;
      const center = gray[i];
      const left = gray[i - 1]; const right = gray[i + 1]; const up = gray[i - width]; const down = gray[i + width];
      const gx = Math.abs(right - left); const gy = Math.abs(down - up);
      if (gx + gy > 55) edges += 1;
      const lap = left + right + up + down - 4 * center;
      lapSum += lap; lapSq += lap * lap;
    }
  }
  const lapSamples = Math.max(1, Math.floor(((width - 2) * (height - 2)) / 4));
  const lapVariance = Math.max(0, lapSq / lapSamples - Math.pow(lapSum / lapSamples, 2));
  const contrast = Math.sqrt(variance);
  const edgeDensity = edges / Math.max(1, Math.floor(((width - 2) * (height - 2)) / 4));
  const sharpness = Math.min(100, Math.max(0, lapVariance / 7));
  const contrastScore = Math.min(100, Math.max(0, contrast * 2.2));
  const readabilityScore = Math.round(Math.min(100, 0.55 * sharpness + 0.35 * contrastScore + 10 * Math.min(1, edgeDensity * 6)));
  return { width, height, sharpness, contrastScore, edgeDensity, readabilityScore };
}

export default function VisualVerification() {
  const [items, setItems] = useState([]);
  const [ocr, setOcr] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [referenceWidthMm, setReferenceWidthMm] = useState(0);
  const [selectedField, setSelectedField] = useState("mrp");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => () => items.forEach((item) => URL.revokeObjectURL(item.url)), [items]);

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
    const next = files.slice(0, MAX_IMAGES - items.length).map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (!next.length) return;
    setItems((current) => [...current, ...next]); setOcr(null); setCompliance(null); setMetrics([]); setMessage("Images ready.");
  }

  function remove(index) {
    setItems((current) => current.filter((item, i) => { if (i === index) URL.revokeObjectURL(item.url); return i !== index; }));
    setOcr(null); setCompliance(null); setMetrics([]);
  }

  async function analyze() {
    if (!items.length) return setMessage("Add at least one package image.");
    setBusy(true); setMessage("Running the existing OCR service and visual checks...");
    try {
      const form = new FormData(); items.forEach((item) => form.append("images", item.file));
      const ocrResponse = await apiFetch(`${OCR_URL}/api/ocr/analyze`, { method: "POST", body: form });
      const ocrData = await ocrResponse.json().catch(() => ({}));
      if (!ocrResponse.ok || !ocrData.result) throw new Error(ocrData.error || "OCR analysis failed.");
      const extracted = ocrData.result;
      const imageMetrics = await Promise.all(items.map((item) => imageMetrics(item.file)));
      setMetrics(imageMetrics); setOcr(extracted);
      const response = await apiFetch(`${OCR_URL}/api/ocr/evaluate-structured`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ocr: extracted,
          inspectionId: crypto.randomUUID(), productId: crypto.randomUUID(), inspectionDate: new Date().toISOString().slice(0, 10),
          context: "physical_package", commodityCategory: "packaged commodity", consumerType: "general", isImported: false, packageType: "retail",
        }),
      });
      const complianceData = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(complianceData.error || "Rules Engine evaluation failed.");
      setCompliance(complianceData.compliance || null); setMessage("OCR, visual checks and the existing Rules Engine evaluation are complete.");
    } catch (error) { setMessage(error.message || "Visual verification failed."); } finally { setBusy(false); }
  }

  const fieldRows = useMemo(() => TARGET_FIELDS.map((key) => ({
    key, value: fieldText(ocr?.[key]), confidence: Number(ocr?.[key]?.confidence || 0), box: collectBox(ocr?.[key]),
  })).filter((row) => row.value || row.box), [ocr]);

  const selected = fieldRows.find((row) => row.key === selectedField) || fieldRows[0];
  const selectedMetric = metrics[0];
  const estimatedTextMm = selected?.box && referenceWidthMm > 0 && selectedMetric?.width
    ? (selected.box.height / selectedMetric.width) * referenceWidthMm
    : null;
  const readability = selectedMetric ? (selectedMetric.readabilityScore >= 70 ? "GOOD" : selectedMetric.readabilityScore >= 45 ? "FAIR" : "POOR") : "NOT ANALYZED";
  const violationCount = compliance?.summary?.violations || 0;
  const unableCount = compliance?.summary?.unableToVerify || 0;

  return <div className="visual-verification-page">
    <div className="page-header"><p className="eyebrow">VISUAL DECLARATION VERIFICATION</p><h1>Readability & Font-Size Check</h1><p>Uses the existing OCR service, browser image analysis and the existing Rules Engine. Automatic physical font-size is reported only when a reference dimension is available.</p></div>

    <section className="visual-panel">
      <div className="visual-panel-header"><div><h2>1. Package evidence</h2><p>Upload up to {MAX_IMAGES} images. Use a clear, front-facing photo when possible.</p></div></div>
      <label className="visual-upload">Upload package images<input type="file" accept="image/*" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} hidden /></label>
      <div className="visual-image-grid">{items.map((item, index) => <div className="visual-image-card" key={`${item.file.name}-${index}`}><img src={item.url} alt={`Package ${index + 1}`} /><button type="button" onClick={() => remove(index)}>Remove</button><span>{item.file.name}</span></div>)}</div>
      <button className="primary-button" type="button" onClick={analyze} disabled={busy || !items.length}>{busy ? "Analyzing..." : "Analyze evidence"}</button>
    </section>

    {message && <div className="status-message">{message}</div>}

    {metrics.length > 0 && <section className="visual-panel"><div className="visual-panel-header"><div><h2>2. Image quality</h2><p>These are screening metrics, not a legal determination.</p></div></div><div className="visual-metric-grid">{metrics.map((metric, index) => <div className="visual-metric-card" key={index}><strong>Image {index + 1}</strong><span>{metric.width} × {metric.height}px</span><span>Readability {metric.readabilityScore}/100</span><span>Sharpness {Math.round(metric.sharpness)}/100</span><span>Contrast {Math.round(metric.contrastScore)}/100</span></div>)}</div></section>}

    {ocr && <section className="visual-panel"><div className="visual-panel-header"><div><h2>3. Declaration analysis</h2><p>Select a detected declaration to inspect its confidence and visual evidence.</p></div></div><div className="visual-field-layout"><div className="visual-field-list">{fieldRows.map((row) => <button type="button" className={row.key === selected?.key ? "visual-field active" : "visual-field"} key={row.key} onClick={() => setSelectedField(row.key)}><strong>{row.key.replace(/([A-Z])/g, " $1")}</strong><span>{row.value || "Detected region"}</span><small>{Math.round(row.confidence * 100)}% OCR confidence {row.box ? "· region detected" : "· no region"}</small></button>)}</div><div className="visual-detail-card"><h3>{selected?.key?.replace(/([A-Z])/g, " $1") || "Declaration"}</h3><p>{selected?.value || "No structured value returned."}</p><label>Reference package width (mm)<input type="number" min="0" step="0.1" value={referenceWidthMm || ""} onChange={(event) => setReferenceWidthMm(Number(event.target.value) || 0)} placeholder="Optional" /></label><div className="visual-result-grid"><div><strong>Readability</strong><span>{readability}</span></div><div><strong>OCR confidence</strong><span>{selected ? `${Math.round(selected.confidence * 100)}%` : "-"}</span></div><div><strong>Text region</strong><span>{selected?.box ? `${Math.round(selected.box.width)} × ${Math.round(selected.box.height)} px` : "Not available"}</span></div><div><strong>Estimated text height</strong><span>{estimatedTextMm != null ? `${estimatedTextMm.toFixed(2)} mm · approximate` : "Needs calibration"}</span></div></div><div className="visual-notice">{selected?.box && estimatedTextMm != null ? "The font-size estimate is derived from the selected image's pixel scale and your reference dimension. Perspective and camera angle can affect it, so treat it as screening evidence." : "No physical font-size is claimed without a usable text region and reference dimension. The officer can mark this check for manual verification."}</div></div></div></section>}

    {compliance && <section className="visual-panel"><div className="visual-panel-header"><div><h2>4. Existing Rules Engine result</h2><p>No second compliance engine is used here.</p></div></div><div className="visual-summary-grid"><div><strong>Rules evaluated</strong><span>{compliance.summary?.totalRulesEvaluated || 0}</span></div><div><strong>Violations</strong><span>{violationCount}</span></div><div><strong>Unable to verify</strong><span>{unableCount}</span></div><div><strong>Overall</strong><span>{violationCount ? "Potential non-compliance" : unableCount ? "Needs verification" : "No detected violation"}</span></div></div>{Array.isArray(compliance.findings) && compliance.findings.length > 0 && <div className="visual-findings">{compliance.findings.slice(0, 12).map((finding) => <div key={finding.findingId} className="visual-finding"><strong>{finding.ruleCode || finding.ruleNumber}</strong><span>{finding.message}</span><small>{finding.status} · {finding.field || "inspection"}</small></div>)}</div>}</section>}
  </div>;
}

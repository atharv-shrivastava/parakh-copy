import { useEffect, useRef, useState } from "react";
import { API_URL } from "../context/AuthContext";
import "../styles/ocr.css";

const MAX_IMAGES = 6;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const fields = [
  ["productName", "Product name"], ["brandName", "Brand name"], ["manufacturer", "Manufacturer"],
  ["manufacturerAddress", "Manufacturer address"], ["packer", "Packer"], ["importer", "Importer"],
  ["netQuantity", "Net quantity"], ["unit", "Unit"], ["mrp", "MRP"], ["currency", "Currency"],
  ["dateOfManufacture", "Manufacturing date"], ["dateOfPacking", "Packing date"], ["bestBefore", "Best before"],
  ["expiryDate", "Expiry date"], ["batchNumber", "Batch / lot number"], ["consumerCarePhone", "Consumer care phone"],
  ["consumerCareEmail", "Consumer care email"], ["countryOfOrigin", "Country of origin"],
  ["fssaiLicenseNumber", "FSSAI license number"], ["barcode", "Barcode / GTIN candidate"],
];

export default function OcrPanel({ token, onConfirm }) {
  const inputRef = useRef(null);
  const [images, setImages] = useState([]);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => () => images.forEach((image) => URL.revokeObjectURL(image.preview)), [images]);

  function addImages(fileList) {
    const incoming = Array.from(fileList).filter((file) => ACCEPTED.includes(file.type));
    const slots = MAX_IMAGES - images.length;
    if (slots <= 0) return;
    setImages((current) => [...current, ...incoming.slice(0, slots).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    setError("");
  }

  function removeImage(index) {
    setImages((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, i) => i !== index);
    });
  }

  async function analyze() {
    if (!images.length || !token) return;
    setStatus("analyzing"); setError("");
    const form = new FormData();
    images.forEach(({ file }) => form.append("images", file, file.name));
    try {
      const response = await fetch(`${API_URL}/api/ocr/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || data.error || "OCR analysis failed");
      setResult(data.result); setStatus("success");
    } catch (err) {
      setError(err.message); setStatus("error");
    }
  }

  function updateField(key, value) {
    setResult((current) => ({ ...current, [key]: { ...current[key], value } }));
  }

  function confirm() {
    if (!result) return;
    const mapped = {
      brandName: result.brandName?.value ?? "",
      productName: result.productName?.value ?? "",
      netQuantity: result.netQuantity?.value ?? "",
      unit: result.unit?.value ?? "",
      mrp: result.mrp?.value ?? "",
      barcode: result.barcode?.value ?? "",
      description: [result.manufacturer?.value, result.manufacturerAddress?.value, result.otherDeclarations?.join("; ")].filter(Boolean).join("\n"),
    };
    onConfirm(mapped, result);
  }

  return (
    <section className="ocr-card">
      <div className="section-heading"><div><h2>AI package OCR</h2><p>Upload clear photos of every side containing printed declarations. AI extracts facts only. You review them before saving.</p></div></div>
      <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} multiple capture="environment" hidden onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
      <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()} disabled={status === "analyzing" || images.length >= MAX_IMAGES}>Add package photos</button>
      {images.length > 0 && <div className="ocr-previews">{images.map((image, index) => <div className="ocr-preview" key={image.preview}><img src={image.preview} alt={`Package side ${index + 1}`} /><button type="button" onClick={() => removeImage(index)} disabled={status === "analyzing"}>×</button></div>)}</div>}
      <div className="ocr-actions"><button type="button" className="primary-button" onClick={analyze} disabled={!images.length || status === "analyzing"}>{status === "analyzing" ? "Analyzing package..." : "Analyze package"}</button>{result && <button type="button" className="secondary-button" onClick={confirm}>Use extracted details</button>}</div>
      {error && <div className="status-message">{error}</div>}
      {result && <div className="ocr-results">
        {result.needsReview && <div className="ocr-warning">Some fields need manual review. Low-confidence, unreadable, or ambiguous values are highlighted.</div>}
        {fields.map(([key, label]) => { const field = result[key]; const pct = field ? Math.round((field.confidence || 0) * 100) : 0; return <label className="ocr-field" key={key}><span>{label}<small>{field?.status === "found" ? `${pct}% confidence` : field?.status || "not found"}</small></span><input value={field?.value ?? ""} placeholder={field?.status === "absent" ? "Not found on package" : "Review value"} onChange={(e) => updateField(key, e.target.value)} />{field?.evidence && <em>Evidence: {field.evidence}</em>}</label>; })}
        {result.otherDeclarations?.length > 0 && <div className="ocr-declarations"><strong>Other declarations</strong><ul>{result.otherDeclarations.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      </div>}
    </section>
  );
}

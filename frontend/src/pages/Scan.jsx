import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/scan.css";

const API_URL = "http://localhost:5000/api";
const OCR_URL = "http://localhost:8080/api/ocr/analyze";
const MAX_IMAGES = 4;

const emptyForm = { brandName: "", productName: "", description: "", netQuantity: "", unit: "", mrp: "", barcode: "" };

function flattenCategories(nodes, path = []) {
  return nodes.flatMap((node) => {
    const nextPath = [...path, node];
    return [{ ...node, path: nextPath }, ...flattenCategories(node.children ?? [], nextPath)];
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
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

function Scan() {
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [ocr, setOcr] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/categories/tree/all`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load categories");
        return response.json();
      })
      .then(setCategories)
      .catch((error) => setMessage(error.message));
  }, []);

  const flatCategories = flattenCategories(categories);
  const finalCategories = flatCategories.filter((category) => !(category.children?.length));
  const selectedCategory = flatCategories.find((item) => item.id === selectedCategoryId);
  const ocrText = ocr?.rawText || "";

  const suggestedCategory = useMemo(() => {
    const text = `${ocrText} ${fieldValue(ocr, "productName")} ${fieldValue(ocr, "brandName")}`.toLowerCase();
    if (!text.trim()) return null;
    return finalCategories
      .filter((category) => text.includes(category.name.toLowerCase()) || text.includes(category.slug.replaceAll("-", " ")))
      .sort((a, b) => b.name.length - a.name.length)[0] ?? null;
  }, [ocrText, ocr, finalCategories]);

  function handleImages(event) {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    if (selected.length > MAX_IMAGES) {
      setMessage(`Select at most ${MAX_IMAGES} images.`);
      return;
    }
    setImages(selected.map((file) => ({ file, url: URL.createObjectURL(file) })));
    setOcr(null);
    setMessage(`${selected.length} image${selected.length > 1 ? "s" : ""} ready for analysis.`);
  }

  function removeImage(index) {
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function analyzeImages() {
    if (!images.length) {
      setMessage("Upload at least one product image first.");
      return;
    }
    setAnalyzing(true);
    setMessage("Gemini is analyzing the package images...");
    try {
      const formData = new FormData();
      images.forEach(({ file }) => formData.append("images", file));

      const response = await fetch(OCR_URL, { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "OCR analysis failed");

      const result = data.result ?? data.ocr;
      if (!result) throw new Error("OCR service returned no analysis result");

      setOcr(result);
      setForm((current) => ({
        ...current,
        brandName: fieldValue(result, "brandName") || fieldValue(result, "manufacturer"),
        productName: fieldValue(result, "productName"),
        netQuantity: fieldValue(result, "netQuantity"),
        unit: fieldValue(result, "unit"),
        mrp: fieldValue(result, "mrp"),
        barcode: fieldValue(result, "barcode"),
        description: [result.rawText, ...(result.otherDeclarations || [])].filter(Boolean).join("\n"),
      }));
      setMessage("OCR analysis complete. Review the extracted fields before saving.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAnalyzing(false);
    }
  }

  function applySuggestion() {
    if (!suggestedCategory) {
      setMessage("No matching final product type was found. Choose one manually.");
      return;
    }
    setSelectedCategoryId(suggestedCategory.id);
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!selectedCategoryId || !selectedCategory || selectedCategory.children?.length) {
      setMessage("Select a final product type. Any leaf category can be used as the final product type.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const imageUrls = await Promise.all(images.map(({ file }) => fileToDataUrl(file)));
      const status = ocr?.needsReview ? "NEEDS_REVIEW" : "OKAY";
      const reason = ocr?.needsReview ? "OCR contains low-confidence or unreadable fields and requires inspector review." : "Automated OCR screening passed; final legal verification remains with the inspector.";

      const response = await fetch(`${API_URL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, categoryId: selectedCategoryId, imageUrls, ocrData: ocr, complianceStatus: status, violationReason: reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save product");
      setMessage(`Inspection saved. ${data.complianceStatus}. Opening the product record...`);
      window.location.href = `/products/item/${data.id}`;
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="scan-page">
      <div className="page-header">
        <p className="eyebrow">PRODUCT INSPECTION</p>
        <h1>Scan Product</h1>
        <p>Capture or upload up to four package images, analyze them with Gemini, verify the extracted declarations, and review the result.</p>
      </div>

      <section className="scan-area">
        <div className="scan-icon">⌁</div>
        <h2>Capture or upload package images</h2>
        <p>Use the camera on a phone or select up to {MAX_IMAGES} clear images of different sides of the package.</p>
        <div className="scan-upload-actions">
          <label className="primary-button scan-file-button">Open Camera<input type="file" accept="image/*" capture="environment" onChange={handleImages} hidden /></label>
          <label className="secondary-button scan-file-button">Upload Images<input type="file" accept="image/*" multiple onChange={handleImages} hidden /></label>
        </div>
        <p className="scan-limit">{images.length}/{MAX_IMAGES} images selected</p>
      </section>

      {images.length > 0 && (
        <section className="scan-review">
          <div className="section-heading"><div><h2>Evidence images</h2><p>These are the images sent to Gemini for OCR.</p></div></div>
          <div className="scan-image-grid">
            {images.map(({ url, file }, index) => (
              <div className="scan-image-card" key={`${file.name}-${index}`}><img src={url} alt={`Package evidence ${index + 1}`} /><button type="button" onClick={() => removeImage(index)}>Remove</button><span>{file.name}</span></div>
            ))}
          </div>
          <button type="button" className="primary-button" onClick={analyzeImages} disabled={analyzing}>{analyzing ? "Analyzing images..." : "Analyze Images"}</button>
        </section>
      )}

      {ocr && (
        <section className="scan-review">
          <div className="section-heading"><div><h2>OCR extraction</h2><p>Every extracted value remains editable so an inspector can correct OCR mistakes.</p></div></div>
          <div className="ocr-status-grid">
            <div><strong>OCR review</strong><span>{ocr.needsReview ? "Review required" : "Confident"}</span></div>
            <div><strong>Unreadable fields</strong><span>{ocr.unreadableFields?.length || 0}</span></div>
            <div><strong>Warnings</strong><span>{ocr.warnings?.length || 0}</span></div>
          </div>
          {ocr.warnings?.length > 0 && <div className="status-message">{ocr.warnings.join(" ")}</div>}
          <label>OCR raw text<textarea value={ocr.rawText || ""} onChange={(event) => setOcr((current) => ({ ...current, rawText: event.target.value }))} /></label>
          {suggestedCategory && <div className="scan-suggestion"><span>Suggested final type: <strong>{suggestedCategory.path.map((item) => item.name).join(" → ")}</strong></span><button type="button" className="secondary-button" onClick={applySuggestion}>Use suggestion</button></div>}
        </section>
      )}

      {ocr && (
        <form className="scan-review registration-form" onSubmit={saveProduct}>
          <div className="section-heading"><div><h2>Product information</h2><p>Choose any leaf category as the final product type.</p></div></div>
          <div className="form-grid">
            <label>Company / Manufacturer / Brand *<input required value={form.brandName} onChange={(e) => updateForm("brandName", e.target.value)} /></label>
            <label>Product name *<input required value={form.productName} onChange={(e) => updateForm("productName", e.target.value)} /></label>
            <label>Weight / quantity / volume *<input required value={form.netQuantity} onChange={(e) => updateForm("netQuantity", e.target.value)} /></label>
            <label>Measuring unit *<select required value={form.unit} onChange={(e) => updateForm("unit", e.target.value)}><option value="">Select unit</option><option value="g">g</option><option value="kg">kg</option><option value="mg">mg</option><option value="ml">ml</option><option value="L">L</option><option value="pcs">pcs</option><option value="m">m</option></select></label>
            <label>MRP *<input required type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => updateForm("mrp", e.target.value)} /></label>
            <label>Barcode<input value={form.barcode} onChange={(e) => updateForm("barcode", e.target.value)} /></label>
            <label className="full-width">Final product type *<select required value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}><option value="">Select final product type</option>{finalCategories.map((category) => <option key={category.id} value={category.id}>{category.path.map((item) => item.name).join(" → ")}</option>)}</select></label>
            <label className="full-width">Inspection notes<textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} /></label>
          </div>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving inspection..." : "Save Product & Inspection"}</button>
        </form>
      )}

      {message && <div className="status-message">{message}</div>}
      <section className="scan-info"><h2>PARAKH inspection coverage</h2><div className="check-grid"><div className="check-item"><strong>Mandatory declarations</strong><span>Manufacturer/packer/importer, product identity, quantity, MRP, dates and consumer-care evidence.</span></div><div className="check-item"><strong>Visual evidence</strong><span>Up to four package photographs are retained with the product record.</span></div><div className="check-item"><strong>OCR analysis</strong><span>Package images are analyzed by the standalone OCR service using Gemini vision.</span></div><div className="check-item"><strong>Inspection history</strong><span>Saved products appear in the searchable product repository and history.</span></div></div></section>
      <Link className="back-link" to="/history">View inspection history →</Link>
    </div>
  );
}

export default Scan;

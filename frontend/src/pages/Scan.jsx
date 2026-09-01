import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/scan.css";

const API_URL = "http://localhost:5000/api";

const emptyForm = {
  brandName: "",
  productName: "",
  description: "",
  netQuantity: "",
  unit: "",
  mrp: "",
  barcode: "",
};

function flattenCategories(nodes, path = []) {
  return nodes.flatMap((node) => {
    const nextPath = [...path, node];
    return [
      { ...node, path: nextPath },
      ...flattenCategories(node.children ?? [], nextPath),
    ];
  });
}

function Scan() {
  const [categories, setCategories] = useState([]);
  const [imageName, setImageName] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/categories/tree/all`)
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(setCategories)
      .catch(() => setMessage("Unable to load categories."));
  }, []);

  const flatCategories = flattenCategories(categories);

  const suggestedCategory = useMemo(() => {
    const text = ocrText.toLowerCase();
    if (!text) return null;
    return flatCategories
      .filter((category) =>
        text.includes(category.name.toLowerCase()) ||
        text.includes(category.slug.replaceAll("-", " "))
      )
      .sort((a, b) => b.name.length - a.name.length)[0] ?? null;
  }, [ocrText, flatCategories]);

  const selectedCategory = flatCategories.find((item) => item.id === selectedCategoryId);
  const selectedIsFinalType = selectedCategory?.path?.length === 3;

  function handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageName(file.name);
    setMessage("Image selected. Enter or review the OCR text, then confirm the destination category.");
  }

  function applySuggestion() {
    if (!suggestedCategory) {
      setMessage("No confident category suggestion was found. Choose one manually.");
      return;
    }
    setSelectedCategoryId(suggestedCategory.id);
    setMessage(`Category selected: ${suggestedCategory.path.map((item) => item.name).join(" → ")}`);
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProduct(event) {
    event.preventDefault();

    if (!selectedCategoryId || !selectedIsFinalType) {
      setMessage("Select a final product type, such as Food → Ready to Eat → Biscuits.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, categoryId: selectedCategoryId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save product");

      setMessage(
        data.complianceStatus === "VIOLATION"
          ? `Saved to ${selectedCategory.name}. VIOLATION: ${data.violationReason || "Review required."}`
          : `Saved to ${selectedCategory.name}. Compliance result: ${data.complianceStatus}.`
      );
      setForm(emptyForm);
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
        <p>Scan the label, let PARAKH suggest the category, confirm it, then enter the product data while performing the inspection.</p>
      </div>

      <section className="scan-area">
        <div className="scan-icon">+</div>
        <h2>Upload product image</h2>
        <p>{imageName || "Take a clear photograph of the product label or upload an existing image."}</p>
        <label className="primary-button scan-file-button">
          Upload Image
          <input type="file" accept="image/*" onChange={handleImage} hidden />
        </label>
      </section>

      <section className="scan-review">
        <div className="section-heading">
          <div>
            <h2>OCR and category assignment</h2>
            <p>Automatic classification is a suggestion. The inspector can always correct it.</p>
          </div>
        </div>

        <label>
          OCR text
          <textarea value={ocrText} onChange={(event) => setOcrText(event.target.value)} placeholder="OCR output will appear here..." />
        </label>

        {suggestedCategory && (
          <div className="scan-suggestion">
            <span>Suggested: <strong>{suggestedCategory.path.map((item) => item.name).join(" → ")}</strong></span>
            <button type="button" className="secondary-button" onClick={applySuggestion}>Use suggestion</button>
          </div>
        )}

        <label>
          Confirm destination category
          <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>
            <option value="">Select final product type</option>
            {flatCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {"— ".repeat(category.path.length - 1)}{category.path.map((item) => item.name).join(" → ")}
              </option>
            ))}
          </select>
        </label>

        {selectedCategoryId && !selectedIsFinalType && (
          <div className="status-message">This is not a product type yet. Select the final third-level category.</div>
        )}
      </section>

      {selectedIsFinalType && (
        <form className="scan-review registration-form" onSubmit={saveProduct}>
          <div className="section-heading">
            <div>
              <h2>Product information</h2>
              <p>Destination: {selectedCategory.path.map((item) => item.name).join(" → ")}</p>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Company / Manufacturer / Brand *
              <input required value={form.brandName} onChange={(e) => updateForm("brandName", e.target.value)} placeholder="Company name" />
            </label>
            <label>
              Product name *
              <input required value={form.productName} onChange={(e) => updateForm("productName", e.target.value)} placeholder="Product name" />
            </label>
            <label>
              Weight / quantity / volume *
              <input required value={form.netQuantity} onChange={(e) => updateForm("netQuantity", e.target.value)} placeholder="e.g. 100" />
            </label>
            <label>
              Measuring unit *
              <select required value={form.unit} onChange={(e) => updateForm("unit", e.target.value)}>
                <option value="">Select unit</option>
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="mg">mg</option>
                <option value="ml">ml</option>
                <option value="L">L</option>
                <option value="pcs">pcs</option>
                <option value="m">m</option>
              </select>
            </label>
            <label>
              MRP *
              <input required type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => updateForm("mrp", e.target.value)} placeholder="MRP" />
            </label>
            <label>
              Barcode
              <input value={form.barcode} onChange={(e) => updateForm("barcode", e.target.value)} placeholder="Barcode / GTIN" />
            </label>
            <label className="full-width">
              Other inspection details
              <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="Relevant declarations or observations..." />
            </label>
          </div>

          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving inspection..." : "Save Scanned Product & Verify"}
          </button>
        </form>
      )}

      {message && <div className="status-message">{message}</div>}

      <section className="scan-info">
        <h2>What PARAKH checks</h2>
        <div className="check-grid">
          <div className="check-item"><strong>Mandatory declarations</strong><span>Checks required packaged-commodity information.</span></div>
          <div className="check-item"><strong>Pricing information</strong><span>Checks MRP and related declarations.</span></div>
          <div className="check-item"><strong>Quantity information</strong><span>Supports weight, volume and count-based quantities.</span></div>
          <div className="check-item"><strong>Violation result</strong><span>Shows products that fail automated screening.</span></div>
        </div>
      </section>
    </div>
  );
}

export default Scan;

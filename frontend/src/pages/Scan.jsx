import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/scan.css";

const API_URL = "http://localhost:5000/api";

function flattenCategories(nodes, path = []) {
  return nodes.flatMap((node) => {
    const nextPath = [...path, node];
    return [{ ...node, path: nextPath }, ...flattenCategories(node.children ?? [], nextPath)];
  });
}

function Scan() {
  const [categories, setCategories] = useState([]);
  const [imageName, setImageName] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/categories/tree/all`)
      .then((response) => response.json())
      .then(setCategories)
      .catch(() => setMessage("Unable to load categories."));
  }, []);

  const flatCategories = flattenCategories(categories);
  const suggestedCategory = flatCategories
    .filter((category) => {
      const text = ocrText.toLowerCase();
      return text.includes(category.name.toLowerCase()) || text.includes(category.slug.replaceAll("-", " "));
    })
    .sort((a, b) => b.name.length - a.name.length)[0];

  function handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageName(file.name);
    setMessage("Image selected. The OCR provider can populate the review text, and the inspector can correct the suggested category before saving.");
  }

  function applySuggestion() {
    if (!suggestedCategory) {
      setMessage("No confident category suggestion was found. Choose one manually.");
      return;
    }
    setSelectedCategoryId(suggestedCategory.id);
    setMessage(`Suggested category selected: ${suggestedCategory.path.map((item) => item.name).join(" → ")}`);
  }

  return (
    <div className="scan-page">
      <div className="page-header">
        <p className="eyebrow">PRODUCT INSPECTION</p>
        <h1>Scan Product</h1>
        <p>Upload a label, review OCR output, confirm its category, and continue to registration.</p>
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
            <h2>OCR review and category assignment</h2>
            <p>Automatic classification is only a suggestion. The inspector can always define the correct destination.</p>
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
          Define category manually
          <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>
            <option value="">Select category</option>
            {flatCategories.map((category) => <option key={category.id} value={category.id}>{"— ".repeat(category.path.length - 1)}{category.name}</option>)}
          </select>
        </label>

        {selectedCategoryId && (
          <Link to={`/products/register?parentId=${selectedCategoryId}`} className="register-product-button">
            Continue to Product Registration
          </Link>
        )}

        {message && <div className="status-message">{message}</div>}
      </section>

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

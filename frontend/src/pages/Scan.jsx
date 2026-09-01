import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/scan.css";

const API_URL = "http://localhost:5000/api";

function Scan() {
  const [categories, setCategories] = useState([]);
  const [imageName, setImageName] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/categories`)
      .then((response) => response.json())
      .then(setCategories)
      .catch(() => setMessage("Unable to load categories."));
  }, []);

  function handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageName(file.name);
    setMessage("Image ready for OCR review. Confirm its category before saving.");
  }

  const suggestedCategory = categories.find((category) => {
    const text = ocrText.toLowerCase();
    return text.includes(category.name.toLowerCase()) || text.includes(category.slug.replaceAll("-", " "));
  });

  function applySuggestion() {
    if (!suggestedCategory) {
      setMessage("No confident category suggestion was found. Choose one manually.");
      return;
    }
    setSelectedCategoryId(suggestedCategory.id);
    setMessage(`Suggested category selected: ${suggestedCategory.name}`);
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
            <p>The inspector can accept a suggestion or manually define the category.</p>
          </div>
        </div>

        <label>
          OCR text
          <textarea value={ocrText} onChange={(event) => setOcrText(event.target.value)} placeholder="OCR output will appear here..." />
        </label>

        {suggestedCategory && (
          <div className="scan-suggestion">
            Suggested category: <strong>{suggestedCategory.name}</strong>
            <button type="button" className="secondary-button" onClick={applySuggestion}>Use suggestion</button>
          </div>
        )}

        <label>
          Define category manually
          <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>
            <option value="">Select category</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
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

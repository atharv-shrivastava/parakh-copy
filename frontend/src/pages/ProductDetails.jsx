import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function ProductDetails() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/products/${id}`)
      .then((response) => { if (!response.ok) throw new Error("Product not found"); return response.json(); })
      .then(setProduct)
      .catch((err) => setError(err.message));
  }, [id]);

  const images = useMemo(() => {
    if (!product) return [];
    const parsed = parseJson(product.imageUrls, []);
    if (Array.isArray(parsed) && parsed.length) return parsed;
    return product.imageUrl ? [product.imageUrl] : [];
  }, [product]);

  const ocr = useMemo(() => parseJson(product?.ocrData, null), [product]);

  if (error) return <div className="products-page"><p>{error}</p></div>;
  if (!product) return <div className="products-page"><p>Loading product...</p></div>;

  const statusLabel = product.complianceStatus === "VIOLATION" ? "Violation" : product.complianceStatus === "OKAY" ? "Okay" : "Needs review";
  const path = [product.category?.parent?.parent, product.category?.parent, product.category].filter(Boolean).map((item) => item.name).join(" → ");

  return (
    <div className="products-page">
      <Link to={`/products/category/${product.categoryId}`} className="back-link">← Back to product type</Link>
      <div className="page-header"><p className="eyebrow">INSPECTED PRODUCT</p><h1>{product.productName}</h1><p>{product.brandName || "Company not recorded"}</p><p>{path}</p></div>

      {images.length > 0 && <section className="product-categories"><div className="section-heading"><div><h2>Package evidence</h2><p>{images.length} image{images.length === 1 ? "" : "s"} retained from this inspection.</p></div></div><div className="product-image-gallery">{images.map((src, index) => <img key={index} src={src} alt={`Package evidence ${index + 1}`} />)}</div></section>}

      <section className="product-actions"><div className={`compliance-badge ${product.complianceStatus.toLowerCase()}`}>{statusLabel}</div><h2>Legal Metrology screening</h2><p>{product.violationReason || "No screening note recorded."}</p><button type="button" className="secondary-action" onClick={() => window.print()}>Print / Save report as PDF</button></section>

      <section className="product-categories"><div className="section-heading"><div><h2>Extracted product information</h2></div></div><div className="product-row"><div><strong>Category</strong><span>{product.category?.name}</span></div><div><strong>Quantity</strong><span>{product.netQuantity || "Not recorded"} {product.unit || ""}</span></div><div><strong>MRP</strong><span>{product.mrp === null ? "Not recorded" : `₹${product.mrp}`}</span></div></div></section>

      {ocr && <section className="product-categories"><div className="section-heading"><div><h2>OCR declarations</h2><p>Structured evidence returned by Gemini and retained for audit.</p></div></div><div className="ocr-details-grid">{["manufacturer","manufacturerAddress","packer","packerAddress","importer","importerAddress","dateOfManufacture","dateOfPacking","bestBefore","expiryDate","batchNumber","consumerCarePhone","consumerCareEmail","countryOfOrigin","fssaiLicenseNumber","barcode"].map((key) => { const field = ocr[key]; return field?.status === "found" ? <div key={key}><strong>{key.replace(/([A-Z])/g, " $1")}</strong><span>{String(field.value)}</span><small>Confidence: {Math.round(field.confidence * 100)}%</small></div> : null; })}</div>{ocr.rawText && <details><summary>Raw OCR text</summary><pre className="ocr-raw-text">{ocr.rawText}</pre></details>}</section>}
    </div>
  );
}

export default ProductDetails;

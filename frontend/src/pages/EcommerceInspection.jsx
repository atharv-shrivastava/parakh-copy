import { useState } from "react";
import { apiFetch } from "../lib/auth";
import "../styles/ecommerce.css";

const API_URL = "http://localhost:5000/api";
const MAX_IMAGES = 6;

export default function EcommerceInspection() {
  const [url, setUrl] = useState("");
  const [listing, setListing] = useState(null);
  const [ocr, setOcr] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function inspectListing(event) {
    event.preventDefault();
    const value = url.trim();
    if (!/^https?:\/\/\S+$/i.test(value)) {
      setError("Enter a valid public product listing URL.");
      return;
    }
    setBusy(true);
    setError("");
    setListing(null);
    setOcr(null);
    setCompliance(null);
    setMessage("Fetching the public listing and collecting its product data and images...");
    try {
      const response = await apiFetch(API_URL + "/products/ecommerce/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not inspect the listing.");
      setListing(data.listing || null);
      setOcr(data.ocr || null);
      setCompliance(data.compliance || null);
      setMessage("Listing data and images were collected. Rules Engine analysis completed.");
    } catch (e) {
      setError(e.message || "E-commerce inspection failed.");
    } finally {
      setBusy(false);
    }
  }

  const imageUrls = (listing?.imageUrls || []).slice(0, MAX_IMAGES);

  return <div className="ecommerce-page">
    <div className="page-header">
      <p className="eyebrow">E-COMMERCE INSPECTION</p>
      <h1>Inspect Product Listing</h1>
      <p>Enter the public listing URL. PARAKH retrieves the listing, extracts available product data and collects public product images before running the e-commerce Rules Engine.</p>
    </div>

    <form className="ecommerce-panel ecommerce-url-form" onSubmit={inspectListing}>
      <label>
        Product listing URL
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/product/..." disabled={busy} />
      </label>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Inspecting listing..." : "Inspect Listing"}</button>
      <small>Use public pages and sources that permit automated retrieval. Protected pages, private URLs and login-only content are not accessed.</small>
    </form>

    {error && <div className="status-message">{error}</div>}
    {message && !error && <div className="status-message">{message}</div>}

    {listing && <section className="ecommerce-panel">
      <div className="section-heading">
        <div><h2>Listing Retrieved</h2><p>{listing.sourceTitle || listing.title || "Public product listing"} · <a href={listing.url} target="_blank" rel="noreferrer">Open source page</a></p></div>
      </div>
      <div className="ecommerce-fields">
        {[
          ["Product name", listing.productName],
          ["Brand", listing.brand],
          ["Description", listing.description],
          ["MRP / Price", listing.mrp ? (listing.currency ? listing.currency + " " + listing.mrp : String(listing.mrp)) : ""],
          ["SKU / MPN", listing.sku],
          ["GTIN / Barcode", listing.gtin],
          ["Country of origin", listing.countryOfOrigin],
          ["Country-of-origin filter evidence", listing.filterEvidence ? "Detected on listing page" : "Not established from page structure"],
        ].map(([label, value]) => <div key={label}><strong>{label}</strong><span>{value || "Not established"}</span></div>)}
      </div>
    </section>}

    {imageUrls.length > 0 && <section className="ecommerce-panel">
      <div className="section-heading"><div><h2>Listing Images Retrieved</h2><p>Public product images collected from the listing page.</p></div></div>
      <div className="ecommerce-images">{imageUrls.map((imageUrl, index) => <div className="ecommerce-image" key={imageUrl}><img src={imageUrl} alt={"Listing product " + (index + 1)} /><span>Image {index + 1}</span></div>)}</div>
    </section>}

    {ocr && <section className="ecommerce-panel">
      <div className="section-heading"><div><h2>Image OCR Cross-check</h2><p>Retrieved product images were passed through OCR for cross-checking.</p></div></div>
      <div className="ecommerce-fields">{["productName", "brandName", "countryOfOrigin", "mrp", "netQuantity", "unit", "manufacturer"].map((key) => <div key={key}><strong>{key.replace(/([A-Z])/g, " $1")}</strong><span>{ocr?.[key]?.value || "Not established"}</span></div>)}</div>
    </section>}

    {compliance && <section className="ecommerce-panel">
      <div className="section-heading"><div><h2>Rules Engine Result</h2><p>E-commerce listing context. Findings are inspection support information and may require officer/legal review.</p></div></div>
      <div className="ecommerce-result-summary"><div><span>Status</span><strong>{compliance.overallStatus || "REVIEW"}</strong></div><div><span>Violations</span><strong>{compliance.summary?.violations ?? 0}</strong></div><div><span>Unable to verify</span><strong>{compliance.summary?.unableToVerify ?? 0}</strong></div></div>
      <div className="ecommerce-findings">{(compliance.findings || []).map((finding, index) => <article key={finding.findingId || index}><strong>{finding.ruleNumber || finding.ruleCode || "Rule"}</strong><span>{finding.message}</span>{finding.violationReason && <small>{finding.violationReason}</small>}</article>)}</div>
    </section>}
  </div>;
}

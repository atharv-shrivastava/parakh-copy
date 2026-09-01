
import "../styles/scan.css";

function Scan() {
  return (
    <div className="scan-page">
      <div className="page-header">
        <p className="eyebrow">PRODUCT INSPECTION</p>

        <h1>Scan Product</h1>

        <p>
          Upload a product label or scan its barcode to begin a compliance
          inspection.
        </p>
      </div>

      <section className="scan-area">
        <div className="scan-icon">
          +
        </div>

        <h2>Upload product image</h2>

        <p>
          Take a clear photograph of the product label or upload an existing
          image.
        </p>

        <div className="scan-actions">
          <button type="button" className="primary-button">
            Upload Image
          </button>

          <button type="button" className="secondary-button">
            Scan Barcode
          </button>
        </div>
      </section>

      <section className="scan-info">
        <h2>What Parakh checks</h2>

        <div className="check-grid">
          <div className="check-item">
            <strong>Mandatory declarations</strong>
            <span>Checks required information on the product label.</span>
          </div>

          <div className="check-item">
            <strong>Pricing information</strong>
            <span>Checks MRP and other pricing-related declarations.</span>
          </div>

          <div className="check-item">
            <strong>Product details</strong>
            <span>Reviews important packaged commodity information.</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Scan;

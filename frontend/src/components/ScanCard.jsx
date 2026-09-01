
import { Link } from "react-router-dom";
import "../styles/components.css";

function ScanCard() {
  return (
    <section className="scan-card">
      <div className="scan-card-content">
        <p className="eyebrow">PRODUCT INSPECTION</p>

        <h2>Scan a product</h2>

        <p>
          Scan or upload a product label to check mandatory declarations,
          pricing information, and other compliance requirements.
        </p>

        <Link to="/scan" className="scan-button">
          Start inspection
        </Link>
      </div>
    </section>
  );
}

export default ScanCard;


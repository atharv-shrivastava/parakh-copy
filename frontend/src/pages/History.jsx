import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/history.css";

const API_URL = "http://localhost:5000/api";

function History() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/products/history`)
      .then((response) => { if (!response.ok) throw new Error("Failed to load inspection history"); return response.json(); })
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="history-page">
      <div className="page-header"><p className="eyebrow">INSPECTION RECORDS</p><h1>Inspection History</h1><p>Every saved scan appears here with its product, category, date and compliance status.</p></div>
      {loading && <p>Loading inspection history...</p>}
      {error && <div className="status-message">{error}</div>}
      {!loading && !error && products.length === 0 && <div className="status-message">No inspections have been saved yet.</div>}
      {!loading && !error && <div className="history-list">{products.map((product) => { const status = product.complianceStatus || "NEEDS_REVIEW"; const label = status === "OKAY" ? "Compliant" : status === "VIOLATION" ? "Non-Compliant" : "Needs Review"; const cls = status === "OKAY" ? "compliant" : status === "VIOLATION" ? "non-compliant" : "review"; return <Link key={product.id} to={`/products/item/${product.id}`} className="history-item"><div><h3>{product.productName}</h3><p>{product.brandName || "Company not recorded"} · {product.category?.name || "Uncategorised"} · {new Date(product.createdAt).toLocaleString()}</p></div><span className={`history-status ${cls}`}>{label}</span></Link>; })}</div>}
    </div>
  );
}

export default History;

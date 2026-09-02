import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/history.css";

const API_URL = "http://localhost:5000/api";

function History() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("query", query.trim());
        if (status !== "ALL") params.set("status", status);
        const r = await apiFetch(`${API_URL}/products/history${params.toString() ? `?${params}` : ""}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load history");
        setProducts(Array.isArray(d) ? d : []);
      } catch (e) {
        setError(e.message);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, status, refreshKey]);

  return <div className="history-page">
    <div className="page-header">
      <p className="eyebrow">INSPECTION RECORDS</p>
      <h1>Inspection History</h1>
      <p>Saved registrations and inspections belong to the signed-in user.</p>
    </div>

    <div className="history-toolbar">
      <label className="history-search">
        <span>Search</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Product, brand, category, shop or barcode" />
      </label>
      <label className="history-filter">
        <span>Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="OKAY">Okay</option>
          <option value="VIOLATION">Violation</option>
          <option value="NEEDS_REVIEW">Needs review</option>
        </select>
      </label>
      <button className="history-clear" type="button" onClick={() => { setQuery(""); setStatus("ALL"); setRefreshKey((v) => v + 1); }}>Clear</button>
    </div>

    {loading && <p className="history-loading">Loading inspection history...</p>}
    {error && <div className="status-message">{error}</div>}
    {!loading && !error && !products.length && <div className="status-message">No inspections match the current search and filter.</div>}
    {!loading && !error && products.length > 0 && <div className="history-list">
      {products.map((p) => {
        const s = p.complianceStatus || "NEEDS_REVIEW";
        const inspection = p.inspections?.[0];
        return <Link key={p.id} to={`/products/item/${p.id}`} className="history-item">
          <div>
            <h3>{p.productName}</h3>
            <p>{p.brandName || "Company not recorded"} · {p.category?.name || "Uncategorised"} · {inspection?.shop?.name || "Shop not recorded"}</p>
            <small>{new Date(inspection?.inspectedAt || p.createdAt).toLocaleString()}</small>
          </div>
          <span className={`history-status ${s === "OKAY" ? "compliant" : s === "VIOLATION" ? "non-compliant" : "review"}`}>{s}</span>
        </Link>;
      })}
    </div>}
  </div>;
}

export default History;

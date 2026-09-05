import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/shops.css";

const API_URL = "http://localhost:5000/api";

function Shops() {
  const [shops, setShops] = useState([]);
  const [view, setView] = useState("OFFLINE");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await apiFetch(`${API_URL}/shops?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&sourceType=${view}`);
      const data = await r.json().catch(() => []);
      if (!r.ok) throw new Error(data?.error || "Could not load shops");
      setShops(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Could not load shops");
      setShops([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [query, status, view]);

  const summary = useMemo(() => ({
    total: shops.length,
    compliant: shops.filter((s) => s.status === "COMPLIANT").length,
    review: shops.filter((s) => s.status === "REVIEW").length,
    nonCompliant: shops.filter((s) => s.status === "NON_COMPLIANT").length,
  }), [shops]);

  const ecommerce = view === "ECOMMERCE";

  function resetFilters() {
    setQuery("");
    setStatus("ALL");
  }

  async function deleteShop(event, shop) {
    event.preventDefault();
    event.stopPropagation();
    const confirmed = window.confirm(`Delete ${shop.name}? This will also delete its inspection records.`);
    if (!confirmed) return;
    setDeletingId(shop.id);
    setError("");
    try {
      const response = await apiFetch(`${API_URL}/shops/${shop.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Could not delete shop");
      setShops((current) => current.filter((item) => item.id !== shop.id));
    } catch (e) {
      setError(e?.message || "Could not delete shop");
    } finally {
      setDeletingId(null);
    }
  }

  return <div className="shops-page">
    <div className="page-header">
      <p className="eyebrow">{ecommerce ? "E-COMMERCE SOURCES" : "OFFLINE BUSINESSES"}</p>
      <h1>{ecommerce ? "E-commerce shops" : "Offline shops"}</h1>
      <p>{ecommerce ? "Websites used as sources for e-commerce product inspections. The website name is shown instead of a physical shop name." : "Physical shops created through offline product inspections."}</p>
    </div>

    <div className="shop-source-tabs" role="tablist" aria-label="Shop source">
      <button type="button" className={view === "OFFLINE" ? "active" : ""} onClick={() => setView("OFFLINE")}>Offline shops</button>
      <button type="button" className={view === "ECOMMERCE" ? "active" : ""} onClick={() => setView("ECOMMERCE")}>E-commerce</button>
    </div>

    <div className="shop-summary">
      <div><span>{ecommerce ? "Websites" : "Shops"}</span><strong>{summary.total}</strong></div>
      <div><span>Compliant</span><strong>{summary.compliant}</strong></div>
      <div><span>Needs review</span><strong>{summary.review}</strong></div>
      <div><span>Non-compliant</span><strong>{summary.nonCompliant}</strong></div>
    </div>

    <div className="shop-search">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ecommerce ? "Search website..." : "Search shop, city or address..."} aria-label="Search shops" />
      <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter shop status">
        <option value="ALL">All {ecommerce ? "websites" : "shops"}</option>
        <option value="COMPLIANT">Compliant</option>
        <option value="REVIEW">Needs Review</option>
        <option value="NON_COMPLIANT">Non-Compliant</option>
      </select>
      <button type="button" className="shop-clear" onClick={resetFilters}>Reset</button>
    </div>

    {error && <div className="status-message">{error}</div>}
    {loading && <p className="shops-loading">Loading {ecommerce ? "e-commerce websites" : "offline shops"}...</p>}
    {!loading && !error && !shops.length && <div className="status-message">No {ecommerce ? "e-commerce websites" : "offline shops"} match the current filters.</div>}

    {!loading && !error && shops.length > 0 && <div className="shop-grid">
      {shops.map((shop) => <article key={shop.id} className="shop-card">
        <Link to={`/shops/${shop.id}`} className="shop-card-main">
          <div className="shop-card-header">
            <h2>{shop.name}</h2>
            <span className={`shop-status ${String(shop.status || "REVIEW").toLowerCase()}`}>{String(shop.status || "REVIEW").replace("_", " ")}</span>
          </div>
          <p>{ecommerce ? "Website source" : ([shop.address, shop.city, shop.state].filter(Boolean).join(", ") || "Address not recorded")}</p>
          <div className="shop-card-footer">
            <span>{shop.productCount ?? 0} products</span>
            <span>{shop.inspectionCount ?? 0} inspections</span>
            <span>{shop.lastInspection ? new Date(shop.lastInspection).toLocaleDateString() : "No inspection"}</span>
          </div>
        </Link>
        <button type="button" className="shop-delete" onClick={(event) => deleteShop(event, shop)} disabled={deletingId === shop.id} aria-label={`Delete ${shop.name}`}>
          {deletingId === shop.id ? "Deleting..." : "Delete"}
        </button>
      </article>)}
    </div>}
  </div>;
}

export default Shops;

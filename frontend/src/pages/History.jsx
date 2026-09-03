import { useEffect, useMemo, useState } from "react";
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
  const [brand, setBrand] = useState("");
  const [shop, setShop] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    let alive = true;
    apiFetch(`${API_URL}/products/history`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load history");
        if (alive) setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    const search = query.trim().toLowerCase();
    const brandSearch = brand.trim().toLowerCase();
    const shopSearch = shop.trim().toLowerCase();

    return products.filter((product) => {
      const inspection = product.inspections?.[0];
      const inspectedAt = new Date(inspection?.inspectedAt || product.createdAt);
      const searchable = [
        product.productName,
        product.brandName,
        product.category?.name,
        inspection?.shop?.name,
        product.barcode,
      ].filter(Boolean).join(" ").toLowerCase();

      return (
        (!search || searchable.includes(search)) &&
        (status === "ALL" || product.complianceStatus === status) &&
        (!brandSearch || (product.brandName || "").toLowerCase().includes(brandSearch)) &&
        (!shopSearch || (inspection?.shop?.name || "").toLowerCase().includes(shopSearch)) &&
        (!dateFrom || inspectedAt >= new Date(`${dateFrom}T00:00:00`)) &&
        (!dateTo || inspectedAt <= new Date(`${dateTo}T23:59:59.999`))
      );
    });
  }, [products, query, status, brand, shop, dateFrom, dateTo]);

  function clear() {
    setQuery("");
    setStatus("ALL");
    setBrand("");
    setShop("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="history-page">
      <div className="page-header">
        <p className="eyebrow">INSPECTION RECORDS</p>
        <h1>Inspection History</h1>
        <p>Saved registrations and inspections belong to the signed-in user.</p>
      </div>

      <div className="history-toolbar history-toolbar-wide">
        <label className="history-search">
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Product, category, shop or barcode" />
        </label>

        <label className="history-filter">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="OKAY">Okay</option>
            <option value="VIOLATION">Violation</option>
            <option value="NEEDS_REVIEW">Needs review</option>
          </select>
        </label>

        <label className="history-search">
          <span>Brand</span>
          <input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Any brand" />
        </label>

        <label className="history-search">
          <span>Shop</span>
          <input value={shop} onChange={(event) => setShop(event.target.value)} placeholder="Any shop" />
        </label>

        <label className="history-filter">
          <span>From date</span>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>

        <label className="history-filter">
          <span>To date</span>
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>

        <button className="history-clear" type="button" onClick={clear}>Clear</button>
      </div>

      {loading && <p className="history-loading">Loading inspection history...</p>}
      {error && <div className="status-message">{error}</div>}
      {!loading && !error && !shown.length && <div className="status-message">No inspections match the current filters.</div>}

      {!loading && !error && shown.length > 0 && (
        <div className="history-list">
          {shown.map((product) => {
            const statusValue = product.complianceStatus || "NEEDS_REVIEW";
            const inspection = product.inspections?.[0];
            return (
              <Link key={product.id} to={`/products/item/${product.id}`} className="history-item">
                <div>
                  <h3>{product.productName}</h3>
                  <p>
                    {product.brandName || "Company not recorded"} · {product.category?.name || "Uncategorised"} · {inspection?.shop?.name || "Shop not recorded"}
                  </p>
                  <small>
                    Registered: {new Date(product.createdAt).toLocaleString()} · Inspected:{" "}
                    {new Date(inspection?.inspectedAt || product.createdAt).toLocaleString()}
                  </small>
                </div>
                <span className={`history-status ${statusValue === "OKAY" ? "compliant" : statusValue === "VIOLATION" ? "non-compliant" : "review"}`}>
                  {statusValue}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default History;

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/history.css";

const API_URL = "http://localhost:5000/api";

function History() {
  const [products, setProducts] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("ALL"); const [sourceType, setSourceType] = useState("ALL"); const [brand, setBrand] = useState(""); const [shop, setShop] = useState(""); const [dateFrom, setDateFrom] = useState(""); const [dateTo, setDateTo] = useState(""); const [selected, setSelected] = useState([]); const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ sourceType, status });
      if (query.trim()) params.set("query", query.trim());
      const response = await apiFetch(`${API_URL}/products/history?${params.toString()}`);
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data?.error || "Failed to load history");
      setProducts(Array.isArray(data) ? data : []);
      setSelected([]);
    } catch (err) { setError(err?.message || "Failed to load history"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [sourceType, status]);

  const shown = useMemo(() => {
    const search = query.trim().toLowerCase(), brandSearch = brand.trim().toLowerCase(), shopSearch = shop.trim().toLowerCase();
    return products.filter((product) => {
      const inspection = product.inspections?.[0]; const inspectedAt = new Date(inspection?.inspectedAt || product.createdAt); const website = product.sourceWebsiteName || inspection?.shop?.name || "";
      const searchable = [product.productName, product.brandName, product.category?.name, inspection?.shop?.name, product.sourceWebsiteName, product.barcode].filter(Boolean).join(" ").toLowerCase();
      return (!search || searchable.includes(search)) && (!brandSearch || (product.brandName || "").toLowerCase().includes(brandSearch)) && (!shopSearch || website.toLowerCase().includes(shopSearch)) && (!dateFrom || inspectedAt >= new Date(`${dateFrom}T00:00:00`)) && (!dateTo || inspectedAt <= new Date(`${dateTo}T23:59:59.999`));
    });
  }, [products, query, brand, shop, dateFrom, dateTo]);

  const allShownSelected = shown.length > 0 && shown.every((item) => selected.includes(item.id));
  function toggle(id) { setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]); }
  function toggleAll() { setSelected(allShownSelected ? [] : shown.map((item) => item.id)); }

  async function deleteSelected() {
    if (!selected.length || deleting || !window.confirm(`Delete ${selected.length} selected product record(s)? This also removes their inspection history.`)) return;
    setMessage(""); setDeleting(true);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => apiFetch(`${API_URL}/products/${id}`, { method: "DELETE" })));
    const failed = results.filter((result) => result.status === "rejected" || !result.value?.ok).length;
    if (failed) setMessage(`${failed} record(s) could not be deleted.`); else setMessage("Selected records deleted successfully.");
    await load();
    setDeleting(false);
  }

  function clear() { setQuery(""); setStatus("ALL"); setSourceType("ALL"); setBrand(""); setShop(""); setDateFrom(""); setDateTo(""); setSelected([]); setMessage(""); }

  return <div className="history-page">
    <div className="page-header"><p className="eyebrow">INSPECTION RECORDS</p><h1>Inspection History</h1><p>Saved registrations and inspections belong to the signed-in user. Use Source to separate physical inspections from e-commerce listing inspections.</p></div>
    <div className="history-toolbar history-toolbar-wide">
      <label className="history-search"><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") load(); }} placeholder="Product, category, shop, website or barcode" /></label>
      <label className="history-filter"><span>Source</span><select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="ALL">All sources</option><option value="OFFLINE">Offline</option><option value="ECOMMERCE">E-commerce</option></select></label>
      <label className="history-filter"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option><option value="OKAY">Okay</option><option value="VIOLATION">Violation</option><option value="NEEDS_REVIEW">Needs review</option></select></label>
      <label className="history-search"><span>Brand</span><input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Any brand" /></label>
      <label className="history-search"><span>Shop / Website</span><input value={shop} onChange={(event) => setShop(event.target.value)} placeholder="Any shop or website" /></label>
      <label className="history-filter"><span>From date</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
      <label className="history-filter"><span>To date</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
      <button className="history-clear" type="button" onClick={clear}>Clear</button>
    </div>

    {(shown.length > 0 || selected.length > 0) && <div className="history-bulkbar">
      <label><input type="checkbox" checked={allShownSelected} onChange={toggleAll} /> Select visible</label>
      <span>{selected.length} selected</span>
      <button className="history-delete" type="button" disabled={!selected.length || deleting} onClick={deleteSelected}>{deleting ? "Deleting..." : "Delete selected"}</button>
    </div>}

    {message && <div className="status-message">{message}</div>}
    {loading && <p className="history-loading">Loading inspection history...</p>}{error && <div className="status-message">{error}</div>}{!loading && !error && !shown.length && <div className="status-message">No inspections match the current filters.</div>}
    {!loading && !error && shown.length > 0 && <div className="history-list">{shown.map((product) => { const statusValue = product.complianceStatus || "NEEDS_REVIEW"; const inspection = product.inspections?.[0]; const source = String(product.sourceType || "OFFLINE").toUpperCase(); const sourceName = source === "ECOMMERCE" ? (product.sourceWebsiteName || inspection?.shop?.name || "Website not recorded") : (inspection?.shop?.name || "Shop not recorded"); return <div key={product.id} className={`history-item ${selected.includes(product.id) ? "selected" : ""}`}><label className="history-check" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggle(product.id)} /></label><Link to={`/products/item/${product.id}`} className="history-content"><div><h3>{product.productName}</h3><p>{product.brandName || "Company not recorded"} · {product.category?.name || "Uncategorised"} · {sourceName}</p><small>{source === "ECOMMERCE" ? "E-commerce" : "Offline"} · Registered: {new Date(product.createdAt).toLocaleString()} · Inspected: {new Date(inspection?.inspectedAt || product.createdAt).toLocaleString()}</small></div><span className={`history-status ${statusValue === "OKAY" ? "compliant" : statusValue === "VIOLATION" ? "non-compliant" : "review"}`}>{statusValue}</span></Link></div>; })}</div>}
  </div>;
}

export default History;

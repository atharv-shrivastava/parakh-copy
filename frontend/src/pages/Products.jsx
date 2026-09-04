import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, getUser } from "../lib/auth";
import "../styles/products.css";
import "../styles/product-controls.css";

const API_URL = "http://localhost:5000/api";

export default function Products() {
  const [categories, setCategories] = useState([]), [products, setProducts] = useState([]);
  const [sourceType, setSourceType] = useState("OFFLINE"), [query, setQuery] = useState(""), [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState([]), [message, setMessage] = useState(""), [loading, setLoading] = useState(true);
  const [name, setName] = useState(""), [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true); setMessage("");
    try {
      const [cr, pr] = await Promise.all([apiFetch(`${API_URL}/categories?sourceType=${sourceType}`), apiFetch(`${API_URL}/products?sourceType=${sourceType}`)]);
      const cd = await cr.json().catch(() => []), pd = await pr.json().catch(() => []);
      if (!cr.ok) throw new Error(cd?.error || "Could not load categories");
      if (!pr.ok) throw new Error(pd?.error || "Could not load products");
      setCategories(Array.isArray(cd) ? cd : []); setProducts(Array.isArray(pd) ? pd : []); setSelected([]);
    } catch (e) { setMessage(e.message || "Could not load products"); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [sourceType]);

  const shown = products.filter((p) => {
    const hay = [p.productName, p.brandName, p.category?.name, p.barcode, p.sourceWebsiteName, p.inspections?.[0]?.shop?.name].filter(Boolean).join(" ").toLowerCase();
    return (!query || hay.includes(query.toLowerCase())) && (status === "ALL" || p.complianceStatus === status);
  });
  const allSelected = shown.length > 0 && shown.every((p) => selected.includes(p.id));
  const toggleAll = () => setSelected(allSelected ? [] : shown.map((p) => p.id));

  async function addCategory() {
    if (!name.trim() || creating) return;
    setCreating(true); setMessage("");
    try {
      const r = await apiFetch(`${API_URL}/categories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), sourceType, global: false, isFinal: false }) });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Could not create category");
      setName(""); setMessage("Private category created for this account only."); await load();
    } catch (e) { setMessage(e.message); } finally { setCreating(false); }
  }
  async function delCategory(c) {
    if (c.isSystem || !confirm(`Delete ${c.name}? Registered products will be moved to an Uncategorized category.`)) return;
    const r = await apiFetch(`${API_URL}/categories/${c.id}`, { method: "DELETE" }); const d = await r.json().catch(() => ({}));
    setMessage(r.ok ? (d.message || "Category deleted") : (d.error || "Delete failed")); if (r.ok) await load();
  }
  async function deleteSelected() {
    if (!selected.length || !confirm(`Delete ${selected.length} selected product(s)?`)) return;
    let failed = 0; for (const id of selected) { try { const r = await apiFetch(`${API_URL}/products/${id}`, { method: "DELETE" }); if (!r.ok) failed += 1; } catch { failed += 1; } }
    setMessage(failed ? `${failed} product(s) could not be deleted.` : "Selected products deleted successfully."); await load();
  }

  const label = sourceType === "ECOMMERCE" ? "E-commerce" : "Offline";
  return <div className="products-page">
    <div className="page-header"><p className="eyebrow">PRODUCT DATABASE</p><h1>Products & categories</h1><p>{getUser()?.role === "ADMIN" ? "Manage private categories and product records. Global categories remain shared." : "Global categories are shared; private categories belong to this account."}</p></div>
    {message && <div className="status-message">{message}</div>}
    <section className="product-actions private-category-actions"><div className="private-category-fields"><label><span>Private category name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Festival Snacks" disabled={creating} /></label><label><span>Source</span><select value={sourceType} onChange={(e) => setSourceType(e.target.value)} disabled={creating}><option value="OFFLINE">Offline</option><option value="ECOMMERCE">E-commerce</option></select></label></div><div className="product-action-buttons"><button className="primary-button" onClick={addCategory} disabled={creating || !name.trim()}>{creating ? "Creating..." : `Add private ${label} category`}</button><Link className="secondary-action" to="/products/manual-register">Register product manually</Link><Link className="secondary-action" to="/ecommerce-products">E-commerce products</Link></div></section>
    <section className="product-categories"><div className="section-heading"><div><h2>{label} categories</h2><p>Browse the available hierarchy and registered records.</p></div></div>{loading ? <p>Loading...</p> : <div className="category-grid">{categories.map((c) => <div className="category-item" key={c.id}><Link to={`/products/category/${c.id}`} className="category-card"><h3>{c.name}</h3><p>{c.isSystem ? "Global" : "Private to your account"} · {c.isFinalProductType ? "Final category" : "Can contain subcategories"}</p></Link>{!c.isSystem && <button className="delete-category-button" onClick={() => delCategory(c)}>Delete</button>}</div>)}</div>}</section>
    <section className="product-categories registered-product-section"><div className="section-heading"><div><h2>Registered {label} products</h2><p>{shown.length} record(s) match the current filters.</p></div></div><div className="product-list-toolbar"><input value={query} onChange={(e) => { setQuery(e.target.value); setSelected([]); }} placeholder="Search product, brand, barcode or category" /><select value={status} onChange={(e) => { setStatus(e.target.value); setSelected([]); }}><option>ALL</option><option>OKAY</option><option>VIOLATION</option><option>NEEDS_REVIEW</option></select></div>{shown.length > 0 && <div className="bulk-toolbar"><label><input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select visible</label><span>{selected.length} selected</span><button className="delete-category-button" disabled={!selected.length} onClick={deleteSelected}>Delete selected</button></div>}<div className="product-list">{shown.map((p) => <div className="product-row" key={p.id}><Link to={`/products/item/${p.id}`} state={{ product:p }}><div><strong>{p.productName}</strong><span>{p.brandName || "Brand not recorded"}</span></div><div><span>{p.netQuantity || "-"} {p.unit || ""}</span><span>{p.sourceWebsiteName || p.inspections?.[0]?.shop?.name || "Source not recorded"}</span></div><span className={`compliance-badge ${(p.complianceStatus || "NEEDS_REVIEW").toLowerCase()}`}>{p.complianceStatus || "NEEDS_REVIEW"}</span></Link></div>)}</div>{!loading && !shown.length && <div className="status-message">No matching product records.</div>}</section>
  </div>;
}

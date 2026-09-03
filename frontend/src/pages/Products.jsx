import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, getUser } from "../lib/auth";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function Products() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [final, setFinal] = useState(false);
  const [sourceType, setSourceType] = useState("OFFLINE");
  const [advancedFinal, setAdvancedFinal] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const user = getUser();

  async function load(selectedSource = sourceType) {
    setLoading(true);
    try {
      const r = await apiFetch(`${API_URL}/categories?sourceType=${encodeURIComponent(selectedSource)}`);
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setMessage(d?.error || "Could not load categories");
        return;
      }
      setCategories(Array.isArray(d) ? d : []);
    } catch (error) {
      setMessage(error?.message || "Could not load categories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(sourceType); }, [sourceType]);

  async function add() {
    const categoryName = name.trim();
    if (!categoryName || creating) return;
    setCreating(true);
    setMessage("");
    try {
      const r = await apiFetch(`${API_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName, isFinal: final, sourceType, global: false }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setMessage(d?.error || "Could not add private category");
        return;
      }
      setName("");
      setFinal(false);
      setMessage("Private category created for this account only.");
      await load(sourceType);
    } catch (error) {
      setMessage(error?.message || "Could not add private category");
    } finally {
      setCreating(false);
    }
  }

  async function del(c) {
    if (c.isSystem) return;
    if (!window.confirm(`Delete ${c.name}? Registered products will be moved to an Uncategorized category.`)) return;
    const r = await apiFetch(`${API_URL}/categories/${c.id}`, { method: "DELETE" });
    const d = await r.json().catch(() => null);
    setMessage(r.ok ? (d?.message || "Category deleted") : (d?.error || "Delete failed"));
    if (r.ok) load(sourceType);
  }

  const sourceLabel = sourceType === "ECOMMERCE" ? "E-commerce" : "Offline";

  return <div className="products-page">
    <div className="page-header">
      <p className="eyebrow">PRODUCT DATABASE</p>
      <h1>Products & categories</h1>
      <p>{user?.role === "ADMIN" ? "This is your private Products workspace. Global categories are shared but cannot be changed here. Categories created here are visible only to your admin account." : "Global categories are shared. Private categories belong only to your account. Private subcategories can also be added inside global categories."}</p>
    </div>

    {message && <div className="status-message">{message}</div>}

    <section className="product-actions private-category-actions">
      <div className="private-category-fields">
        <label>
          <span>Private category name</span>
          <input placeholder="e.g. Festival Snacks" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} disabled={creating} />
        </label>
        <label>
          <span>Source</span>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} disabled={creating}>
            <option value="OFFLINE">Offline</option>
            <option value="ECOMMERCE">E-commerce</option>
          </select>
        </label>
        <div className="final-control-lock" onContextMenu={(e) => { e.preventDefault(); setAdvancedFinal(true); }} onTouchStart={(e) => { const t = window.setTimeout(() => setAdvancedFinal(true), 800); e.currentTarget.dataset.longPress = t; }} onTouchEnd={(e) => window.clearTimeout(Number(e.currentTarget.dataset.longPress || 0))}>
          {advancedFinal ? <label className="checkbox-field"><input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} disabled={creating} /><span>Set as final product category</span></label> : <span className="gesture-hint">Long-press or right-click for advanced final control</span>}
        </div>
      </div>
      <div className="product-action-buttons">
        <button className="primary-button" type="button" onClick={add} disabled={creating || !name.trim()}>{creating ? "Creating..." : `Add private ${sourceLabel} category`}</button>
        <Link className="secondary-action" to="/products/manual-register">Register product manually</Link>
        <Link className="secondary-action" to="/ecommerce-products">E-commerce products</Link>
      </div>
    </section>

    <section className="product-categories">
      <div className="section-heading">
        <div>
          <h2>{sourceLabel} categories</h2>
          <p>Only {sourceLabel.toLowerCase()} categories are shown. Global categories are shared; private categories remain private to your account.</p>
        </div>
      </div>
      {loading ? <p>Loading...</p> : <div className="category-grid">{categories.map((c) => <div className="category-item" key={c.id}>
        <Link to={`/products/category/${c.id}`} className="category-card">
          <h3>{c.name}</h3>
          <p>{c.isSystem ? "Global" : "Private to your account"} · {c.sourceType === "ECOMMERCE" ? "E-commerce" : "Offline"} · {c.isFinalProductType ? "Final category" : "Can contain subcategories"}</p>
        </Link>
        {!c.isSystem && <button className="delete-category-button" type="button" onClick={() => del(c)}>Delete</button>}
      </div>)}</div>}
      {!loading && !categories.length && <p>No {sourceLabel.toLowerCase()} categories available.</p>}
    </section>
  </div>;
}

export default Products;

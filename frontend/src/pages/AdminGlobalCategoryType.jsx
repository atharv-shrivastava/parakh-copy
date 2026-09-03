import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

export default function AdminGlobalCategoryType() {
  const { sourceType: rawSourceType } = useParams();
  const sourceType = String(rawSourceType || "offline").toUpperCase() === "ECOMMERCE" ? "ECOMMERCE" : "OFFLINE";
  const label = sourceType === "ECOMMERCE" ? "E-commerce" : "Offline";
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [final, setFinal] = useState(false);
  const [advancedFinal, setAdvancedFinal] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch(`${API_URL}/categories?sourceType=${sourceType}`);
      const d = await r.json().catch(() => []);
      if (!r.ok) throw new Error(d?.error || "Could not load global categories");
      setCategories((Array.isArray(d) ? d : []).filter((c) => c.isSystem));
    } catch (error) {
      setMessage(error?.message || "Could not load global categories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [sourceType]);

  async function addRoot() {
    const clean = name.trim();
    if (!clean || creating) return;
    setCreating(true);
    setMessage("");
    try {
      const r = await apiFetch(`${API_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean, parentId: null, isFinal: final, sourceType, global: true }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || `Could not create ${label} global category`);
      setName("");
      setFinal(false);
      setMessage(`${label} global category created and made available to all users.`);
      await load();
    } catch (error) {
      setMessage(error?.message || `Could not create ${label} global category`);
    } finally {
      setCreating(false);
    }
  }

  async function remove(category) {
    if (!window.confirm(`Delete ${category.name}? Products will be moved to the appropriate Uncategorized category and child categories will also be removed.`)) return;
    const r = await apiFetch(`${API_URL}/categories/${category.id}`, { method: "DELETE" });
    const d = await r.json().catch(() => null);
    setMessage(r.ok ? (d?.message || "Global category deleted") : (d?.error || "Delete failed"));
    if (r.ok) await load();
  }

  return <div className="products-page">
    <Link className="back-link" to="/admin/categories">← Global category types</Link>
    <div className="page-header">
      <p className="eyebrow">ADMIN · GLOBAL · {label.toUpperCase()}</p>
      <h1>{label} Global Categories</h1>
      <p>Create a global category exactly like creating a private category. The only difference is that categories created here are shared with every user.</p>
    </div>

    <section className="product-actions private-category-actions admin-global-category-form">
      <div className="private-category-fields">
        <label>
          <span>{label} global category name</span>
          <input placeholder={sourceType === "ECOMMERCE" ? "e.g. Electronics" : "e.g. Packaged Foods"} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addRoot(); }} disabled={creating} />
        </label>
        <div className="final-control-lock" onContextMenu={(e) => { e.preventDefault(); setAdvancedFinal(true); }} onTouchStart={(e) => { const t = window.setTimeout(() => setAdvancedFinal(true), 800); e.currentTarget.dataset.longPress = t; }} onTouchEnd={(e) => window.clearTimeout(Number(e.currentTarget.dataset.longPress || 0))}>
          {advancedFinal ? <label className="checkbox-field"><input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} disabled={creating} /><span>Set as final product category</span></label> : <span className="gesture-hint">Long-press or right-click for advanced final control</span>}
        </div>
      </div>
      <div className="product-action-buttons">
        <button className="primary-button" type="button" onClick={addRoot} disabled={creating || !name.trim()}>{creating ? "Creating..." : `Add ${label.toLowerCase()} global category`}</button>
      </div>
      {message && <div className="status-message">{message}</div>}
    </section>

    <section className="product-categories">
      <div className="section-heading"><div><h2>{label} global categories</h2><p>Open a category to add its next global subcategory. You can delete any global branch from here.</p></div></div>
      {loading ? <p>Loading...</p> : categories.length ? <div className="category-grid">{categories.map((c) => <div className="category-item" key={c.id}><Link to={`/admin/categories/${sourceType.toLowerCase()}/${c.id}?globalAdmin=1`} className="category-card"><h3>{c.name}</h3><p>{c.isFinalProductType ? "Final category" : "Can contain global subcategories"} · {label} · Global</p></Link><button className="delete-category-button" type="button" onClick={() => remove(c)}>Delete global category</button></div>)}</div> : <p>No {label.toLowerCase()} global categories yet.</p>}
    </section>
  </div>;
}

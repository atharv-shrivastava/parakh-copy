import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, getUser } from "../lib/auth";
import "../styles/products.css";
import "../styles/ecommerce-products.css";

const API_URL = "http://localhost:5000/api";

function EcommerceProducts() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [advancedFinal, setAdvancedFinal] = useState(false);
  const [final, setFinal] = useState(false);
  const user = getUser();

  async function load() {
    setLoading(true); setMessage("");
    try {
      const response = await apiFetch(`${API_URL}/categories`);
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data?.error || "Could not load categories");
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) { setMessage(error.message || "Could not load categories"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function addMainCategory() {
    const categoryName = name.trim();
    if (!categoryName || creating) return;
    setCreating(true); setMessage("");
    try {
      const response = await apiFetch(`${API_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName, parentId: null, isFinal: advancedFinal && final, global: false }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Could not add main category");
      setName(""); setFinal(false); setAdvancedFinal(false); setMessage("Private main category created for this account only.");
      await load();
    } catch (error) { setMessage(error.message || "Could not add main category"); }
    finally { setCreating(false); }
  }

  async function deleteCategory(category) {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    const response = await apiFetch(`${API_URL}/categories/${category.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data?.error || "Delete failed");
    load();
  }

  return <div className="products-page ecommerce-products-page">
    <div className="page-header"><p className="eyebrow">E-COMMERCE PRODUCT DATABASE</p><h1>E-commerce Products</h1><p>Online products use the same category → subcategory → final product hierarchy as offline products. Select a category to drill down to its products.</p></div>
    <section className="product-actions private-category-actions ecommerce-main-category-actions">
      <div className="private-category-fields">
        <label><span>Private main category</span><input placeholder="e.g. Electronics, Clothing, Home Appliances" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addMainCategory(); }} disabled={creating} /></label>
        <div className="final-control-lock" onContextMenu={(e) => { e.preventDefault(); setAdvancedFinal(true); }} onTouchStart={(e) => { const t = window.setTimeout(() => setAdvancedFinal(true), 800); e.currentTarget.dataset.longPress = t; }} onTouchEnd={(e) => window.clearTimeout(Number(e.currentTarget.dataset.longPress || 0))}>{advancedFinal ? <label className="checkbox-field"><input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} disabled={creating} /><span>Set as final product category</span></label> : <span className="gesture-hint">Long-press or right-click for advanced final control</span>}</div>
      </div>
      <div className="product-action-buttons"><button className="primary-button" type="button" onClick={addMainCategory} disabled={creating || !name.trim()}>{creating ? "Creating…" : "Add main category"}</button><Link className="secondary-action" to="/ecommerce-inspection">Inspect listing</Link><Link className="secondary-action" to="/products">Offline products</Link>{user?.role === "ADMIN" && <Link className="secondary-action" to="/admin/categories">Manage global categories</Link>}</div>
    </section>
    {message && <div className="status-message">{message}</div>}
    <section className="product-categories"><div className="section-heading"><div><h2>Main categories</h2><p>Categories are shared with the normal product database. Private categories created here are available only to your account.</p></div></div>
      {loading ? <p>Loading...</p> : <div className="category-grid">{categories.map((category) => <div className="category-item" key={category.id}><Link to={`/ecommerce-products/category/${category.id}`} className="category-card"><h3>{category.name}</h3><p>{category.isSystem ? "Global" : "Private to your account"} · {category.isFinalProductType ? "Final category" : "Can contain subcategories"}</p></Link>{!category.isSystem && <button className="delete-category-button" type="button" onClick={() => deleteCategory(category)}>Delete</button>}</div>)}</div>}
      {!loading && !categories.length && <p>No categories available.</p>}
    </section>
  </div>;
}

export default EcommerceProducts;

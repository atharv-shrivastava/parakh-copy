import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function TreeNode({ node, onDelete }) {
  return <div className="category-tree-node">
    <div className="category-item">
      <Link className="category-card" to={`/products/category/${node.id}`}>
        <h3>{node.name}</h3>
        <p>{node.sourceType === "ECOMMERCE" ? "E-commerce" : "Offline"} · {node.isFinalProductType ? "Final category" : "Can contain subcategories"} · Global</p>
      </Link>
      <button className="delete-category-button" type="button" onClick={() => onDelete(node)}>Delete global category</button>
    </div>
    {node.children?.length ? <div className="category-tree-children">{node.children.map((child) => <TreeNode key={child.id} node={child} onDelete={onDelete} />)}</div> : null}
  </div>;
}

function GlobalCategoryForm({ sourceType, onCreated }) {
  const [name, setName] = useState("");
  const [final, setFinal] = useState(false);
  const [advancedFinal, setAdvancedFinal] = useState(false);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  async function add() {
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
      if (!r.ok) {
        setMessage(d?.error || "Could not create global category");
        return;
      }
      setName("");
      setFinal(false);
      setMessage(`${sourceType === "ECOMMERCE" ? "E-commerce" : "Offline"} global category added for all users.`);
      onCreated();
    } finally {
      setCreating(false);
    }
  }

  return <section className="product-actions private-category-actions admin-global-category-form">
    <div className="private-category-fields">
      <label>
        <span>{sourceType === "ECOMMERCE" ? "E-commerce" : "Offline"} global category name</span>
        <input placeholder={sourceType === "ECOMMERCE" ? "e.g. Online Electronics" : "e.g. Packaged Foods"} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} disabled={creating} />
      </label>
      <div className="final-control-lock" onContextMenu={(e) => { e.preventDefault(); setAdvancedFinal(true); }} onTouchStart={(e) => { const t = window.setTimeout(() => setAdvancedFinal(true), 800); e.currentTarget.dataset.longPress = t; }} onTouchEnd={(e) => window.clearTimeout(Number(e.currentTarget.dataset.longPress || 0))}>
        {advancedFinal ? <label className="checkbox-field"><input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} disabled={creating} /><span>Set as final product category</span></label> : <span className="gesture-hint">Long-press or right-click for advanced final control</span>}
      </div>
    </div>
    <div className="product-action-buttons">
      <button className="primary-button" type="button" onClick={add} disabled={creating || !name.trim()}>{creating ? "Creating..." : `Add ${sourceType === "ECOMMERCE" ? "e-commerce" : "offline"} global category`}</button>
    </div>
    {message && <div className="status-message">{message}</div>}
  </section>;
}

export default function AdminCategories() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const r = await apiFetch(`${API_URL}/categories/tree/all`);
    const d = await r.json().catch(() => []);
    if (r.ok) setTree(d);
    else setMessage(d?.error || "Could not load global categories");
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function remove(category) {
    if (!window.confirm(`Delete ${category.name}? Products in this branch will be moved to the appropriate Uncategorized category and descendant categories will also be removed.`)) return;
    const r = await apiFetch(`${API_URL}/categories/${category.id}`, { method: "DELETE" });
    const d = await r.json().catch(() => null);
    setMessage(r.ok ? (d?.message || "Global category deleted") : (d?.error || "Delete failed"));
    if (r.ok) await load();
  }

  const offline = tree.filter((x) => x.sourceType !== "ECOMMERCE");
  const ecommerce = tree.filter((x) => x.sourceType === "ECOMMERCE");

  return <div className="products-page">
    <div className="page-header">
      <p className="eyebrow">ADMIN · GLOBAL CATEGORIES</p>
      <h1>Global Categories</h1>
      <p>Admin-created categories are shared with every user. Your own products and private categories remain in your normal Products area and are visible only to your account.</p>
    </div>

    <GlobalCategoryForm sourceType="OFFLINE" onCreated={load} />
    <GlobalCategoryForm sourceType="ECOMMERCE" onCreated={load} />

    {message && <div className="status-message">{message}</div>}

    <section className="product-categories">
      <div className="section-heading"><div><h2>Offline global categories</h2><p>Open a category to add its global or private subcategories from inside that category.</p></div></div>
      {loading ? <p>Loading...</p> : offline.length ? <div className="category-tree">{offline.map((root) => <TreeNode key={root.id} node={root} onDelete={remove} />)}</div> : <p>No offline global categories yet.</p>}
    </section>

    <section className="product-categories">
      <div className="section-heading"><div><h2>E-commerce global categories</h2><p>Open a category to add its global or private subcategories from inside that category.</p></div></div>
      {loading ? <p>Loading...</p> : ecommerce.length ? <div className="category-tree">{ecommerce.map((root) => <TreeNode key={root.id} node={root} onDelete={remove} />)}</div> : <p>No e-commerce global categories yet.</p>}
    </section>
  </div>;
}

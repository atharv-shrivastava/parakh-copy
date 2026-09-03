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
        <p>{node.sourceType === "ECOMMERCE" ? "E-commerce" : "Offline"} · {node.isFinalProductType ? "Final category" : "Category"} · Global</p>
      </Link>
      <button className="delete-category-button" type="button" onClick={() => onDelete(node)}>Delete</button>
    </div>
    {node.children?.length ? <div className="category-tree-children">{node.children.map((child) => <TreeNode key={child.id} node={child} onDelete={onDelete} />)}</div> : null}
  </div>;
}

function AdminCategories() {
  const [tree, setTree] = useState([]);
  const [name, setName] = useState("");
  const [final, setFinal] = useState(false);
  const [sourceType, setSourceType] = useState("OFFLINE");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const r = await apiFetch(`${API_URL}/categories/tree/all`);
    const d = await r.json().catch(() => []);
    if (r.ok) setTree(d);
    else setMessage(d.error || "Could not load categories");
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addRoot() {
    const clean = name.trim();
    if (!clean || creating) return setMessage("Category name is required");
    setCreating(true);
    setMessage("");
    try {
      const r = await apiFetch(`${API_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean, parentId: null, isFinal: final, sourceType, global: true }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) return setMessage(d?.error || "Could not create global category");
      setName("");
      setFinal(false);
      setMessage(`Global ${sourceType === "ECOMMERCE" ? "e-commerce" : "offline"} category created for every user.`);
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function remove(category) {
    if (!window.confirm(`Delete ${category.name}? Products in this branch will be moved to Uncategorized and descendant categories will also be removed.`)) return;
    const r = await apiFetch(`${API_URL}/categories/${category.id}`, { method: "DELETE" });
    const d = await r.json().catch(() => null);
    setMessage(r.ok ? (d?.message || "Category deleted") : (d?.error || "Delete failed"));
    if (r.ok) await load();
  }

  return <div className="products-page">
    <div className="page-header">
      <p className="eyebrow">ADMIN</p>
      <h1>Global categories</h1>
      <p>Create a global main category here. Open a category to add its global subcategories from inside that category, just like private category management.</p>
    </div>

    {message && <div className="status-message">{message}</div>}

    <section className="product-actions private-category-actions admin-global-category-form">
      <div className="private-category-fields">
        <label>
          <span>Global category name</span>
          <input placeholder="e.g. Packaged Foods" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addRoot(); }} disabled={creating} />
        </label>
        <label>
          <span>Source</span>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} disabled={creating}>
            <option value="OFFLINE">Offline</option>
            <option value="ECOMMERCE">E-commerce</option>
          </select>
        </label>
        <div className="final-control-lock">
          <label className="checkbox-field">
            <input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} disabled={creating} />
            <span>Set as final product category</span>
          </label>
        </div>
      </div>
      <div className="product-action-buttons">
        <button className="primary-button" type="button" onClick={addRoot} disabled={creating || !name.trim()}>{creating ? "Creating..." : "Add global category"}</button>
      </div>
    </section>

    <section className="product-categories">
      <div className="section-heading">
        <div>
          <h2>Global category tree</h2>
          <p>Click a category to open it and add a global subcategory there. Offline and E-commerce branches stay separate.</p>
        </div>
      </div>
      {loading ? <p>Loading...</p> : tree.length ? <div className="category-tree">{tree.map((root) => <TreeNode key={root.id} node={root} onDelete={remove} />)}</div> : <p>No global categories yet.</p>}
    </section>
  </div>;
}

export default AdminCategories;

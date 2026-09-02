import { useEffect, useState } from "react";
import { apiFetch } from "../lib/auth";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";
function flatten(nodes, path = []) { return nodes.flatMap((n) => { const next = [...path, n]; return [{ ...n, path: next }, ...flatten(n.children || [], next)]; }); }
function AdminCategories() {
  const [tree, setTree] = useState([]); const [selected, setSelected] = useState(""); const [name, setName] = useState(""); const [final, setFinal] = useState(false); const [message, setMessage] = useState("");
  async function load() { const r = await apiFetch(`${API_URL}/categories/tree/all`); const d = await r.json().catch(() => []); if (r.ok) setTree(d); else setMessage(d.error || "Could not load categories"); }
  useEffect(() => { load(); }, []);
  async function add() { if (!name.trim()) return setMessage("Category name is required"); const r = await apiFetch(`${API_URL}/categories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parentId: selected || null, isFinal: final, global: true }) }); const d = await r.json(); if (!r.ok) return setMessage(d.error || "Could not create category"); setName(""); setFinal(false); setSelected(""); setMessage("Global category created for every user."); load(); }
  async function remove(id) { if (!window.confirm("Delete this global category? It must have no children or products.")) return; const r = await apiFetch(`${API_URL}/categories/${id}`, { method: "DELETE" }); const d = await r.json(); setMessage(d.error || d.message); if (r.ok) load(); }
  const options = flatten(tree);
  return <div className="products-page"><div className="page-header"><p className="eyebrow">ADMIN</p><h1>Global categories</h1><p>Anything created here is visible to every user. User-private categories never appear here.</p></div><section className="product-actions category-toolbar"><select value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Level 1 category</option>{options.filter((x) => !x.isFinalProductType && x.path.length < 4).map((x) => <option key={x.id} value={x.id}>{x.path.map((p) => p.name).join(" → ")}</option>)}</select><input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} /><label><input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} /> Final category</label><button className="primary-button" type="button" onClick={add}>Add global category</button></section>{message && <div className="status-message">{message}</div>}<section className="product-categories"><div className="category-grid">{tree.map((root) => <div className="category-item" key={root.id}><div className="category-card"><h3>{root.name}</h3><p>{root.isFinalProductType ? "Final category" : "Global category"}</p></div><button className="delete-category-button" type="button" onClick={() => remove(root.id)}>Delete</button></div>)}</div></section></div>;
}
export default AdminCategories;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, getUser } from "../lib/auth";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function Products() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [final, setFinal] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const user = getUser();

  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch(`${API_URL}/categories`);
      const d = await r.json().catch(() => null);
      if (r.ok) setCategories(Array.isArray(d) ? d : []);
      else setMessage(d?.error || "Could not load categories");
    } catch (error) {
      setMessage(error?.message || "Could not load categories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    const categoryName = name.trim();
    if (!categoryName || creating) return;

    setCreating(true);
    setMessage("");
    try {
      const r = await apiFetch(`${API_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName, isFinal: final, global: false }),
      });
      const d = await r.json().catch(() => null);

      if (!r.ok) {
        setMessage(d?.error || "Could not add private category");
        return;
      }

      setName("");
      setFinal(false);
      setMessage("Private category created for this account only.");
      await load();
    } catch (error) {
      setMessage(error?.message || "Could not add private category");
    } finally {
      setCreating(false);
    }
  }

  async function del(c) {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    const r = await apiFetch(`${API_URL}/categories/${c.id}`, { method: "DELETE" });
    const d = await r.json().catch(() => null);
    setMessage(r.ok ? (d?.message || "Category deleted") : (d?.error || "Delete failed"));
    if (r.ok) load();
  }

  return (
    <div className="products-page">
      <div className="page-header">
        <p className="eyebrow">PRODUCT DATABASE</p>
        <h1>Products & categories</h1>
        <p>Global categories are shared. Private categories belong only to {user?.name || "this account"}.</p>
      </div>

      {message && <div className="status-message">{message}</div>}

      <section className="product-actions private-category-actions">
        <div className="private-category-fields">
          <label>
            <span>Private category name</span>
            <input
              placeholder="e.g. Festival Snacks"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              disabled={creating}
            />
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={final}
              onChange={(e) => setFinal(e.target.checked)}
              disabled={creating}
            />
            <span>Set as final product category</span>
          </label>
        </div>
        <button className="primary-button" type="button" onClick={add} disabled={creating || !name.trim()}>
          {creating ? "Creating…" : "Add private category"}
        </button>
        {user?.role === "ADMIN" && <Link className="secondary-action" to="/admin/categories">Manage global categories</Link>}
      </section>

      <section className="product-categories">
        <div className="section-heading">
          <div>
            <h2>Main categories</h2>
            <p>Continue through up to four levels. Final categories are the only places where products can be registered.</p>
          </div>
        </div>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="category-grid">
            {categories.map((c) => (
              <div className="category-item" key={c.id}>
                <Link to={`/products/category/${c.id}`} className="category-card">
                  <h3>{c.name}</h3>
                  <p>{c.isSystem ? "Global" : "Private to your account"} · {c.isFinalProductType ? "Final category" : "Can contain subcategories"}</p>
                </Link>
                {!c.isSystem && <button className="delete-category-button" type="button" onClick={() => del(c)}>Delete</button>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Products;

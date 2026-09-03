import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/products.css";
import "../styles/ecommerce-products.css";

const API_URL = "http://localhost:5000/api";

function EcommerceProducts() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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

  async function deleteCategory(category) {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    const response = await apiFetch(`${API_URL}/categories/${category.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => null);
    if (!response.ok) return setMessage(data?.error || "Delete failed");
    load();
  }

  return <div className="products-page ecommerce-products-page">
    <div className="page-header"><p className="eyebrow">E-COMMERCE PRODUCT DATABASE</p><h1>E-commerce Products</h1><p>Online products use the same category → subcategory → final product hierarchy as offline products. Select a category to drill down to its products.</p></div>
    <div className="product-actions ecommerce-product-actions"><Link className="secondary-action" to="/ecommerce-inspection">+ Inspect listing</Link><Link className="secondary-action" to="/products">Offline products</Link></div>
    {message && <div className="status-message">{message}</div>}
    <section className="product-categories"><div className="section-heading"><div><h2>Main categories</h2><p>Categories are shared with the normal product database. E-commerce products appear only inside their selected final category.</p></div></div>
      {loading ? <p>Loading...</p> : <div className="category-grid">{categories.map((category) => <div className="category-item" key={category.id}><Link to={`/ecommerce-products/category/${category.id}`} className="category-card"><h3>{category.name}</h3><p>{category.isSystem ? "Global" : "Private to your account"} · {category.isFinalProductType ? "Final category" : "Can contain subcategories"}</p></Link>{!category.isSystem && <button className="delete-category-button" type="button" onClick={() => deleteCategory(category)}>Delete</button>}</div>)}</div>}
      {!loading && !categories.length && <p>No categories available.</p>}
    </section>
  </div>;
}

export default EcommerceProducts;

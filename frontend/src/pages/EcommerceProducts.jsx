import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/products.css";
import "../styles/ecommerce-products.css";

const API_URL = "http://localhost:5000/api";

function EcommerceProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError("");
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        apiFetch(`${API_URL}/products?sourceType=ECOMMERCE`),
        apiFetch(`${API_URL}/categories/tree/all`),
      ]);
      const productData = await productsResponse.json().catch(() => []);
      const categoryData = await categoriesResponse.json().catch(() => []);
      if (!productsResponse.ok) throw new Error(productData.error || "Could not load e-commerce products");
      setProducts(Array.isArray(productData) ? productData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
    } catch (e) { setError(e.message || "Could not load e-commerce products"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const finalCategories = useMemo(() => {
    const flatten = (nodes, path = []) => nodes.flatMap((node) => {
      const next = [...path, node];
      return [{ ...node, path: next }, ...flatten(node.children || [], next)];
    });
    return flatten(categories).filter((c) => c.isFinalProductType);
  }, [categories]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const w = website.trim().toLowerCase();
    return products.filter((product) => {
      const source = product.sourceWebsiteName || product.inspections?.[0]?.shop?.name || "";
      const text = [product.productName, product.brandName, product.category?.name, source, product.barcode].filter(Boolean).join(" ").toLowerCase();
      return (!q || text.includes(q)) && (status === "ALL" || product.complianceStatus === status) && (category === "ALL" || product.category?.id === category) && (!w || source.toLowerCase().includes(w));
    });
  }, [products, query, status, category, website]);

  return <div className="products-page ecommerce-products-page">
    <div className="page-header"><p className="eyebrow">E-COMMERCE PRODUCT DATABASE</p><h1>E-commerce Products</h1><p>Stored products inspected from public e-commerce listings. The structure mirrors the normal product database while keeping online inspections separate.</p></div>
    <div className="product-actions ecommerce-product-actions"><Link className="secondary-action" to="/ecommerce-inspection">+ Inspect listing</Link><Link className="secondary-action" to="/products">Offline products</Link></div>
    <section className="product-categories">
      <div className="section-heading"><div><h2>Stored e-commerce products</h2><p>{shown.length} products match the current filters.</p></div></div>
      <div className="ecommerce-product-filters">
        <input placeholder="Search product, brand, website or barcode" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All statuses</option><option value="OKAY">Okay</option><option value="VIOLATION">Violation</option><option value="NEEDS_REVIEW">Needs review</option></select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="ALL">All categories</option>{finalCategories.map((c) => <option key={c.id} value={c.id}>{c.path.map((x) => x.name).join(" → ")}</option>)}</select>
        <input placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {error && <div className="status-message">{error}</div>}
      {loading && <p>Loading e-commerce products...</p>}
      {!loading && !error && !shown.length && <div className="status-message">No e-commerce products match the current filters.</div>}
      {!loading && !error && shown.length > 0 && <div className="product-list">{shown.map((product) => <div className="product-row" key={product.id}><Link to={`/products/item/${product.id}`}><div><strong>{product.productName}</strong><span>{product.brandName || "Brand not recorded"}</span></div><div><span>{product.netQuantity || "-"} {product.unit || ""}</span><span>₹{product.mrp ?? "-"} · {product.sourceWebsiteName || product.inspections?.[0]?.shop?.name || "Website not recorded"}</span></div><span className={`compliance-badge ${(product.complianceStatus || "NEEDS_REVIEW").toLowerCase()}`}>{product.complianceStatus || "NEEDS_REVIEW"}</span></Link></div>)}</div>}
    </section>
  </div>;
}

export default EcommerceProducts;

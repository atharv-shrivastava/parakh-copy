import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/products.css";
import "../styles/ecommerce-products.css";

const API_URL = "http://localhost:5000/api";

function pathOf(category) {
  const nodes = []; let current = category;
  while (current) { nodes.unshift(current); current = current.parent; }
  return nodes.map((node) => node.name).join(" → ");
}

export default function EcommerceCategoryPage() {
  const { categoryId } = useParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ status: "ALL", productName: "", brand: "", website: "", unit: "", minQ: "", maxQ: "", minMrp: "", maxMrp: "", dateFrom: "", dateTo: "" });
  const [childName, setChildName] = useState("");
  const [childFinal, setChildFinal] = useState(false);
  const [showChild, setShowChild] = useState(false);
  const [advancedFinal, setAdvancedFinal] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [categoryResponse, productResponse] = await Promise.all([
        apiFetch(`${API_URL}/categories/id/${categoryId}`),
        apiFetch(`${API_URL}/products?categoryId=${encodeURIComponent(categoryId)}&sourceType=ECOMMERCE`),
      ]);
      const categoryData = await categoryResponse.json().catch(() => null);
      const productData = await productResponse.json().catch(() => []);
      if (!categoryResponse.ok) throw new Error(categoryData?.error || "Category not found");
      if (!productResponse.ok) throw new Error(productData?.error || "Could not load e-commerce products");
      setCategory(categoryData);
      setProducts(Array.isArray(productData) ? productData : []);
    } catch (error) { setMessage(error.message || "Could not load category"); }
  }

  useEffect(() => { setCategory(null); setProducts([]); setMessage(""); load(); }, [categoryId]);

  const depth = useMemo(() => {
    let current = category?.parent; let value = 1;
    while (current) { value += 1; current = current.parent; }
    return value;
  }, [category]);

  const children = category?.children || [];
  const isFinal = Boolean(category?.isFinalProductType);
  const canAddChild = !isFinal && depth < 4;

  const shownProducts = useMemo(() => products.filter((product) => {
    const website = product.sourceWebsiteName || "";
    const quantity = Number.parseFloat(String(product.netQuantity || "").replace(/[^0-9.]/g, ""));
    const inspectedAt = new Date(product.inspections?.[0]?.inspectedAt || product.createdAt);
    return (filters.status === "ALL" || product.complianceStatus === filters.status)
      && (product.productName || "").toLowerCase().includes(filters.productName.toLowerCase())
      && (product.brandName || "").toLowerCase().includes(filters.brand.toLowerCase())
      && website.toLowerCase().includes(filters.website.toLowerCase())
      && (!filters.unit || (product.unit || "").toLowerCase() === filters.unit.toLowerCase())
      && (!filters.minQ || quantity >= Number(filters.minQ))
      && (!filters.maxQ || quantity <= Number(filters.maxQ))
      && (!filters.minMrp || Number(product.mrp) >= Number(filters.minMrp))
      && (!filters.maxMrp || Number(product.mrp) <= Number(filters.maxMrp))
      && (!filters.dateFrom || inspectedAt >= new Date(`${filters.dateFrom}T00:00:00`))
      && (!filters.dateTo || inspectedAt <= new Date(`${filters.dateTo}T23:59:59.999`));
  }), [products, filters]);

  function setFilter(key, value) { setFilters((current) => ({ ...current, [key]: value })); }

  async function addChild() {
    const cleanName = childName.trim();
    if (!cleanName || !canAddChild) return;

    const response = await apiFetch(`${API_URL}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cleanName,
        parentId: category.id,
        isFinal: advancedFinal && childFinal,
        sourceType: category.sourceType,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return setMessage(data?.error || "Could not add category");
    setChildName(""); setChildFinal(false); setShowChild(false); setAdvancedFinal(false);
    setMessage("Private E-commerce subcategory added to this account.");
    load();
  }

  async function deleteCategory(id) {
    if (!window.confirm("Delete this category?")) return;
    const response = await apiFetch(`${API_URL}/categories/${id}`, { method: "DELETE" });
    const data = await response.json().catch(() => null);
    if (!response.ok) return setMessage(data?.error || "Delete failed");
    window.location.href = category.parent ? `/ecommerce-products/category/${category.parent.id}` : "/ecommerce-products";
  }

  if (!category) return <div className="products-page"><p>{message || "Loading..."}</p></div>;

  return <div className="products-page ecommerce-products-page">
    <Link className="back-link" to={category.parent ? `/ecommerce-products/category/${category.parent.id}` : "/ecommerce-products"}>← Back</Link>
    <div className="page-header">
      <p className="eyebrow">E-COMMERCE PRODUCT DATABASE · LEVEL {depth}</p>
      <h1>{category.name}</h1>
      <p>{pathOf(category)}</p>
      <p>{category.isSystem ? "GLOBAL CATEGORY" : "PRIVATE CATEGORY"} · E-COMMERCE · {isFinal ? "FINAL PRODUCT CATEGORY" : "SUBCATEGORY"}</p>
    </div>
    {message && <div className="status-message">{message}</div>}
    {canAddChild && <section className="product-actions category-toolbar"><button className="secondary-action" type="button" onClick={() => setShowChild((value) => !value)}>+ Add subcategory</button></section>}
    {showChild && <div className="category-form" onContextMenu={(event) => { event.preventDefault(); setAdvancedFinal(true); }}>
      <input placeholder="New subcategory" value={childName} onChange={(event) => setChildName(event.target.value)} />
      {depth < 3 && advancedFinal && <label><input type="checkbox" checked={childFinal} onChange={(event) => setChildFinal(event.target.checked)} /> Mark final</label>}
      <button type="button" onClick={addChild}>Add</button>
      <span className="gesture-hint">{advancedFinal ? "Advanced final control unlocked" : "Right-click this form for final control"}</span>
    </div>}
    {!isFinal && <section className="product-categories">
      <div className="section-heading"><div><h2>Subcategories</h2><p>Maximum depth is four. Final categories cannot have subcategories.</p></div></div>
      <div className="category-grid">{children.map((child) => <div className="category-item" key={child.id}>
        <Link className="category-card" to={`/ecommerce-products/category/${child.id}`}><h3>{child.name}</h3><p>{child.isSystem ? "Global" : "Private to your account"} · E-commerce · {child.isFinalProductType ? "Final category" : `Level ${depth + 1}`}</p></Link>
        {!child.isSystem && <button className="delete-category-button" type="button" onClick={() => deleteCategory(child.id)}>Delete</button>}
      </div>)}</div>
      {!children.length && <p>No subcategories yet.</p>}
    </section>}
    {isFinal && <section className="product-categories">
      <div className="section-heading"><div><h2>Registered {category.name} e-commerce products</h2><p>{shownProducts.length} products match the current filters.</p></div></div>
      <div className="filter-panel">
        <input placeholder="Product" value={filters.productName} onChange={(event) => setFilter("productName", event.target.value)} />
        <input placeholder="Brand" value={filters.brand} onChange={(event) => setFilter("brand", event.target.value)} />
        <input placeholder="Website" value={filters.website} onChange={(event) => setFilter("website", event.target.value)} />
        <select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}><option>ALL</option><option>OKAY</option><option>VIOLATION</option><option>NEEDS_REVIEW</option><option>UNABLE_TO_VERIFY</option></select>
        <select value={filters.unit} onChange={(event) => setFilter("unit", event.target.value)}><option value="">Any unit</option><option value="mg">mg</option><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="pcs">pcs</option><option value="dozen">dozen</option><option value="m">m</option></select>
        <input type="number" placeholder="Min quantity" value={filters.minQ} onChange={(event) => setFilter("minQ", event.target.value)} />
        <input type="number" placeholder="Max quantity" value={filters.maxQ} onChange={(event) => setFilter("maxQ", event.target.value)} />
        <input type="number" placeholder="Min MRP" value={filters.minMrp} onChange={(event) => setFilter("minMrp", event.target.value)} />
        <input type="number" placeholder="Max MRP" value={filters.maxMrp} onChange={(event) => setFilter("maxMrp", event.target.value)} />
        <label className="filter-date"><span>From date</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilter("dateFrom", event.target.value)} /></label>
        <label className="filter-date"><span>To date</span><input type="date" value={filters.dateTo} onChange={(event) => setFilter("dateTo", event.target.value)} /></label>
      </div>
      <div className="product-list">{shownProducts.map((product) => <div className="product-row" key={product.id}><Link to={`/products/item/${product.id}`}><div><strong>{product.productName}</strong><span>{product.brandName || "Brand not recorded"}</span></div><div><span>{product.netQuantity || "-"} {product.unit || ""}</span><span>₹{product.mrp ?? "-"} · {product.sourceWebsiteName || "Website not recorded"}</span></div><span className={`compliance-badge ${(product.complianceStatus || "NEEDS_REVIEW").toLowerCase()}`}>{product.complianceStatus || "NEEDS_REVIEW"}</span></Link></div>)}</div>
      {!shownProducts.length && <p>No e-commerce products in this final category yet.</p>}
    </section>}
  </div>;
}

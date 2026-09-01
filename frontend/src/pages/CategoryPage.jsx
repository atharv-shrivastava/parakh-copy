import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function CategoryPage() {
  const { categoryId } = useParams();
  const [category, setCategory] = useState(null);
  const [filters, setFilters] = useState({ status: "ALL", brandName: "", shopName: "", productName: "", unit: "", minQuantity: "", maxQuantity: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [childName, setChildName] = useState("");
  const [showChildForm, setShowChildForm] = useState(false);
  const [message, setMessage] = useState("");

  async function loadCategory() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/categories/id/${categoryId}`);
      if (!response.ok) throw new Error("Category not found");
      setCategory(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCategory(); }, [categoryId]);

  const filteredProducts = useMemo(() => {
    const products = category?.products ?? [];
    return products.filter((product) => {
      const shop = product.inspections?.[0]?.shop?.name ?? "";
      const quantity = Number.parseFloat(product.netQuantity ?? "");
      const min = filters.minQuantity === "" ? null : Number(filters.minQuantity);
      const max = filters.maxQuantity === "" ? null : Number(filters.maxQuantity);
      return (
        (filters.status === "ALL" || product.complianceStatus === filters.status) &&
        product.productName.toLowerCase().includes(filters.productName.toLowerCase()) &&
        (product.brandName ?? "").toLowerCase().includes(filters.brandName.toLowerCase()) &&
        shop.toLowerCase().includes(filters.shopName.toLowerCase()) &&
        (!filters.unit || product.unit === filters.unit) &&
        (min === null || (Number.isFinite(quantity) && quantity >= min)) &&
        (max === null || (Number.isFinite(quantity) && quantity <= max))
      );
    });
  }, [category, filters]);

  async function addChildCategory() {
    if (!childName.trim() || !category) return;
    const slug = childName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: childName.trim(), slug, parentId: category.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add category");
      setChildName("");
      setShowChildForm(false);
      setMessage(`Added ${data.name}.`);
      await loadCategory();
    } catch (err) {
      setMessage(err.message);
    }
  }

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  if (loading) return <div className="products-page"><p>Loading category...</p></div>;
  if (error) return <div className="products-page"><p>Error: {error}</p></div>;

  const hasChildren = category.children?.length > 0;
  const parentLink = category.parent ? `/products/category/${category.parent.id}` : "/products";

  return (
    <div className="products-page">
      <Link to={parentLink} className="back-link">← Back</Link>

      <div className="page-header">
        <p className="eyebrow">PRODUCT DATABASE</p>
        <h1>{category.name}</h1>
        <p>{hasChildren ? "Continue through the dynamic product hierarchy." : "Products registered under this product type."}</p>
      </div>

      {message && <div className="status-message">{message}</div>}

      <section className="product-actions category-toolbar">
        <Link to={`/products/register?parentId=${category.id}`} className="register-product-button">Register New Product</Link>
        <button className="secondary-action" onClick={() => setShowChildForm((value) => !value)}>+ Add Subcategory / Product Type</button>
      </section>

      {showChildForm && (
        <div className="category-form">
          <input value={childName} onChange={(event) => setChildName(event.target.value)} placeholder={`New child under ${category.name}`} />
          <button type="button" onClick={addChildCategory}>Add</button>
        </div>
      )}

      {hasChildren ? (
        <section className="product-categories">
          <div className="section-heading"><div><h2>Subcategories / Product Types</h2><p>Every main category uses the same structure.</p></div></div>
          <div className="category-grid">
            {category.children.map((child) => (
              <Link key={child.id} to={`/products/category/${child.id}`} className="category-card">
                <h3>{child.name}</h3>
                <p>Open and continue to the next level.</p>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="product-categories">
          <div className="section-heading"><div><h2>Products</h2><p>Common compliance filters work for every product type.</p></div></div>
          <div className="filter-panel">
            <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}><option value="ALL">All compliance results</option><option value="OKAY">Okay</option><option value="VIOLATION">Violation</option><option value="NEEDS_REVIEW">Needs review</option></select>
            <input placeholder="Product name" value={filters.productName} onChange={(e) => setFilter("productName", e.target.value)} />
            <input placeholder="Company / brand" value={filters.brandName} onChange={(e) => setFilter("brandName", e.target.value)} />
            <input placeholder="Shop name" value={filters.shopName} onChange={(e) => setFilter("shopName", e.target.value)} />
            <select value={filters.unit} onChange={(e) => setFilter("unit", e.target.value)}><option value="">Any unit</option><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="pcs">pcs</option></select>
            <input type="number" placeholder="Min quantity" value={filters.minQuantity} onChange={(e) => setFilter("minQuantity", e.target.value)} />
            <input type="number" placeholder="Max quantity" value={filters.maxQuantity} onChange={(e) => setFilter("maxQuantity", e.target.value)} />
          </div>

          {filteredProducts.length === 0 ? <p>No products match these filters.</p> : (
            <div className="product-list">
              {filteredProducts.map((product) => (
                <Link key={product.id} to={`/products/item/${product.id}`} className="product-row">
                  <div><strong>{product.productName}</strong><span>{product.brandName || "Company not recorded"}</span></div>
                  <div><span>{product.netQuantity || "Quantity not recorded"} {product.unit || ""}</span><span>{product.inspections?.[0]?.shop?.name || "Shop not recorded"}</span></div>
                  <span className={`compliance-badge ${product.complianceStatus.toLowerCase()}`}>{product.complianceStatus === "VIOLATION" ? "Violation" : product.complianceStatus === "OKAY" ? "Okay" : "Needs review"}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default CategoryPage;

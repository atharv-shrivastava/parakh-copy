import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function createSlug(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function CategoryPage() {
  const { categoryId } = useParams();
  const location = useLocation();
  const [category, setCategory] = useState(null);
  const [filters, setFilters] = useState({
    status: "ALL",
    brandName: "",
    shopName: "",
    productName: "",
    unit: "",
    minQuantity: "",
    maxQuantity: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [childName, setChildName] = useState("");
  const [showChildForm, setShowChildForm] = useState(false);
  const [message, setMessage] = useState("");

  async function loadCategory() {
    setLoading(true);
    setError("");
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

  useEffect(() => {
    loadCategory();
  }, [categoryId]);

  const depth = category
    ? category.parent
      ? category.parent.parent
        ? 3
        : 2
      : 1
    : 0;

  const isProductType = depth === 3;
  const canAddChild = depth === 1 || depth === 2;
  const children = category?.children ?? [];

  const filteredProducts = useMemo(() => {
    return (category?.products ?? []).filter((product) => {
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
    const name = childName.trim();
    if (!name || !category || !canAddChild) return;

    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: createSlug(name), parentId: category.id }),
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

  async function deleteCategory() {
    if (!category) return;
    const confirmed = window.confirm(
      `Delete "${category.name}"? Categories containing children or products cannot be deleted.`
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/categories/${category.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete category");
      window.location.href = depth === 1 ? "/products" : `/products/category/${category.parent.id}`;
    } catch (err) {
      setMessage(err.message);
    }
  }

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  if (loading) return <div className="products-page"><p>Loading category...</p></div>;
  if (error) return <div className="products-page"><p>Error: {error}</p></div>;

  const parentLink = category.parent ? `/products/category/${category.parent.id}` : "/products";
  const levelTitle = depth === 1 ? "Subcategories" : depth === 2 ? "Product Types" : "Products";
  const addLabel = depth === 1 ? "Register New Subcategory" : "Register New Product Type";
  const path = [category.parent?.parent?.parent, category.parent?.parent, category.parent, category]
    .filter(Boolean)
    .map((item) => item.name)
    .join(" → ");

  return (
    <div className="products-page">
      <Link to={parentLink} className="back-link">← Back</Link>

      <div className="page-header">
        <p className="eyebrow">PRODUCT DATABASE</p>
        <h1>{category.name}</h1>
        <p>{path}</p>
      </div>

      {message && <div className="status-message">{message}</div>}

      <section className="product-actions category-toolbar">
        {canAddChild && (
          <button className="secondary-action" type="button" onClick={() => setShowChildForm((value) => !value)}>
            + {addLabel}
          </button>
        )}
        <button className="delete-category-button" type="button" onClick={deleteCategory}>
          Delete {depth === 1 ? "Category" : depth === 2 ? "Subcategory" : "Product Type"}
        </button>
      </section>

      {showChildForm && canAddChild && (
        <div className="category-form">
          <input
            value={childName}
            onChange={(event) => setChildName(event.target.value)}
            placeholder={depth === 1 ? `New subcategory under ${category.name}` : `New product type under ${category.name}`}
          />
          <button type="button" onClick={addChildCategory}>Add</button>
        </div>
      )}

      {isProductType ? (
        <section className="product-categories">
          <div className="section-heading">
            <div>
              <h2>Scanned Products</h2>
              <p>Products are added here automatically when an inspection is saved from Scan.</p>
            </div>
          </div>

          <div className="filter-panel">
            <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
              <option value="ALL">All compliance results</option>
              <option value="OKAY">Okay</option>
              <option value="VIOLATION">Violation</option>
              <option value="NEEDS_REVIEW">Needs review</option>
            </select>
            <input placeholder="Product name" value={filters.productName} onChange={(e) => setFilter("productName", e.target.value)} />
            <input placeholder="Company / brand" value={filters.brandName} onChange={(e) => setFilter("brandName", e.target.value)} />
            <input placeholder="Shop name" value={filters.shopName} onChange={(e) => setFilter("shopName", e.target.value)} />
            <select value={filters.unit} onChange={(e) => setFilter("unit", e.target.value)}>
              <option value="">Any unit</option><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="pcs">pcs</option><option value="m">m</option>
            </select>
            <input type="number" placeholder="Min quantity" value={filters.minQuantity} onChange={(e) => setFilter("minQuantity", e.target.value)} />
            <input type="number" placeholder="Max quantity" value={filters.maxQuantity} onChange={(e) => setFilter("maxQuantity", e.target.value)} />
          </div>

          {filteredProducts.length === 0 ? <p>No products match these filters.</p> : (
            <div className="product-list">
              {filteredProducts.map((product) => (
                <Link key={product.id} to={`/products/item/${product.id}`} state={{ product }} className="product-row">
                  <div><strong>{product.productName}</strong><span>{product.brandName || "Company not recorded"}</span></div>
                  <div><span>{product.netQuantity || "Quantity not recorded"} {product.unit || ""}</span><span>{product.inspections?.[0]?.shop?.name || "Shop not recorded"}</span></div>
                  <span className={`compliance-badge ${product.complianceStatus.toLowerCase()}`}>{product.complianceStatus}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="product-categories">
          <div className="section-heading">
            <div><h2>{levelTitle}</h2><p>Level {depth} of 3. Only the next hierarchy level can be created here.</p></div>
          </div>
          {children.length === 0 ? <p>No {depth === 1 ? "subcategories" : "product types"} yet.</p> : (
            <div className="category-grid">
              {children.map((child) => (
                <div key={child.id} className="category-item">
                  <Link to={`/products/category/${child.id}`} className="category-card">
                    <h3>{child.name}</h3>
                    <p>{depth === 1 ? "Open subcategory" : "Open product type"}</p>
                  </Link>
                  <button
                    type="button"
                    className="delete-category-button"
                    onClick={async () => {
                      if (!window.confirm(`Delete "${child.name}"? This cannot be undone.`)) return;
                      try {
                        const response = await fetch(`${API_URL}/categories/${child.id}`, { method: "DELETE" });
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.error || "Could not delete category");
                        setMessage(`"${child.name}" deleted successfully.`);
                        await loadCategory();
                      } catch (err) { setMessage(err.message); }
                    }}
                  >Delete</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default CategoryPage;

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function CategoryPage() {
  const { categorySlug } = useParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
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
      const response = await fetch(`${API_URL}/categories/${categorySlug}`);
      if (!response.ok) throw new Error("Category not found");
      const data = await response.json();
      setCategory(data);
      setProducts(data.products ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategory();
  }, [categorySlug]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const latestShop = product.inspections?.[0]?.shop?.name ?? "";
      const quantity = Number.parseFloat(product.netQuantity ?? "");
      const min = filters.minQuantity === "" ? null : Number(filters.minQuantity);
      const max = filters.maxQuantity === "" ? null : Number(filters.maxQuantity);

      return (
        (filters.status === "ALL" || product.complianceStatus === filters.status) &&
        product.productName.toLowerCase().includes(filters.productName.toLowerCase()) &&
        (product.brandName ?? "").toLowerCase().includes(filters.brandName.toLowerCase()) &&
        latestShop.toLowerCase().includes(filters.shopName.toLowerCase()) &&
        (!filters.unit || product.unit === filters.unit) &&
        (min === null || (Number.isFinite(quantity) && quantity >= min)) &&
        (max === null || (Number.isFinite(quantity) && quantity <= max))
      );
    });
  }, [products, filters]);

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

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  if (loading) return <div className="products-page"><p>Loading category...</p></div>;
  if (error) return <div className="products-page"><p>Error: {error}</p></div>;

  const parentLink = category.parent ? `/products/${category.parent.slug}` : "/products";
  const hasChildren = category.children?.length > 0;

  return (
    <div className="products-page">
      <Link to={parentLink} className="back-link">← Back</Link>

      <div className="page-header">
        <p className="eyebrow">PRODUCT DATABASE</p>
        <h1>{category.name}</h1>
        <p>{hasChildren ? "Choose the next level of the product hierarchy." : "Inspected products in this product type."}</p>
      </div>

      {message && <div className="status-message">{message}</div>}

      <section className="product-actions category-toolbar">
        <Link
          to={`/products/register?parentId=${category.id}`}
          className="register-product-button"
        >
          Register New Product
        </Link>
        <button className="secondary-action" onClick={() => setShowChildForm((value) => !value)}>
          + Add Subcategory / Product Type
        </button>
      </section>

      {showChildForm && (
        <div className="category-form">
          <input
            value={childName}
            onChange={(event) => setChildName(event.target.value)}
            placeholder={`New child under ${category.name}`}
          />
          <button type="button" onClick={addChildCategory}>Add</button>
        </div>
      )}

      {hasChildren ? (
        <section className="product-categories">
          <div className="section-heading">
            <div>
              <h2>Subcategories / Product Types</h2>
              <p>This same hierarchy works for every main category.</p>
            </div>
          </div>
          <div className="category-grid">
            {category.children.map((child) => (
              <Link key={child.id} to={`/products/${child.slug}`} className="category-card">
                <h3>{child.name}</h3>
                <p>Open {child.name} and continue down the hierarchy.</p>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="product-categories">
          <div className="section-heading">
            <div>
              <h2>Products</h2>
              <p>Common filters apply to every product type. Use the extra fields when they make sense for the selected product.</p>
            </div>
          </div>

          <div className="filter-panel">
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              <option value="ALL">All compliance results</option>
              <option value="OKAY">Okay</option>
              <option value="VIOLATION">Violation</option>
              <option value="NEEDS_REVIEW">Needs review</option>
            </select>
            <input placeholder="Product name" value={filters.productName} onChange={(event) => updateFilter("productName", event.target.value)} />
            <input placeholder="Company / brand" value={filters.brandName} onChange={(event) => updateFilter("brandName", event.target.value)} />
            <input placeholder="Shop name" value={filters.shopName} onChange={(event) => updateFilter("shopName", event.target.value)} />
            <select value={filters.unit} onChange={(event) => updateFilter("unit", event.target.value)}>
              <option value="">Any unit</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="L">L</option>
              <option value="pcs">pcs</option>
            </select>
            <input type="number" placeholder="Min quantity" value={filters.minQuantity} onChange={(event) => updateFilter("minQuantity", event.target.value)} />
            <input type="number" placeholder="Max quantity" value={filters.maxQuantity} onChange={(event) => updateFilter("maxQuantity", event.target.value)} />
          </div>

          {filteredProducts.length === 0 ? (
            <p>No products match these filters.</p>
          ) : (
            <div className="product-list">
              {filteredProducts.map((product) => (
                <Link key={product.id} to={`/products/item/${product.id}`} className="product-row">
                  <div>
                    <strong>{product.productName}</strong>
                    <span>{product.brandName || "Company not recorded"}</span>
                  </div>
                  <div>
                    <span>{product.netQuantity || "Quantity not recorded"} {product.unit || ""}</span>
                    <span>{product.inspections?.[0]?.shop?.name || "Shop not recorded"}</span>
                  </div>
                  <span className={`compliance-badge ${product.complianceStatus.toLowerCase()}`}>
                    {product.complianceStatus === "VIOLATION" ? "Violation" : product.complianceStatus === "OKAY" ? "Okay" : "Needs review"}
                  </span>
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

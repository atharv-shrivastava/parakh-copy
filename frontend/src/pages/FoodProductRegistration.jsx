import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

const emptyForm = {
  brandName: "",
  productName: "",
  description: "",
  netQuantity: "",
  unit: "",
  mrp: "",
  barcode: "",
};

function FoodProductRegistration() {
  const [searchParams] = useSearchParams();
  const [roots, setRoots] = useState([]);
  const [levels, setLevels] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function getCategory(id) {
    const response = await fetch(`${API_URL}/categories/id/${id}`);
    if (!response.ok) throw new Error("Unable to load category");
    return response.json();
  }

  async function loadRoots() {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/categories`);
      if (!response.ok) throw new Error("Unable to load categories");

      const data = await response.json();
      setRoots(data);

      const parentId = searchParams.get("parentId");
      if (parentId) {
        const category = await getCategory(parentId);
        const chain = [];
        let current = category;

        while (current && chain.length < 3) {
          chain.unshift(current);
          current = current.parent;
        }

        setLevels(chain);
      } else {
        setLevels([]);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoots();
  }, [searchParams]);

  async function selectCategory(category) {
    try {
      setMessage("");
      const selected = await getCategory(category.id);
      setLevels([selected]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function selectChild(child) {
    try {
      setMessage("");
      const selected = await getCategory(child.id);
      setLevels((current) => [...current.slice(0, 2), selected]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function goBackToLevel(index) {
    setLevels((current) => current.slice(0, index + 1));
    setMessage("");
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const selectedCategory = levels[levels.length - 1] ?? null;
  const selectedPath = levels.map((level) => level.name).join(" → ");
  const isProductType = levels.length === 3;
  const choices = selectedCategory?.children ?? [];

  async function registerProduct(event) {
    event.preventDefault();

    if (!selectedCategory || !isProductType) {
      setMessage("Select a main category, subcategory, and final product type first.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          categoryId: selectedCategory.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Registration failed");

      setMessage(
        data.complianceStatus === "VIOLATION"
          ? `Product registered. Result: VIOLATION. ${data.violationReason || ""}`
          : "Product registered. Basic compliance screening passed."
      );
      setForm(emptyForm);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function renderChoices() {
    if (levels.length === 0) {
      return (
        <div className="category-grid">
          {roots.map((category) => (
            <button
              key={category.id}
              type="button"
              className="category-card"
              onClick={() => selectCategory(category)}
            >
              <h3>{category.name}</h3>
              <p>Select this main category</p>
            </button>
          ))}
        </div>
      );
    }

    if (isProductType) return null;

    return (
      <div className="category-grid">
        {choices.map((child) => (
          <button
            key={child.id}
            type="button"
            className="category-card"
            onClick={() => selectChild(child)}
          >
            <h3>{child.name}</h3>
            <p>
              {levels.length === 1
                ? "Select this subcategory"
                : "Select this product type"}
            </p>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="products-page">
      <Link to="/products" className="back-link">
        ← Back to Products
      </Link>

      <div className="page-header">
        <p className="eyebrow">PRODUCT REGISTRATION</p>
        <h1>Register New Product</h1>
        <p>
          Select exactly three category levels: main category → subcategory →
          product type. Product details are entered only at the final level.
        </p>
      </div>

      {message && <div className="status-message">{message}</div>}

      {loading ? (
        <p>Loading categories...</p>
      ) : (
        <>
          <section className="product-categories">
            <div className="section-heading">
              <div>
                <h2>
                  {levels.length === 0
                    ? "Main Category"
                    : levels.length === 1
                      ? "Subcategory"
                      : "Product Type"}
                </h2>
                <p>{selectedPath || "Choose Food, Utensils, or another main category."}</p>
              </div>
            </div>

            {levels.length > 0 && (
              <div className="hierarchy-path">
                {levels.map((level, index) => (
                  <button
                    key={level.id}
                    type="button"
                    className={index === levels.length - 1 ? "active" : ""}
                    onClick={() => goBackToLevel(index)}
                  >
                    {level.name}
                  </button>
                ))}
              </div>
            )}

            {renderChoices()}

            {levels.length === 1 && choices.length === 0 && (
              <p>No subcategories yet. Create one from the category page first.</p>
            )}

            {levels.length === 2 && choices.length === 0 && (
              <p>No product types yet. Create one from this subcategory page first.</p>
            )}
          </section>

          {isProductType && (
            <form className="registration-form" onSubmit={registerProduct}>
              <div className="section-heading">
                <div>
                  <h2>Product Details</h2>
                  <p>Selected: {selectedPath}</p>
                </div>
              </div>

              <div className="form-grid">
                <label>
                  Company / Manufacturer / Brand
                  <input
                    value={form.brandName}
                    onChange={(e) => updateForm("brandName", e.target.value)}
                    placeholder="e.g. Company name"
                  />
                </label>

                <label>
                  Product name *
                  <input
                    required
                    value={form.productName}
                    onChange={(e) => updateForm("productName", e.target.value)}
                  />
                </label>

                <label>
                  Net quantity
                  <input
                    value={form.netQuantity}
                    onChange={(e) => updateForm("netQuantity", e.target.value)}
                    placeholder="e.g. 100"
                  />
                </label>

                <label>
                  Unit
                  <select
                    value={form.unit}
                    onChange={(e) => updateForm("unit", e.target.value)}
                  >
                    <option value="">Select unit</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="L">L</option>
                    <option value="pcs">pcs</option>
                    <option value="m">m</option>
                  </select>
                </label>

                <label>
                  MRP
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.mrp}
                    onChange={(e) => updateForm("mrp", e.target.value)}
                  />
                </label>

                <label>
                  Barcode
                  <input
                    value={form.barcode}
                    onChange={(e) => updateForm("barcode", e.target.value)}
                  />
                </label>

                <label className="full-width">
                  Description
                  <textarea
                    value={form.description}
                    onChange={(e) => updateForm("description", e.target.value)}
                  />
                </label>
              </div>

              <button
                className="register-product-button"
                type="submit"
                disabled={saving}
              >
                {saving ? "Registering..." : "Register Product"}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export default FoodProductRegistration;

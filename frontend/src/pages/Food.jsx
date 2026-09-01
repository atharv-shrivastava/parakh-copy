import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function Food() {
  const [food, setFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSubcategoryForm, setShowSubcategoryForm] = useState(false);
  const [subcategoryName, setSubcategoryName] = useState("");
  const [message, setMessage] = useState("");

  async function loadFood() {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/categories/food`);
      if (!response.ok) throw new Error("Failed to load Food category");
      setFood(await response.json());
      setError("");
    } catch (err) {
      setError("Unable to load food categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFood();
  }, []);

  async function addSubcategory() {
    const name = subcategoryName.trim();
    if (!name || !food) return;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, parentId: food.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add subcategory");

      setSubcategoryName("");
      setShowSubcategoryForm(false);
      setMessage(`Added ${data.name}.`);
      await loadFood();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="products-page">
      <Link to="/products" className="back-link">
        ← Back to Products
      </Link>

      <div className="page-header">
        <p className="eyebrow">PRODUCT CATEGORY</p>
        <h1>Food</h1>
        <p>Main category → subcategory → product type → inspected products.</p>
      </div>

      {message && <div className="status-message">{message}</div>}

      <section className="product-actions category-toolbar">
        <Link to="/products/register" className="register-product-button">
          Register New Food Product
        </Link>
        <button
          type="button"
          className="secondary-action"
          onClick={() => setShowSubcategoryForm((value) => !value)}
        >
          + Register New Subcategory
        </button>
      </section>

      {showSubcategoryForm && (
        <div className="category-form">
          <input
            value={subcategoryName}
            onChange={(event) => setSubcategoryName(event.target.value)}
            placeholder="New Food subcategory"
          />
          <button type="button" onClick={addSubcategory}>
            Add Subcategory
          </button>
        </div>
      )}

      <section className="product-categories">
        <div className="section-heading">
          <div>
            <h2>Food Subcategories</h2>
            <p>
              Choose a subcategory such as Ready to Eat, Ready to Cook, Dairy,
              or Staples.
            </p>
          </div>
        </div>

        {loading && <p>Loading categories...</p>}
        {error && <p>{error}</p>}

        {!loading && !error && food?.children?.length === 0 && (
          <p>No food subcategories found.</p>
        )}

        {!loading && !error && food?.children?.length > 0 && (
          <div className="category-grid">
            {food.children.map((category) => (
              <Link
                key={category.id}
                to={`/products/category/${category.id}`}
                className="category-card"
              >
                <h3>{category.name}</h3>
                <p>Open {category.name} and choose its product types.</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Food;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/products.css";

const API_URL = "http://localhost:5000";

function Food() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch(`${API_URL}/api/categories`);

        if (!response.ok) {
          throw new Error("Failed to load categories");
        }

        const data = await response.json();
        const food = data.find((category) => category.slug === "food");

        setCategories(food?.children ?? []);
      } catch (err) {
        console.error(err);
        setError("Unable to load food categories.");
      } finally {
        setLoading(false);
      }
    }

    loadCategories();
  }, []);

  return (
    <div className="products-page">
      <Link to="/products" className="back-link">
        ← Back to Products
      </Link>

      <div className="page-header">
        <p className="eyebrow">PRODUCT CATEGORY</p>
        <h1>Food</h1>
        <p>
          Browse food products by category and explore their
          compliance information.
        </p>
      </div>

      <section className="product-categories">
        <div className="section-heading">
          <div>
            <h2>Food Categories</h2>
            <p>Select a category to continue.</p>
          </div>
        </div>

        {loading && <p>Loading categories...</p>}
        {error && <p>{error}</p>}

        {!loading && !error && categories.length === 0 && (
          <p>No food categories found.</p>
        )}

        {!loading && !error && categories.length > 0 && (
          <div className="category-grid">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/products/food/${category.slug}`}
                className="category-card"
              >
                <h3>{category.name}</h3>
                <p>Browse products in this category.</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="product-actions">
        <div className="section-heading">
          <div>
            <h2>Product registration</h2>
            <p>Register a new food product in the database.</p>
          </div>
        </div>

        <Link
          to="/products/register/food"
          className="register-product-button"
        >
          Register New Food Product
        </Link>
      </section>
    </div>
  );
}

export default Food;

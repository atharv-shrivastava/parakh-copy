import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function Products() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch(`${API_URL}/categories`);
        if (!response.ok) throw new Error("Failed to load categories");
        setCategories(await response.json());
      } catch (err) {
        console.error(err);
        setError("Could not load categories. Make sure the backend is running.");
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, []);

  return (
    <div className="products-page">
      <div className="page-header">
        <p className="eyebrow">PRODUCT DATABASE</p>
        <h1>Products</h1>
        <p>
          Browse inspected products by category and explore their compliance information.
        </p>
      </div>

      <section className="product-categories">
        <div className="section-heading">
          <div>
            <h2>Categories</h2>
            <p>Choose a main category.</p>
          </div>
        </div>

        {loading && <p>Loading categories...</p>}
        {error && <p>{error}</p>}
        {!loading && !error && categories.length === 0 && (
          <p>No categories have been added yet.</p>
        )}

        {!loading && !error && categories.length > 0 && (
          <div className="category-grid">
            {categories.map((category) => (
              <div key={category.id} className="category-item">
                <Link
                  to={`/products/category/${category.id}`}
                  className="category-card"
                >
                  <h3>{category.name}</h3>
                  <p>
                    {category.children?.length
                      ? `${category.children.length} child categories`
                      : "Open category"}
                  </p>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="product-actions">
        <div className="section-heading">
          <div>
            <h2>Category management</h2>
            <p>
              Create a new Level 1 category. Actual products are added through scanning.
            </p>
          </div>
        </div>
        <Link
          to="/products/register"
          className="register-product-button"
        >
          Register New Category
        </Link>
      </section>
    </div>
  );
}

export default Products;

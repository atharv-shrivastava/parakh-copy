import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function Food() {
  const [food, setFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadFood() {
      try {
        const response = await fetch(`${API_URL}/categories/food`);
        if (!response.ok) throw new Error("Failed to load Food category");
        setFood(await response.json());
      } catch (err) {
        setError("Unable to load food categories.");
      } finally {
        setLoading(false);
      }
    }
    loadFood();
  }, []);

  return (
    <div className="products-page">
      <Link to="/products" className="back-link">← Back to Products</Link>
      <div className="page-header">
        <p className="eyebrow">PRODUCT CATEGORY</p>
        <h1>Food</h1>
        <p>Browse the Food hierarchy and open any product type to inspect its products.</p>
      </div>

      <section className="product-actions category-toolbar">
        <Link to="/products/register?parentId=food" className="register-product-button">Register New Food Product</Link>
      </section>

      <section className="product-categories">
        <div className="section-heading"><div><h2>Food Categories</h2><p>Select a category to continue.</p></div></div>
        {loading && <p>Loading categories...</p>}
        {error && <p>{error}</p>}
        {!loading && !error && food?.children?.length === 0 && <p>No food subcategories found.</p>}
        {!loading && !error && food?.children?.length > 0 && (
          <div className="category-grid">
            {food.children.map((category) => (
              <Link key={category.id} to={`/products/category/${category.id}`} className="category-card">
                <h3>{category.name}</h3>
                <p>{category.name === "Ready to Eat" ? "Chips, biscuits and other ready-to-eat types." : "Open and continue through the dynamic hierarchy."}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Food;

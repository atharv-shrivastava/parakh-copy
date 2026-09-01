
import { Link } from "react-router-dom";
import "../styles/products.css";

function Dairy() {
  return (
    <div className="products-page">
      <Link to="/products/food" className="back-link">
        ← Back to Food
      </Link>

      <div className="page-header">
        <p className="eyebrow">FOOD • DAIRY</p>
        <h1>Dairy</h1>
        <p>Browse packaged dairy products.</p>
      </div>

      <section className="product-categories">
        <div className="section-heading">
          <div>
            <h2>Categories</h2>
            <p>Select a category to continue.</p>
          </div>
        </div>

        <div className="category-grid">
          <Link to="/products/food/dairy/milk" className="category-card">
            <h3>Milk</h3>
            <p>Packaged milk and milk products.</p>
          </Link>

          <Link to="/products/food/dairy/curd" className="category-card">
            <h3>Curd</h3>
            <p>Packaged curd and yoghurt products.</p>
          </Link>

          <Link to="/products/food/dairy/butter" className="category-card">
            <h3>Butter</h3>
            <p>Packaged butter products.</p>
          </Link>

          <Link to="/products/food/dairy/cheese" className="category-card">
            <h3>Cheese</h3>
            <p>Packaged cheese products.</p>
          </Link>

          <Link to="/products/food/dairy/other" className="category-card">
            <h3>Other Dairy</h3>
            <p>Other packaged dairy products.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Dairy;

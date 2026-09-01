
import { Link } from "react-router-dom";
import "../styles/products.css";

function ReadyToCook() {
  return (
    <div className="products-page">
      <Link to="/products/food" className="back-link">
        ← Back to Food
      </Link>

      <div className="page-header">
        <p className="eyebrow">FOOD • READY TO COOK</p>

        <h1>Ready to Cook</h1>

        <p>
          Browse food products that require cooking or preparation
          before consumption.
        </p>
      </div>

      <section className="product-categories">
        <div className="section-heading">
          <div>
            <h2>Categories</h2>
            <p>Ready-to-cook food categories will appear here.</p>
          </div>
        </div>

        <div className="category-grid">
          <div className="category-card">
            <h3>Frozen Foods</h3>
            <p>Frozen food products requiring preparation.</p>
          </div>

          <div className="category-card">
            <h3>Instant Foods</h3>
            <p>Instant and quick-preparation food products.</p>
          </div>

          <div className="category-card">
            <h3>Pasta & Noodles</h3>
            <p>Pasta, noodles and similar products.</p>
          </div>

          <div className="category-card">
            <h3>Frozen Snacks</h3>
            <p>Frozen snacks requiring cooking before consumption.</p>
          </div>

          <div className="category-card">
            <h3>Other Ready-to-Cook</h3>
            <p>Other ready-to-cook food products.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ReadyToCook;



import { Link } from "react-router-dom";
import "../styles/products.css";

function OtherFood() {
  return (
    <div className="products-page">
      <Link to="/products/food" className="back-link">
        ← Back to Food
      </Link>

      <div className="page-header">
        <p className="eyebrow">FOOD • OTHER</p>
        <h1>Other Food</h1>
        <p>Browse food products outside the primary categories.</p>
      </div>

      <section className="product-categories">
        <div className="section-heading">
          <div>
            <h2>Categories</h2>
            <p>Select a category to continue.</p>
          </div>
        </div>

        <div className="category-grid">
          <Link to="/products/food/other/packaged-food" className="category-card">
            <h3>Packaged Food</h3>
            <p>Other packaged food commodities.</p>
          </Link>

          <Link to="/products/food/other/mixes" className="category-card">
            <h3>Food Mixes</h3>
            <p>Packaged food mixes and preparations.</p>
          </Link>

          <Link to="/products/food/other/specialty" className="category-card">
            <h3>Specialty Foods</h3>
            <p>Specialty and miscellaneous food products.</p>
          </Link>

          <Link to="/products/food/other/other" className="category-card">
            <h3>Other</h3>
            <p>Food products that don't fit another category.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default OtherFood;
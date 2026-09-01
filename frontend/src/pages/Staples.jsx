
import { Link } from "react-router-dom";
import "../styles/products.css";

function Staples() {
  return (
    <div className="products-page">
      <Link to="/products/food" className="back-link">
        ← Back to Food
      </Link>

      <div className="page-header">
        <p className="eyebrow">FOOD • STAPLES</p>
        <h1>Staples</h1>
        <p>Browse essential packaged food commodities.</p>
      </div>

      <section className="product-categories">
        <div className="section-heading">
          <div>
            <h2>Categories</h2>
            <p>Select a category to continue.</p>
          </div>
        </div>

        <div className="category-grid">
          <Link to="/products/food/staples/flour" className="category-card">
            <h3>Flour & Atta</h3>
            <p>Wheat flour, atta and other packaged flours.</p>
          </Link>

          <Link to="/products/food/staples/rice" className="category-card">
            <h3>Rice</h3>
            <p>Packaged rice and rice varieties.</p>
          </Link>

          <Link to="/products/food/staples/pulses" className="category-card">
            <h3>Pulses & Dal</h3>
            <p>Packaged pulses, lentils and dal.</p>
          </Link>

          <Link to="/products/food/staples/sugar" className="category-card">
            <h3>Sugar</h3>
            <p>Packaged sugar and related products.</p>
          </Link>

          <Link to="/products/food/staples/salt" className="category-card">
            <h3>Salt</h3>
            <p>Packaged edible salt and varieties.</p>
          </Link>

          <Link to="/products/food/staples/other" className="category-card">
            <h3>Other Staples</h3>
            <p>Other staple food commodities.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Staples;

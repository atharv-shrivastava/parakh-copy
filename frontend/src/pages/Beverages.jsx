
import { Link } from "react-router-dom";
import "../styles/products.css";

function Beverages() {
  return (
    <div className="products-page">
      <Link to="/products/food" className="back-link">
        ← Back to Food
      </Link>

      <div className="page-header">
        <p className="eyebrow">FOOD • BEVERAGES</p>
        <h1>Beverages</h1>
        <p>Browse packaged beverages and drinks.</p>
      </div>

      <section className="product-categories">
        <div className="section-heading">
          <div>
            <h2>Categories</h2>
            <p>Select a category to continue.</p>
          </div>
        </div>

        <div className="category-grid">
          <Link to="/products/food/beverages/soft-drinks" className="category-card">
            <h3>Soft Drinks</h3>
            <p>Carbonated and non-carbonated soft drinks.</p>
          </Link>

          <Link to="/products/food/beverages/juices" className="category-card">
            <h3>Juices</h3>
            <p>Packaged fruit and vegetable juices.</p>
          </Link>

          <Link to="/products/food/beverages/water" className="category-card">
            <h3>Packaged Water</h3>
            <p>Packaged drinking and mineral water.</p>
          </Link>

          <Link to="/products/food/beverages/tea" className="category-card">
            <h3>Tea</h3>
            <p>Packaged tea and tea products.</p>
          </Link>

          <Link to="/products/food/beverages/coffee" className="category-card">
            <h3>Coffee</h3>
            <p>Packaged coffee and coffee products.</p>
          </Link>

          <Link to="/products/food/beverages/other" className="category-card">
            <h3>Other Beverages</h3>
            <p>Other packaged beverage products.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Beverages;

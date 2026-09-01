
import { Link } from "react-router-dom";
import "../styles/products.css";

function CookingEssentials() {
  return (
    <div className="products-page">
      <Link to="/products/food" className="back-link">
        ← Back to Food
      </Link>

      <div className="page-header">
        <p className="eyebrow">FOOD • COOKING ESSENTIALS</p>
        <h1>Cooking Essentials</h1>
        <p>Browse packaged ingredients used for cooking.</p>
      </div>

      <section className="product-categories">
        <div className="section-heading">
          <div>
            <h2>Categories</h2>
            <p>Select a category to continue.</p>
          </div>
        </div>

        <div className="category-grid">
          <Link to="/products/food/cooking-essentials/oil" className="category-card">
            <h3>Cooking Oil</h3>
            <p>Edible oils and packaged cooking oils.</p>
          </Link>

          <Link to="/products/food/cooking-essentials/ghee" className="category-card">
            <h3>Ghee</h3>
            <p>Packaged ghee and clarified butter products.</p>
          </Link>

          <Link to="/products/food/cooking-essentials/spices" className="category-card">
            <h3>Spices</h3>
            <p>Packaged spices and spice blends.</p>
          </Link>

          <Link to="/products/food/cooking-essentials/sauces" className="category-card">
            <h3>Sauces & Condiments</h3>
            <p>Sauces, spreads, chutneys and condiments.</p>
          </Link>

          <Link to="/products/food/cooking-essentials/other" className="category-card">
            <h3>Other Cooking Essentials</h3>
            <p>Other packaged cooking ingredients.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default CookingEssentials;


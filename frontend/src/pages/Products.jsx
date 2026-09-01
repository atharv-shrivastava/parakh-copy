
import { Link } from "react-router-dom";
import "../styles/products.css";

function Products() {
  return (
    <div className="products-page">
      <div className="page-header">
        <p className="eyebrow">PRODUCT DATABASE</p>

        <h1>Products</h1>

        <p>
          Browse inspected products by category and explore their
          compliance information.
        </p>
      </div>

      <section className="product-categories">
        <div className="section-heading">
          <div>
            <h2>Categories</h2>
            <p>Select a category to continue.</p>
          </div>
        </div>

        <div className="category-grid">
          <Link to="/products/food" className="category-card">
            <h3>Food</h3>
            <p>Packaged food and food commodities.</p>
          </Link>

          <Link to="/products/utensils" className="category-card">
            <h3>Utensils</h3>
            <p>Kitchen and household utensils.</p>
          </Link>

          <Link to="/products/cleaning" className="category-card">
            <h3>Cleaning</h3>
            <p>Cleaning and household products.</p>
          </Link>

          <Link to="/products/personal-care" className="category-card">
            <h3>Personal Care</h3>
            <p>Personal hygiene and care products.</p>
          </Link>

          <Link to="/products/other" className="category-card">
            <h3>Other</h3>
            <p>Products that don't fit another category.</p>
          </Link>
        </div>
      </section>

      <section className="product-actions">
        <div className="section-heading">
          <div>
            <h2>Product registration</h2>
            <p>Add a new product to the Parakh database.</p>
          </div>
        </div>

        <Link to="/products/register" className="register-product-button">
          Register New Product
        </Link>
      </section>
    </div>
  );
}

export default Products;

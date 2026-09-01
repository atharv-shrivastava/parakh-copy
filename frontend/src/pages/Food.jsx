
import { Link } from "react-router-dom";
import "../styles/products.css";

function Food() {
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

        <div className="category-grid">
          <Link
            to="/products/food/ready-to-eat"
            className="category-card"
          >
            <h3>Ready to Eat</h3>
            <p>
              Food products that can be consumed directly after opening.
            </p>
          </Link>

          <Link
            to="/products/food/ready-to-cook"
            className="category-card"
          >
            <h3>Ready to Cook</h3>
            <p>
              Food products that require cooking or preparation.
            </p>
          </Link>

          <Link
            to="/products/food/staples"
            className="category-card"
          >
            <h3>Staples</h3>
            <p>
              Essential food commodities such as rice, flour and pulses.
            </p>
          </Link>

          <Link
            to="/products/food/cooking-essentials"
            className="category-card"
          >
            <h3>Cooking Essentials</h3>
            <p>
              Oils, ghee, spices, sauces and other cooking ingredients.
            </p>
          </Link>

          <Link
            to="/products/food/beverages"
            className="category-card"
          >
            <h3>Beverages</h3>
            <p>
              Packaged drinks, juices, tea, coffee and drinking water.
            </p>
          </Link>

          <Link
            to="/products/food/dairy"
            className="category-card"
          >
            <h3>Dairy</h3>
            <p>
              Milk, curd, butter, cheese and other dairy products.
            </p>
          </Link>

          <Link
            to="/products/food/other"
            className="category-card"
          >
            <h3>Other Food</h3>
            <p>
              Food products that don't fit another category.
            </p>
          </Link>
        </div>
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

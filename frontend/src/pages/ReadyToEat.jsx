
import { Link } from "react-router-dom";
import "../styles/products.css";

function ReadyToEat() {
  return (
    <div className="products-page">
      <Link to="/products/food" className="back-link">
        ← Back to Food
      </Link>

      <div className="page-header">
        <p className="eyebrow">FOOD • READY TO EAT</p>

        <h1>Ready to Eat</h1>

        <p>
          Browse food products that can be consumed directly without
          further preparation.
        </p>
      </div>

      <section className="product-categories">
        <div className="section-heading">
          <div>
            <h2>Categories</h2>
            <p>Select a product category to continue.</p>
          </div>
        </div>

        <div className="category-grid">
          <Link
            to="/products/food/ready-to-eat/chips"
            className="category-card"
          >
            <h3>Chips & Namkeen</h3>
            <p>
              Potato chips, banana chips, namkeen and similar snacks.
            </p>
          </Link>

          <Link
            to="/products/food/ready-to-eat/biscuits"
            className="category-card"
          >
            <h3>Biscuits & Cookies</h3>
            <p>
              Biscuits, cookies and packaged baked snacks.
            </p>
          </Link>

          <Link
            to="/products/food/ready-to-eat/confectionery"
            className="category-card"
          >
            <h3>Chocolates & Confectionery</h3>
            <p>
              Chocolates, candies, toffees and other confectionery.
            </p>
          </Link>

          <Link
            to="/products/food/ready-to-eat/snacks"
            className="category-card"
          >
            <h3>Snacks</h3>
            <p>
              Packaged savoury snacks and other ready-to-eat foods.
            </p>
          </Link>

          <Link
            to="/products/food/ready-to-eat/breakfast"
            className="category-card"
          >
            <h3>Cereals & Breakfast Foods</h3>
            <p>
              Breakfast cereals and other ready-to-eat breakfast products.
            </p>
          </Link>

          <Link
            to="/products/food/ready-to-eat/other"
            className="category-card"
          >
            <h3>Other Ready-to-Eat</h3>
            <p>
              Ready-to-eat food products that don't fit another category.
            </p>
          </Link>
        </div>
      </section>

      <section className="product-actions">
        <div className="section-heading">
          <div>
            <h2>Product registration</h2>
            <p>Register a new ready-to-eat food product.</p>
          </div>
        </div>

        <Link
          to="/products/register/food/ready-to-eat"
          className="register-product-button"
        >
          Register New Product
        </Link>
      </section>
    </div>
  );
}

export default ReadyToEat;

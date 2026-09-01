

import { Link } from "react-router-dom";
import "../styles/shop-products.css";

function ShopProducts() {
  return (
    <div className="shop-products-page">
      <Link to="/shops/1" className="back-link">
        ← Back to Shop
      </Link>

      <div className="page-header">
        <p className="eyebrow">SHOP PRODUCTS</p>
        <h1>Sharma General Store</h1>
        <p>Products inspected and registered for this shop.</p>
      </div>

      <div className="shop-products-list">
        <Link to="/products/1" className="shop-product-item">
          <div>
            <h2>Packaged Wheat Flour</h2>
            <p>Food Commodity</p>
          </div>

          <span className="product-status compliant">
            Compliant
          </span>
        </Link>

        <Link to="/products/2" className="shop-product-item">
          <div>
            <h2>Cooking Oil</h2>
            <p>Food Commodity</p>
          </div>

          <span className="product-status compliant">
            Compliant
          </span>
        </Link>

        <Link to="/products/3" className="shop-product-item">
          <div>
            <h2>Bathing Soap</h2>
            <p>Personal Care</p>
          </div>

          <span className="product-status review">
            Needs Review
          </span>
        </Link>

        <Link to="/products/4" className="shop-product-item">
          <div>
            <h2>Detergent Powder</h2>
            <p>Household Commodity</p>
          </div>

          <span className="product-status compliant">
            Compliant
          </span>
        </Link>
      </div>
    </div>
  );
}

export default ShopProducts
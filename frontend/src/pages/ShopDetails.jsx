

import { Link } from "react-router-dom";
import "../styles/shop-details.css";

function ShopDetails() {
  return (
    <div className="shop-details-page">
      <Link to="/shops" className="back-link">
        ← Back to Shops
      </Link>

      <div className="shop-details-header">
        <div>
          <p className="eyebrow">SHOP DETAILS</p>
          <h1>Sharma General Store</h1>
          <p>123 Main Market, Bhopal</p>
        </div>

        <span className="shop-detail-status">Compliant</span>
      </div>

      <section className="shop-overview">
        <div className="overview-card">
          <span>Total Products</span>
          <strong>24</strong>
        </div>

        <div className="overview-card">
          <span>Inspections</span>
          <strong>18</strong>
        </div>

        <div className="overview-card">
          <span>Last Inspection</span>
          <strong>Today</strong>
        </div>
      </section>

      <section className="shop-products">
        <div className="section-heading">
          <div>
            <h2>Registered Products</h2>
            <p>Products registered under this shop.</p>
          </div>

          <Link to="/shops/1/products">View all products</Link>
        </div>

        <div className="product-list">
          <Link to="/products/1" className="product-row">
            <div>
              <strong>Packaged Wheat Flour</strong>
              <span>Food Commodity</span>
            </div>

            <span className="product-status compliant">
              Compliant
            </span>
          </Link>

          <Link to="/products/2" className="product-row">
            <div>
              <strong>Cooking Oil</strong>
              <span>Food Commodity</span>
            </div>

            <span className="product-status compliant">
              Compliant
            </span>
          </Link>

          <Link to="/products/3" className="product-row">
            <div>
              <strong>Bathing Soap</strong>
              <span>Personal Care</span>
            </div>

            <span className="product-status review">
              Needs Review
            </span>
          </Link>

          <Link to="/products/4" className="product-row">
            <div>
              <strong>Detergent Powder</strong>
              <span>Household Commodity</span>
            </div>

            <span className="product-status compliant">
              Compliant
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default ShopDetails;


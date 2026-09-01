
import { Link } from "react-router-dom";
import "../styles/shops.css";

function Shops() {
  return (
    <div className="shops-page">
      <div className="page-header">
        <p className="eyebrow">REGISTERED BUSINESSES</p>
        <h1>Shops</h1>
        <p>
          Browse registered shops and view their inspection records.
        </p>
      </div>

      <div className="shop-search">
        <input
          type="text"
          placeholder="Search shops..."
          aria-label="Search shops"
        />

        <select aria-label="Filter shops">
          <option value="all">All shops</option>
          <option value="compliant">Compliant</option>
          <option value="review">Needs Review</option>
          <option value="non-compliant">Non-Compliant</option>
        </select>
      </div>

      <div className="shop-grid">
        <Link to="/shops/1" className="shop-card">
          <div className="shop-card-header">
            <h2>Sharma General Store</h2>
            <span className="shop-status compliant">Compliant</span>
          </div>

          <p>123 Main Market, Bhopal</p>

          <div className="shop-card-footer">
            <span>24 products</span>
            <span>Last inspected: Today</span>
          </div>
        </Link>

        <Link to="/shops/2" className="shop-card">
          <div className="shop-card-header">
            <h2>City Mart</h2>
            <span className="shop-status review">Needs Review</span>
          </div>

          <p>45 New Market, Bhopal</p>

          <div className="shop-card-footer">
            <span>18 products</span>
            <span>Last inspected: Yesterday</span>
          </div>
        </Link>

        <Link to="/shops/3" className="shop-card">
          <div className="shop-card-header">
            <h2>Patel Supermarket</h2>
            <span className="shop-status compliant">Compliant</span>
          </div>

          <p>78 Arera Colony, Bhopal</p>

          <div className="shop-card-footer">
            <span>36 products</span>
            <span>Last inspected: 28 Aug 2026</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default Shops;

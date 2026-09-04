import { Link } from "react-router-dom";
import "../styles/products.css";

export default function AdminCategories() {
  return <div className="products-page admin-global-home">
    <div className="page-header">
      <p className="eyebrow">ADMIN · GLOBAL CATEGORIES</p>
      <h1>Global Categories</h1>
      <p>Global categories are managed here only. Categories created from Products remain private to your admin account.</p>
    </div>

    <section className="global-source-grid">
      <Link className="global-source-card" to="/admin/categories/offline">
        <span className="global-source-kicker">GLOBAL</span>
        <h2>Offline Categories</h2>
        <p>Create and manage Offline global categories and their global subcategories. Everything created here is available to every user.</p>
        <strong>Open Offline Categories →</strong>
      </Link>
      <Link className="global-source-card" to="/admin/categories/ecommerce">
        <span className="global-source-kicker">GLOBAL</span>
        <h2>E-commerce Categories</h2>
        <p>Create and manage E-commerce global categories and their global subcategories. Everything created here is available to every user.</p>
        <strong>Open E-commerce Categories →</strong>
      </Link>
    </section>
  </div>;
}

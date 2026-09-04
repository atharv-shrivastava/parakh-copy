import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import "../styles/products.css";

const API_URL = "http://localhost:5000/api";

function ProductDetails() {
  const { id } = useParams();
  const location = useLocation();
  const [product, setProduct] = useState(location.state?.product || null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      try {
        const response = await fetch(`${API_URL}/products/${id}`);
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Product not found");
        if (!cancelled) {
          setProduct(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled && !location.state?.product) setError(err.message);
      }
    }

    loadProduct();
    return () => { cancelled = true; };
  }, [id, location.state]);

  if (error) return <div className="products-page"><p>{error}</p></div>;
  if (!product) return <div className="products-page"><p>Loading product...</p></div>;

  const statusLabel = product.complianceStatus === "VIOLATION" ? "Violation" : product.complianceStatus === "OKAY" ? "Okay" : "Needs review";
  const latestInspection = product.inspections?.[0];

  return (
    <div className="products-page">
      <Link to={`/products/category/${product.categoryId}`} className="back-link">← Back to product type</Link>
      <div className="page-header">
        <p className="eyebrow">INSPECTED PRODUCT</p>
        <h1>{product.productName}</h1>
        <p>{product.brandName || "Company not recorded"}</p>
      </div>

      <section className="product-actions">
        <div className={`compliance-badge ${product.complianceStatus.toLowerCase()}`}>{statusLabel}</div>
        <h2>Legal Metrology screening</h2>
        <p>{product.violationReason || "No screening note recorded."}</p>
      </section>

      <section className="product-categories">
        <div className="section-heading"><div><h2>Product information</h2></div></div>
        <div className="product-row">
          <div><strong>Category</strong><span>{product.category?.name}</span></div>
          <div><strong>Quantity</strong><span>{product.netQuantity || "Not recorded"} {product.unit || ""}</span></div>
          <div><strong>MRP</strong><span>{product.mrp === null ? "Not recorded" : `₹${product.mrp}`}</span></div>
        </div>
      </section>

      {latestInspection && (
        <section className="product-categories">
          <div className="section-heading"><div><h2>Latest inspection</h2></div></div>
          <div className="product-row">
            <div><strong>Shop</strong><span>{latestInspection.shop?.name || "Not recorded"}</span></div>
            <div><strong>Status</strong><span>{latestInspection.status}</span></div>
            <div><strong>Date</strong><span>{new Date(latestInspection.inspectedAt).toLocaleString()}</span></div>
          </div>
        </section>
      )}
    </div>
  );
}

export default ProductDetails;

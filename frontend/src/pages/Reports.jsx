import { useEffect, useMemo, useState } from "react";
import { apiFetch, getUser } from "../lib/auth";
import { calculatePenalty } from "../lib/penalties";
import { downloadProductPdf } from "../lib/productPdf";
import { downloadProductRtf } from "../lib/productRtf";
import "../styles/reports.css";

const API_URL = "http://localhost:5000/api";

function Reports() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [brand, setBrand] = useState("");
  const [shop, setShop] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeRules, setActiveRules] = useState([]);
  const user = getUser();

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const response = await apiFetch(`${API_URL}/products/history`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load reports");
        if (alive) setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        if (alive) setError(err.message || "Could not load reports");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    apiFetch(`${API_URL}/rules/active`).then((r) => r.ok ? r.json() : []).then((data) => alive && setActiveRules(Array.isArray(data) ? data : [])).catch(() => alive && setActiveRules([]));
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    const search = query.trim().toLowerCase();
    const brandSearch = brand.trim().toLowerCase();
    const shopSearch = shop.trim().toLowerCase();

    return products.filter((product) => {
      const inspection = product.inspections?.[0];
      const inspectedAt = new Date(inspection?.inspectedAt || product.createdAt);
      const searchable = [
        product.productName,
        product.brandName,
        product.category?.name,
        inspection?.shop?.name,
        product.barcode,
      ].filter(Boolean).join(" ").toLowerCase();

      return (
        (!search || searchable.includes(search)) &&
        (status === "ALL" || product.complianceStatus === status) &&
        (!brandSearch || (product.brandName || "").toLowerCase().includes(brandSearch)) &&
        (!shopSearch || (inspection?.shop?.name || "").toLowerCase().includes(shopSearch)) &&
        (!dateFrom || inspectedAt >= new Date(`${dateFrom}T00:00:00`)) &&
        (!dateTo || inspectedAt <= new Date(`${dateTo}T23:59:59.999`))
      );
    });
  }, [products, query, status, brand, shop, dateFrom, dateTo]);

  function clearFilters() {
    setQuery("");
    setStatus("ALL");
    setBrand("");
    setShop("");
    setDateFrom("");
    setDateTo("");
  }

  async function downloadReport(product) {
    setError("");
    try {
      const response = await apiFetch(`${API_URL}/products/${product.id}`);
      const full = await response.json();
      if (!response.ok) throw new Error(full.error || "Could not load product report");

      let stored = null;
      try {
        stored = full.ocrData ? JSON.parse(full.ocrData) : null;
      } catch {
        stored = null;
      }

      const allFindings = Array.isArray(stored?.compliance?.findings) ? stored.compliance.findings : [];
      const acceptedIds = Array.isArray(stored?.complianceReview?.acceptedFindingIds) ? new Set(stored.complianceReview.acceptedFindingIds.map(String)) : null;
      const violations = allFindings.filter((finding) => {
        const isViolation = String(finding?.status || "").toUpperCase() === "VIOLATION";
        return isViolation && (!acceptedIds || acceptedIds.has(String(finding?.findingId)));
      });
      const penaltySummary = calculatePenalty(violations, activeRules, "SECOND");
      await downloadProductPdf({ product: full, user, violations, penaltySummary });
    } catch (err) {
      setError(err.message || "Could not generate the PDF");
    }
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <p className="eyebrow">REPORTS</p>
        <h1>Inspection Reports</h1>
        <p>Search inspections and generate a product-specific PDF with evidence, user details and only that product's recorded rule violations.</p>
      </div>

      <div className="reports-toolbar reports-toolbar-wide">
        <label className="reports-search">
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Product, category, shop or barcode..." />
        </label>

        <label className="reports-filter">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="OKAY">Okay</option>
            <option value="VIOLATION">Violation</option>
            <option value="NEEDS_REVIEW">Needs review</option>
            <option value="UNABLE_TO_VERIFY">Unable to verify</option>
          </select>
        </label>

        <label className="reports-search">
          <span>Brand</span>
          <input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Any brand" />
        </label>

        <label className="reports-search">
          <span>Shop</span>
          <input value={shop} onChange={(event) => setShop(event.target.value)} placeholder="Any shop" />
        </label>

        <label className="reports-filter">
          <span>From date</span>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>

        <label className="reports-filter">
          <span>To date</span>
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>

        <button className="reports-clear" type="button" onClick={clearFilters}>
          Clear
        </button>
      </div>

      {loading && <p className="reports-loading">Loading reports...</p>}
      {error && <div className="status-message">{error}</div>}
      {!loading && !error && shown.length === 0 && (
        <div className="status-message">No reports match the current filters.</div>
      )}

      {!loading && !error && shown.length > 0 && (
        <div className="report-list">
          {shown.map((product) => (
            <article className="report-card" key={product.id}>
              <div className="report-card-content">
                <h3>{product.productName}</h3>
                <p>
                  {product.brandName || "Brand not recorded"} ·{" "}
                  {product.category?.name || "Uncategorised"} ·{" "}
                  {product.inspections?.[0]?.shop?.name || "No shop"}
                </p>
                <div className="report-meta">
                  <span>MRP Rs. {product.mrp ?? "-"}</span>
                  <span>{product.netQuantity || "-"} {product.unit || ""}</span>
                  <span>{product.complianceStatus || "NEEDS_REVIEW"}</span>
                  <span>Registered {new Date(product.createdAt).toLocaleString()}</span>
                  <span>{product.owner?.name || user?.name || "User"}</span>
                </div>
              </div>

              <div className="report-actions">
                <button className="report-button" type="button" onClick={() => downloadReport(product)}>Download PDF</button>
                <button className="report-button" type="button" onClick={async () => {
                  setError("");
                  try {
                    const response = await apiFetch(`${API_URL}/products/${product.id}`);
                    const full = await response.json();
                    if (!response.ok) throw new Error(full.error || "Could not load product report");
                    let stored = null;
                    try { stored = full.ocrData ? JSON.parse(full.ocrData) : null; } catch {}
                    const allFindings = Array.isArray(stored?.compliance?.findings) ? stored.compliance.findings : [];
                    const acceptedIds = Array.isArray(stored?.complianceReview?.acceptedFindingIds) ? new Set(stored.complianceReview.acceptedFindingIds.map(String)) : null;
                    const violations = allFindings.filter((finding) => String(finding?.status || "").toUpperCase() === "VIOLATION" && (!acceptedIds || acceptedIds.has(String(finding?.findingId))));
                    const penaltySummary = calculatePenalty(violations, activeRules, "SECOND");
                    await downloadProductRtf({ product: full, user, violations, penaltySummary });
                  } catch (err) {
                    setError(err.message || "Could not generate the editable report");
                  }
                }}>Editable</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default Reports;

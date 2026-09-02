import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, getUser } from "../lib/auth";
import "../styles/dashboard.css";

const API_URL = "http://localhost:5000/api";

function Dashboard() {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const user = getUser();

  useEffect(() => {
    apiFetch(`${API_URL}/products/history`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load dashboard");
        setHistory(data);
      })
      .catch((e) => setError(e.message));
  }, []);

  const stats = {
    total: history.length,
    compliant: history.filter((p) => p.complianceStatus === "OKAY").length,
    violations: history.filter((p) => p.complianceStatus === "VIOLATION").length,
    review: history.filter((p) => p.complianceStatus === "NEEDS_REVIEW" || p.complianceStatus === "UNABLE_TO_VERIFY").length,
  };

  return <main className="dashboard">
    <header className="dashboard-header"><div><p className="eyebrow">LEGAL METROLOGY COMPLIANCE</p><h1>Welcome, {user?.name || "User"}</h1><p className="dashboard-subtitle">Inspect packaged commodities and identify potential compliance violations.</p></div></header>

    <section className="dashboard-section">
      <div className="quick-access">
        <div className="quick-card"><strong>{stats.total}</strong><span>Total registered products</span></div>
        <div className="quick-card"><strong>{stats.compliant}</strong><span>Compliant</span></div>
        <div className="quick-card"><strong>{stats.violations}</strong><span>Violations</span></div>
        <div className="quick-card"><strong>{stats.review}</strong><span>Needs review</span></div>
      </div>
    </section>

    <section className="scan-card"><div className="scan-card-content"><span className="scan-card-label">PRODUCT INSPECTION</span><h2>Scan a packaged commodity</h2><p>Use your camera or upload up to four package images to extract declarations and run the Legal Metrology Rules Engine.</p><Link className="scan-button" to="/scan">Start Scan</Link></div></section>

    {error && <div className="status-message">{error}</div>}
    <section className="dashboard-section">
      <div className="section-heading"><div><h2>Recent inspections</h2><p>Your latest product compliance checks.</p></div><Link to="/history">View all</Link></div>
      <div className="inspection-grid">
        {history.slice(0, 6).map((p) => <Link key={p.id} to={`/products/item/${p.id}`} className="inspection-card"><div className="inspection-card-image">{p.productName}</div><div className="inspection-card-info"><h3>{p.productName}</h3><p>{p.category?.name || "Uncategorised"} · {p.inspections?.[0]?.shop?.name || "No shop"}</p><span className={`status-badge ${p.complianceStatus === "OKAY" ? "status-compliant" : p.complianceStatus === "VIOLATION" ? "status-non-compliant" : "status-needs-review"}`}>{p.complianceStatus}</span></div></Link>)}
        {!history.length && <div className="status-message">No inspections yet. Start your first scan.</div>}
      </div>
    </section>

    <section className="dashboard-section">
      <div className="section-heading"><div><h2>Quick access</h2><p>Frequently used areas of PARAKH.</p></div></div>
      <div className="quick-access">
        <Link to="/shops" className="quick-card"><strong>Shops</strong><span>Browse registered shops</span></Link>
        <Link to="/products" className="quick-card"><strong>Products</strong><span>Browse category hierarchy and product records</span></Link>
        <Link to="/reports" className="quick-card"><strong>Reports</strong><span>Generate product inspection reports</span></Link>
      </div>
    </section>
  </main>;
}

export default Dashboard;

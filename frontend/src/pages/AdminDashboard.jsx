import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/admin-dashboard.css";

const API_URL = "http://localhost:5000/api";

function BarList({ items = [], labelKey, valueKey, empty = "No data yet." }) {
  const max = Math.max(...items.map((item) => Number(item?.[valueKey] || 0)), 1);
  if (!items.length) return <p className="admin-empty">{empty}</p>;
  return <div className="admin-bars">{items.map((item) => (
    <div className="admin-bar-row" key={String(item?.[labelKey])}>
      <div className="admin-bar-label"><span>{item?.[labelKey] || "Unknown"}</span><b>{item?.[valueKey] ?? 0}</b></div>
      <div className="admin-bar-track"><span style={{ width: `${Math.max(4, (Number(item?.[valueKey] || 0) / max) * 100)}%` }} /></div>
    </div>
  ))}</div>;
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiFetch(API_URL + "/admin/overview")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Could not load admin dashboard");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <main className="admin-dashboard"><div className="admin-error">{error}</div></main>;
  if (!data) return <main className="admin-dashboard"><div className="admin-loading">Loading admin dashboard...</div></main>;

  const c = data.counts || {};
  const a = data.analytics || {};
  const statusItems = a.inspectionStatuses || [];
  const violationTotal = Math.max(1, Number(c.violations || 0));
  const complianceRate = c.products ? Math.round((Number(c.compliant || 0) / Number(c.products)) * 100) : 0;

  return <main className="admin-dashboard">
    <header className="admin-header">
      <div>
        <p className="eyebrow">ADMIN CONTROL CENTER</p>
        <h1>PARAKH Administration</h1>
        <p>Platform overview, compliance activity, trends and repeat-violation monitoring.</p>
      </div>
      <div className="admin-actions">
        <Link className="admin-primary" to="/admin/categories">Global Categories</Link>
        <Link className="admin-secondary" to="/products">Product Database</Link>
        <Link className="admin-secondary" to="/reports">Reports</Link>
      </div>
    </header>

    <section className="admin-stat-grid">
      {[["Users", c.users], ["Products", c.products], ["Inspections", c.inspections], ["Shops", c.shops], ["Compliant", c.compliant], ["Violations", c.violations], ["Needs Review", c.review], ["Compliance Rate", `${complianceRate}%`]].map(([n, v]) => (
        <div className="admin-stat" key={n}><span>{n}</span><strong>{v ?? 0}</strong></div>
      ))}
    </section>

    <div className="admin-columns">
      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Recent Inspections</h2><p>Latest recorded field activity.</p></div><Link to="/history">History</Link></div>
        <div className="admin-list">{(data.recentInspections || []).map((x) => (
          <Link className="admin-list-row" to={x.product?.id ? "/products/item/" + x.product.id : "/history"} key={x.id}>
            <div><strong>{x.product?.productName || "Unnamed product"}</strong><span>{x.shop?.name || "Unknown shop"} · {x.worker?.name || "Unknown user"} · {new Date(x.inspectedAt).toLocaleDateString()}</span></div>
            <b>{x.status}</b>
          </Link>
        ))}{!data.recentInspections?.length && <p className="admin-empty">No inspections yet.</p>}</div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Inspection Status</h2><p>Current inspection outcome distribution.</p></div></div>
        <BarList items={statusItems} labelKey="status" valueKey="count" />
      </section>
    </div>

    <div className="admin-columns">
      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Top Categories</h2><p>Product distribution by category.</p></div><Link to="/products">Browse</Link></div>
        <div className="admin-ranking">{(data.topCategories || []).map((x, i) => <div className="admin-rank-row" key={x.categoryId}><i>{i + 1}</i><span>{x.name}</span><b>{x.products}</b></div>)}{!data.topCategories?.length && <p className="admin-empty">No products yet.</p>}</div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Top Brands</h2><p>Brands appearing most often in inspections.</p></div></div>
        <BarList items={a.topBrands || []} labelKey="brand" valueKey="products" />
      </section>
    </div>

    <div className="admin-columns">
      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Violations by Brand</h2><p>Brands associated with stored violation records.</p></div></div>
        <BarList items={a.brandViolations || []} labelKey="brand" valueKey="violations" />
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Violations by Location</h2><p>Inspection locations with recorded violations.</p></div></div>
        <BarList items={a.locationViolations || []} labelKey="location" valueKey="violations" />
      </section>
    </div>

    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Violation Trend</h2><p>Monthly violation activity from stored inspection records.</p></div></div>
      <BarList items={a.violationTrend || []} labelKey="month" valueKey="violations" empty="No monthly violation data yet." />
    </section>

    <div className="admin-columns">
      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Repeat Violations</h2><p>Products with multiple stored inspections currently carrying violation status.</p></div><Link to="/history">Inspect history</Link></div>
        <BarList items={a.repeatViolations || []} labelKey="shop" valueKey="repeatViolations" empty="No repeat-violation patterns detected." />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Pending Verification</h2><p>Records requiring further officer review.</p></div></div>
        <div className="admin-pending"><strong>{a.pendingVerification ?? c.review ?? 0}</strong><span>products requiring review</span><div className="admin-pending-track"><span style={{ width: `${Math.min(100, ((a.pendingVerification ?? c.review ?? 0) / Math.max(1, Number(c.products || 0))) * 100)}%` }} /></div></div>
        <div className="admin-status-grid">{statusItems.filter((x) => ["NEEDS_REVIEW", "UNABLE_TO_VERIFY"].includes(x.status)).map((x) => <div key={x.status}><span>{x.status.replaceAll("_", " ")}</span><b>{x.count}</b></div>)}</div>
      </section>
    </div>

    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Frequent Rule Violations</h2><p>Stored Rules Engine findings.</p></div><Link to="/reports">Reports</Link></div>
      <div className="admin-rule-grid">{(data.topRules || []).map((x) => <div className="admin-rule" key={x.rule}><strong>{x.rule}</strong><span>{x.count} violation{x.count === 1 ? "" : "s"}</span></div>)}{!data.topRules?.length && <p className="admin-empty">No violations yet.</p>}</div>
    </section>
  </main>;
}

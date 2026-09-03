import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import "../styles/admin-dashboard.css";

const API_URL = "http://localhost:5000/api";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiFetch(API_URL + "/admin/overview").then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not load admin dashboard");
      setData(d);
    }).catch((e) => setError(e.message));
  }, []);
  if (error) return <main className="admin-dashboard"><div className="admin-error">{error}</div></main>;
  if (!data) return <main className="admin-dashboard"><div className="admin-loading">Loading admin dashboard...</div></main>;
  const c = data.counts || {};
  return <main className="admin-dashboard">
    <header className="admin-header"><div><p className="eyebrow">ADMIN CONTROL CENTER</p><h1>PARAKH Administration</h1><p>Platform overview, compliance activity and global category management.</p></div><div className="admin-actions"><Link className="admin-primary" to="/admin/categories">Global Categories</Link><Link className="admin-secondary" to="/products">Product Database</Link></div></header>
    <section className="admin-stat-grid">{[["Users",c.users],["Products",c.products],["Inspections",c.inspections],["Shops",c.shops],["Compliant",c.compliant],["Violations",c.violations],["Needs Review",c.review],["Global Categories",c.globalCategories]].map(([n,v]) => <div className="admin-stat" key={n}><span>{n}</span><strong>{v ?? 0}</strong></div>)}</section>
    <div className="admin-columns">
      <section className="admin-panel"><div className="admin-panel-head"><div><h2>Recent Inspections</h2><p>Latest platform activity.</p></div><Link to="/history">History</Link></div><div className="admin-list">{(data.recentInspections || []).map((x) => <Link className="admin-list-row" to={x.product?.id ? "/products/item/" + x.product.id : "/history"} key={x.id}><div><strong>{x.product?.productName || "Unnamed product"}</strong><span>{x.shop?.name || "Unknown shop"} · {x.worker?.name || "Unknown user"}</span></div><b>{x.status}</b></Link>)}{!data.recentInspections?.length && <p className="admin-empty">No inspections yet.</p>}</div></section>
      <section className="admin-panel"><div className="admin-panel-head"><div><h2>Top Categories</h2><p>Most registered products.</p></div><Link to="/products">Browse</Link></div><div className="admin-ranking">{(data.topCategories || []).map((x,i) => <div className="admin-rank-row" key={x.categoryId}><i>{i+1}</i><span>{x.name}</span><b>{x.products}</b></div>)}{!data.topCategories?.length && <p className="admin-empty">No products yet.</p>}</div></section>
    </div>
    <section className="admin-panel"><div className="admin-panel-head"><div><h2>Frequent Rule Violations</h2><p>Stored Rules Engine findings.</p></div><Link to="/reports">Reports</Link></div><div className="admin-rule-grid">{(data.topRules || []).map((x) => <div className="admin-rule" key={x.rule}><strong>{x.rule}</strong><span>{x.count} violation{x.count === 1 ? "" : "s"}</span></div>)}{!data.topRules?.length && <p className="admin-empty">No violations yet.</p>}</div></section>
  </main>;
}

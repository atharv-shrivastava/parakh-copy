import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, getUser } from "../lib/auth";
import { useLanguage } from "../components/LanguageProvider";
import "../styles/dashboard.css";

const API_URL = "http://localhost:5000/api";

function Dashboard() {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const user = getUser();
  const { t } = useLanguage();

  useEffect(() => {
    apiFetch(`${API_URL}/products/analytics/summary`)
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not load analytics"); setAnalytics(data); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    apiFetch(`${API_URL}/products/history`)
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not load dashboard"); setHistory(data); })
      .catch((e) => setError(e.message));
  }, []);

  const stats = {
    total: history.length,
    compliant: history.filter((p) => p.complianceStatus === "OKAY").length,
    violations: history.filter((p) => p.complianceStatus === "VIOLATION").length,
    review: history.filter((p) => p.complianceStatus === "NEEDS_REVIEW" || p.complianceStatus === "UNABLE_TO_VERIFY").length,
  };

  return <main className="dashboard">
    <header className="dashboard-header"><div><p className="eyebrow">{t("legalMetrology")}</p><h1>{t("welcome")}, {user?.name || "User"}</h1><p className="dashboard-subtitle">{t("inspectSubtitle")}</p></div></header>
    <section className="dashboard-section"><div className="quick-access"><div className="quick-card"><strong>{stats.total}</strong><span>{t("totalRegistered")}</span></div><div className="quick-card"><strong>{stats.compliant}</strong><span>{t("compliant")}</span></div><div className="quick-card"><strong>{stats.violations}</strong><span>{t("violations")}</span></div><div className="quick-card"><strong>{stats.review}</strong><span>{t("needsReview")}</span></div></div></section>
    {analytics && <section className="dashboard-section"><div className="section-heading"><div><h2>{t("myAnalytics")}</h2><p>{t("analyticsHelp")}</p></div></div><div className="dashboard-analytics-grid"><div className="analytics-panel"><h3>{t("inspectionSummary")}</h3><div className="analytics-metric-row"><span>{t("products")}</span><strong>{analytics.counts?.products ?? 0}</strong></div><div className="analytics-metric-row"><span>{t("inspectionSummary")}</span><strong>{analytics.counts?.inspections ?? 0}</strong></div><div className="analytics-metric-row"><span>{t("compliant")}</span><strong>{analytics.counts?.compliant ?? 0}</strong></div><div className="analytics-metric-row"><span>{t("violations")}</span><strong>{analytics.counts?.violations ?? 0}</strong></div><div className="analytics-metric-row"><span>{t("needsReview")}</span><strong>{analytics.counts?.review ?? 0}</strong></div></div><div className="analytics-panel"><h3>{t("frequentViolations")}</h3>{(analytics.topRules || []).map((x) => <div className="analytics-bar-row" key={x.rule}><div><span>{x.rule}</span><b>{x.count}</b></div><i><em style={{width:`${Math.min(100, Math.max(6, (x.count / Math.max(1, analytics.counts?.violations || 1)) * 100))}%`}} /></i></div>)}{!analytics.topRules?.length && <p className="analytics-empty">{t("noViolations")}</p>}</div><div className="analytics-panel"><h3>{t("productsByCategory")}</h3>{(analytics.topCategories || []).slice(0,6).map((x) => <div className="analytics-metric-row" key={x.categoryId}><span data-no-auto-translate="true" className="category-identity">{x.name}</span><strong>{x.products}</strong></div>)}{!analytics.topCategories?.length && <p className="analytics-empty">{t("noCategoryData")}</p>}</div><div className="analytics-panel"><h3>{t("topBrands")}</h3>{(analytics.topBrands || []).slice(0,6).map((x) => <div className="analytics-metric-row" key={x.brand}><span data-no-auto-translate="true" className="product-identity">{x.brand}</span><strong>{x.products}</strong></div>)}{!analytics.topBrands?.length && <p className="analytics-empty">{t("noBrandData")}</p>}</div><div className="analytics-panel"><h3>{t("inspectionLocations")}</h3>{(analytics.topLocations || []).slice(0,6).map((x) => <div className="analytics-metric-row" key={x.location}><span>{x.location}</span><strong>{x.inspections}</strong></div>)}{!analytics.topLocations?.length && <p className="analytics-empty">{t("noLocationData")}</p>}</div><div className="analytics-panel"><h3>{t("violationTrend")}</h3>{(analytics.violationTrend || []).slice(-6).map((x) => <div className="analytics-metric-row" key={x.month}><span>{x.month}</span><strong>{x.violations}</strong></div>)}{!analytics.violationTrend?.length && <p className="analytics-empty">{t("noTrendData")}</p>}</div></div></section>}
    <section className="scan-card"><div className="scan-card-content"><span className="scan-card-label">{t("productInspection")}</span><h2>{t("scanCommodity")}</h2><p>{t("scanCommodityHelp")}</p><Link className="scan-button" to="/scan">{t("startScan")}</Link></div></section>
    {error && <div className="status-message">{error}</div>}
    <section className="dashboard-section"><div className="section-heading"><div><h2>{t("recentInspections")}</h2><p>{t("latestChecks")}</p></div><Link to="/history">{t("viewAll")}</Link></div><div className="inspection-grid">{history.slice(0, 6).map((p) => <Link key={p.id} to={`/products/item/${p.id}`} className="inspection-card"><div className="inspection-card-image data-product-identity" data-no-auto-translate="true">{p.productName}</div><div className="inspection-card-info"><h3 data-no-auto-translate="true" className="product-identity">{p.productName}</h3><p><span data-no-auto-translate="true" className="category-identity">{p.category?.name || ""}</span> · {p.inspections?.[0]?.shop?.name || t("noShop")}</p><span className={`status-badge ${p.complianceStatus === "OKAY" ? "status-compliant" : p.complianceStatus === "VIOLATION" ? "status-non-compliant" : "status-needs-review"}`}>{p.complianceStatus}</span></div></Link>)}{!history.length && <div className="status-message">{t("noInspections")}</div>}</div></section>
    <section className="dashboard-section"><div className="section-heading"><div><h2>{t("quickAccess")}</h2><p>{t("frequentlyUsed")}</p></div></div><div className="quick-access"><Link to="/shops" className="quick-card"><strong>{t("shops")}</strong><span>{t("browseRegisteredShops")}</span></Link><Link to="/products" className="quick-card"><strong>{t("products")}</strong><span>{t("browseProductRecords")}</span></Link><Link to="/reports" className="quick-card"><strong>{t("reports")}</strong><span>{t("generateReports")}</span></Link></div></section>
  </main>;
}
export default Dashboard;

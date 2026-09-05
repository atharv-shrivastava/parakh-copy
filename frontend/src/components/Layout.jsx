import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getUser } from "../lib/auth";
import { useLanguage } from "./LanguageProvider";
import ScanVisualCheck from "./ScanVisualCheck";
import DashboardInsights from "./DashboardInsights";

const NAV_ITEMS = [
  ["/", "dashboard", "⌂"],
  ["/scan", "scan", "⌁"],
  ["/ecommerce-inspection", "ecommerce", "▣"],
  ["/shops", "shops", "⌂"],
  ["/products", "products", "◇"],
  ["/history", "history", "↺"],
  ["/reports", "reports", "▤"],
  ["/profile", "account", "◉"],
];

function NavIcon({ children }) {
  return <span className="nav-icon" aria-hidden="true">{children}</span>;
}

function Layout() {
  const user = getUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  function logout() { clearSession(); navigate("/login", { replace: true }); }
  const showDashboardInsights = location.pathname === "/" || location.pathname === "/admin";

  return <div className="app-layout">
    <aside className="sidebar">
      <div className="logo">
        <h2>PARAKH</h2>
        <span className="logo-full">Packaged Article Regulatory Assessment &amp; Knowledge Hub</span>
      </div>
      <nav className="navigation">
        <div className="sidebar-section-label">Workspace</div>
        {NAV_ITEMS.slice(0, 3).map(([to, label, icon]) => <NavLink key={to} to={to} end={to === "/"}><NavIcon>{icon}</NavIcon><span className="nav-label">{t(label)}</span></NavLink>)}
        <div className="sidebar-section-label">Catalog</div>
        {NAV_ITEMS.slice(3, 5).map(([to, label, icon]) => <NavLink key={to} to={to} end={to === "/products"}><NavIcon>{icon}</NavIcon><span className="nav-label">{t(label)}</span></NavLink>)}
        <div className="sidebar-section-label">Insights</div>
        {NAV_ITEMS.slice(5).map(([to, label, icon]) => <NavLink key={to} to={to}><NavIcon>{icon}</NavIcon><span className="nav-label">{t(label)}</span></NavLink>)}
        {user?.role === "ADMIN" && <>
          <div className="sidebar-section-label">Administration</div>
          <NavLink to="/admin"><NavIcon>⚙</NavIcon><span className="nav-label">{t("adminDashboard")}</span></NavLink>
          <NavLink to="/admin/categories"><NavIcon>▦</NavIcon><span className="nav-label">{t("globalCategories")}</span></NavLink>
          <NavLink to="/admin/rules"><NavIcon>✓</NavIcon><span className="nav-label">{t("complianceRules")}</span></NavLink>
        </>}
      </nav>
      <div className="sidebar-user"><strong>{user?.name || "User"}</strong><span>{user?.role || "USER"}</span><button type="button" onClick={logout}><span className="nav-icon" aria-hidden="true">↪</span>{t("signOut")}</button></div>
    </aside>
    <main className="main-content">{showDashboardInsights && <DashboardInsights />}<Outlet />{location.pathname === "/scan" && <ScanVisualCheck />}</main>
  </div>;
}
export default Layout;

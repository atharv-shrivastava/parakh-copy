import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getUser } from "../lib/auth";
import { useLanguage } from "./LanguageProvider";
import ScanVisualCheck from "./ScanVisualCheck";

function Layout() {
  const user = getUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  function logout() { clearSession(); navigate("/login", { replace: true }); }
  return <div className="app-layout">
    <aside className="sidebar">
      <div className="logo"><h2>PARAKH</h2><span>{t("compliancePlatform")}</span></div>
      <nav className="navigation">
        <NavLink to="/" end>{t("dashboard")}</NavLink>
        <NavLink to="/scan">{t("scan")}</NavLink>
        <NavLink to="/ecommerce-inspection">{t("ecommerce")}</NavLink>
        <NavLink to="/shops">{t("shops")}</NavLink>
        <NavLink to="/products" end>{t("products")}</NavLink>
        <NavLink to="/history">{t("history")}</NavLink>
        <NavLink to="/reports">{t("reports")}</NavLink>
        <NavLink to="/profile">{t("account")}</NavLink>
        {user?.role === "ADMIN" && <><NavLink to="/admin">{t("adminDashboard")}</NavLink><NavLink to="/admin/categories">{t("globalCategories")}</NavLink><NavLink to="/admin/rules">{t("complianceRules")}</NavLink></>}
      </nav>
      <div className="sidebar-user"><strong>{user?.name || "User"}</strong><span>{user?.role || "USER"}</span><button type="button" onClick={logout}>{t("signOut")}</button></div>
    </aside>
    <main className="main-content"><Outlet />{location.pathname === "/scan" && <ScanVisualCheck />}</main>
  </div>;
}
export default Layout;

import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession, getUser } from "../lib/auth";

function Layout() {
  const user = getUser();
  const navigate = useNavigate();
  function logout() { clearSession(); navigate("/login", { replace: true }); }
  return <div className="app-layout">
    <aside className="sidebar">
      <div className="logo"><h2>PARAKH</h2><span>Compliance Platform</span></div>
      <nav className="navigation">
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/scan">Scan</NavLink>
        <NavLink to="/ecommerce-inspection">E-commerce</NavLink>
        <NavLink to="/shops">Shops</NavLink>
        <NavLink to="/products" end>Products</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/reports">Reports</NavLink>
        <NavLink to="/profile">Profile</NavLink>
        {user?.role === "ADMIN" && <><NavLink to="/admin">Admin Dashboard</NavLink><NavLink to="/admin/categories">Global Categories</NavLink><NavLink to="/admin/rules">Compliance Rules</NavLink></>}
      </nav>
      <div className="sidebar-user"><strong>{user?.name || "User"}</strong><span>{user?.role || "USER"}</span><button type="button" onClick={logout}>Sign out</button></div>
    </aside>
    <main className="main-content"><Outlet /></main>
  </div>;
}
export default Layout;

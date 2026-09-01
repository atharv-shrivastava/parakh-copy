import { Link, Outlet } from "react-router-dom";

function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="logo">
          PARAKH
        </div>

        <nav className="sidebar-nav">
          <Link to="/">Dashboard</Link>
          <Link to="/scan">Scan</Link>
          <Link to="/shops">Shops</Link>
          <Link to="/products">Products</Link>
          <Link to="/history">History</Link>
          <Link to="/reports">Reports</Link>
          <Link to="/profile">Profile</Link>
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <h1>Parakh</h1>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
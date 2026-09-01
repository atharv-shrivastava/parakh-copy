

import { NavLink, Outlet } from "react-router-dom";

function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="logo">
          <h2>PARAKH</h2>
          <span>Compliance Platform</span>
        </div>

        <nav className="navigation">
          <NavLink to="/" end>
            Dashboard
          </NavLink>

          <NavLink to="/scan" end>
            Scan
          </NavLink>

          <NavLink to="/shops">
            Shops
          </NavLink>

          <NavLink to="/products" end>
            Products
          </NavLink>

          <NavLink to="/history" end>
            History
          </NavLink>

          <NavLink to="/reports" end>
            Reports
          </NavLink>

          <NavLink to="/profile" end>
            Profile
          </NavLink>
        </nav>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;

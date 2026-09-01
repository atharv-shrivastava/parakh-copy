
import ScanCard from "../components/ScanCard";
import InspectionCard from "../components/InspectionCard";
import "../styles/dashboard.css";

function Dashboard() {
  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">LEGAL METROLOGY COMPLIANCE</p>

          <h1>Dashboard</h1>

          <p className="dashboard-subtitle">
            Inspect packaged commodities and identify potential compliance
            violations.
          </p>
        </div>
      </header>

      <ScanCard />

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h2>Recent inspections</h2>
            <p>Your latest product compliance checks.</p>
          </div>

          <a href="/history">View all</a>
        </div>

        <div className="inspection-grid">
          <InspectionCard
            product="Packaged Food Product"
            date="Today"
            status="Compliant"
          />

          <InspectionCard
            product="Household Commodity"
            date="Yesterday"
            status="Needs Review"
          />

          <InspectionCard
            product="Personal Care Product"
            date="28 Aug 2026"
            status="Non-Compliant"
          />
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h2>Quick access</h2>
            <p>Frequently used areas of Parakh.</p>
          </div>
        </div>

        <div className="quick-access">
          <a href="/shops" className="quick-card">
            <strong>Shops</strong>
            <span>Browse registered shops</span>
          </a>

          <a href="/products" className="quick-card">
            <strong>Products</strong>
            <span>Search product records</span>
          </a>

          <a href="/reports" className="quick-card">
            <strong>Reports</strong>
            <span>View compliance reports</span>
          </a>
        </div>
      </section>
    </main>
  );
}

export default Dashboard;

import { useState } from 'react';

const navItems = ['Dashboard', 'Scan', 'Shops', 'Products', 'History', 'Reports', 'Analytics'];

const stats = [
  ['Today’s Inspections', '24', '+8%'],
  ['Potential Violations', '07', 'Needs review'],
  ['Pending Verification', '05', 'Officer action'],
  ['Compliance Rate', '82%', '+3.2%']
];

function App() {
  const [active, setActive] = useState('Dashboard');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">P</span><div><strong>PARAKH</strong><small>Compliance Intelligence</small></div></div>
        <nav>
          {navItems.map((item) => (
            <button key={item} className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item)}>
              <span>{item === 'Scan' ? '⌕' : item === 'Dashboard' ? '▦' : item === 'Shops' ? '⌂' : item === 'Products' ? '□' : item === 'History' ? '◷' : item === 'Reports' ? '▤' : '◈'}</span>{item}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> System operational</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><span className="eyebrow">LEGAL METROLOGY INSPECTION</span><h1>{active}</h1></div>
          <div className="officer"><div className="avatar">AO</div><div><strong>Inspection Officer</strong><small>Government Enforcement</small></div></div>
        </header>

        {active === 'Dashboard' ? <Dashboard onScan={() => setActive('Scan')} /> : <Placeholder title={active} />}
      </main>
    </div>
  );
}

function Dashboard({ onScan }) {
  return <section className="content">
    <div className="welcome-row"><div><h2>Inspection overview</h2><p>Monitor field inspections, products and compliance activity.</p></div><button className="primary" onClick={onScan}>＋ Start new scan</button></div>
    <div className="stats-grid">{stats.map(([label, value, note]) => <article className="stat" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <div className="dashboard-grid">
      <article className="panel scan-panel"><div className="panel-title"><div><span className="eyebrow">FIELD WORKFLOW</span><h3>Scan a packaged commodity</h3></div><span className="badge">AI assisted</span></div><div className="scan-box"><div className="camera">⌗</div><strong>Capture or upload package images</strong><p>PARAKH will extract declarations, identify the product and evaluate applicable requirements.</p><button className="primary" onClick={onScan}>Open scanner</button></div></article>
      <article className="panel"><div className="panel-title"><div><span className="eyebrow">RECENT ACTIVITY</span><h3>Latest inspections</h3></div><button className="text-button">View history</button></div><div className="activity-list"><Activity shop="Sharma General Store" product="Chips · Lay's Classic Salted" status="Needs review" /><Activity shop="City Mart" product="Biscuits · Parle-G" status="Compliant" /><Activity shop="Fresh Basket" product="Frozen food · McCain" status="Compliant" /></div></article>
    </div>
    <article className="panel"><div className="panel-title"><div><span className="eyebrow">INSPECTION ANALYTICS</span><h3>Compliance snapshot</h3></div><span className="muted">Last 30 days</span></div><div className="bars"><div style={{height:'64%'}}><span>Compliant</span></div><div style={{height:'25%'}}><span>Review</span></div><div style={{height:'11%'}}><span>Violation</span></div></div></article>
  </section>;
}

function Activity({ shop, product, status }) { return <div className="activity"><div className="activity-icon">▣</div><div><strong>{shop}</strong><small>{product}</small></div><span className={status === 'Compliant' ? 'pill good' : 'pill warning'}>{status}</span></div>; }
function Placeholder({ title }) { return <section className="content"><div className="empty-page"><span className="eyebrow">PARAKH MODULE</span><h2>{title}</h2><p>This module is wired into the application shell. The next implementation slice will connect its real workflow to the backend.</p></div></section>; }

export default App;

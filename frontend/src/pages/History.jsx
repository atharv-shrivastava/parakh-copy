import "../styles/history.css";

function History() {
  return (
    <div className="history-page">
      <div className="page-header">
        <p className="eyebrow">INSPECTION RECORDS</p>
        <h1>Inspection History</h1>
        <p>View and review your previous product inspections.</p>
      </div>

      <div className="history-list">
        <div className="history-item">
          <div>
            <h3>Packaged Food Product</h3>
            <p>Inspected today</p>
          </div>
          <span className="history-status compliant">Compliant</span>
        </div>

        <div className="history-item">
          <div>
            <h3>Household Commodity</h3>
            <p>Inspected yesterday</p>
          </div>
          <span className="history-status review">Needs Review</span>
        </div>

        <div className="history-item">
          <div>
            <h3>Personal Care Product</h3>
            <p>Inspected 28 Aug 2026</p>
          </div>
          <span className="history-status non-compliant">
            Non-Compliant
          </span>
        </div>
      </div>
    </div>
  );
}

export default History;
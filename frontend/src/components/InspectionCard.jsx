
import "../styles/components.css";

function InspectionCard({ product, date, status }) {
  const statusClass = status.toLowerCase().replace(/\s+/g, "-");

  return (
    <article className="inspection-card">
      <div className="inspection-card-top">
        <span className="inspection-product">{product}</span>

        <span className={`status status-${statusClass}`}>
          {status}
        </span>
      </div>

      <p className="inspection-date">{date}</p>
    </article>
  );
}

export default InspectionCard;


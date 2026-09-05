import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/auth";
import "../styles/dashboard-insights.css";

const API_URL = "http://localhost:5000/api";

function formatMonth(value) {
  const date = new Date(`${value}-01T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short" });
}

function highestLabel(item, fallback) {
  if (!item) return { name: fallback, count: 0 };
  return { name: item.name || fallback, count: Number(item.count || 0) };
}

function TrendChart({ points }) {
  const width = 760;
  const height = 220;
  const padX = 24;
  const padY = 22;
  const values = points.map((point) => Number(point.inspections || 0));
  const max = Math.max(...values, 1);
  const usableWidth = width - padX * 2;
  const usableHeight = height - padY * 2;
  const coordinates = points.map((point, index) => {
    const x = padX + (points.length === 1 ? usableWidth / 2 : (index / (points.length - 1)) * usableWidth);
    const y = height - padY - (Number(point.inspections || 0) / max) * usableHeight;
    return { ...point, x, y };
  });
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length ? `${padX},${height - padY} ${line} ${width - padX},${height - padY}` : "";

  return <div className="insights-chart-wrap">
    <svg className="insights-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Inspections over the last 12 months">
      {[0, 0.5, 1].map((ratio) => {
        const y = height - padY - ratio * usableHeight;
        const value = Math.round(max * ratio);
        return <g key={ratio}><line x1={padX} x2={width - padX} y1={y} y2={y} className="insights-grid-line" /><text x={width - padX} y={y - 4} textAnchor="end" className="insights-axis-label">{value}</text></g>;
      })}
      {area && <polygon points={area} className="insights-area" />}
      {line && <polyline points={line} className="insights-line" fill="none" />}
      {coordinates.map((point) => <g key={point.month}><circle cx={point.x} cy={point.y} r="4" className="insights-point" /><title>{`${formatMonth(point.month)}: ${point.inspections} inspection${point.inspections === 1 ? "" : "s"}`}</title></g>)}
    </svg>
    <div className="insights-axis-labels">{points.map((point) => <span key={point.month}>{formatMonth(point.month)}</span>)}</div>
  </div>;
}

function SignalCard({ eyebrow, name, count, tone }) {
  return <div className={`insight-signal-card ${tone}`}>
    <span>{eyebrow}</span>
    <strong title={name}>{name}</strong>
    <small>{count} violation{count === 1 ? "" : "s"}</small>
  </div>;
}

export default function DashboardInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`${API_URL}/analytics/dashboard`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not load dashboard analytics");
      setData(payload);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("parakh:data-invalidated", refresh);
    return () => window.removeEventListener("parakh:data-invalidated", refresh);
  }, [load]);

  const trend = useMemo(() => data?.inspectionTrend || [], [data]);
  const highestShop = highestLabel(data?.highestViolatingShop, "No violating shop yet");
  const highestBrand = highestLabel(data?.highestViolatingBrand, "No violating brand yet");
  const highestRule = highestLabel(data?.highestViolatingRule, "No violating rule yet");
  const total = Number(data?.counts?.inspections || 0);
  const violations = Number(data?.counts?.violations || 0);

  return <section className="dashboard-insights">
    <div className="dashboard-insights-head">
      <div><p className="card-kicker">LIVE INSPECTION INTELLIGENCE</p><h2>{data?.scope === "PLATFORM" ? "Platform compliance signals" : "Your inspection signals"}</h2><p>Derived directly from recorded inspections, products and rule findings. No placeholder statistics.</p></div>
      <div className="insight-head-stats"><span><b>{total}</b> inspections</span><span><b>{violations}</b> violations</span></div>
    </div>
    <div className="dashboard-insights-grid">
      <div className="insights-trend-card"><div className="insights-card-head"><div><span>INSPECTION VOLUME</span><strong>Last 12 months</strong></div><small>{loading ? "Updating…" : "Live data"}</small></div>{trend.length ? <TrendChart points={trend} /> : <div className="insights-empty">No inspection data has been recorded yet.</div>}</div>
      <div className="insights-signals">
        <SignalCard eyebrow="HIGHEST VIOLATING SHOP / SOURCE" name={highestShop.name} count={highestShop.count} tone="shop" />
        <SignalCard eyebrow="HIGHEST VIOLATING BRAND" name={highestBrand.name} count={highestBrand.count} tone="brand" />
        <SignalCard eyebrow="HIGHEST VIOLATING RULE" name={highestRule.name} count={highestRule.count} tone="rule" />
      </div>
    </div>
  </section>;
}

export default function BarChart({ items, labels }) {
  const safe = Array.isArray(items) ? items : [];
  const max = Math.max(1, ...safe.map((item) => Number(item.count) || 0));
  return (
    <div className="bar-chart">
      {safe.map((item) => (
        <div className="bar-row" key={item.key}>
          <span className="bar-label">{labels[item.key] || item.key}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: `${((Number(item.count) || 0) / max) * 100}%` }}
            />
          </span>
          <span className="bar-value">{item.count}</span>
        </div>
      ))}
    </div>
  );
}
const WIDTH = 640;
const HEIGHT = 190;
const PAD_X = 10;
const TOP = 12;
const BOTTOM = 26;

export default function TrendChart({ points, ariaLabel }) {
  const safe = Array.isArray(points) ? points : [];
  const values = safe.map((point) => Number(point.count) || 0);
  const max = Math.max(1, ...values);
  const innerHeight = HEIGHT - TOP - BOTTOM;
  const plotWidth = WIDTH - PAD_X * 2;
  const stepX = safe.length > 1 ? plotWidth / (safe.length - 1) : 0;
  const coords = safe.map((point, index) => ({
    x: PAD_X + index * stepX,
    y: TOP + innerHeight - ((Number(point.count) || 0) / max) * innerHeight,
    label: point.label || point.bucket,
    count: point.count,
    bucket: point.bucket,
  }));
  const labelStep = Math.max(1, Math.ceil(coords.length / 8));
  const line = coords.map((coord) => `${coord.x},${coord.y}`).join(" ");
  const area =
    coords.length > 0
      ? `${PAD_X},${TOP + innerHeight} ${line} ${PAD_X + (coords.length - 1) * stepX},${TOP + innerHeight}`
      : "";

  if (safe.length === 0)
    return <p className="analytics-empty">No data for the selected period.</p>;

  return (
    <div className="trend-chart">
      <svg
        className="trend-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={ariaLabel}
      >
        {area ? <polygon points={area} className="trend-area" /> : null}
        <line
          x1={PAD_X}
          y1={TOP + innerHeight}
          x2={WIDTH - PAD_X}
          y2={TOP + innerHeight}
          className="trend-axis"
        />
        {coords.length > 1 ? (
          <polyline points={line} className="trend-line" />
        ) : null}
        {coords.map((coord) => (
          <circle
            key={coord.bucket}
            cx={coord.x}
            cy={coord.y}
            r="3"
            className="trend-dot"
          />
        ))}
        {coords.map((coord, index) =>
          index % labelStep === 0 ? (
            <text
              key={`${coord.bucket}-label`}
              x={coord.x}
              y={HEIGHT - 8}
              className="trend-tick"
              textAnchor="middle"
            >
              {coord.label}
            </text>
          ) : null,
        )}
      </svg>
      <ul className="trend-values">
        {coords.map((coord) => (
          <li key={coord.bucket}>
            {coord.label}: {coord.count}
          </li>
        ))}
      </ul>
    </div>
  );
}
// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M1 - Md. Safinuzzaman (Shafin)
//  GitHub: @shaafin01  |  Part: F19 charts — hand-written inline SVG, no chart library
// ============================================================
// Small chart primitives drawn as plain SVG/CSS so the analytics page needs no
// extra dependency and the drawing code stays ours. They read their colours from
// the CSS variables already defined in styles.css.

const PALETTE = ['var(--primary)', 'var(--accent)', 'var(--blue)', 'var(--amber)', 'var(--red)', 'var(--gray)'];

const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

// Vertical bar chart. `data` = [{ label, value }].
export function BarChart({ data = [], height = 200, format = money }) {
  if (!data.length) return <div className="chart-empty">No data yet</div>;
  const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);
  return (
    <div className="bar-chart" style={{ height }}>
      {data.map((d) => {
        const pct = (Number(d.value) || 0) / max;
        return (
          <div className="bar-col" key={d.label} title={`${d.label}: ${format(d.value)}`}>
            <div className="bar-value">{Number(d.value) ? format(d.value) : ''}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ height: `${Math.max(pct * 100, d.value ? 4 : 0)}%` }} />
            </div>
            <div className="bar-label">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// Donut chart drawn with stroke-dasharray on concentric circles.
export function DonutChart({ data = [], size = 168, thickness = 22, format = money }) {
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  if (!total) return <div className="chart-empty">No data yet</div>;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Revenue split">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {data.map((d, i) => {
            const share = (Number(d.value) || 0) / total;
            const dash = share * circumference;
            const arc = (
              <circle
                key={d.label}
                cx={size / 2} cy={size / 2} r={radius}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return arc;
          })}
        </g>
        <text x="50%" y="48%" textAnchor="middle" className="donut-total">{format(total)}</text>
        <text x="50%" y="61%" textAnchor="middle" className="donut-caption">total</text>
      </svg>
      <ul className="chart-legend">
        {data.map((d, i) => (
          <li key={d.label}>
            <span className="legend-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="legend-label">{d.label}</span>
            <span className="legend-value">{format(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Horizontal progress bar used for per-item utilization percentages.
export function UtilizationBar({ value = 0 }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const tone = pct >= 66 ? 'var(--accent)' : pct >= 33 ? 'var(--amber)' : 'var(--gray)';
  return (
    <div className="util-bar" title={`${pct}% utilized`}>
      <div className="util-fill" style={{ width: `${pct}%`, background: tone }} />
    </div>
  );
}

// KPI tile shown across the top of the analytics / admin pages.
export function StatTile({ label, value, hint, tone }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={tone ? { color: tone } : undefined}>{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

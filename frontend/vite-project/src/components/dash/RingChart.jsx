// src/components/dash/RingChart.jsx
export default function RingChart({
  value = 0, // 0-100
  size = 92,
  stroke = 10,
  label = "Avance",
  sublabel = "",
}) {
  const v = clamp(Number(value) || 0, 0, 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} className="shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(20,20,20,0.10)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(20,20,20,0.9)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="48%"
          dominantBaseline="middle"
          textAnchor="middle"
          style={{ fontSize: 16, fontWeight: 700, fill: "rgba(20,20,20,0.9)" }}
        >
          {Math.round(v)}%
        </text>
        <text
          x="50%"
          y="64%"
          dominantBaseline="middle"
          textAnchor="middle"
          style={{ fontSize: 10, fill: "rgba(20,20,20,0.55)" }}
        >
          {label}
        </text>
      </svg>

      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        {sublabel ? (
          <p className="text-[11px] text-ink/60 leading-snug">{sublabel}</p>
        ) : null}
      </div>
    </div>
  );
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
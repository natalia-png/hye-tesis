import { useMemo } from "react";

export default function PhaseDonut({ phases = [], size = 120 }) {
  const { progress, breakdown } = useMemo(() => {
    const safe = Array.isArray(phases) ? phases : [];

    const totalWeight = safe.reduce((acc, p) => acc + (Number(p.peso) || 0), 0) || 1;

    const weighted =
      safe.reduce((acc, p) => {
        const w = Number(p.peso) || 0;
        const pct = clamp(Number(p.porcentaje) || 0, 0, 100);
        return acc + w * (pct / 100);
      }, 0) / totalWeight;

    const progressPct = Math.round(weighted * 100);

    const byStatus = safe.reduce(
      (acc, p) => {
        const s = (p.estado || "pendiente").toLowerCase();
        if (s.includes("curso")) acc.enCurso += 1;
        else if (s.includes("complet") || s.includes("final")) acc.completadas += 1;
        else acc.pendientes += 1;
        return acc;
      },
      { pendientes: 0, enCurso: 0, completadas: 0 }
    );

    return { progress: progressPct, breakdown: byStatus };
  }, [phases]);

  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (c * progress) / 100;

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        aria-label={`Progreso ${progress}%`}
      >
        <svg width={size} height={size} className="block">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(0,0,0,0.08)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(20,20,20,0.95)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>

        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-[20px] font-semibold text-ink leading-none">{progress}%</p>
            <p className="text-[11px] text-ink/55">Progreso</p>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-[12px] text-ink/60">Resumen de fases</p>

        <div className="mt-2 flex flex-wrap gap-2">
          <Chip label={`Pendientes: ${breakdown.pendientes}`} tone="muted" />
          <Chip label={`En curso: ${breakdown.enCurso}`} tone="warn" />
          <Chip label={`Completadas: ${breakdown.completadas}`} tone="ok" />
        </div>

        <p className="mt-2 text-[11px] text-ink/50">
          *El progreso es ponderado por el “peso” de cada fase.
        </p>
      </div>
    </div>
  );
}

function Chip({ label, tone = "muted" }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-sand text-ink/70 border-taupe/20";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] ${cls}`}>
      {label}
    </span>
  );
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
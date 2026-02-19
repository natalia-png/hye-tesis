// src/components/dash/PhaseBars.jsx
export default function PhaseBars({ fases = [], compact = false }) {
  const list = Array.isArray(fases) ? fases : [];

  return (
    <div className="space-y-2">
      {list.length === 0 ? (
        <p className="text-[12px] text-ink/60">No hay fases registradas.</p>
      ) : (
        list.map((f) => {
          const nombre = f?.nombre || f?.name || "Fase";
          const pct = clamp(Number(f?.porcentaje ?? f?.progress ?? 0) || 0, 0, 100);
          const estado = (f?.estado || f?.status || "pendiente").toLowerCase();

          return (
            <div key={f.id || nombre} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] text-ink/80 truncate">{nombre}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {!compact && (
                    <span className="text-[10px] px-2 py-[2px] rounded-full border border-taupe/30 text-ink/60">
                      {humanEstado(estado)}
                    </span>
                  )}
                  <span className="text-[12px] font-semibold text-ink">{pct}%</span>
                </div>
              </div>

              <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
                <div
                  className="h-full bg-ink"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function humanEstado(e) {
  if (e.includes("en_curso")) return "En curso";
  if (e.includes("complet")) return "Completada";
  return "Pendiente";
}
import { clampInt } from "../../data/fases";
import PropTypes from "prop-types";

export default function PhaseTimeline({ fases = [] }) {
  const safe = Array.isArray(fases) ? fases : [];

  const currentIdx = safe.findIndex((f) => f.estado === "en_curso");
  const idxActive = currentIdx >= 0 ? currentIdx : safe.findIndex((f) => f.estado !== "completada");

  return (
    <div className="rounded-2xl border border-taupe/30 bg-white/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-ink">Timeline por fases</p>
          <p className="text-[11px] text-ink/60">
            Estado del proyecto por etapa. Resalta lo que está en curso.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {safe.map((f, i) => {
          const pct = clampInt(f?.porcentaje, 0, 100);
          const isActive = i === idxActive;
          const isDone = f?.estado === "completada";

          return (
            <div
              key={f.id || i}
              className={
                "rounded-xl border px-3 py-2 " +
                (isActive
                  ? "border-ink/20 bg-ivory/70"
                  : "border-sand bg-white")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-ink truncate">
                    {f?.nombre || "Fase"}
                  </p>
                  <p className="text-[11px] text-ink/55 mt-0.5">
                    {isDone ? "Completada" : isActive ? "En curso" : "Pendiente"}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {isActive && (
                    <span className="text-[10px] rounded-full border border-ink/20 bg-ink text-ivory px-2 py-[2px]">
                      Actual
                    </span>
                  )}
                  <span className="text-[11px] text-ink/60 font-medium">{pct}%</span>
                </div>
              </div>

              <div className="mt-2 h-1.5 w-full bg-sand rounded-full overflow-hidden">
                <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

PhaseTimeline.propTypes = {
  fases: PropTypes.array,
};
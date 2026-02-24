// src/components/ComparativoPlanReal.jsx
// Comparativo Plan vs Avance Real por fase
// Visible para admin y cliente. Las fechas planeadas las ingresa Luisa en FasesProyecto.

/**
 * Calcula cuánto % del tiempo planeado de una fase ya transcurrió (hoy).
 * Si hoy es antes del inicio → 0%.
 * Si hoy es después del fin  → 100%.
 */
function pctEsperado(inicioStr, finStr) {
  if (!inicioStr || !finStr) return null;

  const inicio = new Date(inicioStr);
  const fin = new Date(finStr);
  const hoy = new Date();

  if (isNaN(inicio) || isNaN(fin) || fin <= inicio) return null;

  const total = fin - inicio;
  const transcurrido = hoy - inicio;
  const pct = Math.round((transcurrido / total) * 100);
  return Math.max(0, Math.min(100, pct));
}

function formatFecha(str) {
  if (!str) return "—";
  try {
    return new Date(str).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return str;
  }
}

function estadoSemaforoFase(esperado, real, estado) {
  // Si la fase ya está completada, siempre verde
  if (estado === "completada") {
    return {
      color: "text-green-700",
      bg: "bg-green-50 border-green-200",
      dot: "bg-green-500",
      label: "Completada ✓",
    };
  }

  // Sin plan de fechas
  if (esperado === null) {
    return {
      color: "text-ink/50",
      bg: "bg-ivory border-sand",
      dot: "bg-ink/20",
      label: "Sin fechas plan",
    };
  }

  const diff = real - esperado; // positivo = adelantado, negativo = atrasado

  if (diff >= 0) {
    return {
      color: "text-green-700",
      bg: "bg-green-50 border-green-200",
      dot: "bg-green-500",
      label: diff === 0 ? "En tiempo" : `+${diff}% adelantado`,
    };
  }

  if (diff >= -15) {
    return {
      color: "text-amber-700",
      bg: "bg-amber-50 border-amber-200",
      dot: "bg-amber-400",
      label: `${diff}% atrasado`,
    };
  }

  return {
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    dot: "bg-red-500",
    label: `${diff}% atrasado`,
  };
}

export default function ComparativoPlanReal({ fases = [], startDate, endDate }) {
  // Calcular variación global del proyecto
  const proyectoInicio = startDate ? new Date(startDate) : null;
  const proyectoFin = endDate ? new Date(endDate) : null;
  const hoy = new Date();

  let planGlobal = null;
  let diasRestantes = null;
  let estadoGlobal = "sin_plan";

  if (proyectoInicio && proyectoFin && proyectoFin > proyectoInicio) {
    const total = proyectoFin - proyectoInicio;
    const transcurrido = hoy - proyectoInicio;
    planGlobal = Math.max(0, Math.min(100, Math.round((transcurrido / total) * 100)));
    diasRestantes = Math.ceil((proyectoFin - hoy) / (1000 * 60 * 60 * 24));

    if (diasRestantes < 0) estadoGlobal = "vencido";
    else if (diasRestantes <= 14) estadoGlobal = "proximo";
    else estadoGlobal = "en_curso";
  }

  // Avance real global ponderado por peso
  const totalPeso = fases.reduce((s, f) => s + (f.peso || 1), 0);
  const realGlobal = totalPeso > 0
    ? Math.round(fases.reduce((s, f) => s + (f.porcentaje || 0) * (f.peso || 1), 0) / totalPeso)
    : 0;

  const variacionGlobal = planGlobal != null ? realGlobal - planGlobal : null;

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-[14px] font-semibold text-ink">Plan vs avance real</h2>
        <p className="text-[11px] text-ink/60 mt-0.5">
          Compara el cronograma planeado con el avance real registrado por fase.
        </p>
      </div>

      {/* KPIs globales del proyecto */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard
          label="Plan hoy"
          value={planGlobal != null ? `${planGlobal}%` : "—"}
          sub="% tiempo transcurrido"
        />
        <KpiCard
          label="Real hoy"
          value={`${realGlobal}%`}
          sub="% avance por fases"
        />
        <KpiCard
          label="Variación"
          value={
            variacionGlobal == null
              ? "—"
              : variacionGlobal >= 0
              ? `+${variacionGlobal}%`
              : `${variacionGlobal}%`
          }
          sub={
            variacionGlobal == null
              ? "Sin fechas plan"
              : variacionGlobal >= 0
              ? "Adelantado"
              : "Atrasado"
          }
          highlight={
            variacionGlobal == null
              ? "neutral"
              : variacionGlobal >= 0
              ? "green"
              : variacionGlobal >= -15
              ? "amber"
              : "red"
          }
        />
      </div>

      {/* Barra doble global */}
      {planGlobal != null && (
        <div className="space-y-2 px-1">
          <div>
            <div className="flex justify-between text-[11px] text-ink/55 mb-1">
              <span>Plan</span>
              <span>{planGlobal}%</span>
            </div>
            <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
              <div className="h-full bg-ink/35 rounded-full" style={{ width: `${planGlobal}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-ink/55 mb-1">
              <span>Real</span>
              <span>{realGlobal}%</span>
            </div>
            <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
              <div className="h-full bg-ink rounded-full" style={{ width: `${realGlobal}%` }} />
            </div>
          </div>

          {/* Días restantes */}
          <p className={`text-[11px] font-medium mt-1 ${
            estadoGlobal === "vencido" ? "text-red-600" :
            estadoGlobal === "proximo" ? "text-amber-600" : "text-ink/60"
          }`}>
            {diasRestantes == null
              ? "Sin fecha de entrega definida"
              : diasRestantes < 0
              ? `⚠ Plazo vencido hace ${Math.abs(diasRestantes)} días`
              : diasRestantes === 0
              ? "⚡ La entrega es hoy"
              : `Quedan ${diasRestantes} días para la entrega estimada`}
          </p>
        </div>
      )}

      {/* Tabla por fase */}
      <div>
        <p className="text-[11px] text-ink/50 mb-2 uppercase tracking-wide">
          Detalle por fase
        </p>

        <div className="grid gap-2">
          {fases.map((f) => {
            const esperado = pctEsperado(f.fechaInicioPlaneada, f.fechaFinPlaneada);
            const real = Math.max(0, Math.min(100, f.porcentaje || 0));
            const semaforo = estadoSemaforoFase(esperado, real, f.estado);
            const tieneFechas = f.fechaInicioPlaneada && f.fechaFinPlaneada;

            return (
              <div
                key={f.id}
                className={`rounded-xl border p-3 ${semaforo.bg}`}
              >
                {/* Fila superior: nombre + estado */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${semaforo.dot}`} />
                    <p className="text-[13px] font-medium text-ink truncate">
                      {f.nombre}
                    </p>
                  </div>
                  <span className={`text-[11px] font-medium flex-shrink-0 ${semaforo.color}`}>
                    {semaforo.label}
                  </span>
                </div>

                {/* Fechas planeadas */}
                {tieneFechas && (
                  <p className="text-[11px] text-ink/50 mt-1 ml-4">
                    {formatFecha(f.fechaInicioPlaneada)} → {formatFecha(f.fechaFinPlaneada)}
                  </p>
                )}

                {/* Barras plan vs real por fase */}
                <div className="mt-2 ml-4 space-y-1.5">
                  {tieneFechas && esperado !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-ink/45 w-8 flex-shrink-0">Plan</span>
                      <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-ink/30 rounded-full"
                          style={{ width: `${esperado}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-ink/55 w-8 text-right flex-shrink-0">
                        {esperado}%
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-ink/45 w-8 flex-shrink-0">Real</span>
                    <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ink rounded-full"
                        style={{ width: `${real}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-ink/55 w-8 text-right flex-shrink-0">
                      {real}%
                    </span>
                  </div>
                </div>

                {/* Aviso si no hay fechas planeadas */}
                {!tieneFechas && (
                  <p className="text-[10px] text-ink/40 mt-1 ml-4 italic">
                    Sin fechas planeadas — el equipo aún no ha configurado el cronograma de esta fase.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-ink/45">
        Plan = % de tiempo transcurrido según las fechas planeadas por fase.
        Real = % de avance registrado por el equipo H&amp;E.
      </p>
    </div>
  );
}

function KpiCard({ label, value, sub, highlight = "neutral" }) {
  const colors = {
    neutral: "text-ink",
    green: "text-green-700",
    amber: "text-amber-700",
    red: "text-red-600",
  };

  return (
    <div className="rounded-xl border border-taupe/30 bg-ivory/80 px-3 py-2">
      <p className="text-[10px] text-ink/55">{label}</p>
      <p className={`mt-0.5 text-[14px] font-semibold leading-none ${colors[highlight]}`}>
        {value}
      </p>
      <p className="text-[10px] text-ink/45 mt-1">{sub}</p>
    </div>
  );
}
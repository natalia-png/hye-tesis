// src/pages/DashboardCliente.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { useNavigate } from "react-router-dom";
import { usePushNotifications } from "../hooks/usePushNotifications.js";
import PropTypes from "prop-types";

export default function DashboardCliente() {
  const { user, ready } = useAuth();
  const nav = useNavigate();

  const [projects, setProjects] = useState([]);   // todos los proyectos del cliente
  const [selected, setSelected] = useState(null); // proyecto activo
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const { permissionStatus, requestPermission } = usePushNotifications(user?.uid, null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushDone, setPushDone] = useState(false);

  const handleEnableNotifs = async () => {
    setPushLoading(true);
    const ok = await requestPermission();
    setPushLoading(false);
    if (ok) {
      setPushDone(true);
      setTimeout(() => setPushDone(false), 3000);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!ready) return;
      const email = (user?.email || "").trim().toLowerCase();
      if (!email) {
        setLoading(false);
        setErr("No se detectó tu correo en sesión. Vuelve a iniciar sesión.");
        return;
      }

      setLoading(true);
      setErr("");
      try {
        // Buscar por email Y por uid para no perder ningún proyecto
        const [snapEmail, snapUid] = await Promise.all([
          getDocs(query(collection(db, "projects"), where("clientEmail", "==", email), limit(50))),
          user?.uid
            ? getDocs(query(collection(db, "projects"), where("clientId", "==", user.uid), limit(50)))
            : Promise.resolve({ docs: [] }),
        ]);

        const seen = new Set();
        const list = [];
        [...snapEmail.docs, ...snapUid.docs].forEach(d => {
          if (!seen.has(d.id)) { seen.add(d.id); list.push({ id: d.id, ...d.data() }); }
        });
        list.sort((a, b) => {
          const aT = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
          const bT = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
          return bT - aT;
        });
        setProjects(list);
        setSelected(list[0] || null);
      } catch (e) {
        setErr("No se pudo cargar tu Dashboard.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [ready, user?.email]);

  const computed = useMemo(() => computeProjectKPIs(selected), [selected]);

  if (!ready) return <p className="text-[13px] text-ink/60">Verificando sesión…</p>;
  if (loading) return <p className="text-[13px] text-ink/60">Cargando tu resumen…</p>;

  if (err) {
    return (
      <section className="space-y-3">
        <div className="card">
          <h1 className="text-[18px] font-semibold text-ink">Inicio</h1>
          <p className="text-[13px] text-red-600 mt-2">{err}</p>
        </div>
        <button className="btn-outline text-[13px]" onClick={() => nav("/mis-proyectos")}>
          Ir a mis proyectos
        </button>
      </section>
    );
  }

  if (!selected) {
    return (
      <section className="space-y-3">
        <div className="card space-y-2">
          <h1 className="text-[18px] font-semibold text-ink">Inicio</h1>
          <p className="text-[13px] text-ink/70">Aún no tienes proyectos asignados a tu correo.</p>
          <p className="text-[12px] text-ink/50">
            Correo en sesión: <span className="font-medium">{(user?.email || "—").toLowerCase()}</span>
          </p>
        </div>
        <button className="btn-primary text-[13px]" onClick={() => nav("/mis-proyectos")}>
          Ver mis proyectos
        </button>
      </section>
    );
  }

  const pName = selected.name || selected.nombre || "Proyecto";
  const pCode = selected.code || selected.id;
  const pStatus = selected.status || selected.estado || "Sin estado";
  const pLocation = selected.location || selected.ubicacion || "—";

  return (
    <section className="space-y-4">

      {/* ── Banner notificaciones push ── */}
      {permissionStatus === "default" && !pushDone && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <span className="text-[20px] flex-shrink-0">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-amber-900">Activa las notificaciones</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Recibe alertas en tu celular cuando haya avances en tu proyecto.
            </p>
          </div>
          <button
            type="button"
            onClick={handleEnableNotifs}
            disabled={pushLoading}
            className="flex-shrink-0 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold px-3 py-1.5 transition active:scale-95 disabled:opacity-60"
          >
            {pushLoading ? "…" : "Activar"}
          </button>
        </div>
      )}

      {permissionStatus === "denied" && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-[12px] text-red-700">
            Las notificaciones están bloqueadas en tu navegador. Para recibirlas, habilítalas en la configuración del navegador.
          </p>
        </div>
      )}

      {pushDone && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 flex items-center gap-2">
          <span className="text-[14px]">✅</span>
          <p className="text-[12px] text-emerald-700">Notificaciones activas. Te avisaremos cuando haya novedades.</p>
        </div>
      )}

      {/* ── Header ── */}
      <div className="rounded-[20px] bg-gradient-to-br from-[#141414] via-[#232323] to-[#3a3732] text-ivory p-4 shadow-card border border-white/10">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ivory/60">
            {projects.length > 1 ? "Mis proyectos" : "Mi proyecto"}
          </p>
          {/* Contador si hay varios */}
          {projects.length > 1 && (
            <span className="text-[10px] bg-white/10 border border-white/15 rounded-full px-2 py-0.5 text-ivory/70">
              {projects.length} proyectos
            </span>
          )}
        </div>

        <div className="mt-2">
          <h1 className="text-[18px] font-semibold leading-snug">
            Hola, {firstName(user?.name) || "Cliente"}.
          </h1>
          <p className="text-[13px] text-ivory/75">Este es el resumen del estado de tu proyecto.</p>
        </div>

        {/* ── Selector de proyecto (solo si hay más de uno) ── */}
        {projects.length > 1 && (
          <div className="mt-3">
            <p className="text-[10px] text-ivory/50 mb-1.5 uppercase tracking-[0.12em]">Ver métricas de</p>
            <ProjectSelector
              projects={projects}
              selected={selected}
              onChange={setSelected}
            />
          </div>
        )}

        {/* Info del proyecto (solo cuando hay 1, el selector ya lo muestra cuando hay varios) */}
        {projects.length === 1 && (
          <div className="mt-3 rounded-2xl bg-white/10 border border-white/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] text-ivory/70">Proyecto</p>
                <p className="text-[14px] font-semibold truncate">{pName}</p>
                <p className="text-[12px] text-ivory/70 mt-1">
                  Código <span className="font-medium">{pCode}</span> · {pLocation}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full border border-white/20 px-3 py-1 text-[11px] text-ivory/80 flex-shrink-0">
                {pStatus}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── KPIs ── */}
      <section className="grid grid-cols-2 gap-3">
        <KpiCard label="Avance global" value={`${computed.progress}%`} hint={computed.progressHint} />
        <KpiCard label="Días restantes" value={computed.daysLeftLabel} hint={computed.deadlineHint} />
        <KpiCard label="Fases completadas" value={`${computed.completed}/${computed.total}`} hint="Etapas finalizadas." />
        <KpiCard label="Próxima etapa" value={computed.nextPhaseLabel} hint="Siguiente hito del proyecto." />
      </section>

      {/* ── Avance visual ── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-ink">Estado del proyecto</p>
            <p className="text-[11px] text-ink/55 mt-0.5">Avance general registrado por el equipo H&amp;E.</p>
          </div>
          <RingChart value={computed.progress} />
        </div>
        <MensajeContexto
          progress={computed.progress}
          daysLeft={computed.daysLeft}
          completed={computed.completed}
          total={computed.total}
        />
      </div>

      {/* ── Timeline de fases ── */}
      <div className="card space-y-3">
        <div>
          <p className="text-[13px] font-semibold text-ink">Etapas del proyecto</p>
          <p className="text-[11px] text-ink/55 mt-0.5">Progreso por cada etapa de tu proyecto.</p>
        </div>
        <TimelineFases fases={computed.fases} />
      </div>

      {/* ── CTA ── */}
      <div className="card flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-ink">Ver detalle completo</p>
          <p className="text-[11px] text-ink/60">Notas y archivos del equipo por etapa.</p>
        </div>
        <button type="button" className="btn-primary text-[12px]" onClick={() => nav(`/mis-proyectos/${selected.id}`)}>
          Abrir
        </button>
      </div>
    </section>
  );
}

/* ── Selector de proyecto ── */
function ProjectSelector({ projects, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {/* Botón principal */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15 transition px-3 py-2.5"
      >
        <div className="min-w-0 text-left">
          <p className="text-[13px] font-semibold text-ivory truncate">
            {selected?.name || selected?.nombre || "Seleccionar…"}
          </p>
          <p className="text-[10px] text-ivory/55 mt-0.5">
            {[selected?.code, selected?.location || selected?.ubicacion].filter(Boolean).join(" · ")}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-ivory/60 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Desplegable */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {projects.map(p => {
            const isActive = p.id === selected?.id;
            const name = p.name || p.nombre || "Proyecto";
            const code = p.code || "";
            const status = p.status || p.estado || "";
            const progress = clampInt(p.progress ?? p.avance ?? 0, 0, 100);

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isActive ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                {/* Indicador activo */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  status.toLowerCase() === "archivado" ? "bg-amber-400" :
                  progress >= 100 ? "bg-emerald-400" :
                  progress > 0 ? "bg-blue-400" : "bg-white/20"
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[13px] font-medium truncate ${isActive ? "text-ivory" : "text-ivory/80"}`}>
                      {name}
                    </p>
                    {code && <span className="text-[10px] text-ivory/40 flex-shrink-0">{code}</span>}
                  </div>
                  {/* Mini barra de progreso */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-ivory/50 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-[10px] text-ivory/40 flex-shrink-0">{progress}%</span>
                  </div>
                </div>

                {isActive && (
                  <svg className="w-3.5 h-3.5 text-ivory/60 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Mensaje contextual ── */
function MensajeContexto({ progress, daysLeft, completed, total }) {
  let emoji = "🏗", titulo = "", subtitulo = "", color = "bg-ivory border-sand";

  if (progress >= 100 || completed === total) {
    emoji = "🎉"; titulo = "¡Tu proyecto está completado!";
    subtitulo = "El equipo de H&E ha finalizado todas las etapas. Revisa la documentación final.";
    color = "bg-green-50 border-green-200";
  } else if (daysLeft != null && daysLeft < 0) {
    emoji = "⏰"; titulo = "La fecha estimada ya pasó";
    subtitulo = "El equipo está trabajando para completar los detalles pendientes. Pronto recibirás una actualización.";
    color = "bg-amber-50 border-amber-200";
  } else if (progress >= 75) {
    emoji = "🚀"; titulo = "Tu proyecto está casi listo";
    subtitulo = `Se han completado ${completed} de ${total} etapas. El equipo está en la recta final.`;
    color = "bg-green-50 border-green-200";
  } else if (progress >= 40) {
    emoji = "⚙️"; titulo = "Tu proyecto avanza bien";
    subtitulo = `Hay ${completed} etapa${completed !== 1 ? "s" : ""} completada${completed !== 1 ? "s" : ""}. El equipo de H&E está trabajando activamente.`;
    color = "bg-ivory border-sand";
  } else if (progress > 0) {
    emoji = "📐"; titulo = "Tu proyecto está en marcha";
    subtitulo = "El equipo ha comenzado a trabajar. Podrás ver los avances aquí a medida que progresen.";
    color = "bg-ivory border-sand";
  } else {
    emoji = "📋"; titulo = "Tu proyecto está siendo planificado";
    subtitulo = "El equipo de H&E está organizando las etapas. Pronto comenzará la ejecución.";
    color = "bg-ivory border-sand";
  }

  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <div className="flex items-start gap-3">
        <span className="text-[22px] flex-shrink-0">{emoji}</span>
        <div>
          <p className="text-[13px] font-semibold text-ink">{titulo}</p>
          <p className="text-[12px] text-ink/65 mt-0.5">{subtitulo}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Timeline ── */
function TimelineFases({ fases = [] }) {
  if (fases.length === 0) return <p className="text-[12px] text-ink/50">Las etapas del proyecto aún no están configuradas.</p>;

  return (
    <div className="relative">
      {fases.map((f, idx) => {
        const isLast = idx === fases.length - 1;
        const pct = f.porcentaje || 0;
        let dotColor = "bg-sand border-taupe/40", textColor = "text-ink/50", pctColor = "text-ink/40", estadoLabel = "Pendiente";

        if (f.estado === "completada" || pct >= 100) {
          dotColor = "bg-ink border-ink"; textColor = "text-ink"; pctColor = "text-ink/70"; estadoLabel = "Completada";
        } else if (f.estado === "en_curso" || (pct > 0 && pct < 100)) {
          dotColor = "bg-taupe border-taupe"; textColor = "text-ink"; pctColor = "text-ink/60"; estadoLabel = `En curso · ${pct}%`;
        }

        return (
          <div key={f.id} className="flex gap-3">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-3 h-3 rounded-full border-2 mt-1 ${dotColor}`} />
              {!isLast && <div className="w-[2px] flex-1 bg-sand mt-1" />}
            </div>
            <div className="pb-4 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-[13px] font-medium ${textColor}`}>{f.nombre}</p>
                <p className={`text-[11px] flex-shrink-0 ${pctColor}`}>{estadoLabel}</p>
              </div>
              {f.estado === "en_curso" && pct > 0 && pct < 100 && (
                <div className="mt-1.5 h-1.5 w-full bg-sand rounded-full overflow-hidden">
                  <div className="h-full bg-ink rounded-full" style={{ width: `${pct}%` }} />
                </div>
              )}
              {f.fechaInicioPlaneada && f.fechaFinPlaneada && (
                <p className="text-[10px] text-ink/40 mt-1">
                  {formatFecha(f.fechaInicioPlaneada)} → {formatFecha(f.fechaFinPlaneada)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── UI ── */
function KpiCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-taupe/30 bg-ivory/90 px-3 py-3 shadow-card">
      <p className="text-[11px] text-ink/60">{label}</p>
      <p className="mt-1 text-[18px] font-semibold text-ink leading-none truncate">{value}</p>
      <p className="mt-1 text-[11px] text-ink/55">{hint}</p>
    </div>
  );
}

function RingChart({ value = 0 }) {
  const pct = clampInt(value, 0, 100);
  return (
    <div className="relative h-[90px] w-[90px] rounded-full flex-shrink-0"
      style={{ background: `conic-gradient(#141414 ${pct * 3.6}deg, rgba(20,20,20,0.12) 0deg)` }}>
      <div className="absolute inset-[8px] rounded-full bg-[#F2EEE7] border border-taupe/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[15px] font-semibold text-ink leading-none">{pct}%</p>
          <p className="text-[9px] text-ink/60 mt-0.5">avance</p>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */
function firstName(full) { return full ? String(full).trim().split(" ")[0] : ""; }
function formatFecha(str) {
  if (!str) return "";
  try { return new Date(str).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return str; }
}
function computeProjectKPIs(p) {
  if (!p) return { progress: 0, progressHint: "—", daysLeftLabel: "—", daysLeft: null, deadlineHint: "—", completed: 0, total: 0, nextPhaseLabel: "—", fases: [] };
  const fases = Array.isArray(p.fases) ? p.fases : [];
  const total = fases.length;
  const completed = fases.filter(f => f?.estado === "completada" || Number(f?.porcentaje) >= 100).length;
  const progress = clampInt(p.progress ?? p.avance ?? 0, 0, 100);
  const daysLeft = calcDaysLeft(p.endDate || p.fechaEntrega || null);
  const daysLeftLabel = daysLeft == null ? "—" : daysLeft < 0 ? "Vencido" : String(daysLeft);
  const next = fases.find(f => f?.estado !== "completada" && clampInt(f?.porcentaje, 0, 100) < 100);
  const deadlineHint = daysLeft == null ? "Sin fecha registrada." : daysLeft < 0 ? "La fecha estimada ya pasó." : daysLeft <= 14 ? "Entrando en la recta final." : daysLeft <= 30 ? "Avanzando hacia la entrega." : "Dentro de lo esperado.";
  const progressHint = progress >= 80 ? "Muy avanzado." : progress >= 50 ? "Buen ritmo." : progress > 0 ? "En progreso." : "Por iniciar.";
  return {
    progress, progressHint, daysLeft, daysLeftLabel, deadlineHint, completed, total,
    nextPhaseLabel: next?.nombre || "—",
    fases: fases.map(f => ({ id: f.id, nombre: f.nombre, porcentaje: clampInt(f.porcentaje, 0, 100), estado: f.estado, fechaInicioPlaneada: f.fechaInicioPlaneada || null, fechaFinPlaneada: f.fechaFinPlaneada || null })),
  };
}
function clampInt(v, a, b) { const n = Number(v); return Number.Number.isFinite(n) ? Math.max(a, Math.min(b, Math.round(n))) : a; }
function calcDaysLeft(endDate) { if (!endDate) return null; const d = new Date(endDate); return Number.isNaN(d.getTime()) ? null : Math.ceil((d.getTime() - Date.now()) / 86400000); }

DashboardCliente.propTypes = {};

ProjectSelector.propTypes = {
  selected: PropTypes.object,
  projects: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
};

MensajeContexto.propTypes = {
  progress: PropTypes.number,
  daysLeft: PropTypes.number,
  completed: PropTypes.number,
  total: PropTypes.number,
};

TimelineFases.propTypes = {
  fases: PropTypes.array,
};

KpiCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.any,
  hint: PropTypes.string,
};

RingChart.propTypes = {
  value: PropTypes.number,
};

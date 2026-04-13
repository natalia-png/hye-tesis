// src/pages/DashboardCliente.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { useNavigate } from "react-router-dom";
import { usePushNotifications } from "../hooks/usePushNotifications.js";
import PropTypes from "prop-types";

function useCountUp(to, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!to) { setVal(0); return; }
    let frame;
    const timer = setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        setVal(Math.round(eased * to));
        if (t < 1) frame = requestAnimationFrame(tick);
        else setVal(to);
      };
      frame = requestAnimationFrame(tick);
    }, 200);
    return () => { clearTimeout(timer); if (frame) cancelAnimationFrame(frame); };
  }, [to, duration]);
  return val;
}

export default function DashboardCliente() {
  const { user, ready } = useAuth();
  const nav = useNavigate();

  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const { permissionStatus, requestPermission } = usePushNotifications(user?.uid, null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushDone, setPushDone] = useState(false);

  const handleEnableNotifs = async () => {
    setPushLoading(true);
    const ok = await requestPermission();
    setPushLoading(false);
    if (ok) { setPushDone(true); setTimeout(() => setPushDone(false), 3000); }
  };

  useEffect(() => {
    const load = async () => {
      if (!ready) return;
      const email = (user?.email || "").trim().toLowerCase();
      if (!email) { setLoading(false); setErr("No se detectó tu correo. Vuelve a iniciar sesión."); return; }
      setLoading(true); setErr("");
      try {
        const [snapEmail, snapUid] = await Promise.all([
          getDocs(query(collection(db, "projects"), where("clientEmail", "==", email), limit(50))),
          user?.uid ? getDocs(query(collection(db, "projects"), where("clientId", "==", user.uid), limit(50))) : Promise.resolve({ docs: [] }),
        ]);
        const seen = new Set();
        const list = [];
        [...snapEmail.docs, ...snapUid.docs].forEach(d => {
          if (!seen.has(d.id)) { seen.add(d.id); list.push({ id: d.id, ...d.data() }); }
        });
        list.sort((a, b) => (b.updatedAt?.seconds || b.createdAt?.seconds || 0) - (a.updatedAt?.seconds || a.createdAt?.seconds || 0));
        setProjects(list);
        setSelected(list[0] || null);
      } catch (e) {
        console.error(e);
        setErr("No se pudo cargar tu Dashboard.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [ready, user?.email, user?.uid]);

  const computed = useMemo(() => computeProjectKPIs(selected), [selected]);

  if (!ready) return <p className="text-[13px] text-ink/60">Verificando sesión…</p>;

  if (loading) return (
    <div className="space-y-3">
      <div className="rounded-[22px] bg-gradient-to-br from-[#141414] to-[#3a3732] h-44 animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="rounded-2xl bg-white border border-black/[0.06] h-20 animate-pulse" />)}
      </div>
      <div className="rounded-2xl bg-white border border-black/[0.06] h-40 animate-pulse" />
    </div>
  );

  if (err) return (
    <section className="space-y-3">
      <div className="card"><h1 className="text-[18px] font-semibold text-ink">Inicio</h1>
        <p className="text-[13px] text-red-600 mt-2">{err}</p></div>
      <button className="btn-outline text-[13px]" onClick={() => nav("/mis-proyectos")}>Ir a mis proyectos</button>
    </section>
  );

  if (!selected) return (
    <section className="space-y-3">
      <div className="card space-y-2">
        <h1 className="text-[18px] font-semibold text-ink">Inicio</h1>
        <p className="text-[13px] text-ink/70">Aún no tienes proyectos asignados a tu correo.</p>
        <p className="text-[12px] text-ink/50">Correo: <span className="font-medium">{(user?.email || "—").toLowerCase()}</span></p>
      </div>
      <button className="btn-primary text-[13px]" onClick={() => nav("/mis-proyectos")}>Ver mis proyectos</button>
    </section>
  );

  const pName = selected.name || selected.nombre || "Proyecto";
  const pLocation = selected.location || selected.ubicacion || "";

  return (
    <section className="space-y-4">

      {/* ── Banners push ── */}
      {permissionStatus === "default" && !pushDone && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <span className="text-[20px] flex-shrink-0">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-amber-900">Activa las notificaciones</p>
            <p className="text-[11px] text-amber-700 mt-0.5">Recibe alertas cuando haya avances en tu proyecto.</p>
          </div>
          <button type="button" onClick={handleEnableNotifs} disabled={pushLoading}
            className="flex-shrink-0 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold px-3 py-1.5 transition active:scale-95 disabled:opacity-60">
            {pushLoading ? "…" : "Activar"}
          </button>
        </div>
      )}
      {pushDone && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 flex items-center gap-2">
          <span>✅</span>
          <p className="text-[12px] text-emerald-700 font-medium">Notificaciones activas.</p>
        </div>
      )}

      {/* ── Hero card ── */}
      <div className="rounded-[22px] bg-gradient-to-br from-[#141414] via-[#1a1a18] to-[#3a3732] text-ivory p-5 border border-white/8 shadow-xl">
        <p className="text-[10px] uppercase tracking-[0.22em] text-ivory/40 font-medium mb-3">
          {projects.length > 1 ? "Mis proyectos" : "Mi proyecto"}
        </p>

        {/* Ring grande + info */}
        <div className="flex items-center gap-5">
          <BigRing value={computed.progress} daysLeft={computed.daysLeft} />
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] font-bold leading-snug tracking-tight truncate">
              {firstName(user?.name) || "Cliente"}
            </h1>
            <p className="text-[13px] text-ivory/70 mt-0.5 truncate font-medium">{pName}</p>
            {pLocation && <p className="text-[11px] text-ivory/40 mt-0.5">{pLocation}</p>}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-full border border-ivory/15 bg-ivory/8 px-2 py-0.5 text-[10px] text-ivory/60">
                {computed.completed}/{computed.total} etapas
              </span>
              {computed.daysLeft != null && (
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  computed.daysLeft < 0 ? "border-red-400/50 bg-red-500/20 text-red-300" :
                  computed.daysLeft <= 14 ? "border-amber-400/50 bg-amber-500/20 text-amber-200" :
                  "border-ivory/15 bg-ivory/8 text-ivory/60"
                }`}>
                  {computed.daysLeft < 0 ? `Vencido ${Math.abs(computed.daysLeft)}d` : `${computed.daysLeft}d restantes`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Selector si hay varios proyectos */}
        {projects.length > 1 && (
          <div className="mt-4">
            <p className="text-[10px] text-ivory/40 mb-1.5 uppercase tracking-[0.12em]">Ver métricas de</p>
            <ProjectSelector projects={projects} selected={selected} onChange={setSelected} />
          </div>
        )}
      </div>

      {/* ── Fase activa destacada ── */}
      {computed.activeFase && (
        <ActiveFaseCard fase={computed.activeFase} />
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Avance global" value={`${computed.progress}%`} hint={computed.progressHint}
          color={computed.progress >= 70 ? "green" : computed.progress >= 40 ? "amber" : "neutral"} animated={computed.progress} />
        <KpiCard label="Días restantes" value={computed.daysLeftLabel} hint={computed.deadlineHint}
          color={computed.daysLeft == null ? "neutral" : computed.daysLeft < 0 ? "red" : computed.daysLeft <= 14 ? "amber" : "green"} />
        <KpiCard label="Etapas" value={`${computed.completed}/${computed.total}`} hint="completadas"
          color={computed.total > 0 && computed.completed === computed.total ? "green" : "neutral"} />
        <KpiCard label="Próxima etapa" value={computed.nextPhaseLabel} hint="siguiente hito" color="neutral" small />
      </div>

      {/* ── Banner contextual ── */}
      <MensajeContexto progress={computed.progress} daysLeft={computed.daysLeft} completed={computed.completed} total={computed.total} />

      {/* ── Timeline roadmap ── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-ink">Hoja de ruta</p>
            <p className="text-[11px] text-ink/50 mt-0.5">Toca una etapa para ver detalle.</p>
          </div>
          <span className="text-[11px] font-medium text-ink/40 bg-sand px-2 py-0.5 rounded-full">
            {computed.completed}/{computed.total}
          </span>
        </div>
        <TimelineFases fases={computed.fases} />
      </div>

      {/* ── Acciones rápidas ── */}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => nav(`/mis-proyectos/${selected.id}`)}
          className="card flex items-center gap-3 active:scale-[0.97] transition-all hover:shadow-md text-left">
          <div className="w-9 h-9 rounded-full bg-ink dark:bg-[#3A3731] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-ivory" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-ink">Ver proyecto</p>
            <p className="text-[10px] text-ink/50">Notas y archivos</p>
          </div>
        </button>
        <button type="button" onClick={() => nav(`/mis-proyectos/${selected.id}/garantias`)}
          className="card flex items-center gap-3 active:scale-[0.97] transition-all hover:shadow-md text-left">
          <div className="w-9 h-9 rounded-full bg-sand border border-taupe/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-ink/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-ink">Garantías</p>
            <p className="text-[10px] text-ink/50">Solicitudes</p>
          </div>
        </button>
      </div>
    </section>
  );
}

/* ── Ring grande en hero con countdown ── */
function BigRing({ value = 0, daysLeft }) {
  const [animPct, setAnimPct] = useState(0);
  const counted = useCountUp(value);
  const size = 110;
  const sw = 8;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (animPct / 100) * circ;

  useEffect(() => {
    const t = setTimeout(() => setAnimPct(Math.min(100, Math.max(0, value))), 350);
    return () => clearTimeout(t);
  }, [value]);

  const isUrgent = daysLeft != null && daysLeft < 0;
  const isWarning = daysLeft != null && daysLeft >= 0 && daysLeft <= 14;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} className="block">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={isUrgent ? "#f87171" : isWarning ? "#fbbf24" : "rgba(255,255,255,0.80)"}
          strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-[22px] font-bold text-ivory leading-none">{counted}%</p>
        <p className="text-[9px] text-ivory/50 mt-0.5">avance</p>
      </div>
    </div>
  );
}

/* ── Fase activa destacada ── */
function ActiveFaseCard({ fase }) {
  const pct = fase.porcentaje || 0;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 600);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className="absolute inset-[-3px] rounded-full bg-amber-400 animate-ping opacity-40" />
          <div className="relative w-2.5 h-2.5 rounded-full bg-amber-500" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-amber-700">Etapa activa</p>
      </div>
      <div>
        <p className="text-[15px] font-bold text-ink leading-snug">{fase.nombre}</p>
        {fase.fechaFinPlaneada && (
          <p className="text-[11px] text-ink/50 mt-0.5">
            Fecha estimada: {formatFecha(fase.fechaFinPlaneada)}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-ink/55">Progreso</span>
          <span className="text-[13px] font-bold text-amber-700">{pct}%</span>
        </div>
        <div className="h-2 w-full bg-amber-200/60 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${width}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ── Selector de proyecto ── */
function ProjectSelector({ projects, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15 transition px-3 py-2.5">
        <div className="min-w-0 text-left">
          <p className="text-[13px] font-semibold text-ivory truncate">
            {selected?.name || selected?.nombre || "Seleccionar…"}
          </p>
          <p className="text-[10px] text-ivory/55 mt-0.5">
            {[selected?.code, selected?.location || selected?.ubicacion].filter(Boolean).join(" · ")}
          </p>
        </div>
        <svg className={`w-4 h-4 text-ivory/60 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {projects.map(p => {
            const isActive = p.id === selected?.id;
            const progress = clampInt(p.progress ?? p.avance ?? 0, 0, 100);
            return (
              <button key={p.id} type="button"
                onClick={() => { onChange(p); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${progress >= 100 ? "bg-emerald-400" : progress > 0 ? "bg-amber-400" : "bg-white/20"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium truncate ${isActive ? "text-ivory" : "text-ivory/80"}`}>
                    {p.name || p.nombre || "Proyecto"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-ivory/50 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-[10px] text-ivory/40 flex-shrink-0">{progress}%</span>
                  </div>
                </div>
                {isActive && (
                  <svg className="w-3.5 h-3.5 text-ivory/60 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

/* ── KPI card ── */
function KpiCard({ label, value, hint, color = "neutral", small = false, animated }) {
  const borderColors = { green: "border-l-emerald-400", amber: "border-l-amber-400", red: "border-l-red-400", neutral: "border-l-taupe/25" };
  const valueColors = { green: "text-emerald-600", amber: "text-amber-600", red: "text-red-500", neutral: "text-ink" };
  const counted = useCountUp(typeof animated === "number" ? animated : 0);
  const displayVal = typeof animated === "number" ? `${counted}%` : value;
  return (
    <div className={`rounded-2xl border border-taupe/20 bg-white border-l-4 ${borderColors[color]} px-3 py-3 shadow-sm`}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink/45 font-medium">{label}</p>
      <p className={`mt-1 ${small ? "text-[14px]" : "text-[20px]"} font-bold leading-tight truncate ${valueColors[color]}`}>{displayVal}</p>
      <p className="mt-1 text-[11px] text-ink/45">{hint}</p>
    </div>
  );
}

/* ── Banner contextual ── */
function MensajeContexto({ progress, daysLeft, completed, total }) {
  let emoji = "📋", mensaje = "Tu proyecto está siendo planificado por el equipo H&E.", bgClass = "bg-sand/60 border-taupe/20 text-ink/65";
  if (progress >= 100 || (total > 0 && completed === total)) {
    emoji = "🎉"; mensaje = "¡Proyecto completado! Revisa la documentación final."; bgClass = "bg-emerald-50 border-emerald-200 text-emerald-800";
  } else if (daysLeft != null && daysLeft < 0) {
    emoji = "⏰"; mensaje = "Fecha estimada superada — el equipo está cerrando detalles finales."; bgClass = "bg-amber-50 border-amber-200 text-amber-800";
  } else if (progress >= 75) {
    emoji = "🚀"; mensaje = `Recta final — ${completed} de ${total} etapas completadas.`; bgClass = "bg-emerald-50 border-emerald-100 text-emerald-800";
  } else if (progress >= 40) {
    emoji = "⚙️"; mensaje = `Avanzando bien — ${completed} etapa${completed === 1 ? "" : "s"} completada${completed === 1 ? "" : "s"}.`;
  } else if (progress > 0) {
    emoji = "📐"; mensaje = "El equipo ha comenzado a trabajar. Los avances se reflejan aquí en tiempo real.";
  }
  return (
    <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border ${bgClass}`}>
      <span className="text-[18px] flex-shrink-0">{emoji}</span>
      <p className="text-[12px] font-medium leading-snug">{mensaje}</p>
    </div>
  );
}

/* ── Timeline interactivo ── */
function TimelineFases({ fases = [] }) {
  const [expandedId, setExpandedId] = useState(null);
  if (fases.length === 0) return <p className="text-[12px] text-ink/50">Las etapas aún no están configuradas.</p>;

  return (
    <div>
      {fases.map((f, idx) => {
        const isLast = idx === fases.length - 1;
        const pct = f.porcentaje || 0;
        const isDone = f.estado === "completada" || pct >= 100;
        const isActive = !isDone && (f.estado === "en_curso" || (pct > 0 && pct < 100));
        const isExpanded = expandedId === f.id;

        return (
          <div key={f.id} className="flex gap-3">
            <div className="flex flex-col items-center flex-shrink-0" style={{ width: 20 }}>
              <div className="relative mt-[18px]">
                {isActive && <div className="absolute inset-[-4px] rounded-full bg-amber-300 animate-ping opacity-60" />}
                <div className={`relative w-3 h-3 rounded-full border-2 transition-colors ${
                  isDone ? "bg-ink border-ink" : isActive ? "bg-amber-400 border-amber-500" : "bg-ivory border-taupe/35"
                }`} />
              </div>
              {!isLast && <div className={`w-[2px] flex-1 mt-1 rounded-full ${isDone ? "bg-ink/15" : "bg-sand"}`} />}
            </div>

            <div className={`flex-1 min-w-0 ${!isLast ? "pb-4" : "pb-0"}`}>
              <button type="button" className="w-full text-left py-1"
                onClick={() => setExpandedId(isExpanded ? null : f.id)}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[13px] leading-snug ${isDone ? "text-ink/50 line-through" : isActive ? "text-ink font-semibold" : "text-ink/45"}`}>
                    {f.nombre}
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isDone && <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">✓ Lista</span>}
                    {isActive && <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">{pct}%</span>}
                    {!isDone && !isActive && <span className="text-[10px] text-ink/30">Pendiente</span>}
                    <svg className={`w-3 h-3 text-ink/25 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {isActive && !isExpanded && (
                  <div className="mt-1.5">
                    <AnimatedBar pct={pct} colorClass="bg-amber-400" height="h-1" delay={idx * 100} />
                  </div>
                )}
              </button>

              {isExpanded && (
                <div className="mt-1.5 mb-1 rounded-xl bg-sand/50 border border-taupe/20 p-3 space-y-2">
                  {(isActive || pct > 0) && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-ink/45 uppercase tracking-wide font-medium">Avance</span>
                        <span className="text-[11px] font-bold text-amber-700">{pct}%</span>
                      </div>
                      <AnimatedBar pct={pct} colorClass={isDone ? "bg-emerald-400" : "bg-amber-400"} delay={50} />
                    </div>
                  )}
                  {f.fechaInicioPlaneada && f.fechaFinPlaneada && (
                    <div className="flex items-center gap-1.5 text-[11px] text-ink/50">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatFecha(f.fechaInicioPlaneada)} → {formatFecha(f.fechaFinPlaneada)}</span>
                    </div>
                  )}
                  {isDone && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-500 text-[13px]">✓</span>
                      <span className="text-[11px] text-emerald-700 font-medium">Etapa finalizada</span>
                    </div>
                  )}
                  {!isDone && !isActive && !f.fechaInicioPlaneada && (
                    <p className="text-[11px] text-ink/40">Esta etapa comenzará próximamente.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Barra animada ── */
function AnimatedBar({ pct, colorClass = "bg-ink", height = "h-1.5", delay = 0 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(100, Math.max(0, pct))), 400 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div className={`${height} w-full bg-sand rounded-full overflow-hidden`}>
      <div className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`} style={{ width: `${width}%` }} />
    </div>
  );
}

/* ── Helpers de datos ── */
function firstName(full) { return full ? String(full).trim().split(" ")[0] : ""; }
function formatFecha(str) {
  if (!str) return "";
  try { return new Date(str).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return str; }
}
function clampInt(v, a, b) { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, Math.round(n))) : a; }
function calcDaysLeft(endDate) { if (!endDate) return null; const d = new Date(endDate); return Number.isNaN(d.getTime()) ? null : Math.ceil((d.getTime() - Date.now()) / 86400000); }

function computeProjectKPIs(p) {
  if (!p) return { progress: 0, progressHint: "—", daysLeftLabel: "—", daysLeft: null, deadlineHint: "—", completed: 0, total: 0, nextPhaseLabel: "—", activeFase: null, fases: [] };
  const fases = Array.isArray(p.fases) ? p.fases : [];
  const total = fases.length;
  const completed = fases.filter(f => f?.estado === "completada" || Number(f?.porcentaje) >= 100).length;
  const progress = clampInt(p.progress ?? p.avance ?? 0, 0, 100);
  const daysLeft = calcDaysLeft(p.endDate || p.fechaEntrega || null);
  let daysLeftLabel = "—";
  if (daysLeft != null) { daysLeftLabel = daysLeft < 0 ? "Vencido" : String(daysLeft); }
  const activeFaseRaw = fases.find(f => {
    const pct = clampInt(f?.porcentaje, 0, 100);
    return f?.estado !== "completada" && pct < 100 && (f?.estado === "en_curso" || pct > 0);
  });
  const next = fases.find(f => f?.estado !== "completada" && clampInt(f?.porcentaje, 0, 100) < 100);
  let deadlineHint = "Sin fecha registrada.";
  if (daysLeft != null) {
    if (daysLeft < 0) { deadlineHint = "La fecha estimada ya pasó."; }
    else if (daysLeft <= 14) { deadlineHint = "Entrando en la recta final."; }
    else if (daysLeft <= 30) { deadlineHint = "Avanzando hacia la entrega."; }
    else { deadlineHint = "Dentro de lo esperado."; }
  }
  let progressHint = "Por iniciar.";
  if (progress >= 80) { progressHint = "Muy avanzado."; }
  else if (progress >= 50) { progressHint = "Buen ritmo."; }
  else if (progress > 0) { progressHint = "En progreso."; }
  return {
    progress, progressHint, daysLeft, daysLeftLabel, deadlineHint, completed, total,
    nextPhaseLabel: next?.nombre || "—",
    activeFase: activeFaseRaw ? {
      id: activeFaseRaw.id,
      nombre: activeFaseRaw.nombre,
      porcentaje: clampInt(activeFaseRaw.porcentaje, 0, 100),
      fechaFinPlaneada: activeFaseRaw.fechaFinPlaneada || null,
    } : null,
    fases: fases.map(f => ({
      id: f.id, nombre: f.nombre,
      porcentaje: clampInt(f.porcentaje, 0, 100),
      estado: f.estado,
      fechaInicioPlaneada: f.fechaInicioPlaneada || null,
      fechaFinPlaneada: f.fechaFinPlaneada || null,
    })),
  };
}

DashboardCliente.propTypes = {};
BigRing.propTypes = { value: PropTypes.number, daysLeft: PropTypes.number };
ActiveFaseCard.propTypes = { fase: PropTypes.object.isRequired };
ProjectSelector.propTypes = { selected: PropTypes.object, projects: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired };
MensajeContexto.propTypes = { progress: PropTypes.number, daysLeft: PropTypes.number, completed: PropTypes.number, total: PropTypes.number };
TimelineFases.propTypes = { fases: PropTypes.array };
KpiCard.propTypes = { label: PropTypes.string, value: PropTypes.any, hint: PropTypes.string, color: PropTypes.string, small: PropTypes.bool, animated: PropTypes.number };
AnimatedBar.propTypes = { pct: PropTypes.number, colorClass: PropTypes.string, height: PropTypes.string, delay: PropTypes.number };

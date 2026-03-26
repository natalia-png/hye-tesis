// src/pages/DashboardAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

export default function DashboardAdmin() {
  const { user, ready } = useAuth();
  const { requestPermission } = usePushNotifications(user?.uid || null, null);
  const nav = useNavigate();

  // Guard robusto: cualquier rol que no sea "cliente" puede ver el dashboard admin
  const role = (user?.role || "sin-rol").toLowerCase().trim();
  const isAdmin = role !== "cliente" && role !== "sin-rol";

  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!ready) return;
      if (!isAdmin) {
        setLoading(false);
        setErr(`Rol detectado: "${role}". Verifica el perfil en Firestore.`);
        return;
      }
      setLoading(true);
      setErr("");
      try {
        // Sin orderBy para evitar necesidad de índice compuesto
        const snap = await getDocs(query(collection(db, "projects"), limit(30)));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const aT = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
          const bT = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
          return bT - aT;
        });
        setProjects(list);
        setSelectedId(cur => cur || list[0]?.id || "");
      } catch (e) {
        setErr("No se pudieron cargar los proyectos. Revisa permisos de Firestore.");
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isAdmin]);

  const selected = useMemo(() => projects.find(p => p.id === selectedId) || null, [projects, selectedId]);
  const computed = useMemo(() => computeKPIs(selected), [selected]);

  if (!ready) return <p className="text-[13px] text-ink/60">Verificando sesión…</p>;

  if (loading) return (
    <div className="flex items-center gap-2 py-4">
      <div className="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
      <p className="text-[13px] text-ink/60">Cargando Dashboard…</p>
    </div>
  );

  if (err) return (
    <div className="space-y-2 py-2">
      <p className="text-[13px] text-red-600">{err}</p>
      <p className="text-[11px] text-ink/50">
        Rol: <span className="font-mono font-medium">{role}</span> · Email: <span className="font-mono font-medium">{user?.email}</span>
      </p>
      <button className="btn-outline text-[12px] mt-1" onClick={() => globalThis.location.reload()}>Recargar</button>
    </div>
  );

  const first = (user?.name || "Admin").trim().split(" ")[0];

  return (
    <section className="space-y-4">

      {/* Header */}
      <div className="rounded-[20px] bg-gradient-to-br from-[#141414] via-[#232323] to-[#3a3732] text-ivory p-4 border border-white/10">
        <p className="text-[10px] uppercase tracking-[0.22em] text-ivory/40 font-medium">Dashboard administrativo</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-bold leading-snug tracking-tight">Hola, {first}.</h1>
            <p className="text-[12px] text-ivory/55 mt-0.5">Seguimiento operativo H&E.</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-ivory/20 bg-ivory/8 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-ivory/70">Admin</span>
        </div>

        <div className="mt-3 rounded-2xl bg-white/8 border border-white/10 p-3">
          <p className="text-[10px] text-ivory/50 uppercase tracking-[0.15em] mb-2">Proyecto en foco</p>
          <select
            className="w-full rounded-xl bg-[#F2EEE7] text-ink text-[13px] px-3 py-2 outline-none"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            {projects.length === 0 && <option value="">Sin proyectos</option>}
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.code || p.id} — {p.name || p.nombre || "Proyecto"}
              </option>
            ))}
          </select>
          {selected && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-ivory/60 truncate">
                {selected.client || selected.cliente || "—"} · {selected.location || selected.ubicacion || "—"}
              </p>
              <button type="button" className="text-[11px] text-ivory/80 hover:text-ivory underline flex-shrink-0 transition-colors" onClick={() => nav(`/proyectos/${selected.id}`)}>
                Abrir →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Banner notificaciones push ── */}
      {typeof Notification !== "undefined" && Notification.permission !== "granted" && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-amber-800">🔔 Activa las notificaciones</p>
            <p className="text-[11px] text-amber-700/80 mt-0.5">
              Recibe alertas de solicitudes de garantía y cambios en proyectos.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await requestPermission();
                if (Notification.permission === "granted") alert("¡Notificaciones activadas!");
                else alert("Permiso denegado o cancelado.");
              } catch (e) {
                alert("Error: " + e.message);
              }
            }}
            className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-[12px] font-semibold px-4 py-2 rounded-xl transition-all"
          >
            Activar
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="rounded-2xl bg-white border border-black/[0.06] p-6 text-center space-y-2">
          <p className="text-[14px] font-semibold text-ink">Sin proyectos aún</p>
          <p className="text-[12px] text-ink/50">Crea el primer proyecto para comenzar.</p>
          <button className="btn-primary text-[13px] mt-2" onClick={() => nav("/proyectos/nuevo")}>Crear proyecto</button>
        </div>
      ) : !selected ? null : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Avance global" value={`${computed.progress}%`} hint={computed.progressHint} />
            <KpiCard label="Días a entrega" value={computed.daysLeftLabel} hint={computed.deadlineHint} />
            <KpiCard label="Fases completadas" value={`${computed.completed}/${computed.total}`} hint={computed.phaseHint} />
            <KpiCard label="Riesgo" value={computed.riskLabel} hint={computed.riskHint}
              highlight={computed.riskLabel === "Alto" ? "red" : computed.riskLabel === "Medio" ? "amber" : "green"} />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white border border-black/[0.06] p-4 space-y-2">
              <p className="text-[12px] font-semibold text-ink">Avance</p>
              <p className="text-[11px] text-ink/50">Lectura ejecutiva.</p>
              <div className="pt-2 flex items-center justify-center"><RingChart value={computed.progress} /></div>
            </div>
            <div className="rounded-2xl bg-white border border-black/[0.06] p-4 space-y-2">
              <p className="text-[12px] font-semibold text-ink">Por fases</p>
              <p className="text-[11px] text-ink/50">Dónde está el trabajo.</p>
              <div className="pt-1"><PhaseBars fases={computed.fases} /></div>
            </div>
          </div>

          {/* Plan vs Real */}
          <PlanVsRealCard proyecto={selected} />

          {/* Acciones */}
          <div className="rounded-2xl bg-white border border-black/[0.06] p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-ink">Acciones rápidas</p>
              <p className="text-[11px] text-ink/50">Ir al detalle para ajustes por fase.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-outline text-[12px]" onClick={() => nav("/proyectos")}>Ver lista</button>
              <button className="btn-primary text-[12px]" onClick={() => nav(`/proyectos/${selected.id}`)}>Abrir</button>
            </div>
          </div>

          {/* Acceso rápido al historial */}
          <button type="button" onClick={() => nav("/historial")}
            className="w-full rounded-2xl border border-taupe/30 bg-white px-4 py-3 flex items-center justify-between gap-3 hover:border-ink/20 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-sand flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-ink/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div className="text-left">
                <p className="text-[13px] font-medium text-ink">Historial de proyectos</p>
                <p className="text-[11px] text-ink/50">Archivados y finalizados.</p>
              </div>
            </div>
            <span className="text-ink/40 text-[13px]">→</span>
          </button>
        </>
      )}
    </section>
  );
}

function PlanVsRealCard({ proyecto }) {
  const fases = Array.isArray(proyecto?.fases) ? proyecto.fases : [];
  const totalPeso = fases.reduce((s, f) => s + (f.peso || 1), 0);
  const realGlobal = totalPeso > 0
    ? Math.round(fases.reduce((s, f) => s + (f.porcentaje || 0) * (f.peso || 1), 0) / totalPeso) : 0;

  let planGlobal = null, diasRestantes = null, estadoGlobal = "sin_plan";
  if (proyecto?.startDate && proyecto?.endDate) {
    const ini = new Date(proyecto.startDate), fin = new Date(proyecto.endDate), hoy = new Date();
    if (fin > ini) {
      planGlobal = Math.max(0, Math.min(100, Math.round(((hoy - ini) / (fin - ini)) * 100)));
      diasRestantes = Math.ceil((fin - hoy) / 86400000);
      estadoGlobal = diasRestantes < 0 ? "vencido" : diasRestantes <= 14 ? "proximo" : "en_curso";
    }
  }
  const variacion = planGlobal != null ? realGlobal - planGlobal : null;
  const fasesConPlan = fases.filter(f => f.fechaInicioPlaneada && f.fechaFinPlaneada);

  return (
    <div className="rounded-2xl bg-white border border-black/[0.06] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-ink">Plan vs avance real</p>
          <p className="text-[11px] text-ink/45 mt-0.5">Cronograma vs avance registrado.</p>
        </div>
        {diasRestantes != null && (
          <span className={`text-[10px] font-medium px-2 py-1 rounded-full flex-shrink-0 border ${estadoGlobal === "vencido" ? "bg-red-50 text-red-600 border-red-200"
              : estadoGlobal === "proximo" ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-[#F2EEE7] text-ink/60 border-black/[0.06]"}`}>
            {diasRestantes < 0 ? `Vencido ${Math.abs(diasRestantes)}d` : `${diasRestantes}d restantes`}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniKpi label="Plan" value={planGlobal != null ? `${planGlobal}%` : "—"} sub="tiempo" />
        <MiniKpi label="Real" value={`${realGlobal}%`} sub="avance" />
        <MiniKpi label="Δ" value={variacion == null ? "—" : variacion >= 0 ? `+${variacion}%` : `${variacion}%`}
          sub={variacion == null ? "sin plan" : variacion >= 0 ? "adelantado" : "atrasado"}
          color={variacion == null ? "neutral" : variacion >= 0 ? "green" : variacion >= -15 ? "amber" : "red"} />
      </div>
      {planGlobal != null && (
        <div className="space-y-1.5">
          <BarraDoble label="Plan" pct={planGlobal} dim />
          <BarraDoble label="Real" pct={realGlobal} />
        </div>
      )}
      {fasesConPlan.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-ink/35">Por fase</p>
          {fasesConPlan.map(f => {
            const esp = calcPctEsperado(f.fechaInicioPlaneada, f.fechaFinPlaneada);
            const real = Math.max(0, Math.min(100, f.porcentaje || 0));
            const sem = getSemaforo(esp, real, f.estado);
            return (
              <div key={f.id} className={`rounded-xl border p-2.5 ${sem.bg}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sem.dot}`} />
                    <p className="text-[12px] font-medium text-ink truncate">{f.nombre}</p>
                  </div>
                  <span className={`text-[10px] font-medium flex-shrink-0 ${sem.color}`}>{sem.label}</span>
                </div>
                <div className="space-y-1 ml-3">
                  {esp !== null && <BarraDoble label="Plan" pct={esp} dim small />}
                  <BarraDoble label="Real" pct={real} small />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-ink/35 italic">Sin fechas por fase — configúralas en "Editar proyecto".</p>
      )}
    </div>
  );
}

function KpiCard({ label, value, hint, highlight = "neutral" }) {
  const vc = highlight === "red" ? "text-red-600" : highlight === "amber" ? "text-amber-600" : highlight === "green" ? "text-green-700" : "text-ink";
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-3 py-3">
      <p className="text-[10px] text-ink/45 uppercase tracking-[0.12em]">{label}</p>
      <p className={`mt-1 text-[20px] font-bold leading-none truncate ${vc}`}>{value}</p>
      <p className="mt-1 text-[11px] text-ink/45">{hint}</p>
    </div>
  );
}

function MiniKpi({ label, value, sub, color = "neutral" }) {
  const c = { neutral: "text-ink", green: "text-green-700", amber: "text-amber-700", red: "text-red-600" };
  return (
    <div className="rounded-xl border border-black/[0.06] bg-[#FAFAF7] px-2.5 py-2">
      <p className="text-[10px] text-ink/40">{label}</p>
      <p className={`text-[14px] font-bold leading-tight mt-0.5 ${c[color]}`}>{value}</p>
      <p className="text-[10px] text-ink/35 mt-0.5">{sub}</p>
    </div>
  );
}

function BarraDoble({ label, pct, dim = false, small = false }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-ink/35 flex-shrink-0 ${small ? "text-[9px] w-6" : "text-[10px] w-7"}`}>{label}</span>
      <div className={`flex-1 bg-[#F2EEE7] rounded-full overflow-hidden ${small ? "h-1" : "h-1.5"}`}>
        <div className={`h-full rounded-full ${dim ? "bg-ink/30" : "bg-ink"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-ink/40 flex-shrink-0 text-right ${small ? "text-[9px] w-6" : "text-[10px] w-7"}`}>{pct}%</span>
    </div>
  );
}

function RingChart({ value = 0 }) {
  const pct = clampInt(value, 0, 100);
  return (
    <div className="relative h-[100px] w-[100px] rounded-full"
      style={{ background: `conic-gradient(#141414 ${pct * 3.6}deg, rgba(20,20,20,0.1) 0deg)` }}>
      <div className="absolute inset-[9px] rounded-full bg-white border border-black/[0.06] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[17px] font-bold text-ink leading-none">{pct}%</p>
          <p className="text-[9px] text-ink/40 mt-0.5">avance</p>
        </div>
      </div>
    </div>
  );
}

function PhaseBars({ fases = [] }) {
  return (
    <div className="space-y-2">
      {fases.slice(0, 6).map(f => (
        <div key={f.id} className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-ink/60 truncate">{f.nombre}</p>
            <p className="text-[11px] text-ink/50">{f.porcentaje}%</p>
          </div>
          <div className="h-1.5 w-full bg-[#F2EEE7] rounded-full overflow-hidden">
            <div className="h-full bg-ink rounded-full" style={{ width: `${f.porcentaje}%` }} />
          </div>
        </div>
      ))}
      {fases.length > 6 && <p className="text-[10px] text-ink/35">+{fases.length - 6} más</p>}
    </div>
  );
}

function computeKPIs(p) {
  if (!p) return { progress: 0, progressHint: "—", daysLeftLabel: "—", deadlineHint: "—", completed: 0, total: 0, phaseHint: "—", riskLabel: "—", riskHint: "—", fases: [] };
  const fases = Array.isArray(p.fases) ? p.fases : [];
  const total = fases.length;
  const completed = fases.filter(f => f?.estado === "completada" || Number(f?.porcentaje) >= 100).length;
  const progress = clampInt(p.progress ?? p.avance ?? 0, 0, 100);
  const daysLeft = getDaysLeft(p.endDate || p.fechaEntrega);
  const daysLeftLabel = daysLeft == null ? "—" : daysLeft < 0 ? "Vencido" : String(daysLeft);
  const deadlineHint = daysLeft == null ? "Sin fecha." : daysLeft < 0 ? "Plazo vencido." : daysLeft <= 14 ? "Ventana crítica." : daysLeft <= 30 ? "Monitoreo semanal." : "En rango.";
  const progressHint = progress >= 80 ? "Buen desempeño." : progress >= 50 ? "Normal." : "Requiere impulso.";
  let riskLabel = "Bajo", riskHint = "Estable.";
  if (daysLeft != null) {
    if (daysLeft < 0 || (daysLeft <= 14 && progress < 80)) { riskLabel = "Alto"; riskHint = "Acción inmediata."; }
    else if (daysLeft <= 30 && progress < 70) { riskLabel = "Medio"; riskHint = "Reforzar seguimiento."; }
  }
  return { progress, progressHint, daysLeftLabel, deadlineHint, completed, total, phaseHint: total ? "Balance por etapas." : "Sin fases.", riskLabel, riskHint, fases: fases.map(f => ({ id: f.id, nombre: f.nombre, porcentaje: clampInt(f.porcentaje, 0, 100), estado: f.estado })) };
}

function clampInt(v, a, b) { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, Math.round(n))) : a; }
function getDaysLeft(d) { if (!d) return null; const t = new Date(d); return Number.isNaN(t.getTime()) ? null : Math.ceil((t - Date.now()) / 86400000); }
function calcPctEsperado(ini, fin) {
  if (!ini || !fin) return null;
  const a = new Date(ini), b = new Date(fin), h = new Date();
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return null;
  return Math.max(0, Math.min(100, Math.round(((h - a) / (b - a)) * 100)));
}
function getSemaforo(esp, real, estado) {
  if (estado === "completada") return { color: "text-green-700", bg: "bg-green-50 border-green-200", dot: "bg-green-500", label: "Completada ✓" };
  if (esp === null) return { color: "text-ink/40", bg: "bg-[#F2EEE7] border-black/[0.06]", dot: "bg-ink/20", label: "sin plan" };
  const d = real - esp;
  if (d >= 0) return { color: "text-green-700", bg: "bg-green-50 border-green-200", dot: "bg-green-500", label: d === 0 ? "En tiempo" : `+${d}%` };
  if (d >= -15) return { color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-400", label: `${d}%` };
  return { color: "text-red-700", bg: "bg-red-50 border-red-200", dot: "bg-red-500", label: `${d}%` };
}

DashboardAdmin.propTypes = {};

PlanVsRealCard.propTypes = {
  proyecto: PropTypes.object,
};

KpiCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.any,
  hint: PropTypes.string,
  highlight: PropTypes.string,
};

MiniKpi.propTypes = {
  label: PropTypes.string,
  value: PropTypes.any,
  sub: PropTypes.string,
  color: PropTypes.string,
};

BarraDoble.propTypes = {
  label: PropTypes.string,
  pct: PropTypes.number,
  dim: PropTypes.bool,
  small: PropTypes.bool,
};

RingChart.propTypes = {
  value: PropTypes.number,
};

PhaseBars.propTypes = {
  fases: PropTypes.array,
};
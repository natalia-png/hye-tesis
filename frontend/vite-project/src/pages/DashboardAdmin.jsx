// src/pages/DashboardAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { useNavigate } from "react-router-dom";

export default function DashboardAdmin() {
  const { user, ready } = useAuth();
  const nav = useNavigate();

  const role = (user?.role || "sin-rol").toLowerCase();
  const isAdmin = role === "admin";

  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!ready) return;

      if (!isAdmin) {
        setLoading(false);
        setErr("No tienes permisos para ver el Dashboard de admin.");
        return;
      }

      setLoading(true);
      setErr("");

      try {
        const refCol = collection(db, "projects");

        // ✅ Admin puede listar todos (single-field orderBy ok)
        // Priorizamos updatedAt, si está nulo, igual devuelve
        const qs = query(refCol, orderBy("updatedAt", "desc"), limit(30));
        const snap = await getDocs(qs);

        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // fallback por si algunos no tienen updatedAt
        list.sort((a, b) => {
          const aT = (a.updatedAt?.seconds || a.createdAt?.seconds || 0);
          const bT = (b.updatedAt?.seconds || b.createdAt?.seconds || 0);
          return bT - aT;
        });

        setProjects(list);

        // ✅ selección inicial: el más reciente
        const first = list[0]?.id || "";
        setSelectedId((cur) => cur || first);
      } catch (e) {
        console.error("DashboardAdmin load error:", e);
        setErr("No se pudieron cargar los proyectos. Revisa reglas/permisos.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [ready, isAdmin]);

  const selected = useMemo(() => {
    return projects.find((p) => p.id === selectedId) || null;
  }, [projects, selectedId]);

  const computed = useMemo(() => computeProjectKPIs(selected), [selected]);

  if (!ready) return <p className="text-[13px] text-ink/60">Verificando sesión…</p>;
  if (loading) return <p className="text-[13px] text-ink/60">Cargando Dashboard…</p>;

  if (err) {
    return (
      <section className="space-y-3">
        <div className="card">
          <h1 className="text-[18px] font-semibold text-ink">Inicio (Admin)</h1>
          <p className="text-[13px] text-red-600 mt-2">{err}</p>
        </div>
      </section>
    );
  }

  const first = firstName(user?.name) || "Admin";

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="rounded-[20px] bg-gradient-to-br from-[#141414] via-[#232323] to-[#3a3732] text-ivory p-4 shadow-card border border-white/10">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ivory/60">
          Dashboard administrativo
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold leading-snug">
              Hola, {first}.
            </h1>
            <p className="text-[13px] text-ivory/75">
              KPIs operativos para seguimiento y priorización.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-ivory/25 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-ivory/80">
            Admin
          </span>
        </div>

        {/* Selector proyecto */}
        <div className="mt-3 rounded-2xl bg-white/10 border border-white/10 p-3">
          <p className="text-[11px] text-ivory/70 mb-2">Proyecto en foco</p>
          <select
            className="w-full rounded-xl bg-[#F2EEE7] text-ink text-[13px] px-3 py-2 outline-none border border-white/10"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.code || p.id)} — {(p.name || p.nombre || "Proyecto")}
              </option>
            ))}
          </select>

          {selected && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[12px] text-ivory/80 truncate">
                {(selected.client || selected.cliente || "Cliente")} ·{" "}
                {(selected.location || selected.ubicacion || "—")}
              </p>
              <button
                type="button"
                className="text-[12px] text-ivory/90 underline"
                onClick={() => nav(`/proyectos/${selected.id}`)}
              >
                Abrir
              </button>
            </div>
          )}
        </div>
      </div>

      {!selected ? (
        <div className="card">
          <p className="text-[13px] text-ink/70">No hay proyectos para mostrar.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <section className="grid grid-cols-2 gap-3">
            <KpiCard label="Avance global" value={`${computed.progress}%`} hint={computed.progressHint} />
            <KpiCard label="Días a entrega" value={computed.daysLeftLabel} hint={computed.deadlineHint} />
            <KpiCard label="Fases completadas" value={`${computed.completed}/${computed.total}`} hint={computed.phaseHint} />
            <KpiCard label="Riesgo" value={computed.riskLabel} hint={computed.riskHint} />
          </section>

          {/* Gráficos */}
          <section className="grid grid-cols-2 gap-3">
            <div className="card space-y-2">
              <p className="text-[12px] font-semibold text-ink">Avance</p>
              <p className="text-[11px] text-ink/60">Lectura rápida ejecutiva.</p>
              <div className="pt-2 flex items-center justify-center">
                <RingChart value={computed.progress} />
              </div>
            </div>

            <div className="card space-y-2">
              <p className="text-[12px] font-semibold text-ink">Fases</p>
              <p className="text-[11px] text-ink/60">Dónde está el trabajo.</p>
              <div className="pt-1">
                <PhaseBars fases={computed.fases} />
              </div>
            </div>
          </section>

          {/* Última actualización + CTA */}
          <div className="card flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-ink">Acciones rápidas</p>
              <p className="text-[11px] text-ink/60">
                Ir a detalle para notas/archivos y ajustes por fase.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-outline text-[12px]" onClick={() => nav("/proyectos")}>
                Ver lista
              </button>
              <button className="btn-primary text-[12px]" onClick={() => nav(`/proyectos/${selected.id}`)}>
                Abrir proyecto
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/* ---------------- helpers + UI ---------------- */

function firstName(full) {
  if (!full) return "";
  return String(full).trim().split(" ")[0];
}

function computeProjectKPIs(p) {
  if (!p) {
    return {
      progress: 0,
      progressHint: "—",
      daysLeftLabel: "—",
      deadlineHint: "—",
      completed: 0,
      total: 0,
      phaseHint: "—",
      riskLabel: "—",
      riskHint: "—",
      fases: [],
    };
  }

  const fases = Array.isArray(p.fases) ? p.fases : [];
  const total = fases.length || 0;
  const completed = fases.filter((f) => f?.estado === "completada" || (Number(f?.porcentaje) >= 100)).length;

  const progressRaw = typeof p.progress === "number" ? p.progress : typeof p.avance === "number" ? p.avance : 0;
  const progress = clampInt(progressRaw, 0, 100);

  const endDate = p.endDate || p.fechaEntrega || null;
  const daysLeft = calcDaysLeft(endDate);
  const daysLeftLabel = daysLeft == null ? "—" : daysLeft < 0 ? "Vencido" : String(daysLeft);

  const deadlineHint =
    daysLeft == null
      ? "Sin fecha registrada."
      : daysLeft < 0
      ? "La fecha estimada ya pasó."
      : daysLeft <= 14
      ? "Ventana crítica: cerrar pendientes."
      : daysLeft <= 30
      ? "Monitoreo semanal recomendado."
      : "En rango esperado.";

  const progressHint =
    progress >= 80 ? "Buen desempeño." : progress >= 50 ? "Seguimiento normal." : "Requiere priorización.";

  const phaseHint = total ? "Balance por etapas." : "No hay fases configuradas.";

  // Riesgo simple pero útil (pro):
  // - Alto si faltan <= 14 días y avance < 80
  // - Medio si faltan <= 30 días y avance < 70
  // - Bajo el resto
  let riskLabel = "Bajo";
  let riskHint = "Operación estable.";

  if (daysLeft != null) {
    if (daysLeft <= 14 && progress < 80) {
      riskLabel = "Alto";
      riskHint = "Acelerar entregables y bloquear desviaciones.";
    } else if (daysLeft <= 30 && progress < 70) {
      riskLabel = "Medio";
      riskHint = "Reforzar plan y seguimiento.";
    } else if (daysLeft < 0) {
      riskLabel = "Alto";
      riskHint = "Entrega vencida: revisar plan de acción.";
    }
  }

  return {
    progress,
    progressHint,
    daysLeftLabel,
    deadlineHint,
    completed,
    total,
    phaseHint,
    riskLabel,
    riskHint,
    fases: fases.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      porcentaje: clampInt(f.porcentaje, 0, 100),
      estado: f.estado,
    })),
  };
}

function clampInt(v, a, b) {
  const n = Number(v);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, Math.round(n)));
}

function calcDaysLeft(endDate) {
  if (!endDate) return null;
  const d = new Date(endDate);
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

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
  const style = {
    background: `conic-gradient(#141414 ${pct * 3.6}deg, rgba(20,20,20,0.12) 0deg)`,
  };

  return (
    <div className="relative h-[110px] w-[110px] rounded-full" style={style}>
      <div className="absolute inset-[10px] rounded-full bg-[#F2EEE7] border border-taupe/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[18px] font-semibold text-ink leading-none">{pct}%</p>
          <p className="text-[10px] text-ink/60 mt-1">avance</p>
        </div>
      </div>
    </div>
  );
}

function PhaseBars({ fases = [] }) {
  const show = fases.slice(0, 6);

  return (
    <div className="space-y-2">
      {show.map((f) => (
        <div key={f.id} className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-ink/70 truncate">{f.nombre}</p>
            <p className="text-[11px] text-ink/60">{f.porcentaje}%</p>
          </div>
          <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
            <div className="h-full bg-ink" style={{ width: `${f.porcentaje}%` }} />
          </div>
        </div>
      ))}
      {fases.length > show.length && (
        <p className="text-[11px] text-ink/50">
          +{fases.length - show.length} fases más (ver detalle en proyecto)
        </p>
      )}
    </div>
  );
}
// src/pages/DashboardCliente.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { useNavigate } from "react-router-dom";

export default function DashboardCliente() {
  const { user, ready } = useAuth();
  const nav = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!ready) return;

      const email = (user?.email || "").trim().toLowerCase();
      if (!email) {
        setProject(null);
        setLoading(false);
        setErr("No se detectó tu correo en sesión. Vuelve a iniciar sesión.");
        return;
      }

      setLoading(true);
      setErr("");

      try {
        const refCol = collection(db, "projects");

        // ✅ 100% por EMAIL (sin orderBy para evitar índices extra)
        const qs = query(refCol, where("clientEmail", "==", email), limit(50));
        const snap = await getDocs(qs);

        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // ✅ elegimos el más “reciente” por updatedAt si existe, si no por createdAt
        list.sort((a, b) => {
          const aT = (a.updatedAt?.seconds || a.createdAt?.seconds || 0);
          const bT = (b.updatedAt?.seconds || b.createdAt?.seconds || 0);
          return bT - aT;
        });

        setProject(list[0] || null);
      } catch (e) {
        console.error("DashboardCliente load error:", e);
        setErr(
          "No se pudo cargar tu Dashboard. Verifica que tu proyecto tenga clientEmail exactamente igual al correo con el que iniciaste sesión (en minúscula)."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [ready, user?.email]);

  const computed = useMemo(() => computeProjectKPIs(project), [project]);

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

  if (!project) {
    return (
      <section className="space-y-3">
        <div className="card space-y-2">
          <h1 className="text-[18px] font-semibold text-ink">Inicio</h1>
          <p className="text-[13px] text-ink/70">
            Aún no tienes proyectos asignados a tu correo.
          </p>
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

  const pName = project.name || project.nombre || "Proyecto";
  const pCode = project.code || project.id;
  const pStatus = project.status || project.estado || "Sin estado";
  const pLocation = project.location || project.ubicacion || "—";

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="rounded-[20px] bg-gradient-to-br from-[#141414] via-[#232323] to-[#3a3732] text-ivory p-4 shadow-card border border-white/10">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ivory/60">
          Dashboard de cliente
        </p>
        <div className="mt-2">
          <h1 className="text-[18px] font-semibold leading-snug">
            Hola, {firstName(user?.name) || "Cliente"}.
          </h1>
          <p className="text-[13px] text-ivory/75">
            Resumen ejecutivo del estado de tu proyecto.
          </p>
        </div>

        <div className="mt-3 rounded-2xl bg-white/10 border border-white/10 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] text-ivory/70">Proyecto</p>
              <p className="text-[14px] font-semibold truncate">{pName}</p>
              <p className="text-[12px] text-ivory/70 mt-1">
                Código <span className="font-medium">{pCode}</span> · {pLocation}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-white/20 px-3 py-1 text-[11px] text-ivory/80">
              {pStatus}
            </span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3">
        <KpiCard label="Avance global" value={`${computed.progress}%`} hint={computed.progressHint} />
        <KpiCard label="Días restantes" value={computed.daysLeftLabel} hint={computed.deadlineHint} />
        <KpiCard label="Fases completadas" value={`${computed.completed}/${computed.total}`} hint={computed.phaseHint} />
        <KpiCard label="Próxima fase" value={computed.nextPhaseLabel} hint="Siguiente hito operativo." />
      </section>

      {/* Gráficos */}
      <section className="grid grid-cols-2 gap-3">
        <div className="card space-y-2">
          <p className="text-[12px] font-semibold text-ink">Distribución de avance</p>
          <p className="text-[11px] text-ink/60">Lectura rápida del progreso total.</p>
          <div className="pt-2 flex items-center justify-center">
            <RingChart value={computed.progress} />
          </div>
        </div>

        <div className="card space-y-2">
          <p className="text-[12px] font-semibold text-ink">Fases (porcentaje)</p>
          <p className="text-[11px] text-ink/60">Comparativo por etapa.</p>
          <div className="pt-1">
            <PhaseBars fases={computed.fases} compact />
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="card flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-ink">Ver detalle completo</p>
          <p className="text-[11px] text-ink/60">
            Avances, notas y archivos visibles por fase.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary text-[12px]"
          onClick={() => nav(`/mis-proyectos/${project.id}`)}
        >
          Abrir
        </button>
      </div>
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
      nextPhaseLabel: "—",
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

  const next = fases.find((f) => (f?.estado !== "completada") && clampInt(f?.porcentaje, 0, 100) < 100);
  const nextPhaseLabel = next?.nombre || next?.name || "—";

  const daysLeftLabel = daysLeft == null ? "—" : daysLeft < 0 ? "Vencido" : String(daysLeft);

  const deadlineHint =
    daysLeft == null
      ? "Sin fecha registrada."
      : daysLeft < 0
      ? "La fecha estimada ya pasó."
      : daysLeft <= 14
      ? "Atención: ventana crítica."
      : daysLeft <= 30
      ? "Revisar prioridades."
      : "Dentro de lo esperado.";

  const progressHint =
    progress >= 80 ? "Buen ritmo." : progress >= 50 ? "En seguimiento." : "Requiere impulso.";

  const phaseHint = total ? "Estado por etapas." : "No hay fases configuradas.";

  return {
    progress,
    progressHint,
    daysLeftLabel,
    deadlineHint,
    completed,
    total,
    phaseHint,
    nextPhaseLabel,
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

function PhaseBars({ fases = [], compact = false }) {
  const show = fases.slice(0, compact ? 4 : 8);

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
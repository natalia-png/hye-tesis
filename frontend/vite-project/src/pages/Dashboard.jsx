// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/useAuth";
import {
  collection,
  getDocs,
  orderBy,
  limit,
  query,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase() || "sin-rol";

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [errorProjects, setErrorProjects] = useState("");

  // 🔌 Cargar proyectos reales desde Firestore
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoadingProjects(true);
      setErrorProjects("");
      try {
        // Por ahora: todos los proyectos (luego filtramos por arquitectoUid, cliente, etc.)
        const base = collection(db, "projects");
        const q = query(base, orderBy("createdAt", "desc"), limit(5));
        const snap = await getDocs(q);

        const items = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            code: data.code || doc.id,
            nombre: data.name || data.nombre || "Proyecto sin nombre",
            cliente: data.client || data.cliente || "Cliente sin nombre",
            estado: data.status || data.estado || "Sin estado",
            avance:
              typeof data.progress === "number"
                ? data.progress
                : typeof data.avance === "number"
                ? data.avance
                : 0,
          };
        });

        setProjects(items);
      } catch (e) {
        console.error("Error cargando proyectos:", e);
        setErrorProjects("No se pudieron cargar los proyectos.");
      } finally {
        setLoadingProjects(false);
      }
    };

    load();
  }, [user?.uid]);

  if (role === "arquitecto" || role === "arquitecta") {
    return (
      <ArchitectDashboard
        user={user}
        projects={projects}
        loading={loadingProjects}
        error={errorProjects}
      />
    );
  }

  // Otros roles: por ahora un dashboard simple
  return <GenericDashboard user={user} />;
}

/* ------------------------------------------------------------------ */
/* Dashboard específico ARQUITECTA (Luisa)                            */
/* ------------------------------------------------------------------ */

function ArchitectDashboard({ user, projects, loading, error }) {
  const nav = useNavigate();

  const firstName = useMemo(
    () => (user?.name ? user.name.split(" ")[0] : "Arquitecta"),
    [user]
  );

  const activos = projects.length;
  const enEjecucion = projects.filter((p) =>
    p.estado.toLowerCase().includes("ejecución")
  ).length;
  const casiListos = projects.filter((p) => p.avance >= 80).length;

  return (
    <section className="space-y-5">
      {/* Tarjeta principal de bienvenida */}
      <div className="rounded-[20px] bg-gradient-to-br from-[#141414] via-[#232323] to-[#3a3732] text-ivory p-4 shadow-card border border-white/10">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ivory/60">
          Panel de arquitectura
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold leading-snug">
              Hola, {firstName}.
            </h1>
            <p className="text-[13px] text-ivory/75">
              Este es el estado actual de tus proyectos en H&amp;E.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-ivory/25 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-ivory/80">
            Arquitecta
          </span>
        </div>
      </div>

      {/* Métricas rápidas */}
      <section className="grid grid-cols-3 gap-3">
        <MetricCard label="Proyectos activos" value={activos} />
        <MetricCard label="En ejecución" value={enEjecucion} />
        <MetricCard label="Casi listos" value={casiListos} />
      </section>

      {/* Portafolio de proyectos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">
            Portafolio de proyectos
          </h2>
          <button
            onClick={() => nav("/proyectos")}
            className="text-[12px] text-ink/70 hover:text-ink underline-offset-2 hover:underline"
          >
            Ver todos
          </button>
        </div>

        {loading && (
          <p className="text-[13px] text-ink/60">Cargando proyectos…</p>
        )}

        {error && !loading && (
          <p className="text-[13px] text-red-600">{error}</p>
        )}

        {!loading && !error && projects.length === 0 && (
          <p className="text-[13px] text-ink/50">
            Aún no hay proyectos registrados. Puedes crear el primero desde la
            sección de “Proyectos”.
          </p>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="space-y-3">
            {projects.map((p) => (
              <article
                key={p.id}
                className="card cursor-pointer active:scale-[0.99] transition-transform"
                onClick={() => nav("/proyectos")} // luego lo cambiamos a /proyectos/:id
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-[14px] font-medium text-ink">
                      {p.nombre}
                    </h3>
                    <p className="text-[12px] text-ink/70">{p.cliente}</p>
                  </div>
                  <span className="text-[11px] text-ink/60 font-semibold tracking-wide">
                    {p.code}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-ink/65">
                  <span className="inline-flex items-center rounded-full bg-sand/80 px-2 py-[2px] text-[11px] text-ink/80">
                    {p.estado}
                  </span>
                  <span>{p.avance}% avance</span>
                </div>

                <div className="mt-2 h-1.5 w-full bg-sand rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ink"
                    style={{ width: `${p.avance}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Acciones rápidas */}
      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-ink">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => nav("/proyectos")}
            className="btn-primary !text-[13px] flex items-center justify-center gap-2"
          >
            <span>Gestionar proyectos</span>
          </button>
          <button
            onClick={() => nav("/proyectos")}
            className="btn-outline !text-[13px] flex items-center justify-center"
          >
            Nuevo proyecto
          </button>
        </div>
      </section>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard genérico para otros roles                                */
/* ------------------------------------------------------------------ */

function GenericDashboard({ user }) {
  const firstName = user?.name?.split(" ")[0] || "Usuario";
  const role = user?.role || "sin rol";

  return (
    <section className="space-y-4">
      <div className="rounded-[20px] bg-white border border-taupe/30 shadow-card p-4">
        <h1 className="text-[18px] font-semibold text-ink">
          Bienvenido, {firstName}
        </h1>
        <p className="text-[13px] text-ink/70 mt-1">
          Estás autenticado como{" "}
          <span className="font-medium capitalize">{role}</span>.
        </p>
        <p className="text-[13px] text-ink/65 mt-2">
          Pronto veremos aquí un resumen específico para tu rol.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Componentes de apoyo                                               */
/* ------------------------------------------------------------------ */

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-taupe/30 bg-ivory/90 px-3 py-2 shadow-card">
      <p className="text-[11px] text-ink/60">{label}</p>
      <p className="mt-1 text-[18px] font-semibold text-ink leading-none">
        {value}
      </p>
    </div>
  );
}

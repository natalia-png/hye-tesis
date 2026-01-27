// src/pages/Proyectos.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";

export default function Proyectos() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qText, setQText] = useState("");
  const [order, setOrder] = useState("recientes"); // "recientes" | "nombre"

  // 🔌 Cargar proyectos desde Firestore (optimizado para costos)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const base = collection(db, "projects");

        // 🔒 Cost-friendly: trae solo los más recientes (ej: 50)
        const qRef = query(base, orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(qRef);

        const items = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            code: data.code || d.id,
            name: data.name || data.nombre || "Proyecto sin nombre",
            client: data.client || data.cliente || "Cliente sin nombre",
            status: data.status || data.estado || "Sin estado",
            // OJO: en detalle ya calculas el avance por fases.
            // Aquí mantenemos progress como "resumen" (si luego quieres, lo recalculamos también aquí).
            progress:
              typeof data.progress === "number"
                ? data.progress
                : typeof data.avance === "number"
                ? data.avance
                : 0,
            createdAt: data.createdAt || null,
          };
        });

        setProjects(items);
      } catch (e) {
        console.error("Error cargando proyectos:", e);
        setError("No se pudieron cargar los proyectos. Revisa permisos/reglas.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // 🔍 Filtros y orden (sin recargar Firestore)
  const filtered = useMemo(() => {
    const term = qText.trim().toLowerCase();
    let list = [...projects];

    if (term) {
      list = list.filter((p) => {
        const code = (p.code || "").toLowerCase();
        const name = (p.name || "").toLowerCase();
        const client = (p.client || "").toLowerCase();
        return code.includes(term) || name.includes(term) || client.includes(term);
      });
    }

    if (order === "nombre") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    // "recientes" ya vienen por createdAt desc (y si no, igual queda consistente)

    return list;
  }, [projects, qText, order]);

  const stats = useMemo(() => {
    const total = projects.length;
    const enCurso = projects.filter((p) => {
      const s = (p.status || "").toLowerCase();
      return s.includes("curso") || s.includes("ejecución") || s.includes("ejecucion");
    }).length;
    return { total, enCurso };
  }, [projects]);

  const firstName = user?.name?.split(" ")[0] || "Arquitecta";

  return (
    <section className="space-y-5">
      {/* Encabezado */}
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold text-ink">Proyectos</h1>
            <p className="text-[13px] text-ink/65">
              {stats.total} totales · {stats.enCurso} en curso
            </p>
          </div>

          <button
            type="button"
            className="btn-primary whitespace-nowrap"
            onClick={() => nav("/proyectos/nuevo")}
          >
            + Nuevo
          </button>
        </div>

        <p className="text-[12px] text-ink/65 leading-relaxed">
          Esta vista está pensada para{" "}
          <span className="font-medium">{firstName}</span>, como directora de la
          firma de arquitectura. Desde aquí revisa el portafolio completo de
          proyectos, verifica el estado, el cliente asociado y el avance de cada
          uno antes de entrar al detalle.
        </p>
      </header>

      {/* Búsqueda y ordenamiento */}
      <div className="space-y-3 rounded-2xl bg-ivory/80 p-3 border border-taupe/20">
        <div className="flex gap-2">
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Buscar por ID, nombre o cliente…"
            className="input flex-1"
          />
        </div>

        <div className="flex gap-2 text-[12px]">
          <button
            type="button"
            onClick={() => setOrder("recientes")}
            className={`px-3 py-1 rounded-full border ${
              order === "recientes"
                ? "bg-ink text-ivory border-ink"
                : "bg-transparent text-ink/70 border-taupe/40"
            }`}
          >
            Recientes
          </button>

          <button
            type="button"
            onClick={() => setOrder("nombre")}
            className={`px-3 py-1 rounded-full border ${
              order === "nombre"
                ? "bg-ink text-ivory border-ink"
                : "bg-transparent text-ink/70 border-taupe/40"
            }`}
          >
            A-Z por nombre
          </button>
        </div>

        {/* Nota cost-friendly */}
        <p className="text-[11px] text-ink/50">
          Se muestran los 50 proyectos más recientes para optimizar lecturas en Firestore.
        </p>
      </div>

      {/* Listado */}
      <div className="space-y-3">
        {loading && (
          <p className="text-[13px] text-ink/60">Cargando proyectos…</p>
        )}

        {error && !loading && (
          <p className="text-[13px] text-red-600">{error}</p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <p className="text-[13px] text-ink/50">
            No se encontraron proyectos con ese criterio de búsqueda.
          </p>
        )}

        {!loading &&
          !error &&
          filtered.map((p) => (
            <article
              key={p.id}
              className="card flex flex-col gap-2 cursor-pointer"
              onClick={() => nav(`/proyectos/${p.id}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[15px] font-medium text-ink">{p.name}</h3>
                  <p className="text-[12px] text-ink/70">Cliente: {p.client}</p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] text-ink/70 font-semibold tracking-wide">
                    {p.code}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-sand px-2 py-[2px] text-[11px] text-ink/80">
                    {p.status}
                  </span>
                </div>
              </div>

              <div className="mt-1">
                <div className="flex justify-between text-[11px] text-ink/60 mb-1">
                  <span>Avance</span>
                  <span>{p.progress}%</span>
                </div>
                <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
                  <div className="h-full bg-ink" style={{ width: `${p.progress}%` }} />
                </div>
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}

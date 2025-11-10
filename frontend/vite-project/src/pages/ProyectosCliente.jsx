// src/pages/ProyectosCliente.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";

export default function ProyectosCliente() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Cargar proyectos asociados al cliente logueado
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      setError("");

      try {
        // suponiendo que en "projects" guardas clientUid = uid del cliente
        const ref = collection(db, "projects");
        const qs = query(ref, where("clientUid", "==", user.uid));
        const snap = await getDocs(qs);

        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id, // 🔴 MUY IMPORTANTE: este es el que usamos en la ruta
            code: data.code || d.id,
            name: data.name || data.nombre || "Proyecto sin nombre",
            status: data.status || data.estado || "Sin estado",
            progress:
              typeof data.progress === "number"
                ? data.progress
                : typeof data.avance === "number"
                ? data.avance
                : 0,
            location: data.location || data.ubicacion || "",
          };
        });

        setItems(list);
      } catch (e) {
        console.error(e);
        setError("No se pudieron cargar tus proyectos.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return items.filter(
      (p) =>
        p.code.toLowerCase().includes(s) ||
        p.name.toLowerCase().includes(s) ||
        p.location.toLowerCase().includes(s)
    );
  }, [items, q]);

  return (
    <section className="space-y-4">
      <div className="card space-y-2">
        <h1 className="text-[18px] font-semibold text-ink">Mis proyectos</h1>
        <p className="text-[13px] text-ink/70">
          Esta vista está diseñada para clientes de la firma H&E. Aquí puedes
          consultar el estado general de tus proyectos, el avance acumulado y la
          información clave sin acceder a los módulos internos de gestión.
        </p>
        <p className="text-[12px] text-ink/60">
          Proyectos asociados a tu usuario:{" "}
          <span className="font-semibold">{items.length}</span>
        </p>
      </div>

      <div className="card space-y-3">
        <p className="text-[12px] text-ink/60">Buscar en mis proyectos</p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por código, nombre o ubicación…"
          className="input w-full"
        />
      </div>

      {loading && (
        <p className="text-[13px] text-ink/60">Cargando proyectos…</p>
      )}

      {error && (
        <p className="text-[13px] text-red-600 mt-2">{error}</p>
      )}

      <div className="space-y-3">
        {filtered.map((p) => (
          <article
            key={p.id}
            className="card space-y-2 cursor-pointer"
            onClick={() => nav(`/mis-proyectos/${p.id}`)} // 👈 aquí vamos al detalle
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">
                  {p.name}
                </h2>
                <p className="text-[12px] text-ink/70">
                  {p.location || "Ubicación pendiente"}
                </p>
              </div>
              <span className="text-[11px] text-ink/60">{p.code}</span>
            </div>

            <span className="inline-flex w-fit rounded-full bg-sand px-3 py-[3px] text-[11px] text-ink/80">
              {p.status}
            </span>

            <div className="mt-1">
              <div className="flex justify-between text-[11px] text-ink/60 mb-1">
                <span>Avance</span>
                <span>{p.progress}%</span>
              </div>
              <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
                <div
                  className="h-full bg-ink"
                  style={{ width: `${p.progress}%` }}
                />
              </div>
            </div>

            <p className="text-[11px] text-ink/60 mt-1">
              Esta información tiene carácter informativo. Las decisiones
              técnicas y contractuales siguen siendo coordinadas directamente
              con el equipo de H&amp;E.
            </p>

            <button
              type="button"
              className="mt-1 text-[12px] text-ink/70 underline"
              onClick={(e) => {
                e.stopPropagation();
                nav(`/mis-proyectos/${p.id}`);
              }}
            >
              Ver detalle
            </button>
          </article>
        ))}

        {!loading && !error && filtered.length === 0 && (
          <p className="text-[13px] text-ink/60">
            No se encontraron proyectos con ese criterio.
          </p>
        )}
      </div>
    </section>
  );
}

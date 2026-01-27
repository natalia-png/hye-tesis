// src/pages/ProyectosCliente.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";

export default function ProyectosCliente() {
  const { user, ready } = useAuth();
  const nav = useNavigate();

  const [items, setItems] = useState([]);
  const [qText, setQText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!ready) return;

      const uid = user?.uid || null;
      const email = (user?.email || "").trim();


      if (!uid) {
        setItems([]);
        setLoading(false);
        setError("");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const refCol = collection(db, "projects");

        // ✅ 1) Principal: por email (tu caso real)
        let snapEmail = { docs: [] };
        if (email) {
          const qsEmail = query(
            refCol,
            where("clientEmail", "==", email),
            limit(50)
          );
          snapEmail = await getDocs(qsEmail);
        }

        // ✅ 2) Fallback: por clientId (por si tienes proyectos viejos)
        const qsUid = query(refCol, where("clientId", "==", uid), limit(50));
        const snapUid = await getDocs(qsUid);

        // ✅ Unir + deduplicar por id
        const map = new Map();

        const pushDocs = (docs) => {
          docs.forEach((d) => {
            const data = d.data() || {};
            map.set(d.id, {
              id: d.id,
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
              createdAt: data.createdAt || null,
            });
          });
        };

        pushDocs(snapEmail.docs);
        pushDocs(snapUid.docs);

        const list = Array.from(map.values());

        // ✅ Ordenar (más reciente primero) sin indices extra
        list.sort((a, b) => {
          const aT = a.createdAt?.seconds || 0;
          const bT = b.createdAt?.seconds || 0;
          return bT - aT;
        });

        setItems(list);
      } catch (e) {
        console.error("Error cargando proyectos cliente:", e);
        setError(
          "No se pudieron cargar tus proyectos. Revisa que el proyecto tenga clientEmail (igual al correo con el que iniciaste sesión) o clientId asignado."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [ready, user?.uid, user?.email]);

  const filtered = useMemo(() => {
    const term = qText.trim().toLowerCase();
    if (!term) return items;

    return items.filter((p) => {
      const code = (p.code || "").toLowerCase();
      const name = (p.name || "").toLowerCase();
      const loc = (p.location || "").toLowerCase();
      return code.includes(term) || name.includes(term) || loc.includes(term);
    });
  }, [items, qText]);

  return (
    <section className="space-y-4">
      <div className="card space-y-2">
        <h1 className="text-[18px] font-semibold text-ink">Mis proyectos</h1>
        <p className="text-[13px] text-ink/70">
          Esta vista está diseñada para clientes de la firma H&amp;E. Aquí puedes
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
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          placeholder="Buscar por código, nombre o ubicación…"
          className="input w-full"
        />
        <p className="text-[11px] text-ink/50">
          Se muestran hasta 50 proyectos para optimizar lecturas en Firestore.
        </p>
      </div>

      {!ready && <p className="text-[13px] text-ink/60">Verificando sesión…</p>}
      {loading && ready && <p className="text-[13px] text-ink/60">Cargando proyectos…</p>}
      {error && <p className="text-[13px] text-red-600 mt-2">{error}</p>}

      <div className="space-y-3">
        {filtered.map((p) => (
          <article
            key={p.id}
            className="card space-y-2 cursor-pointer"
            onClick={() => nav(`/mis-proyectos/${p.id}`)}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">{p.name}</h2>
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
                <div className="h-full bg-ink" style={{ width: `${p.progress}%` }} />
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

        {!loading && !error && ready && filtered.length === 0 && (
          <p className="text-[13px] text-ink/60">
            No se encontraron proyectos con ese criterio.
          </p>
        )}
      </div>
    </section>
  );
}

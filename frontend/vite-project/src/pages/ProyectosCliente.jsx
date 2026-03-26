// src/pages/ProyectosCliente.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
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
    if (!ready) return;

    // ✅ CORREGIDO: usar clientEmail (igual que DashboardCliente)
    // El flujo oficial es: Luisa asigna por email → se guarda clientEmail
    const email = (user?.email || "").trim().toLowerCase();

    if (!email) {
      setItems([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    setItems([]);

    const refCol = collection(db, "projects");

    // ✅ Filtra por clientEmail — consistente con DashboardCliente
    const qs = query(refCol, where("clientEmail", "==", email), limit(50));

    const unsub = onSnapshot(
      qs,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
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
          };
        });

        // ordenar local por createdAt (sin índices)
        list.sort((a, b) => {
          const aT = a.createdAt?.seconds || 0;
          const bT = b.createdAt?.seconds || 0;
          return bT - aT;
        });

        setItems(list);
        setLoading(false);
        setError("");
      },
      (e) => {
        setItems([]);
        setLoading(false);
        setError("No se pudieron cargar tus proyectos. Verifica que tu proyecto tenga el email asignado correctamente.");
      }
    );

    return () => { try { unsub(); } catch (_e) { /* ignore */ } };
  }, [ready, user?.email]); // ✅ depende de email, consistente con DashboardCliente

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
          Aquí puedes consultar el estado general de tus proyectos e información clave.
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
          <button
            key={p.id}
            type="button"
            className="card space-y-2 cursor-pointer w-full text-left"
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
          </button>
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

ProyectosCliente.propTypes = {};
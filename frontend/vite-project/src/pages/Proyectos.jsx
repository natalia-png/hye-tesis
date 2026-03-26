// src/pages/Proyectos.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, orderBy, query, limit, onSnapshot,
  doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import PropTypes from "prop-types";

export default function Proyectos() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qText, setQText] = useState("");
  const [order, setOrder] = useState("recientes");

  useEffect(() => {
    const qRef = query(
      collection(db, "projects"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(qRef, snap => {
      const items = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          code: data.code || d.id,
          name: data.name || data.nombre || "Proyecto sin nombre",
          client: data.client || data.cliente || "Cliente sin nombre",
          status: data.status || data.estado || "Sin estado",
          progress:
            typeof data.progress === "number" ? data.progress :
            typeof data.avance === "number" ? data.avance : 0,
          createdAt: data.createdAt || null,
        };
      // Excluir archivados y finalizados de la lista activa
      }).filter(p => {
        const s = (p.status || "").toLowerCase();
        return s !== "archivado" && s !== "finalizado" && s !== "completado";
      });

      setProjects(items);
      setLoading(false);
    }, e => {
      setError("No se pudieron cargar los proyectos.");
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const term = qText.trim().toLowerCase();
    let list = [...projects];
    if (term) {
      list = list.filter(p =>
        (p.code || "").toLowerCase().includes(term) ||
        (p.name || "").toLowerCase().includes(term) ||
        (p.client || "").toLowerCase().includes(term)
      );
    }
    if (order === "nombre") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return list;
  }, [projects, qText, order]);

  const stats = useMemo(() => {
    const total = projects.length;
    const enCurso = projects.filter(p => {
      const s = (p.status || "").toLowerCase();
      return s.includes("curso") || s.includes("ejecución") || s.includes("ejecucion");
    }).length;
    return { total, enCurso };
  }, [projects]);

  const handleArchivar = async (id) => {
    try {
      await updateDoc(doc(db, "projects", id), {
        status: "Archivado",
        archivedAt: serverTimestamp(),
      });
      // onSnapshot lo elimina automáticamente de la lista
    } catch (e) {
    }
  };

  const firstName = user?.name?.split(" ")[0] || "Arquitecta";

  return (
    <section className="space-y-5">
      {/* Encabezado */}
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold text-ink">Proyectos</h1>
            <p className="text-[13px] text-ink/65">
              {stats.total} activos · {stats.enCurso} en curso
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
          Vista de <span className="font-medium">{firstName}</span> — portafolio
          activo. Los proyectos archivados se mueven al Historial.
        </p>
      </header>

      {/* Búsqueda y orden */}
      <div className="space-y-3 rounded-2xl bg-ivory/80 p-3 border border-taupe/20">
        <input
          value={qText}
          onChange={e => setQText(e.target.value)}
          placeholder="Buscar por ID, nombre o cliente…"
          className="input w-full"
        />
        <div className="flex gap-2 text-[12px]">
          {["recientes", "nombre"].map(o => (
            <button
              key={o}
              type="button"
              onClick={() => setOrder(o)}
              className={`px-3 py-1 rounded-full border ${
                order === o
                  ? "bg-ink text-ivory border-ink"
                  : "bg-transparent text-ink/70 border-taupe/40"
              }`}
            >
              {o === "recientes" ? "Recientes" : "A-Z por nombre"}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink/50">
          Se muestran los 50 proyectos activos más recientes.
        </p>
      </div>

      {/* Listado */}
      <div className="space-y-3">
        {loading && <p className="text-[13px] text-ink/60">Cargando proyectos…</p>}
        {error && !loading && <p className="text-[13px] text-red-600">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="text-[13px] text-ink/50">
            No se encontraron proyectos con ese criterio.
          </p>
        )}

        {!loading && !error && filtered.map(p => (
          <TarjetaProyecto
            key={p.id}
            proyecto={p}
            onNav={() => nav(`/proyectos/${p.id}`)}
            onArchivar={() => handleArchivar(p.id)}
          />
        ))}
      </div>
    </section>
  );
}

/* ── TARJETA ── */
function TarjetaProyecto({ proyecto: p, onNav, onArchivar }) {
  const [confirm, setConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const handleArchivar = async (e) => {
    e.stopPropagation();
    setArchiving(true);
    await onArchivar();
    setArchiving(false);
    setConfirm(false);
  };

  return (
    <article className="card flex flex-col gap-2">
      {/* Zona clickeable principal */}
      <div
        className="flex items-start justify-between gap-4 cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={onNav}
        onKeyDown={e => e.key === 'Enter' && onNav()}
      >
        <div>
          <h3 className="text-[15px] font-medium text-ink">{p.name}</h3>
          <p className="text-[12px] text-ink/70">Cliente: {p.client}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[11px] text-ink/70 font-semibold tracking-wide">{p.code}</span>
          <span className="inline-flex items-center rounded-full bg-sand px-2 py-[2px] text-[11px] text-ink/80">
            {p.status}
          </span>
        </div>
      </div>

      {/* Barra de progreso */}
      <div
        className="mt-1 cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={onNav}
        onKeyDown={e => e.key === 'Enter' && onNav()}
      >
        <div className="flex justify-between text-[11px] text-ink/60 mb-1">
          <span>Avance</span>
          <span>{p.progress}%</span>
        </div>
        <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
          <div className="h-full bg-ink" style={{ width: `${p.progress}%` }} />
        </div>
      </div>

      {/* Archivar */}
      <div className="border-t border-sand pt-2.5 mt-1">
        {!confirm ? (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setConfirm(true); }}
            className="text-[11px] text-ink/35 hover:text-amber-600 transition-colors"
          >
            Archivar proyecto →
          </button>
        ) : (
          <div
            className="flex items-center gap-2"
            role="button"
            tabIndex={0}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
          >
            <p className="text-[11px] text-amber-700 font-medium">¿Mover al historial?</p>
            <button
              type="button"
              onClick={handleArchivar}
              disabled={archiving}
              className="px-3 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-medium disabled:opacity-50"
            >
              {archiving ? "Archivando…" : "Sí, archivar"}
            </button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setConfirm(false); }}
              className="px-3 py-1 rounded-lg text-[11px] text-ink/50 hover:text-ink transition"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

TarjetaProyecto.propTypes = {
  proyecto: PropTypes.object,
  onNav: PropTypes.func,
  onArchivar: PropTypes.func,
};

// src/pages/HistorialProyectos.jsx
// Vista admin — proyectos Archivados y Finalizados
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getAuth } from "firebase/auth";
import BtnReportePDF from "../components/BtnReportePDF";

const FUNCTIONS_URL = "https://us-central1-hye-tesis.cloudfunctions.net";

async function callEliminarProyecto(projectId) {
  const token = await getAuth().currentUser.getIdToken();
  const res = await fetch(`${FUNCTIONS_URL}/eliminarProyecto`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ projectId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al eliminar");
  return data;
}

export default function HistorialProyectos() {
  const nav = useNavigate();
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    // Dos listeners: archivados y finalizados
    let archivados = [];
    let finalizados = [];
    let loadedA = false;
    let loadedF = false;

    const merge = () => {
      const merged = [...archivados, ...finalizados];
      // Ordenar por archivedAt o fechaCierre desc
      merged.sort((a, b) => {
        const dateA = a.archivedAt?.seconds || a.fechaCierre?.seconds || 0;
        const dateB = b.archivedAt?.seconds || b.fechaCierre?.seconds || 0;
        return dateB - dateA;
      });
      setProyectos(merged);
      if (loadedA && loadedF) setLoading(false);
    };

    const qArchivados = query(
      collection(db, "projects"),
      where("status", "==", "Archivado"),
      orderBy("archivedAt", "desc")
    );
    const unsubA = onSnapshot(qArchivados, snap => {
      archivados = snap.docs.map(d => ({ id: d.id, _tipo: "archivado", ...d.data() }));
      loadedA = true;
      merge();
    }, () => { loadedA = true; merge(); });

    const qFinalizados = query(
      collection(db, "projects"),
      where("estado", "==", "finalizado"),
      orderBy("fechaCierre", "desc")
    );
    const unsubF = onSnapshot(qFinalizados, snap => {
      finalizados = snap.docs.map(d => ({ id: d.id, _tipo: "finalizado", ...d.data() }));
      loadedF = true;
      merge();
    }, () => { loadedF = true; merge(); });

    return () => { unsubA(); unsubF(); };
  }, []);

  const filtrados = busqueda.trim()
    ? proyectos.filter(p =>
        (p.name || p.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.client || p.cliente || "").toLowerCase().includes(busqueda.toLowerCase())
      )
    : proyectos;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
          Gestión de proyectos
        </p>
        <h1 className="text-[20px] font-bold text-ink leading-tight">
          Historial de proyectos
        </h1>
        <p className="text-[12px] text-ink/50 mt-0.5">
          {loading ? "Cargando…" : `${proyectos.length} proyecto${proyectos.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {proyectos.length > 0 && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/30"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o cliente…"
            className="input w-full pl-9 text-[13px]"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6">
          <div className="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
          <p className="text-[13px] text-ink/50">Cargando historial…</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-12 space-y-3">
          <p className="text-4xl">🏛</p>
          <p className="text-[14px] font-semibold text-ink">
            {busqueda ? "Sin resultados" : "Aún no hay proyectos en el historial"}
          </p>
          <p className="text-[12px] text-ink/50 leading-relaxed max-w-[260px] mx-auto">
            {busqueda
              ? "Intenta con otro nombre o cliente."
              : "Archiva proyectos desde la lista activa o completa todas sus fases."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(p => (
            <TarjetaHistorial key={p.id} proyecto={p} nav={nav} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── TARJETA ── */
function TarjetaHistorial({ proyecto, nav }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null); // { clienteEliminado: bool }

  const handleEliminar = async () => {
    setDeleting(true);
    try {
      const result = await callEliminarProyecto(proyecto.id);
      setDeleteResult(result);
    } catch (e) {
      alert("Error al eliminar: " + e.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const esArchivado = proyecto._tipo === "archivado";
  const nombre = proyecto.name || proyecto.nombre || "Sin nombre";
  const cliente = proyecto.client || proyecto.cliente || "—";
  const tipo = proyecto.type || proyecto.tipo || "—";
  const ubicacion = proyecto.location || proyecto.ubicacion || "—";

  const fechaInicio = proyecto.startDate
    ? new Date(proyecto.startDate).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const fechaCierre = proyecto.fechaCierre?.toDate
    ? proyecto.fechaCierre.toDate().toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
    : proyecto.fechaCierre
      ? new Date(proyecto.fechaCierre).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
      : "—";

  const fechaArchivo = proyecto.archivedAt?.toDate
    ? proyecto.archivedAt.toDate().toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const fases = Array.isArray(proyecto.fases) ? proyecto.fases : [];
  const totalFases = fases.length;

  let duracion = null;
  if (proyecto.startDate && proyecto.fechaCierre) {
    const ini = new Date(proyecto.startDate);
    const fin = proyecto.fechaCierre?.toDate ? proyecto.fechaCierre.toDate() : new Date(proyecto.fechaCierre);
    duracion = Math.ceil((fin - ini) / 86400000);
  }

  // Si ya fue eliminado exitosamente, no renderizar
  if (deleteResult) return null;

  return (
    <div className="card space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {esArchivado ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                Archivado
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✓ Finalizado
              </span>
            )}
          </div>
          <h2 className="text-[15px] font-semibold text-ink mt-1 leading-tight truncate">{nombre}</h2>
          <p className="text-[12px] text-ink/50 mt-0.5">{cliente} · {ubicacion}</p>
        </div>
        <button
          type="button"
          onClick={() => nav(`/proyectos/${proyecto.id}`)}
          className="flex-shrink-0 text-[11px] text-ink/50 hover:text-ink underline transition-colors"
        >
          Ver detalle →
        </button>
      </div>

      {/* Datos */}
      <div className="grid grid-cols-2 gap-2">
        <Dato label="Tipo de obra" value={tipo} />
        <Dato label="Fases" value={`${totalFases} fases`} />
        <Dato label="Fecha de inicio" value={fechaInicio} />
        {esArchivado
          ? <Dato label="Fecha de archivo" value={fechaArchivo} />
          : <Dato label="Fecha de cierre" value={fechaCierre} />
        }
        {duracion !== null && <Dato label="Duración" value={`${duracion} días`} />}
        <Dato label="Avance" value={esArchivado ? `${proyecto.progress || 0}%` : "100%"} />
      </div>

      {/* Progreso */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-ink/50">
          <span>Progreso</span>
          <span className={esArchivado ? "text-amber-600 font-medium" : "text-emerald-600 font-medium"}>
            {esArchivado ? `${proyecto.progress || 0}%` : "100%"}
          </span>
        </div>
        <div className="h-2 bg-sand rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${esArchivado ? "bg-amber-400" : "bg-emerald-500"}`}
            style={{ width: esArchivado ? `${proyecto.progress || 0}%` : "100%" }}
          />
        </div>
      </div>

      {!esArchivado && (
        <div className="pt-1">
          <BtnReportePDF proyecto={proyecto} isAdmin={true} />
        </div>
      )}

      {/* Eliminar permanentemente */}
      <div className="border-t border-sand pt-3">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-[11px] text-ink/35 hover:text-red-500 transition-colors"
          >
            Eliminar permanentemente
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-red-600 font-medium leading-snug">
              ¿Eliminar permanentemente? Si el cliente no tiene otros proyectos, su cuenta también se eliminará.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEliminar}
                disabled={deleting}
                className="px-3 py-1 rounded-lg bg-red-500 text-white text-[11px] font-medium disabled:opacity-50"
              >
                {deleting ? "Eliminando…" : "Sí, eliminar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1 rounded-lg text-[11px] text-ink/50 hover:text-ink transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Dato({ label, value }) {
  return (
    <div className="bg-sand/50 rounded-xl px-3 py-2">
      <p className="text-[10px] text-ink/40 uppercase tracking-[0.12em]">{label}</p>
      <p className="text-[12px] font-medium text-ink mt-0.5">{value}</p>
    </div>
  );
}

TarjetaHistorial.propTypes = {
  proyecto: PropTypes.object,
  nav: PropTypes.func,
};

Dato.propTypes = {
  label: PropTypes.string,
  value: PropTypes.any,
};

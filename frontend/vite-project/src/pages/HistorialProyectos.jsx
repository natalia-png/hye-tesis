// src/pages/HistorialProyectos.jsx
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getAuth } from "firebase/auth";
import BtnReportePDF from "../components/BtnReportePDF";

const FUNCTIONS_URL = "https://us-central1-hye-tesis.cloudfunctions.net";

async function callEliminarProyecto(projectId) {
  const token = await getAuth().currentUser.getIdToken();
  const res = await fetch(`${FUNCTIONS_URL}/eliminarProyecto`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
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
  const [filtro, setFiltro] = useState("todos");

  useEffect(() => {
    let archivados = [], finalizados = [];
    let loadedA = false, loadedF = false;

    const merge = () => {
      const merged = [...archivados, ...finalizados];
      merged.sort((a, b) => {
        const dateA = a.archivedAt?.seconds || a.fechaCierre?.seconds || 0;
        const dateB = b.archivedAt?.seconds || b.fechaCierre?.seconds || 0;
        return dateB - dateA;
      });
      setProyectos(merged);
      if (loadedA && loadedF) setLoading(false);
    };

    const qA = query(collection(db, "projects"), where("status", "==", "Archivado"), orderBy("archivedAt", "desc"));
    const unsubA = onSnapshot(qA, snap => {
      archivados = snap.docs.map(d => ({ id: d.id, _tipo: "archivado", ...d.data() }));
      loadedA = true; merge();
    }, () => { loadedA = true; merge(); });

    const qF = query(collection(db, "projects"), where("estado", "==", "finalizado"), orderBy("fechaCierre", "desc"));
    const unsubF = onSnapshot(qF, snap => {
      finalizados = snap.docs.map(d => ({ id: d.id, _tipo: "finalizado", ...d.data() }));
      loadedF = true; merge();
    }, () => { loadedF = true; merge(); });

    return () => {
      try { unsubA(); } catch (e) { console.error(e); }
      try { unsubF(); } catch (e) { console.error(e); }
    };
  }, []);

  const porTipo = {
    todos:      proyectos,
    archivados: proyectos.filter(p => p._tipo === "archivado"),
    finalizados: proyectos.filter(p => p._tipo === "finalizado"),
  };

  const filtrados = (porTipo[filtro] || proyectos).filter(p => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      (p.name || p.nombre || "").toLowerCase().includes(q) ||
      (p.client || p.cliente || "").toLowerCase().includes(q)
    );
  });

  const tabs = [
    { key: "todos",       label: "Todos",       count: proyectos.length },
    { key: "archivados",  label: "Archivados",  count: porTipo.archivados.length },
    { key: "finalizados", label: "Finalizados",  count: porTipo.finalizados.length },
  ];

  return (
    <section className="space-y-4">

      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-medium" style={{ color: "rgb(var(--ink) / 0.4)" }}>
          Gestión de proyectos
        </p>
        <h1 className="text-[20px] font-bold leading-tight" style={{ color: "rgb(var(--ink))" }}>
          Historial
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "rgb(var(--ink) / 0.5)" }}>
          {loading ? "Cargando…" : `${proyectos.length} proyecto${proyectos.length === 1 ? "" : "s"} en historial`}
        </p>
      </div>

      {/* Filtro tabs */}
      {!loading && proyectos.length > 0 && (
        <div className="flex gap-2">
          {tabs.map(tab => {
            const active = filtro === tab.key;
            return (
              <button key={tab.key} type="button" onClick={() => setFiltro(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                  active
                    ? "border-transparent text-ivory"
                    : "hover:border-ink/20"
                }`}
                style={active
                  ? { background: "rgb(var(--ink))", borderColor: "rgb(var(--ink))" }
                  : { background: "transparent", borderColor: "rgb(var(--taupe) / 0.3)", color: "rgb(var(--ink) / 0.6)" }
                }>
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  active ? "bg-white/20 text-ivory" : ""
                }`}
                  style={!active ? { background: "rgb(var(--sand))", color: "rgb(var(--ink) / 0.55)" } : {}}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Búsqueda */}
      {!loading && proyectos.length > 0 && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgb(var(--ink) / 0.3)" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o cliente…"
            className="input w-full pl-9 text-[13px]" />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1,2].map(i => (
            <div key={i} className="rounded-2xl h-48 animate-pulse" style={{ background: "rgb(var(--ink) / 0.06)" }} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filtrados.length === 0 && (
        <div className="rounded-2xl border py-14 text-center space-y-3"
          style={{ borderColor: "rgb(var(--taupe) / 0.25)", background: "rgb(var(--sand) / 0.4)" }}>
          <p className="text-[36px]">🏛️</p>
          <p className="text-[14px] font-semibold" style={{ color: "rgb(var(--ink))" }}>
            {busqueda ? "Sin resultados" : "Sin proyectos en este historial"}
          </p>
          <p className="text-[12px] max-w-[260px] mx-auto leading-relaxed" style={{ color: "rgb(var(--ink) / 0.5)" }}>
            {busqueda
              ? "Intenta con otro nombre o cliente."
              : "Archiva proyectos desde la lista activa o completa todas sus fases."}
          </p>
        </div>
      )}

      {/* Lista */}
      {!loading && filtrados.length > 0 && (
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
  const [deleteResult, setDeleteResult] = useState(null);
  const [desarchivando, setDesarchivando] = useState(false);
  const [confirmDesarchivar, setConfirmDesarchivar] = useState(false);

  const esArchivado = proyecto._tipo === "archivado";
  const nombre = proyecto.name || proyecto.nombre || "Sin nombre";
  const cliente = proyecto.client || proyecto.cliente || "—";
  const tipo = proyecto.type || proyecto.tipo || "—";
  const ubicacion = proyecto.location || proyecto.ubicacion || "—";
  const fases = Array.isArray(proyecto.fases) ? proyecto.fases : [];
  const prog = esArchivado ? (proyecto.progress || 0) : 100;

  const fechaInicio = proyecto.startDate
    ? new Date(proyecto.startDate).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const fechaCierre = (() => {
    const fmt = d => d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
    if (proyecto.fechaCierre?.toDate) return fmt(proyecto.fechaCierre.toDate());
    if (proyecto.fechaCierre) return fmt(new Date(proyecto.fechaCierre));
    return "—";
  })();

  const fechaArchivo = proyecto.archivedAt?.toDate
    ? proyecto.archivedAt.toDate().toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const duracion = (() => {
    if (!proyecto.startDate || !proyecto.fechaCierre) return null;
    const ini = new Date(proyecto.startDate);
    const fin = proyecto.fechaCierre?.toDate ? proyecto.fechaCierre.toDate() : new Date(proyecto.fechaCierre);
    return Math.ceil((fin - ini) / 86400000);
  })();

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

  const handleDesarchivar = async () => {
    setDesarchivando(true);
    try {
      await updateDoc(doc(db, "projects", proyecto.id), {
        status: "En curso",
        archivedAt: null,
        updatedAt: serverTimestamp(),
      });
      // El listener lo sacará de la lista automáticamente
    } catch (e) {
      alert("Error al desarchivar: " + e.message);
      setDesarchivando(false);
      setConfirmDesarchivar(false);
    }
  };

  if (deleteResult) return null;

  return (
    <div className="rounded-2xl border overflow-hidden bg-[rgb(var(--ivory))] dark:bg-[#252320]"
      style={{ borderColor: "rgb(var(--taupe) / 0.25)" }}>

      {/* Franja de color superior */}
      <div className={`h-1 w-full ${esArchivado ? "bg-amber-400" : "bg-emerald-500"}`} />

      <div className="p-4 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {esArchivado ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  📦 Archivado
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✓ Finalizado
                </span>
              )}
              {esArchivado && proyecto.code && (
                <span className="text-[10px] font-medium" style={{ color: "rgb(var(--ink) / 0.35)" }}>
                  {proyecto.code}
                </span>
              )}
            </div>
            <h2 className="text-[15px] font-bold leading-tight" style={{ color: "rgb(var(--ink))" }}>{nombre}</h2>
            <p className="text-[12px] mt-0.5" style={{ color: "rgb(var(--ink) / 0.5)" }}>{cliente} · {ubicacion}</p>
          </div>
          <button type="button" onClick={() => nav(`/proyectos/${proyecto.id}`)}
            className="flex-shrink-0 text-[11px] hover:underline transition-colors"
            style={{ color: "rgb(var(--ink) / 0.45)" }}>
            Ver detalle →
          </button>
        </div>

        {/* Datos en grid */}
        <div className="grid grid-cols-2 gap-2">
          <Dato label="Tipo de obra" value={tipo} />
          <Dato label="Fases" value={`${fases.length} fase${fases.length !== 1 ? "s" : ""}`} />
          <Dato label="Fecha de inicio" value={fechaInicio} />
          {esArchivado
            ? <Dato label="Archivado el" value={fechaArchivo} />
            : <Dato label="Fecha de cierre" value={fechaCierre} />}
          {duracion !== null && <Dato label="Duración" value={`${duracion} días`} />}
          <Dato label="Avance" value={`${prog}%`} colored={esArchivado ? "amber" : "green"} />
        </div>

        {/* Barra de progreso */}
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgb(var(--ink) / 0.08)" }}>
            <div className={`h-full rounded-full ${esArchivado ? "bg-amber-400" : "bg-emerald-500"}`}
              style={{ width: `${prog}%` }} />
          </div>
        </div>

        {/* Reporte PDF solo finalizados */}
        {!esArchivado && (
          <BtnReportePDF proyecto={proyecto} isAdmin={true} />
        )}

        {/* Acciones del footer */}
        <div className="border-t flex items-center justify-between gap-3 pt-3"
          style={{ borderColor: "rgb(var(--taupe) / 0.2)" }}>

          {/* Desarchivar — solo archivados */}
          {esArchivado && (
            <div>
              {!confirmDesarchivar ? (
                <button type="button" onClick={() => setConfirmDesarchivar(true)}
                  className="flex items-center gap-1.5 text-[11px] font-medium transition-colors"
                  style={{ color: "rgb(var(--ink) / 0.5)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "rgb(var(--ink))"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgb(var(--ink) / 0.5)"}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Desarchivar proyecto
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.6)" }}>¿Volver a activos?</p>
                  <button type="button" onClick={handleDesarchivar} disabled={desarchivando}
                    className="px-2.5 py-1 rounded-lg text-white text-[11px] font-medium disabled:opacity-50"
                    style={{ background: "rgb(var(--ink))" }}>
                    {desarchivando ? "…" : "Sí, desarchivar"}
                  </button>
                  <button type="button" onClick={() => setConfirmDesarchivar(false)}
                    className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.45)" }}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Eliminar permanentemente */}
          <div className={esArchivado ? "" : "ml-auto"}>
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="text-[11px] transition-colors"
                style={{ color: "rgb(var(--ink) / 0.3)" }}
                onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                onMouseLeave={e => e.currentTarget.style.color = "rgb(var(--ink) / 0.3)"}>
                Eliminar permanentemente
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-red-600 font-medium">¿Eliminar para siempre?</p>
                <button type="button" onClick={handleEliminar} disabled={deleting}
                  className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-[11px] font-medium disabled:opacity-50">
                  {deleting ? "…" : "Eliminar"}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.45)" }}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Dato({ label, value, colored }) {
  const colors = { green: "#16a34a", amber: "#d97706" };
  return (
    <div className="rounded-xl px-3 py-2 bg-[rgb(var(--sand)/0.5)] dark:bg-white/[0.06]">
      <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "rgb(var(--ink) / 0.4)" }}>{label}</p>
      <p className="text-[12px] font-semibold mt-0.5" style={{ color: colored ? colors[colored] : "rgb(var(--ink))" }}>{value}</p>
    </div>
  );
}

TarjetaHistorial.propTypes = { proyecto: PropTypes.object, nav: PropTypes.func };
Dato.propTypes = { label: PropTypes.string, value: PropTypes.any, colored: PropTypes.string };

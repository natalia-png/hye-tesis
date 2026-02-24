// src/pages/ProyectoDetalleCliente.jsx
// Vista de detalle para el cliente — misma esencia visual de la app
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, onSnapshot, orderBy, query, where, limit } from "firebase/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { DEFAULT_FASES, calcAvanceGlobal, cloneFases } from "../data/fases";
import { useReportePDF } from "../hooks/useReportePDF";

export default function ProyectoDetalleCliente() {
  const { id } = useParams();
  const nav = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openFaseId, setOpenFaseId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "projects", id));
        if (!snap.exists()) { setError("Proyecto no encontrado."); return; }
        const data = snap.data() || {};
        const fasesRaw = Array.isArray(data.fases) ? data.fases
          : Array.isArray(data.phases) ? data.phases : null;
        const fases = fasesRaw?.length ? fasesRaw : cloneFases(DEFAULT_FASES);
        setProject({
          id: snap.id,
          name: data.name || data.nombre || "Proyecto",
          code: data.code || snap.id,
          status: data.status || data.estado || "Sin estado",
          type: data.type || data.tipo || "",
          location: data.location || data.ubicacion || "",
          startDate: data.startDate || null,
          endDate: data.endDate || null,
          description: data.description || "",
          progress: calcAvanceGlobal(fases),
          fases,
          updatedAt: data.updatedAt || data.createdAt || null,
        });
        const activa = fases.find(f => f.estado === "en_curso" || (f.porcentaje > 0 && f.porcentaje < 100));
        setOpenFaseId(activa?.id || null);
      } catch (e) {
        console.error(e);
        setError("No se pudo cargar el proyecto.");
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  if (loading) return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => nav("/mis-proyectos")} className="text-[12px] text-ink/60 hover:text-ink">
          ‹ Mis proyectos
        </button>
      </div>
      <div className="flex items-center gap-2 py-6">
        <div className="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
        <p className="text-[13px] text-ink/50">Cargando proyecto…</p>
      </div>
    </section>
  );

  if (error || !project) return (
    <section className="space-y-4">
      <button onClick={() => nav("/mis-proyectos")} className="text-[12px] text-ink/60 hover:text-ink">
        ‹ Mis proyectos
      </button>
      <p className="text-[13px] text-red-600">{error || "Proyecto no encontrado."}</p>
    </section>
  );

  const completadas = project.fases.filter(f => f.porcentaje >= 100 || f.estado === "completada").length;
  const total = project.fases.length;
  const diasRestantes = getDaysLeft(project.endDate);

  return (
    <section className="space-y-4">

      {/* Back */}
      <button
        onClick={() => nav("/mis-proyectos")}
        className="text-[12px] text-ink/60 hover:text-ink inline-flex items-center gap-1 transition-colors"
      >
        ‹ Mis proyectos
      </button>

      {/* ── Hero card — oscuro, mismo estilo que el header del dashboard ── */}
      <div className="rounded-[20px] bg-gradient-to-br from-[#141414] via-[#232323] to-[#3a3732] text-ivory p-4 border border-white/10">

        {/* Meta */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {project.type && (
              <p className="text-[10px] uppercase tracking-[0.22em] text-ivory/40 font-medium mb-1">
                {project.type}
              </p>
            )}
            <h1 className="text-[20px] font-bold leading-tight tracking-tight">{project.name}</h1>
            <p className="text-[12px] text-ivory/50 mt-0.5">
              {project.code}{project.location ? ` · ${project.location}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="inline-flex items-center rounded-full border border-ivory/20 bg-ivory/10 px-2.5 py-1 text-[10px] text-ivory/75">
              {project.status}
            </span>
            {diasRestantes !== null && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium border ${diasRestantes < 0 ? "bg-red-500/20 text-red-300 border-red-500/30"
                : diasRestantes <= 14 ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${diasRestantes < 0 ? "bg-red-400"
                  : diasRestantes <= 14 ? "bg-amber-400"
                    : "bg-emerald-400"
                  }`} />
                {diasRestantes < 0 ? `Vencido` : `${diasRestantes}d`}
              </span>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-4">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-[10px] text-ivory/40 uppercase tracking-[0.15em]">Avance general</p>
              <p className="text-[11px] text-ivory/50 mt-0.5">{completadas} de {total} etapas</p>
            </div>
            <span className="text-[28px] font-black tabular-nums leading-none">
              {project.progress}<span className="text-[16px] text-ivory/40">%</span>
            </span>
          </div>
          <div className="h-[3px] w-full bg-ivory/10 rounded-full overflow-hidden">
            <div className="h-full bg-ivory rounded-full transition-all duration-700"
              style={{ width: `${project.progress}%` }} />
          </div>
          {(project.startDate || project.endDate) && (
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-ivory/25">{project.startDate ? formatFecha(project.startDate, "corta") : ""}</span>
              <span className="text-[10px] text-ivory/25">{project.endDate ? `Entrega ${formatFecha(project.endDate, "corta")}` : ""}</span>
            </div>
          )}

          {/* ── Botón PDF ── */}
          <BtnPDF project={project} />

          {/* ── Botón Garantías ── */}
          <div className="mt-2">
            <button
              onClick={() => nav(`/mis-proyectos/${id}/garantias`)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                padding: "8px 16px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.5)",
                color: "rgba(255,255,255,0.9)",
                background: "rgba(255,255,255,0.05)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Garantías y Posventa
            </button>
          </div>
        </div>
      </div>

      {/* Descripción */}
      {project.description && (
        <div className="card space-y-1.5">
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-ink/40">Descripción</p>
          <p className="text-[13px] text-ink/65 leading-relaxed">{project.description}</p>
        </div>
      )}

      {/* ── Etapas ── */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-ink/35 px-1 mb-2">
          Etapas del proyecto
        </p>

        <div className="space-y-2">
          {project.fases.map((fase, idx) => (
            <FaseCard
              key={fase.id}
              fase={fase}
              index={idx}
              projectId={id}
              isOpen={openFaseId === fase.id}
              onToggle={() => setOpenFaseId(cur => cur === fase.id ? null : fase.id)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-[11px] text-ink/25 pt-1">
        Actualizado {timeAgo(project.updatedAt)} · H&amp;E Arquitectos
      </p>
    </section>
  );
}

/* ── FASE CARD ── */
function FaseCard({ fase, index, projectId, isOpen, onToggle }) {
  const pct = Math.max(0, Math.min(100, Number(fase.porcentaje) || 0));
  const isDone = fase.estado === "completada" || pct >= 100;
  const isActive = !isDone && (fase.estado === "en_curso" || pct > 0);

  return (
    <div className={`rounded-2xl overflow-hidden border transition-all duration-200 ${isDone ? "bg-[#141414] border-[#141414]"
      : isActive ? "bg-white border-black/20"
        : "bg-white border-black/[0.06]"
      } ${isOpen ? "shadow-md" : "shadow-sm"}`}>

      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
      >
        {/* Número / check */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold ${isDone ? "bg-ivory/15 text-ivory"
          : isActive ? "bg-[#141414] text-ivory"
            : "bg-black/[0.05] text-ink/30"
          }`}>
          {isDone ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold leading-tight ${isDone ? "text-ivory" : "text-ink"}`}>
            {fase.nombre}
          </p>
          <div className="flex items-center gap-1.5 mt-[3px]">
            <span className={`w-[5px] h-[5px] rounded-full ${isDone ? "bg-emerald-400" : isActive ? "bg-amber-400" : "bg-ink/20"
              }`} />
            <span className={`text-[11px] ${isDone ? "text-ivory/45" : isActive ? "text-ink/55" : "text-ink/30"}`}>
              {isDone ? "Completada" : isActive ? `En curso · ${pct}%` : "Pendiente"}
            </span>
            {!isDone && fase.fechaFinPlaneada && (
              <>
                <span className="text-ink/15">·</span>
                <span className="text-[10px] text-ink/30">hasta {formatFecha(fase.fechaFinPlaneada, "corta")}</span>
              </>
            )}
          </div>
        </div>

        <svg
          className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""} ${isDone ? "text-ivory/25" : "text-ink/20"}`}
          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Barra de progreso */}
      {isActive && (
        <div className="h-[2px] bg-black/[0.04]">
          <div className="h-full bg-amber-400 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      )}
      {isDone && <div className="h-[2px] bg-emerald-400/40" />}

      {/* Body */}
      {isOpen && (
        <div className="border-t border-black/[0.06] bg-[#FAFAF7]">
          <NotasPanel projectId={projectId} phaseId={fase.id} />
          <ArchivosPanel projectId={projectId} phaseId={fase.id} />

          {fase.fechaInicioPlaneada && fase.fechaFinPlaneada && (
            <div className="mx-4 mb-4 flex justify-between rounded-xl bg-black/[0.03] px-3 py-2.5">
              <div>
                <p className="text-[9px] text-ink/30 uppercase tracking-widest">Inicio</p>
                <p className="text-[12px] font-medium text-ink/60 mt-0.5">{formatFecha(fase.fechaInicioPlaneada, "larga")}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-ink/30 uppercase tracking-widest">Fin estimado</p>
                <p className="text-[12px] font-medium text-ink/60 mt-0.5">{formatFecha(fase.fechaFinPlaneada, "larga")}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── NOTAS ── */
function NotasPanel({ projectId, phaseId }) {
  const [notas, setNotas] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!projectId || !phaseId) return;
    const qs = query(
      collection(db, "projects", projectId, "fases", phaseId, "notas"),
      orderBy("createdAt", "desc"), limit(10)
    );
    const unsub = onSnapshot(qs, snap => {
      setNotas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setReady(true);
    }, () => setReady(true));
    return () => unsub();
  }, [projectId, phaseId]);

  if (!ready) return null;

  return (
    <div className="px-4 pt-4 pb-2">
      {/* Header sección */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full bg-[#141414] flex items-center justify-center flex-shrink-0">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-ink/45">
          Actualizaciones
        </p>
        {notas.length > 0 && (
          <span className="ml-auto text-[10px] bg-[#141414] text-ivory rounded-full px-1.5 py-0.5">
            {notas.length}
          </span>
        )}
      </div>

      {notas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-taupe/50 py-4 text-center mb-3">
          <p className="text-[12px] text-ink/35">El equipo aún no ha dejado actualizaciones.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-3">
          {notas.map(n => (
            <div key={n.id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#141414] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[8px] font-bold text-ivory tracking-tight">HE</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-white rounded-2xl rounded-tl-[6px] px-3.5 py-2.5 border border-taupe/30 shadow-sm">
                  <p className="text-[13px] text-ink/70 leading-relaxed whitespace-pre-wrap">{n.text}</p>
                </div>
                <p className="text-[10px] text-ink/30 mt-1 ml-1">H&E · {timeAgo(n.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── ARCHIVOS ── */
function ArchivosPanel({ projectId, phaseId }) {
  const [archivos, setArchivos] = useState([]);
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    if (!projectId || !phaseId) return;
    const qs = query(
      collection(db, "projects", projectId, "fases", phaseId, "archivos"),
      where("visibleToClient", "==", true),
      orderBy("createdAt", "desc"), limit(20)
    );
    const unsub = onSnapshot(qs, snap => {
      setArchivos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setReady(true);
    }, () => setReady(true));
    return () => unsub();
  }, [projectId, phaseId]);

  const download = async (a) => {
    if (downloading) return;
    setDownloading(a.id);
    try {
      const url = a.downloadURL || await getDownloadURL(storageRef(storage, a.storagePath));
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) { console.error(e); }
    finally { setDownloading(null); }
  };

  if (!ready || archivos.length === 0) return null;

  return (
    <div className="px-4 pb-4">
      <div className="h-px bg-taupe/20 mb-3" />

      {/* Header sección */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full bg-[#141414] flex items-center justify-center flex-shrink-0">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
        </div>
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-ink/45">
          Documentos
        </p>
        <span className="ml-auto text-[10px] text-ink/30">{archivos.length} archivo{archivos.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-2">
        {archivos.map(a => {
          const tipo = getFileType(a.fileName || "");
          const busy = downloading === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => download(a)}
              disabled={busy}
              className="w-full flex items-center gap-3 bg-white rounded-2xl border border-taupe/30 px-3 py-2.5 text-left group hover:border-ink/25 hover:shadow-sm active:scale-[0.99] transition-all duration-150"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tipo.bg}`}>
                <span className="text-[10px] font-black tracking-tight">{tipo.ext}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-ink truncate">{a.fileName || "Documento"}</p>
                {a.size && <p className="text-[10px] text-ink/35">{formatSize(a.size)}</p>}
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${busy ? "border-2 border-ink/15 border-t-ink/60 animate-spin"
                : "bg-[#F2EEE7] group-hover:bg-[#141414]"
                }`}>
                {!busy && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className="text-ink/40 group-hover:text-ivory transition-colors">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── BOTÓN PDF ── */
function BtnPDF({ project }) {
  const { generar, loading } = useReportePDF();
  return (
    <div className="mt-4 pt-3 border-t border-white/10">
      <button
        onClick={() => generar(project, false)}
        disabled={loading || !project}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          padding: "8px 16px",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.5)",
          color: "rgba(255,255,255,0.9)",
          background: "rgba(255,255,255,0.05)",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.5 : 1,
          transition: "all 0.15s",
        }}
      >
        {loading ? (
          <>
            <svg style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }}
              fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"
                style={{ opacity: 0.25 }} />
              <path fill="currentColor" style={{ opacity: 0.75 }}
                d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Generando...
          </>
        ) : (
          <>
            <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor"
              viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 10v6m0 0-3-3m3 3 3-3M3 17a4 4 0 004 4h10a4 4 0 004-4V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0014.586 3H7a4 4 0 00-4 4v10z" />
            </svg>
            Descargar reporte PDF
          </>
        )}
      </button>
    </div>
  );
}

/* ── HELPERS ── */
function getDaysLeft(d) {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t) ? null : Math.ceil((t - Date.now()) / 86400000);
}

function formatFecha(str, modo = "corta") {
  if (!str) return "—";
  try {
    const d = new Date(str);
    if (modo === "larga") return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return str; }
}

function formatSize(bytes) {
  const n = Number(bytes);
  if (!isFinite(n) || n <= 0) return "";
  return n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

function timeAgo(value) {
  if (!value) return "—";
  const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (isNaN(d)) return "—";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function getFileType(filename) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const map = {
    pdf: { ext: "PDF", bg: "bg-red-50 text-red-500" },
    doc: { ext: "DOC", bg: "bg-blue-50 text-blue-500" },
    docx: { ext: "DOC", bg: "bg-blue-50 text-blue-500" },
    xls: { ext: "XLS", bg: "bg-emerald-50 text-emerald-600" },
    xlsx: { ext: "XLS", bg: "bg-emerald-50 text-emerald-600" },
    jpg: { ext: "IMG", bg: "bg-violet-50 text-violet-500" },
    jpeg: { ext: "IMG", bg: "bg-violet-50 text-violet-500" },
    png: { ext: "IMG", bg: "bg-violet-50 text-violet-500" },
    dwg: { ext: "DWG", bg: "bg-amber-50 text-amber-600" },
    dxf: { ext: "DXF", bg: "bg-amber-50 text-amber-600" },
    zip: { ext: "ZIP", bg: "bg-zinc-100 text-zinc-500" },
  };
  return map[ext] || { ext: ext.toUpperCase().slice(0, 3) || "DOC", bg: "bg-zinc-100 text-zinc-500" };
}
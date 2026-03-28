// src/components/FasesProyecto.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { doc, getDoc, getDocs, collection, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { SUB_ROLE_LABEL, SUB_ROLE_COLOR } from "../data/roles";
import NotasFase from "./NotasFase.jsx";
import ArchivosFase from "./ArchivosFase.jsx";
import { calcAvanceGlobal, clampInt, labelEstado, normalizeFases } from "../data/fases";
import { createNotification, detectChanges, getClientUid } from "../lib/notifications.js";

async function sendSaveNotifications({ projectId, isAdmin, user, nextFases, prevFases, progress, prevProgress }) {
  const projectSnap = await getDoc(doc(db, "projects", projectId));
  const projectData = projectSnap.data() || {};
  const projectName = projectData.name || projectData.nombre || "Proyecto";
  const clientUid = await getClientUid(projectData);

  if (isAdmin) {
    for (const f of nextFases) {
      const prev = prevFases.find(p => p.id === f.id);
      if (f.responsableUid && f.responsableUid !== prev?.responsableUid) {
        await createNotification(f.responsableUid, {
          type: "fase_asignada",
          title: "📋 Nueva fase asignada",
          body: `Se te asignó "${f.nombre}" en el proyecto ${projectName}`,
          projectId,
          projectName,
        });
      }
    }
  }

  if (clientUid) {
    const changes = detectChanges(prevFases, nextFases, progress, prevProgress);
    for (const change of changes) {
      await createNotification(clientUid, {
        ...change,
        projectId,
        projectName,
      });
    }
  }
}
import { timeAgoSmart } from "../utils/timeAgo";

export default function FasesProyecto({
  projectId,
  fases = [],
  clientView = false,
  canEdit = false,
  updatedAt = null,
  createdAt = null,
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isColab = user?.role === "colaborador";

  // canEditHere global: admin puede editar cualquier fase, colaborador solo sus fases
  // (la lógica por fase se evalúa en cada item)
  const safeFases = useMemo(() => normalizeFases(fases), [fases]);
  const [localFases, setLocalFases] = useState(safeFases);
  const [colaboradores, setColaboradores] = useState([]);
  const initialRef = useRef(safeFases);
  const [openId, setOpenId] = useState(safeFases?.[0]?.id || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Cargar lista de colaboradores para el selector de responsable
  useEffect(() => {
    if (!isAdmin) return;
    getDocs(query(collection(db, "users"), where("role", "==", "colaborador")))
      .then(snap => {
        setColaboradores(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
      })
      .catch(e => { console.error(e); });
  }, [isAdmin]);

  useEffect(() => {
    setLocalFases(safeFases);
    initialRef.current = safeFases;
    if (!openId && safeFases?.[0]?.id) setOpenId(safeFases[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeFases]);

  // Admin edita cualquier fase. Colaborador solo edita sus fases asignadas.
  const handleResponsableChange = (faseId, uid) => {
    const col = colaboradores.find(c => c.uid === uid);
    setLocalFases(prev => prev.map(fase => {
      if (fase.id !== faseId) { return fase; }
      return {
        ...fase,
        responsableUid: uid || null,
        responsableNombre: col?.name || null,
        responsableSubRole: col?.subRole || null,
      };
    }));
  };

  const canEditFaseActual = (fase) => {
    if (clientView) return false;
    if (!canEdit) return false;
    if (isAdmin) return true;
    if (isColab) {
      const localFase = localFases.find(f => f.id === fase?.id);
      const uid = localFase?.responsableUid || fase?.responsableUid;
      return uid === user?.uid;
    }
    return false;
  };
  // Para partes globales (botón guardar, header)
  // Usamos safeFases (directo de props) para no depender del estado local desactualizado
  const canEditHere = isAdmin
    ? (!!canEdit && !clientView)
    : (isColab && !clientView && safeFases.some(f => f.responsableUid === user?.uid));

  const avanceGlobal = useMemo(() => calcAvanceGlobal(localFases), [localFases]);
  const completed = localFases.filter(f => f.estado === "completada").length;
  const lastUpdate = updatedAt || createdAt;

  const dirty = useMemo(() => {
    const a = JSON.stringify(initialRef.current?.map(pickComparable));
    const b = JSON.stringify(localFases?.map(pickComparable));
    return a !== b;
  }, [localFases]);

  const setPct = (phaseId, value) => {
    const pct = clampInt(value, 0, 100);
    setLocalFases(prev => prev.map(f => {
      if (f.id !== phaseId) return f;
      let estado = "pendiente";
      if (pct >= 100) { estado = "completada"; }
      else if (pct > 0) { estado = "en_curso"; }
      return { ...f, porcentaje: pct, estado };
    }));
  };

  const reset = () => {
    setLocalFases(initialRef.current);
    setError("");
    setToast("Cambios restablecidos.");
    setTimeout(() => setToast(""), 2500);
  };

  const saveAll = async () => {
    if (!canEditHere || !projectId || !dirty) return;
    setSaving(true);
    setError("");

    try {
      const prevFases = initialRef.current;

      // Colaborador: solo guarda sus fases, preserva las de otros sin cambios
      const nextFases = isColab
        ? localFases.map(f =>
          f.responsableUid === user?.uid
            ? f  // su fase — guarda los cambios
            : (prevFases.find(p => p.id === f.id) || f) // fase ajena — restaura original
        )
        : localFases;
      const progress = calcAvanceGlobal(nextFases);
      const prevProgress = calcAvanceGlobal(prevFases);

      // 1 ── Guardar en Firestore
      // Auto-finalizar si todas las fases llegan al 100%
      const todasCompletas = nextFases.length > 0 &&
        nextFases.every(f => (f.porcentaje || 0) >= 100);

      await updateDoc(doc(db, "projects", projectId), {
        fases: nextFases,
        progress,
        updatedAt: serverTimestamp(),
        ...(todasCompletas ? {
          estado: "finalizado",
          fechaCierre: serverTimestamp(),
        } : {}),
      });
      initialRef.current = nextFases;

      // 2 ── Enviar notificaciones al cliente y a colaboradores asignados
      sendSaveNotifications({ projectId, isAdmin, user, nextFases, prevFases, progress, prevProgress })
        .catch(e => console.error(e));

      setToast("✅ Cambios guardados.");
      setTimeout(() => setToast(""), 2500);
    } catch (e) {
      console.error(e);
      setError("No se pudieron guardar los cambios. Revisa permisos o conexión.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Fases del proyecto</h2>
          <p className="text-[11px] text-ink/60">
            {clientView
              ? "Seguimiento por etapas. Las notas y avances se actualizan por el equipo de H&E."
              : "Ajusta el avance por fase. Guarda cuando termines para mantener consistencia."}
          </p>
          <p className="text-[11px] text-ink/50 mt-1">
            Actualizado: <span className="font-medium">{timeAgoSmart(lastUpdate)}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-ink/60">Avance global</p>
          <p className="text-[16px] font-semibold text-ink leading-tight">{avanceGlobal}%</p>
          <p className="text-[11px] text-ink/50">{completed}/{localFases.length} completadas</p>
        </div>
      </div>

      {/* Acciones admin */}
      {canEditHere && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-ink/60">
            {dirty ? "Tienes cambios sin guardar." : "Sin cambios pendientes."}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-outline text-[12px]" onClick={reset} disabled={saving || !dirty}>
              Restablecer
            </button>
            <button type="button" className="btn-primary text-[12px]" onClick={saveAll} disabled={saving || !dirty}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}

      {toast && <p className="text-[12px] text-ink/70">{toast}</p>}
      {error && <p className="text-[12px] text-red-600">{error}</p>}

      {/* Acordeón */}
      <div className="grid gap-2">
        {localFases.map(f => {
          const pct = clampInt(f.porcentaje, 0, 100);
          const isOpen = openId === f.id;

          return (
            <div key={f.id} className="rounded-2xl border border-sand bg-white/80 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(cur => cur === f.id ? null : f.id)}
                className="w-full px-3 py-3 flex items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink truncate">{f.nombre}</p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <EstadoChip estado={f.estado} />
                    <span className="text-[11px] text-ink/60">{pct}%</span>
                    <span className="text-[11px] text-ink/40">· Peso {f.peso}</span>
                    {f.responsableNombre && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${SUB_ROLE_COLOR[f.responsableSubRole] || "bg-sand text-ink/60 border-taupe/20"}`}>
                        {f.responsableNombre.split(" ")[0]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{pct}%</span>
                  <span className="text-[12px] text-ink/50">{isOpen ? "▴" : "▾"}</span>
                </div>
              </button>

              {isOpen && (
                <div className="px-3 pb-3">
                  <div className="mt-2">
                    <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
                      <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Selector de responsable — solo admin */}
                  {isAdmin && colaboradores.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">
                        Responsable
                      </p>
                      <select
                        value={localFases.find(lf => lf.id === f.id)?.responsableUid || ""}
                        onChange={e => handleResponsableChange(f.id, e.target.value)}
                        className="input w-full text-[12px]"
                      >
                        <option value="">Sin responsable</option>
                        {colaboradores.map(col => (
                          <option key={col.uid} value={col.uid}>
                            {col.name} ({SUB_ROLE_LABEL[col.subRole] || col.subRole})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Slider — admin siempre, colaborador solo en sus fases */}
                  {canEditFaseActual(f) ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-ink/60 mb-1">
                        <span>Ajustar avance</span><span>{pct}%</span>
                      </div>
                      <input
                        type="range" min={0} max={100} step={5} value={pct}
                        onChange={e => setPct(f.id, e.target.value)}
                        className="w-full accent-ink"
                      />
                      <p className="text-[10px] text-ink/50 mt-1">Incrementos de 5% para consistencia.</p>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-ink/40">
                      {isColab && f.responsableUid && f.responsableUid !== user?.uid
                        ? <span>Esta fase está asignada a otro colaborador.</span>
                        : <span>El avance lo actualiza el equipo de H&E.</span>
                      }
                    </div>
                  )}

                  <NotasFase projectId={projectId} phaseId={f.id} canEdit={canEditFaseActual(f)} clientView={clientView} />
                  <ArchivosFase projectId={projectId} phaseId={f.id} canEdit={canEditFaseActual(f)} clientView={clientView} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {clientView && (
        <p className="text-[11px] text-ink/50">
          La información se actualiza por el equipo de H&amp;E.
        </p>
      )}
    </div>
  );
}

FasesProyecto.propTypes = {
  projectId: PropTypes.string.isRequired,
  fases: PropTypes.array,
  clientView: PropTypes.bool,
  canEdit: PropTypes.bool,
  updatedAt: PropTypes.any,
  createdAt: PropTypes.any,
};

function EstadoChip({ estado }) {
  const label = labelEstado(estado);
  let cls = "bg-white border-sand text-ink/80";
  if (estado === "completada") { cls = "bg-ivory border-taupe/30 text-ink"; }
  else if (estado === "en_curso") { cls = "bg-sand border-taupe/30 text-ink"; }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] ${cls}`}>
      {label}
    </span>
  );
}

EstadoChip.propTypes = {
  estado: PropTypes.string,
};

function pickComparable(f) {
  return {
    id: f?.id,
    porcentaje: clampInt(f?.porcentaje, 0, 100),
    estado: f?.estado,
    peso: f?.peso,
    responsableUid: f?.responsableUid || null,
  };
}


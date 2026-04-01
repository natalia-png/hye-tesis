// src/components/FasesProyecto.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PropTypes from "prop-types";
import { doc, getDoc, getDocs, collection, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { SUB_ROLE_LABEL, getSubRoleColor } from "../data/roles";
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

  // Colaborador solo ve sus fases asignadas; admin y cliente ven todas
  const fasesVisibles = useMemo(() => {
    if (!isColab) return localFases;
    return localFases.filter(f => f.responsableUid === user?.uid);
  }, [isColab, localFases, user?.uid]);

  const primeraFaseColab = safeFases.find(f => f.responsableUid === user?.uid);
  const [openId, setOpenId] = useState(
    isColab ? (primeraFaseColab?.id || null) : (safeFases?.[0]?.id || null)
  );
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
        fechaEntregaResponsable: uid ? (fase.fechaEntregaResponsable || "") : null,
      };
    }));
  };

  const handleFechaEntregaChange = (faseId, value) => {
    setLocalFases(prev => prev.map(fase => (
      fase.id !== faseId ? fase : { ...fase, fechaEntregaResponsable: value || null }
    )));
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

  const [nuevaFaseNombre, setNuevaFaseNombre] = useState("");
  const [mostrarFormNueva, setMostrarFormNueva] = useState(false);

  const agregarFase = useCallback(() => {
    const nombre = nuevaFaseNombre.trim();
    if (!nombre) return;
    const newId = `fase_extra_${Date.now()}`;
    setLocalFases(prev => [...prev, {
      id: newId,
      nombre,
      porcentaje: 0,
      estado: "pendiente",
      responsableUid: null,
      responsableNombre: null,
      responsableSubRole: null,
      fechaEntregaResponsable: null,
    }]);
    setNuevaFaseNombre("");
    setMostrarFormNueva(false);
  }, [nuevaFaseNombre]);

  const eliminarFase = useCallback((faseId) => {
    setLocalFases(prev => prev.filter(f => f.id !== faseId));
    setOpenId(cur => cur === faseId ? null : cur);
  }, []);

  // ── Drag & drop (solo admin) ─────────────────────────────────
  const [activeDragId, setActiveDragId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const handleDragEnd = useCallback(({ active, over }) => {
    setActiveDragId(null);
    if (!over || active.id === over.id) return;
    setLocalFases(prev => {
      const oldIdx = prev.findIndex(f => f.id === active.id);
      const newIdx = prev.findIndex(f => f.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

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
      if (isAdmin) {
        const faseSinFecha = nextFases.find(f => f.responsableUid && !f.fechaEntregaResponsable);
        if (faseSinFecha) {
          setError(`La fase "${faseSinFecha.nombre}" tiene responsable pero no fecha de entrega.`);
          setSaving(false);
          return;
        }
      }
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
          <p className="text-[11px] text-ink/50">{completed}/{isColab ? fasesVisibles.length : localFases.length} {isColab ? "asignadas" : "completadas"}</p>
        </div>
      </div>

      {/* Acciones admin */}
      {canEditHere && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-ink/60 flex-1 min-w-0">
              {dirty ? "Tienes cambios sin guardar." : "Sin cambios pendientes."}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isAdmin && (
                <button type="button" className="btn-outline text-[11px] px-2.5 py-1" onClick={() => setMostrarFormNueva(v => !v)}>
                  + Fase
                </button>
              )}
              <button type="button" className="btn-outline text-[11px] px-2.5 py-1" onClick={reset} disabled={saving || !dirty}>
                Restablecer
              </button>
              <button type="button" className="btn-primary text-[11px] px-2.5 py-1" onClick={saveAll} disabled={saving || !dirty}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
          {mostrarFormNueva && isAdmin && (
            <div className="flex gap-2 items-center bg-sand/50 border border-taupe/30 rounded-xl px-3 py-2">
              <input
                type="text"
                value={nuevaFaseNombre}
                onChange={e => setNuevaFaseNombre(e.target.value)}
                onKeyDown={e => e.key === "Enter" && agregarFase()}
                placeholder="Nombre de la nueva fase…"
                className="flex-1 bg-transparent text-[12px] outline-none text-ink placeholder:text-ink/40"
                autoFocus
              />
              <button type="button" onClick={agregarFase} disabled={!nuevaFaseNombre.trim()} className="btn-primary text-[11px] py-1 px-3">
                Agregar
              </button>
              <button type="button" onClick={() => { setMostrarFormNueva(false); setNuevaFaseNombre(""); }} className="text-[11px] text-ink/50 hover:text-ink">
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {toast && <p className="text-[12px] text-ink/70">{toast}</p>}
      {error && <p className="text-[12px] text-red-600">{error}</p>}

      {/* Empty state colaborador sin fases asignadas */}
      {isColab && fasesVisibles.length === 0 && (
        <div className="py-8 text-center space-y-1">
          <p className="text-[13px] font-medium text-ink/60">No tienes fases asignadas aún</p>
          <p className="text-[11px] text-ink/40">El administrador te asignará fases próximamente.</p>
        </div>
      )}

      {/* Acordeón */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveDragId(active.id)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <SortableContext
          items={fasesVisibles.map(f => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-2">
            {fasesVisibles.map(f => (
              <SortableFaseItem
                key={f.id}
                f={f}
                isAdmin={isAdmin}
                isColab={isColab}
                canEditHere={canEditHere}
                openId={openId}
                setOpenId={setOpenId}
                canEditFaseActual={canEditFaseActual}
                colaboradores={colaboradores}
                handleResponsableChange={handleResponsableChange}
                handleFechaEntregaChange={handleFechaEntregaChange}
                setPct={setPct}
                projectId={projectId}
                clientView={clientView}
                user={user}
                isDragging={activeDragId === f.id}
                onEliminar={eliminarFase}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeDragId ? (
            <div className="rounded-2xl border border-ink/20 bg-white shadow-xl px-3 py-3 opacity-95">
              <p className="text-[13px] font-medium text-ink truncate">
                {fasesVisibles.find(f => f.id === activeDragId)?.nombre}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
    fechaEntregaResponsable: f?.fechaEntregaResponsable || null,
  };
}

function formatFechaCorta(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

/* ── Componente sortable de fase ─────────────────────────────── */
function SortableFaseItem({
  f, isAdmin, isColab, canEditHere, openId, setOpenId,
  canEditFaseActual, colaboradores, handleResponsableChange,
  handleFechaEntregaChange, setPct, projectId, clientView, user, isDragging,
  onEliminar,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: f.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const pct = clampInt(f.porcentaje, 0, 100);
  const isOpen = openId === f.id;

  return (
    <div ref={setNodeRef} style={style} className="rounded-2xl border border-sand bg-white/80 overflow-hidden">
      <div className="flex items-stretch">
        {/* Handle drag — solo admin, no en clientView */}
        {isAdmin && canEditHere && (
          <button
            type="button"
            {...listeners}
            {...attributes}
            className="flex items-center justify-center px-2 cursor-grab active:cursor-grabbing text-ink/20 hover:text-ink/50 transition-colors touch-none flex-shrink-0 focus:outline-none"
            tabIndex={-1}
            aria-label="Arrastrar para reordenar"
          >
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="2.5" cy="2.5" r="1.5"/><circle cx="7.5" cy="2.5" r="1.5"/>
              <circle cx="2.5" cy="8" r="1.5"/><circle cx="7.5" cy="8" r="1.5"/>
              <circle cx="2.5" cy="13.5" r="1.5"/><circle cx="7.5" cy="13.5" r="1.5"/>
            </svg>
          </button>
        )}

        {/* Cabecera acordeón */}
        <button
          type="button"
          onClick={() => setOpenId(cur => cur === f.id ? null : f.id)}
          className="flex-1 px-3 py-3 flex items-center justify-between gap-3 text-left min-w-0"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-ink truncate">{f.nombre}</p>
              {isColab && f.responsableUid === user?.uid && (
                <span className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-ink text-ivory">Tu fase</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <EstadoChip estado={f.estado} />
              <span className="text-[11px] text-ink/60">{pct}%</span>
              {f.responsableNombre && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${getSubRoleColor(f.responsableSubRole)}`}>
                  {f.responsableNombre.split(" ")[0]}
                </span>
              )}
              {f.fechaEntregaResponsable && (
                <span className="text-[11px] text-ink/50">· {formatFechaCorta(f.fechaEntregaResponsable)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[14px] font-semibold text-ink">{pct}%</span>
            {isAdmin && canEditHere && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onEliminar(f.id); }}
                className="w-5 h-5 flex items-center justify-center rounded-full text-ink/25 hover:text-red-500 hover:bg-red-50 transition-colors"
                aria-label="Eliminar fase"
              >
                ×
              </button>
            )}
            <span className="text-[12px] text-ink/50">{isOpen ? "▴" : "▾"}</span>
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="px-3 pb-3 overflow-hidden">
          <div className="mt-2">
            <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
              <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {isAdmin && colaboradores.length > 0 && (
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Responsable</p>
                <select
                  value={f.responsableUid || ""}
                  onChange={e => handleResponsableChange(f.id, e.target.value)}
                  className="input w-full text-[12px]"
                >
                  <option value="">Sin responsable</option>
                  {colaboradores.map(col => (
                    <option key={col.uid} value={col.uid}>
                      {col.name} ({col.subRole || "Colaborador"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Fecha de entrega</p>
                <input
                  type="date"
                  value={f.fechaEntregaResponsable || ""}
                  onChange={e => handleFechaEntregaChange(f.id, e.target.value)}
                  disabled={!f.responsableUid}
                  className="input w-full max-w-full text-[12px] disabled:opacity-50 box-border"
                />
                <p className="text-[10px] text-ink/45">Define para cuando necesitas esta fase una vez tenga responsable.</p>
              </div>
            </div>
          )}

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
}

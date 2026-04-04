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
import {
  doc, getDoc, getDocs, collection, query, where,
  updateDoc, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { getSubRoleColor } from "../data/roles";
import NotasFase from "./NotasFase.jsx";
import ArchivosFase from "./ArchivosFase.jsx";
import { calcAvanceGlobal, clampInt, labelEstado, normalizeFases } from "../data/fases";
import { createNotification, detectChanges, getClientUid, notifyAdmins } from "../lib/notifications.js";
import { timeAgoSmart } from "../utils/timeAgo";

// ── Notificaciones al guardar ──────────────────────────────────
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
          title: "Nueva fase asignada",
          body: `Se te asigno "${f.nombre}" en el proyecto ${projectName}`,
          projectId,
          projectName,
        });
      }
    }
  }

  if (clientUid) {
    const changes = detectChanges(prevFases, nextFases, progress, prevProgress);
    for (const change of changes) {
      await createNotification(clientUid, { ...change, projectId, projectName });
    }
  }
}

// ── Hacer visibles al cliente los archivos de una fase ─────────
async function makePhaseFilesVisible(projectId, phaseId) {
  try {
    const archRef = collection(db, "projects", projectId, "fases", phaseId, "archivos");
    const snap = await getDocs(query(archRef, where("visibleToClient", "==", false)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { visibleToClient: true }));
    await batch.commit();
  } catch (e) {
    console.error("makePhaseFilesVisible error:", e);
  }
}

// ── Hacer visibles al cliente las notas de una fase ───────────
async function makePhaseNotesVisible(projectId, phaseId) {
  try {
    const notasRef = collection(db, "projects", projectId, "fases", phaseId, "notas");
    const snap = await getDocs(query(notasRef, where("visibleToClient", "==", false)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { visibleToClient: true }));
    await batch.commit();
  } catch (e) {
    console.error("makePhaseNotesVisible error:", e);
  }
}

// ─────────────────────────────────────────────────────────────
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

  const safeFases = useMemo(() => normalizeFases(fases), [fases]);
  const [localFases, setLocalFases] = useState(safeFases);
  const [colaboradores, setColaboradores] = useState([]);
  const initialRef = useRef(safeFases);

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
  const [rejectModal, setRejectModal] = useState(null); // { faseId, nombre, responsableUid, responsableNombre }
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    getDocs(query(collection(db, "users"), where("role", "==", "colaborador")))
      .then(snap => setColaboradores(snap.docs.map(d => ({ uid: d.id, ...d.data() }))))
      .catch(e => console.error(e));
  }, [isAdmin]);

  useEffect(() => {
    setLocalFases(safeFases);
    initialRef.current = safeFases;
    if (!openId && safeFases?.[0]?.id) setOpenId(safeFases[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeFases]);

  const handleResponsableChange = (faseId, uid) => {
    const col = colaboradores.find(c => c.uid === uid);
    setLocalFases(prev => prev.map(fase => {
      if (fase.id !== faseId) return fase;
      return {
        ...fase,
        responsableUid: uid || null,
        responsableNombre: col?.name || null,
        responsableSubRole: col?.subRole || null,
        fechaEntregaResponsable: uid ? (fase.fechaEntregaResponsable || "") : null,
        avancePropuesto: uid ? fase.avancePropuesto : null,
        notaAvancePropuesto: uid ? (fase.notaAvancePropuesto || "") : "",
        avancePropuestoPorUid: uid ? fase.avancePropuestoPorUid : null,
        avancePropuestoPorNombre: uid ? fase.avancePropuestoPorNombre : null,
        avancePropuestoAt: uid ? fase.avancePropuestoAt : null,
      };
    }));
  };

  const handleFechaEntregaChange = (faseId, value) => {
    setLocalFases(prev => prev.map(f => (
      f.id !== faseId ? f : { ...f, fechaEntregaResponsable: value || null }
    )));
  };

  // Admin puede editar SOLO fases sin responsable (las con responsable se aprueban)
  const canAdjustDirectProgress = (fase) => {
    if (clientView || !canEdit) return false;
    return isAdmin && !fase?.responsableUid;
  };

  // Colaborador puede proponer en sus fases
  const canProposeProgress = (fase) => {
    if (clientView || !canEdit || !isColab) return false;
    const localFase = localFases.find(f => f.id === fase?.id);
    return (localFase?.responsableUid || fase?.responsableUid) === user?.uid;
  };

  // canEditFaseActual: controla notas y upload de archivos
  const canEditFaseActual = (fase) => {
    if (clientView || !canEdit) return false;
    if (isAdmin) return true;
    if (isColab) {
      const localFase = localFases.find(f => f.id === fase?.id);
      return (localFase?.responsableUid || fase?.responsableUid) === user?.uid;
    }
    return false;
  };

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
      if (isColab && f.responsableUid === user?.uid) {
        return {
          ...f,
          avancePropuesto: pct,
          avancePropuestoPorUid: user?.uid || null,
          avancePropuestoPorNombre: user?.name || user?.displayName || user?.email || "Colaborador",
          avancePropuestoAt: new Date().toISOString(),
        };
      }
      // Admin solo puede cambiar fases sin responsable
      if (isAdmin && f.responsableUid) return f;
      let estado = "pendiente";
      if (pct >= 100) estado = "completada";
      else if (pct > 0) estado = "en_curso";
      return {
        ...f, porcentaje: pct, estado,
        avancePropuesto: null, notaAvancePropuesto: "",
        avancePropuestoPorUid: null, avancePropuestoPorNombre: null, avancePropuestoAt: null,
      };
    }));
  };

  const setProposalNote = (phaseId, value) => {
    setLocalFases(prev => prev.map(f => {
      if (f.id !== phaseId || !(isColab && f.responsableUid === user?.uid)) return f;
      const currentPct = Number.isFinite(Number(f.avancePropuesto))
        ? clampInt(f.avancePropuesto, 0, 100)
        : clampInt(f.porcentaje, 0, 100);
      return {
        ...f,
        avancePropuesto: currentPct,
        notaAvancePropuesto: value,
        avancePropuestoPorUid: user?.uid || null,
        avancePropuestoPorNombre: user?.name || user?.displayName || user?.email || "Colaborador",
        avancePropuestoAt: new Date().toISOString(),
      };
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
      id: newId, nombre, porcentaje: 0, estado: "pendiente",
      responsableUid: null, responsableNombre: null,
      responsableSubRole: null, fechaEntregaResponsable: null,
    }]);
    setNuevaFaseNombre("");
    setMostrarFormNueva(false);
  }, [nuevaFaseNombre]);

  const eliminarFase = useCallback((faseId) => {
    setLocalFases(prev => prev.filter(f => f.id !== faseId));
    setOpenId(cur => cur === faseId ? null : cur);
  }, []);

  // ── Guardar en Firestore ───────────────────────────────────
  const persistFases = async ({ nextFases, prevFases, successMessage, notifyClient = false, validateAssignedDates = false }) => {
    setSaving(true);
    setError("");
    try {
      if (validateAssignedDates) {
        const faseSinFecha = nextFases.find(f => f.responsableUid && !f.fechaEntregaResponsable);
        if (faseSinFecha) {
          setError(`La fase "${faseSinFecha.nombre}" tiene responsable pero no tiene fecha de entrega.`);
          return false;
        }
      }

      const progress = calcAvanceGlobal(nextFases);
      const prevProgress = calcAvanceGlobal(prevFases);
      const todasCompletas = nextFases.length > 0 && nextFases.every(f => (f.porcentaje || 0) >= 100);

      const payload = {
        fases: nextFases,
        updatedAt: serverTimestamp(),
        ...(isAdmin ? {
          progress,
          ...(todasCompletas ? { estado: "finalizado", fechaCierre: serverTimestamp() } : {}),
        } : {}),
      };

      await updateDoc(doc(db, "projects", projectId), payload);
      initialRef.current = nextFases;
      setLocalFases(nextFases);

      if (notifyClient) {
        sendSaveNotifications({ projectId, isAdmin, user, nextFases, prevFases, progress, prevProgress })
          .catch(e => console.error(e));
      }

      setToast(successMessage);
      setTimeout(() => setToast(""), 3500);
      return true;
    } catch (e) {
      console.error(e);
      setError("No se pudieron guardar los cambios. Revisa permisos o conexion.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ── Aprobar avance: actualiza porcentaje + hace visible archivos ──
  const aprobarAvance = async (faseId) => {
    const prevFases = initialRef.current;
    const nextFases = localFases.map(f => {
      if (f.id !== faseId) return f;
      const pct = clampInt(f.avancePropuesto, 0, 100);
      let estado = "pendiente";
      if (pct >= 100) estado = "completada";
      else if (pct > 0) estado = "en_curso";
      return {
        ...f, porcentaje: pct, estado,
        avancePropuesto: null, notaAvancePropuesto: "",
        avancePropuestoPorUid: null, avancePropuestoPorNombre: null, avancePropuestoAt: null,
        ultimoRechazo: null,
      };
    });

    const fase = localFases.find(item => item.id === faseId);
    const ok = await persistFases({
      nextFases, prevFases,
      successMessage: `Avance aprobado${fase?.nombre ? `: ${fase.nombre}` : ""}.`,
      notifyClient: true,
    });

    if (ok) {
      makePhaseFilesVisible(projectId, faseId);
      makePhaseNotesVisible(projectId, faseId);
    }
  };

  // ── Rechazar propuesta con motivo ────────────────────────
  const rechazarAvance = async (faseId, reason = "") => {
    const prevFases = initialRef.current;
    const fase = localFases.find(item => item.id === faseId);
    const nextFases = localFases.map(f => (
      f.id !== faseId ? f : {
        ...f,
        avancePropuesto: null, notaAvancePropuesto: "",
        notaParaAdmin: "",
        avancePropuestoPorUid: null, avancePropuestoPorNombre: null, avancePropuestoAt: null,
        ultimoRechazo: reason.trim() ? {
          motivo: reason.trim(),
          fecha: new Date().toISOString(),
          responsableUid: f.responsableUid || f.avancePropuestoPorUid || null,
        } : null,
      }
    ));
    await persistFases({
      nextFases, prevFases,
      successMessage: `Propuesta rechazada${fase?.nombre ? `: ${fase.nombre}` : ""}.`,
      notifyClient: false,
    });
    // Notificar al colaborador con el motivo
    if (fase?.responsableUid && reason.trim()) {
      try {
        const projectSnap = await getDoc(doc(db, "projects", projectId)).catch(() => null);
        const projectName = projectSnap?.data()?.name || "Proyecto";
        createNotification(fase.responsableUid, {
          type: "avance_rechazado",
          title: "Propuesta de avance rechazada",
          body: `Tu propuesta para "${fase.nombre}" en ${projectName} fue rechazada. Motivo: ${reason.trim()}`,
          projectId,
          projectName,
        }).catch(e => console.error(e));
      } catch (e) { console.error(e); }
    }
  };

  const confirmReject = async () => {
    if (!rejectModal) return;
    await rechazarAvance(rejectModal.faseId, rejectReason);
    setRejectModal(null);
    setRejectReason("");
  };

  // ── Editar propuesta (admin ajusta antes de aprobar) ──────────
  const editarPropuesta = async (faseId, newPct, newNota, newNotaAdmin) => {
    const prevFases = initialRef.current;
    const nextFases = localFases.map(f => {
      if (f.id !== faseId) return f;
      return {
        ...f,
        avancePropuesto: clampInt(newPct, 0, 100),
        notaAvancePropuesto: newNota || "",
        notaParaAdmin: newNotaAdmin !== undefined ? newNotaAdmin : (f.notaParaAdmin || ""),
      };
    });
    await persistFases({
      nextFases, prevFases,
      successMessage: "Propuesta editada.",
      notifyClient: false,
    });
  };

  // ── Retirar propuesta (colaborador la cancela) ────────────────
  const retirarPropuesta = async (faseId) => {
    const prevFases = initialRef.current;
    const nextFases = localFases.map(f => (
      f.id !== faseId ? f : {
        ...f,
        avancePropuesto: null, notaAvancePropuesto: "",
        notaParaAdmin: "",
        avancePropuestoPorUid: null, avancePropuestoPorNombre: null, avancePropuestoAt: null,
      }
    ));
    await persistFases({
      nextFases, prevFases,
      successMessage: "Propuesta retirada.",
      notifyClient: false,
    });
  };

  // ── Nota privada para admin (solo la ve Luisa) ────────────────
  const setProposalAdminNote = (phaseId, value) => {
    setLocalFases(prev => prev.map(f => {
      if (f.id !== phaseId || !(isColab && f.responsableUid === user?.uid)) return f;
      const currentPct = Number.isFinite(Number(f.avancePropuesto))
        ? clampInt(f.avancePropuesto, 0, 100)
        : clampInt(f.porcentaje, 0, 100);
      return {
        ...f,
        notaParaAdmin: value,
        avancePropuesto: currentPct,
        avancePropuestoPorUid: user?.uid || null,
        avancePropuestoPorNombre: user?.name || user?.displayName || user?.email || "Colaborador",
        avancePropuestoAt: new Date().toISOString(),
      };
    }));
  };

  // ── Drag & drop (solo admin) ──────────────────────────────
  const [activeDragId, setActiveDragId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
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

  // ── Guardar (admin o colaborador) ─────────────────────────
  const saveAll = async () => {
    if (!canEditHere || !projectId || !dirty) return;
    const prevFases = initialRef.current;

    if (isColab) {
      const nextFases = localFases.map(f => {
        const prev = prevFases.find(p => p.id === f.id) || f;
        if (f.responsableUid !== user?.uid) return prev;
        // Solo guardar propuesta si el colaborador movio el slider (avancePropuesto != null y > 0)
        const propVal = (f.avancePropuesto != null && Number.isFinite(Number(f.avancePropuesto)) && Number(f.avancePropuesto) > 0)
          ? clampInt(f.avancePropuesto, 0, 100)
          : (prev.avancePropuesto ?? null);
        return {
          ...prev,
          avancePropuesto: propVal,
          notaAvancePropuesto: f.notaAvancePropuesto || prev.notaAvancePropuesto || "",
          notaParaAdmin: f.notaParaAdmin || prev.notaParaAdmin || "",
          ...(propVal != null ? {
            avancePropuestoPorUid: user?.uid || null,
            avancePropuestoPorNombre: user?.name || user?.displayName || user?.email || "Colaborador",
            avancePropuestoAt: new Date().toISOString(),
            ultimoRechazo: null,
          } : {}),
        };
      });

      const ok = await persistFases({
        nextFases, prevFases,
        successMessage: "Propuesta enviada. Luisa revisara antes de reflejarse al cliente.",
        notifyClient: false,
      });

      if (ok) {
        // Notificar al admin
        const projectSnap = await getDoc(doc(db, "projects", projectId)).catch(() => null);
        const projectName = projectSnap?.data()?.name || "Proyecto";
        const fasePropuesta = nextFases.find(f => f.responsableUid === user?.uid && Number.isFinite(Number(f.avancePropuesto)));
        notifyAdmins({
          type: "avance_propuesto",
          title: "Avance propuesto por colaborador",
          body: `${user?.name || "Colaborador"} propuso ${fasePropuesta?.avancePropuesto ?? "?"}% en "${fasePropuesta?.nombre || "una fase"}" — ${projectName}`,
          projectId,
          projectName,
        }).catch(e => console.error(e));
      }
      return;
    }

    // Admin
    await persistFases({
      nextFases: localFases,
      prevFases,
      successMessage: "Cambios guardados.",
      notifyClient: true,
      validateAssignedDates: true,
    });
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
              : isColab
                ? "Propone el avance de tus fases. El administrador lo aprueba antes de que el cliente lo vea."
                : "Gestiona responsables y aprueba avances. Las fases sin responsable permiten ajuste directo."}
          </p>
          <p className="text-[11px] text-ink/50 mt-1">
            Actualizado: <span className="font-medium">{timeAgoSmart(lastUpdate)}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-ink/60">Avance global</p>
          <p className="text-[16px] font-semibold text-ink leading-tight">{avanceGlobal}%</p>
          <p className="text-[11px] text-ink/50">
            {completed}/{isColab ? fasesVisibles.length : localFases.length}{" "}
            {isColab ? "asignadas" : "completadas"}
          </p>
        </div>
      </div>

      {/* Acciones */}
      {canEditHere && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-ink/60 flex-1 min-w-0">
              {dirty ? "Tienes cambios sin guardar." : "Sin cambios pendientes."}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isAdmin && (
                <button type="button" className="btn-outline text-[11px] px-2.5 py-1"
                  onClick={() => setMostrarFormNueva(v => !v)}>
                  + Fase
                </button>
              )}
              <button type="button" className="btn-outline text-[11px] px-2.5 py-1"
                onClick={reset} disabled={saving || !dirty}>
                Restablecer
              </button>
              <button type="button" className="btn-primary text-[11px] px-2.5 py-1"
                onClick={saveAll} disabled={saving || !dirty}>
                {saving ? "Guardando..." : isColab ? "Enviar propuesta" : "Guardar"}
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
                placeholder="Nombre de la nueva fase..."
                className="flex-1 bg-transparent text-[12px] outline-none text-ink placeholder:text-ink/40"
                autoFocus
              />
              <button type="button" onClick={agregarFase}
                disabled={!nuevaFaseNombre.trim()} className="btn-primary text-[11px] py-1 px-3">
                Agregar
              </button>
              <button type="button"
                onClick={() => { setMostrarFormNueva(false); setNuevaFaseNombre(""); }}
                className="text-[11px] text-ink/50 hover:text-ink">
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium
          ${toast.includes("Propuesta enviada") || toast.includes("Aprobado") || toast.includes("aprobado") || toast.includes("guardad")
            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"
            : "bg-sand/60 dark:bg-white/10 text-ink/70 dark:text-white/60"}`}>
          {(toast.includes("Propuesta enviada") || toast.includes("aprobado") || toast.includes("guardad")) && (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast}
        </div>
      )}
      {error && <p className="text-[12px] text-red-600">{error}</p>}

      {isColab && fasesVisibles.length === 0 && (
        <div className="py-8 text-center space-y-1">
          <p className="text-[13px] font-medium text-ink/60">No tienes fases asignadas aun</p>
          <p className="text-[11px] text-ink/40">El administrador te asignara fases proximamente.</p>
        </div>
      )}

      {/* Acordeon */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveDragId(active.id)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <SortableContext items={fasesVisibles.map(f => f.id)} strategy={verticalListSortingStrategy}>
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
                canAdjustDirectProgress={canAdjustDirectProgress}
                canProposeProgress={canProposeProgress}
                colaboradores={colaboradores}
                handleResponsableChange={handleResponsableChange}
                handleFechaEntregaChange={handleFechaEntregaChange}
                setPct={setPct}
                setProposalNote={setProposalNote}
                setProposalAdminNote={setProposalAdminNote}
                aprobarAvance={aprobarAvance}
                rechazarAvance={rechazarAvance}
                editarPropuesta={editarPropuesta}
                retirarPropuesta={retirarPropuesta}
                setRejectModal={setRejectModal}
                projectId={projectId}
                clientView={clientView}
                user={user}
                isDragging={activeDragId === f.id}
                onEliminar={eliminarFase}
                saving={saving}
                currentUserUid={user?.uid}
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
          La informacion se actualiza por el equipo de H&E.
        </p>
      )}

      {/* Modal rechazo con motivo */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 pb-4"
          onClick={() => { setRejectModal(null); setRejectReason(""); }}>
          <div className="w-full max-w-md bg-white dark:bg-[#1a1a18] rounded-2xl shadow-2xl overflow-hidden border border-black/10 dark:border-white/10"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/10">
              <p className="text-[14px] font-bold text-ink dark:text-white">Rechazar propuesta</p>
              <p className="text-[12px] text-ink/60 dark:text-white/50 mt-0.5">
                Fase: <span className="font-medium">{rejectModal.nombre}</span>
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-[12px] font-semibold text-ink/70 dark:text-white/60 mb-1.5">
                  Motivo del rechazo <span className="text-red-500">*</span>
                </p>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  maxLength={300}
                  autoFocus
                  placeholder="Explica al colaborador que debe corregir o mejorar..."
                  className="input w-full text-[13px] resize-none"
                />
                <p className="text-[10px] text-ink/40 dark:text-white/30 mt-1">
                  El colaborador recibira una notificacion con este mensaje.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { setRejectModal(null); setRejectReason(""); }}
                  className="flex-1 py-2.5 rounded-xl border border-ink/20 dark:border-white/20 text-[13px] text-ink/60 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5 transition">
                  Cancelar
                </button>
                <button type="button"
                  onClick={confirmReject}
                  disabled={saving || !rejectReason.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition disabled:opacity-50">
                  {saving ? "Rechazando..." : "Confirmar rechazo"}
                </button>
              </div>
            </div>
          </div>
        </div>
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

// ── EstadoChip ────────────────────────────────────────────────
function EstadoChip({ estado }) {
  const label = labelEstado(estado);
  let cls = "bg-white border-sand text-ink/80 dark:bg-white/10 dark:border-white/10 dark:text-white/60";
  if (estado === "completada") cls = "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300";
  else if (estado === "en_curso") cls = "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] ${cls}`}>
      {label}
    </span>
  );
}
EstadoChip.propTypes = { estado: PropTypes.string };

// ── pickComparable ────────────────────────────────────────────
function pickComparable(f) {
  return {
    id: f?.id,
    porcentaje: clampInt(f?.porcentaje, 0, 100),
    avancePropuesto: (f?.avancePropuesto != null && Number.isFinite(Number(f?.avancePropuesto)))
      ? clampInt(f?.avancePropuesto, 0, 100)
      : null,
    notaAvancePropuesto: f?.notaAvancePropuesto || "",
    notaParaAdmin: f?.notaParaAdmin || "",
    ultimoRechazo: f?.ultimoRechazo || null,
    estado: f?.estado,
    peso: f?.peso,
    responsableUid: f?.responsableUid || null,
    fechaEntregaResponsable: f?.fechaEntregaResponsable || null,
  };
}

function hasPendingProposal(fase) {
  // Requiere: campo no nulo, numero finito, mayor a 0, Y que haya un uid de quien propuso
  // Esto filtra data corrupta (avancePropuesto:0 guardado sin interaccion real)
  const val = Number(fase?.avancePropuesto);
  return (
    fase?.avancePropuesto != null &&
    Number.isFinite(val) &&
    val > 0 &&
    !!fase?.avancePropuestoPorUid
  );
}
function getProposalValue(fase) {
  if (!hasPendingProposal(fase)) return clampInt(fase?.porcentaje, 0, 100);
  return clampInt(fase?.avancePropuesto, 0, 100);
}
function formatFechaCorta(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

// ── SortableFaseItem ──────────────────────────────────────────
function SortableFaseItem({
  f, isAdmin, isColab, canEditHere, openId, setOpenId,
  canEditFaseActual, canAdjustDirectProgress, canProposeProgress,
  colaboradores, handleResponsableChange, handleFechaEntregaChange,
  setPct, setProposalNote, setProposalAdminNote, aprobarAvance, rechazarAvance,
  editarPropuesta, retirarPropuesta, setRejectModal,
  projectId, clientView, user, isDragging, onEliminar, saving, currentUserUid,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: f.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };

  const [editingProposal, setEditingProposal] = useState(null); // { pct, nota, notaAdmin }

  const pct = clampInt(f.porcentaje, 0, 100);
  const proposedPct = getProposalValue(f);
  const pendingApproval = hasPendingProposal(f);
  const isOpen = openId === f.id;

  return (
    <div ref={setNodeRef} style={style}
      className="rounded-2xl border border-sand bg-white/80 dark:bg-white/5 dark:border-white/10 overflow-hidden">
      <div className="flex items-stretch">
        {/* Drag handle */}
        {isAdmin && canEditHere && (
          <button type="button" {...listeners} {...attributes}
            className="flex items-center justify-center px-2 cursor-grab active:cursor-grabbing text-ink/20 hover:text-ink/50 transition-colors touch-none flex-shrink-0 focus:outline-none"
            tabIndex={-1} aria-label="Arrastrar para reordenar">
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="2.5" cy="2.5" r="1.5"/><circle cx="7.5" cy="2.5" r="1.5"/>
              <circle cx="2.5" cy="8" r="1.5"/><circle cx="7.5" cy="8" r="1.5"/>
              <circle cx="2.5" cy="13.5" r="1.5"/><circle cx="7.5" cy="13.5" r="1.5"/>
            </svg>
          </button>
        )}

        {/* Cabecera acordeon */}
        <button type="button"
          onClick={() => setOpenId(cur => cur === f.id ? null : f.id)}
          className="flex-1 px-3 py-3 flex items-center justify-between gap-3 text-left min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-ink truncate">{f.nombre}</p>
              {isColab && f.responsableUid === user?.uid && (
                <span className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-ink text-ivory">
                  Tu fase
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <EstadoChip estado={f.estado} />
              <span className="text-[11px] text-ink/60">{pct}%</span>
              {pendingApproval && (
                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 dark:text-amber-300">
                  Pendiente {proposedPct}%
                </span>
              )}
              {f.responsableNombre && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${getSubRoleColor(f.responsableSubRole)}`}>
                  {f.responsableNombre.split(" ")[0]}
                </span>
              )}
              {f.fechaEntregaResponsable && (
                <span className="text-[11px] text-ink/50">- {formatFechaCorta(f.fechaEntregaResponsable)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[14px] font-semibold text-ink">{pct}%</span>
            {isAdmin && canEditHere && (
              <button type="button"
                onClick={e => { e.stopPropagation(); onEliminar(f.id); }}
                className="w-5 h-5 flex items-center justify-center rounded-full text-ink/25 hover:text-red-500 hover:bg-red-50 transition-colors"
                aria-label="Eliminar fase">
                &times;
              </button>
            )}
            <span className="text-[12px] text-ink/50">{isOpen ? "▴" : "▾"}</span>
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="px-3 pb-3 overflow-hidden">
          {/* Barra de avance actual */}
          <div className="mt-2">
            <div className="h-2 w-full bg-sand dark:bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-ink dark:bg-white/70 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Selector responsable (solo admin) */}
          {isAdmin && colaboradores.length > 0 && (
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Responsable</p>
                <select
                  value={f.responsableUid || ""}
                  onChange={e => handleResponsableChange(f.id, e.target.value)}
                  className="input w-full text-[12px]">
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
                <p className="text-[10px] text-ink/45">Fecha limite para el colaborador responsable.</p>
              </div>
            </div>
          )}

          {/* Banner aprobacion — solo admin, desaparece al aprobar/rechazar */}
          {isAdmin && pendingApproval && (
            <div className="mt-3 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
              {editingProposal ? (
                /* ── Modo edicion de propuesta ── */
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    Editar propuesta antes de aprobar
                  </p>
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-400 mb-1">
                      <span>Avance</span><span>{editingProposal.pct}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={5}
                      value={editingProposal.pct}
                      onChange={e => setEditingProposal(prev => ({ ...prev, pct: Number(e.target.value) }))}
                      className="w-full accent-amber-600" />
                  </div>
                  <textarea
                    value={editingProposal.nota}
                    onChange={e => setEditingProposal(prev => ({ ...prev, nota: e.target.value }))}
                    rows={2} maxLength={300}
                    placeholder="Nota del avance (visible al cliente al aprobar)..."
                    className="input w-full text-[12px] resize-none"
                  />
                  <textarea
                    value={editingProposal.notaAdmin}
                    onChange={e => setEditingProposal(prev => ({ ...prev, notaAdmin: e.target.value }))}
                    rows={2} maxLength={300}
                    placeholder="Nota privada para admin (solo Luisa la ve)..."
                    className="input w-full text-[12px] resize-none bg-amber-50 dark:bg-amber-900/30"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <button type="button"
                      onClick={async () => {
                        await editarPropuesta(f.id, editingProposal.pct, editingProposal.nota, editingProposal.notaAdmin);
                        setEditingProposal(null);
                      }}
                      disabled={saving}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-semibold transition disabled:opacity-50">
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                    <button type="button"
                      onClick={async () => {
                        await editarPropuesta(f.id, editingProposal.pct, editingProposal.nota, editingProposal.notaAdmin);
                        setEditingProposal(null);
                        aprobarAvance(f.id);
                      }}
                      disabled={saving}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition disabled:opacity-50">
                      Guardar y aprobar
                    </button>
                    <button type="button" onClick={() => setEditingProposal(null)} disabled={saving}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Modo lectura ── */
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      Avance pendiente de aprobacion
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                      <span className="font-medium">{f.avancePropuestoPorNombre || "Colaborador"}</span>
                      {" "}propuso pasar a <span className="font-bold">{proposedPct}%</span>
                    </p>
                    {f.notaAvancePropuesto && (
                      <p className="mt-1.5 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 rounded-lg px-2 py-1.5 whitespace-pre-wrap">
                        {f.notaAvancePropuesto}
                      </p>
                    )}
                    {f.notaParaAdmin && (
                      <p className="mt-1.5 text-[11px] text-ink/70 dark:text-white/60 bg-white/70 dark:bg-white/10 rounded-lg px-2 py-1.5 whitespace-pre-wrap border border-sand dark:border-white/10">
                        <span className="font-semibold text-ink/50 dark:text-white/40">Nota privada: </span>
                        {f.notaParaAdmin}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-500">
                      Al aprobar: el avance se actualiza y los archivos de esta fase quedan visibles al cliente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <button type="button"
                      onClick={() => setEditingProposal({ pct: proposedPct, nota: f.notaAvancePropuesto || "", notaAdmin: f.notaParaAdmin || "" })}
                      disabled={saving}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition disabled:opacity-50">
                      Editar
                    </button>
                    <button type="button" onClick={() => aprobarAvance(f.id)} disabled={saving}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition disabled:opacity-50">
                      Aprobar
                    </button>
                    <button type="button"
                      onClick={() => setRejectModal({ faseId: f.id, nombre: f.nombre, responsableUid: f.responsableUid || f.avancePropuestoPorUid, responsableNombre: f.responsableNombre || f.avancePropuestoPorNombre })}
                      disabled={saving}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50">
                      Rechazar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Control de avance */}
          {canAdjustDirectProgress(f) ? (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-ink/60 mb-1">
                <span>Ajustar avance</span><span>{pct}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={pct}
                onChange={e => setPct(f.id, e.target.value)}
                className="w-full accent-ink" />
              <p className="text-[10px] text-ink/50 mt-1">Incrementos de 5% para consistencia.</p>
            </div>
          ) : canProposeProgress(f) ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-ink/60 mb-1">
                <span>{pendingApproval ? "Actualizar propuesta" : "Proponer avance"}</span>
                <span>{proposedPct}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={proposedPct}
                onChange={e => setPct(f.id, e.target.value)}
                className="w-full accent-ink" />
              <textarea
                value={f.notaParaAdmin || ""}
                onChange={e => setProposalAdminNote(f.id, e.target.value)}
                rows={2} maxLength={500}
                placeholder="Enlace Drive o nota privada para Luisa (solo ella lo ve)..."
                className="input w-full text-[12px] resize-none bg-sand/50 dark:bg-white/5"
              />
              <p className="text-[10px] text-ink/50">
                El avance no se refleja al cliente hasta que sea aprobado.
                {pendingApproval && (
                  <button type="button"
                    onClick={() => retirarPropuesta(f.id)}
                    disabled={saving}
                    className="ml-2 text-red-500 hover:text-red-700 underline transition disabled:opacity-50">
                    Retirar propuesta
                  </button>
                )}
              </p>
            </div>
          ) : (
            <div className="mt-3 text-[11px] text-ink/40">
              {isColab && f.responsableUid && f.responsableUid !== user?.uid
                ? <span>Esta fase esta asignada a otro colaborador.</span>
                : isAdmin && f.responsableUid
                  ? <span>El porcentaje se actualiza al aprobar la propuesta del colaborador.</span>
                  : <span>El avance lo actualiza el equipo de H&E.</span>
              }
            </div>
          )}

          <NotasFase projectId={projectId} phaseId={f.id}
            canEdit={canEditFaseActual(f)} clientView={clientView}
            autoVisible={!isColab} currentUserUid={currentUserUid} />
          {/* Solo admin puede togglear visibilidad; colaborador solo puede subir */}
          <ArchivosFase projectId={projectId} phaseId={f.id}
            canEdit={canEditFaseActual(f)}
            canToggleVisibility={isAdmin && !clientView}
            clientView={clientView} currentUserUid={currentUserUid} />
        </div>
      )}
    </div>
  );
}

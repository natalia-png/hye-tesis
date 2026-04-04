// src/pages/ProyectoDetalle.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import BtnReportePDF from "../components/BtnReportePDF";
import PropTypes from "prop-types";
import { useAuth } from "../app/useAuth";

import FasesProyecto from "../components/FasesProyecto.jsx";
import { DEFAULT_FASES, calcAvanceGlobal, cloneFases } from "../data/fases";
import { timeAgoSmart } from "../utils/timeAgo";

export default function ProyectoDetalle({
  canManageDocuments = false,
  clientView = false,
}) {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isColab = user?.role === "colaborador";
  // Jurídico: cualquier colaborador cuyo subRole contenga "jur" (Jurídica, Juridica, Jurídico…)
  const isJuridico = isColab && !!user?.subRole?.toLowerCase().includes("jur");

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [contratoUploading, setContratoUploading] = useState(false);
  const [contratoMsg, setContratoMsg] = useState("");
  const contratoFileRef = useRef(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [contratoRejectOpen, setContratoRejectOpen] = useState(false);
  const [contratoRejectReason, setContratoRejectReason] = useState("");
  const [solicitandoContrato, setSolicitandoContrato] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const ref = doc(db, "projects", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("El proyecto no existe o fue eliminado.");
          setProject(null);
          return;
        }

        const data = snap.data() || {};

        let fasesFromDb = null;
        if (Array.isArray(data.fases)) { fasesFromDb = data.fases; }
        else if (Array.isArray(data.phases)) { fasesFromDb = data.phases; }

        const fasesSafe =
          fasesFromDb && fasesFromDb.length > 0
            ? fasesFromDb
            : cloneFases(DEFAULT_FASES);

        const avanceReal = calcAvanceGlobal(fasesSafe);

        const adminNotes = data.adminNotes || "";
        setNotesValue(adminNotes);
        setProject({
          id: snap.id,
          code: data.code || snap.id,
          name: data.name || data.nombre || "Proyecto sin nombre",
          client: data.client || data.cliente || "Cliente sin nombre",
          status: data.status || data.estado || "Sin estado",

          progressReal: avanceReal,
          fases: fasesSafe,

          startDate: data.startDate || data.fechaInicio || null,
          endDate: data.endDate || data.fechaEntrega || null,

          type: data.type || data.tipo || null,
          location: data.location || data.ubicacion || null,
          leadArchitect: data.leadArchitect || data.arquitecto || null,
          engineer: data.engineer || data.ingeniero || null,
          lawyer: data.lawyer || data.abogado || null,
          budget: data.budget ?? data.presupuesto ?? null,
          description: data.description || data.descripcion || "",
          adminNotes: data.adminNotes || "",

          clientEmail: data.clientEmail || null,
          clientPhone: data.clientPhone || null,
          projectAddress: data.projectAddress || data.clientAddress || null,
          city: data.city || null,

          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          contratoURL: data.contratoURL || null,
          contratoPropuesto: data.contratoPropuesto || null,
          contratoSolicitado: data.contratoSolicitado || null,
        });
      } catch (e) {
        console.error(e);
        setError("No se pudo cargar la información del proyecto.");
      } finally {
        setLoading(false);
      }
    };

    if (id) load();
  }, [id]);

  const goBack = () => {
    nav(clientView ? "/mis-proyectos" : "/proyectos");
  };

  async function saveNotes() {
    setNotesSaving(true);
    try {
      await updateDoc(doc(db, "projects", id), { adminNotes: notesValue });
      setProject(p => ({ ...p, adminNotes: notesValue }));
      setEditingNotes(false);
    } catch (e) {
      console.error("saveNotes error:", e.message || e);
    } finally {
      setNotesSaving(false);
    }
  }

  async function handleContratoUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") { setContratoMsg("Solo se permiten archivos PDF."); return; }
    if (file.size > 10 * 1024 * 1024) { setContratoMsg("El archivo no debe superar 10 MB."); return; }
    setContratoUploading(true);
    setContratoMsg("");
    try {
      const path = `contratos/proyectos/${id}/contrato-${Date.now()}.pdf`;
      const sRef = storageRef(storage, path);
      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(sRef, file, { contentType: "application/pdf" });
        task.on("state_changed", null, reject, resolve);
      });
      const url = await getDownloadURL(sRef);
      if (isAdmin) {
        // Admin sube directo → visible al cliente de inmediato
        await updateDoc(doc(db, "projects", id), { contratoURL: url });
        setProject(p => ({ ...p, contratoURL: url }));
        setContratoMsg("Contrato subido.");
      } else {
        // Juridico → propuesta, admin decide si se publica
        const propuesta = {
          url,
          subidoPor: user?.name || user?.email || "Colaborador",
          subidoPorUid: user?.uid || null,
          subidoAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, "projects", id), { contratoPropuesto: propuesta });
        setProject(p => ({ ...p, contratoPropuesto: propuesta }));
        setContratoMsg("Propuesta enviada. El admin la revisará antes de publicarla.");
        // Notificar a admins
        try {
          const { notifyAdmins } = await import("../lib/notifications.js");
          notifyAdmins({
            type: "contrato_propuesto",
            title: "Nueva propuesta de contrato",
            body: `${user?.name || "Jurídico"} propuso un contrato para el proyecto ${project?.name || id}.`,
            projectId: id,
            projectName: project?.name || id,
          });
        } catch (e) { console.error(e); }
      }
    } catch (err) {
      setContratoMsg("Error al subir: " + err.message);
    } finally {
      setContratoUploading(false);
    }
  }

  async function aprobarContrato() {
    if (!project?.contratoPropuesto?.url) return;
    await updateDoc(doc(db, "projects", id), {
      contratoURL: project.contratoPropuesto.url,
      contratoPropuesto: null,
    });
    setProject(p => ({ ...p, contratoURL: p.contratoPropuesto.url, contratoPropuesto: null }));
    setContratoMsg("Contrato aprobado y publicado al cliente.");
  }

  async function rechazarContrato(reason = "") {
    const propuestoPorUid = project?.contratoPropuesto?.subidoPorUid;
    const propuestoPor = project?.contratoPropuesto?.subidoPor;
    await updateDoc(doc(db, "projects", id), { contratoPropuesto: null });
    setProject(p => ({ ...p, contratoPropuesto: null }));
    setContratoMsg("Propuesta rechazada.");
    if (propuestoPorUid && reason.trim()) {
      try {
        const { createNotification } = await import("../lib/notifications.js");
        createNotification(propuestoPorUid, {
          type: "contrato_rechazado",
          title: "Propuesta de contrato rechazada",
          body: `Tu propuesta de contrato para "${project?.name || id}" fue rechazada. Motivo: ${reason.trim()}`,
          projectId: id,
          projectName: project?.name || id,
        });
      } catch (e) { console.error(e); }
    }
    void propuestoPor;
  }

  async function solicitarContrato() {
    setSolicitandoContrato(true);
    try {
      const solicitud = {
        solicitadoAt: new Date().toISOString(),
        solicitadoPorUid: user?.uid || null,
        solicitadoPorNombre: user?.name || user?.email || "Admin",
      };
      await updateDoc(doc(db, "projects", id), { contratoSolicitado: solicitud });
      setProject(p => ({ ...p, contratoSolicitado: solicitud }));
      setContratoMsg("Solicitud enviada al equipo jurídico.");
      // Notificar a colaboradores jurídicos
      try {
        const { createNotification } = await import("../lib/notifications.js");
        const snap = await getDocs(query(collection(db, "users"), where("role", "==", "colaborador")));
        const juridicos = snap.docs.filter(d => d.data().subRole?.toLowerCase().includes("jur"));
        await Promise.all(juridicos.map(d => createNotification(d.id, {
          type: "contrato_solicitado",
          title: "Solicitud de contrato",
          body: `El admin solicitó un contrato para el proyecto "${project?.name || id}".`,
          projectId: id,
          projectName: project?.name || id,
        })));
      } catch (e) { console.error(e); }
    } catch (e) {
      setContratoMsg("Error al enviar solicitud: " + e.message);
    } finally {
      setSolicitandoContrato(false);
    }
  }

  const canEditFases = canManageDocuments && !clientView;

  if (loading) {
    return (
      <section className="space-y-4">
        <HeaderDetalle onBack={goBack} />
        <p className="text-[13px] text-ink/60">Cargando proyecto…</p>
      </section>
    );
  }

  if (error || !project) {
    return (
      <section className="space-y-4">
        <HeaderDetalle onBack={goBack} />
        <p className="text-[13px] text-red-600">
          {error || "No se encontró el proyecto."}
        </p>
        <button className="btn-primary" onClick={goBack}>
          Volver a proyectos
        </button>
      </section>
    );
  }

  const {
    code,
    name,
    client,
    status,
    progressReal,
    fases,
    type,
    location,
    budget,
    startDate,
    endDate,
    createdAt,
    updatedAt,
    clientEmail,
    clientPhone,
    projectAddress,
    city,
  } = project;

  const lastUpdate = updatedAt || createdAt;

  return (
    <section className="space-y-4">
      <HeaderDetalle onBack={goBack} />

      {/* PDF inline preview */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90"
          onClick={() => setPdfPreviewUrl(null)}>
          <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0"
            onClick={e => e.stopPropagation()}>
            <p className="text-white text-[13px] font-medium">Vista previa del contrato</p>
            <div className="flex items-center gap-2">
              <a href={pdfPreviewUrl} target="_blank" rel="noopener noreferrer"
                className="text-[11px] px-3 py-1.5 rounded-full border border-white/30 text-white/80 hover:text-white transition">
                Descargar
              </a>
              <button type="button" onClick={() => setPdfPreviewUrl(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition text-[20px]">
                ×
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden" onClick={e => e.stopPropagation()}>
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfPreviewUrl)}&embedded=true`}
              className="w-full h-full border-0"
              title="Vista previa PDF"
            />
          </div>
        </div>
      )}

      {/* Modal rechazo de contrato */}
      {contratoRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 pb-4"
          onClick={() => { setContratoRejectOpen(false); setContratoRejectReason(""); }}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-black/10"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-black/[0.06]">
              <p className="text-[14px] font-bold text-ink">Rechazar propuesta de contrato</p>
              <p className="text-[12px] mt-0.5 text-ink/50">{name}</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-[12px] font-semibold mb-1.5 text-ink/70">
                  Motivo del rechazo <span className="text-red-500">*</span>
                </p>
                <textarea
                  value={contratoRejectReason}
                  onChange={e => setContratoRejectReason(e.target.value)}
                  rows={3} maxLength={300} autoFocus
                  placeholder="Indica qué debe corregir el jurídico..."
                  className="w-full border rounded-xl px-3 py-2 text-[13px] outline-none resize-none text-ink"
                  style={{ borderColor: "rgb(var(--taupe) / 0.35)" }}
                />
              </div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { setContratoRejectOpen(false); setContratoRejectReason(""); }}
                  className="flex-1 py-2.5 rounded-xl border text-[13px] text-ink/60 transition"
                  style={{ borderColor: "rgb(var(--ink) / 0.2)" }}>
                  Cancelar
                </button>
                <button type="button"
                  onClick={async () => {
                    await rechazarContrato(contratoRejectReason);
                    setContratoRejectOpen(false);
                    setContratoRejectReason("");
                  }}
                  disabled={!contratoRejectReason.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition disabled:opacity-50">
                  Confirmar rechazo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cabecera del proyecto */}
      <div className="card space-y-3">
        {/* Tipo badge */}
        {type && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-ink text-ivory">
            {type}
          </span>
        )}

        {/* Título + info */}
        <div>
          <p className="text-[11px] tracking-[0.18em] uppercase text-ink/50">Proyecto</p>
          <h1 className="text-[18px] font-semibold text-ink leading-snug">{name}</h1>
          <p className="text-[13px] text-ink/70 mt-1">
            Código <span className="font-medium">{code}</span> · Cliente{" "}
            <span className="font-medium">{client}</span>
          </p>
          <p className="text-[11px] text-ink/50 mt-1">
            Actualizado: <span className="font-medium">{timeAgoSmart(lastUpdate)}</span>
          </p>
        </div>

        {/* Estado + acciones — siempre en fila, se adapta en móvil */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-sand px-3 py-[4px] text-[11px] text-ink/80">
            {status}
          </span>
          {canManageDocuments && !clientView && (
            <button
              type="button"
              onClick={() => nav(`/proyectos/${id}/editar`)}
              className="text-[11px] text-ink/70 hover:text-ink underline"
            >
              Editar
            </button>
          )}
          {canManageDocuments && !clientView && (
            <button
              type="button"
              onClick={() => nav(`/proyectos/${id}/garantias`)}
              className="text-[11px] text-ink/70 hover:text-ink underline"
            >
              Garantías
            </button>
          )}
          <BtnReportePDF proyecto={project} isAdmin={!clientView} />
        </div>

        {/* Datos de contacto del cliente */}
        {(clientEmail || clientPhone || projectAddress || city) && (
          <div className="border-t border-taupe/20 pt-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-medium">Datos del cliente</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {clientEmail && (
                <a href={`mailto:${clientEmail}`}
                  className="flex items-center gap-1.5 text-[12px] text-ink/70 hover:text-ink transition-colors">
                  <svg className="w-3 h-3 text-ink/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {clientEmail}
                </a>
              )}
              {clientPhone && (
                <a href={`tel:${clientPhone}`}
                  className="flex items-center gap-1.5 text-[12px] text-ink/70 hover:text-ink transition-colors">
                  <svg className="w-3 h-3 text-ink/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {clientPhone}
                </a>
              )}
              {(projectAddress || city) && (
                <span className="flex items-center gap-1.5 text-[12px] text-ink/70">
                  <svg className="w-3 h-3 text-ink/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {[projectAddress, city].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Barra de avance real global */}
        <div className="mt-1">
          <div className="flex justify-between text-[11px] text-ink/60 mb-1">
            <span>Avance real</span>
            <span>{progressReal}%</span>
          </div>
          <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
            <div
              className="h-full bg-ink"
              style={{ width: `${progressReal}%` }}
            />
          </div>
          <p className="text-[11px] text-ink/50 mt-1">
            Calculado a partir del avance por fases.
          </p>
        </div>
      </div>

      {/* Fases del proyecto */}
      <FasesProyecto
        projectId={id}
        fases={fases}
        clientView={clientView}
        canEdit={canEditFases}
        createdAt={createdAt}
        updatedAt={updatedAt}
      />

      {/* Info general */}
      <div className="grid gap-3">
        <div className="card space-y-2">
          <h2 className="text-[14px] font-semibold text-ink">
            Información general
          </h2>
          <InfoRow label="Tipo de proyecto" value={type} />
          <InfoRow label="Ubicación" value={location} />
          <InfoRow label="Presupuesto estimado" value={formatMoney(budget)} />
        </div>

        <div className="card space-y-2">
          <h2 className="text-[14px] font-semibold text-ink">
            Fechas clave (plan)
          </h2>
          <InfoRow label="Inicio" value={formatDate(startDate)} />
          <InfoRow label="Entrega estimada" value={formatDate(endDate)} />
          <DaysRemaining endDate={endDate} />
        </div>

        {!clientView && (
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-ink">
                Notas internas
              </h2>
              {canManageDocuments && !editingNotes && (
                <button
                  type="button"
                  onClick={() => setEditingNotes(true)}
                  className="text-[12px] text-ink/50 hover:text-ink underline"
                >
                  Editar
                </button>
              )}
            </div>

            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  placeholder="Escribe notas internas del proyecto..."
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F4EE] border border-taupe/40
                             text-[13px] text-ink outline-none focus:ring-2 focus:ring-ink/10
                             focus:border-ink/40 resize-none transition"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveNotes}
                    disabled={notesSaving}
                    className="px-4 py-1.5 rounded-xl bg-ink text-white text-[12px]
                               disabled:opacity-60 hover:brightness-110 transition"
                  >
                    {notesSaving ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingNotes(false); setNotesValue(project.adminNotes || ""); }}
                    className="px-4 py-1.5 rounded-xl text-[12px] text-ink/60 hover:text-ink transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-ink/70 whitespace-pre-wrap">
                {project.adminNotes || (
                  <span className="italic text-ink/40">Sin notas internas aún.</span>
                )}
              </p>
            )}
          </div>
        )}

        {!clientView && (isAdmin || isColab) && (
          <div className="card space-y-2">
            <h2 className="text-[14px] font-semibold text-ink dark:text-white/90">Contrato del proyecto</h2>

            {/* Contrato vigente — admin y todos los colaboradores lo ven */}
            {project.contratoURL ? (
              <div className="flex items-center gap-3 rounded-xl border border-sand dark:border-white/10 bg-sand/40 dark:bg-white/5 px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-ink/8 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-ink/50 dark:text-white/50" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-ink dark:text-white/85">Contrato firmado</p>
                  <p className="text-[10px] text-ink/45 dark:text-white/35">Documento oficial del proyecto</p>
                </div>
                <button type="button"
                  onClick={() => window.open(project.contratoURL, "_blank", "noopener,noreferrer")}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-ink dark:bg-white text-ivory dark:text-ink font-medium hover:opacity-80 transition flex-shrink-0">
                  Ver
                </button>
              </div>
            ) : !isJuridico && (
              <p className="text-[12px] text-ink/40 dark:text-white/30 italic">Sin contrato subido aun.</p>
            )}

            {/* ── Solo admin: banner de propuesta pendiente ── */}
            {isAdmin && project.contratoPropuesto && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 space-y-2">
                <div>
                  <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    Contrato propuesto por <span className="font-bold">{project.contratoPropuesto.subidoPor}</span>
                  </p>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">Pendiente de aprobacion para publicar al cliente</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button type="button"
                    onClick={() => setPdfPreviewUrl(project.contratoPropuesto.url)}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition">
                    Ver PDF
                  </button>
                  <button type="button" onClick={aprobarContrato}
                    className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition">
                    Aprobar y publicar
                  </button>
                  <button type="button" onClick={() => { setContratoRejectOpen(true); setContratoRejectReason(""); }}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                    Rechazar
                  </button>
                </div>
              </div>
            )}

            {/* ── Admin: subir/reemplazar + solicitar a jurídico ── */}
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                {contratoUploading ? (
                  <span className="text-[12px] text-ink/50 dark:text-white/40">Subiendo...</span>
                ) : (
                  <button type="button" onClick={() => contratoFileRef.current?.click()}
                    className="text-[12px] px-3 py-1.5 rounded-full border border-taupe/40 dark:border-white/20 text-ink/60 dark:text-white/50 hover:text-ink dark:hover:text-white hover:border-ink/30 transition">
                    {project.contratoURL ? "Reemplazar contrato" : "Subir contrato"}
                  </button>
                )}
                {!project.contratoPropuesto && (
                  <button type="button"
                    onClick={solicitarContrato}
                    disabled={solicitandoContrato}
                    className="text-[12px] px-3 py-1.5 rounded-full border border-taupe/40 dark:border-white/20 text-ink/60 dark:text-white/50 hover:text-ink dark:hover:text-white hover:border-ink/30 transition disabled:opacity-50">
                    {solicitandoContrato ? "Enviando..." : project.contratoSolicitado ? "Solicitud enviada ✓" : "Solicitar a Jurídico"}
                  </button>
                )}
                <input ref={contratoFileRef} type="file" accept="application/pdf" className="hidden" onChange={handleContratoUpload} />
              </div>
            )}

            {/* ── Jurídico: banner de solicitud del admin ── */}
            {isJuridico && project.contratoSolicitado && !project.contratoPropuesto && !project.contratoURL && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">
                  El admin solicita un contrato para este proyecto
                </p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                  Sube tu propuesta usando el botón de abajo.
                </p>
              </div>
            )}

            {/* ── Jurídico: proponer / retirar ── */}
            {isJuridico && (
              project.contratoPropuesto ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/15 px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">Propuesta enviada — esperando aprobacion de Luisa</p>
                  </div>
                  <button type="button"
                    onClick={async () => {
                      await updateDoc(doc(db, "projects", id), { contratoPropuesto: null });
                      setProject(p => ({ ...p, contratoPropuesto: null }));
                      setContratoMsg("Propuesta retirada.");
                    }}
                    className="text-[11px] text-red-500 dark:text-red-400 hover:underline transition">
                    Retirar propuesta
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {contratoUploading ? (
                    <span className="text-[12px] text-ink/50 dark:text-white/40">Subiendo...</span>
                  ) : (
                    <button type="button" onClick={() => contratoFileRef.current?.click()}
                      className="text-[12px] px-3 py-1.5 rounded-full border border-taupe/40 dark:border-white/20 text-ink/60 dark:text-white/50 hover:text-ink dark:hover:text-white hover:border-ink/30 transition">
                      Proponer contrato
                    </button>
                  )}
                  <p className="text-[10px] text-ink/40 dark:text-white/30">
                    Luisa aprobara el contrato antes de que sea visible para el cliente.
                  </p>
                  <input ref={contratoFileRef} type="file" accept="application/pdf" className="hidden" onChange={handleContratoUpload} />
                </div>
              )
            )}

            {contratoMsg && (
              <p className={`text-[11px] font-medium ${contratoMsg.includes("Error") ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                {contratoMsg}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── UI helpers ─── */

function HeaderDetalle({ onBack }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <button
        type="button"
        onClick={onBack}
        className="text-[12px] text-ink/70 hover:text-ink"
      >
        ‹ Volver a proyectos
      </button>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <span className="text-ink/60">{label}</span>
      <span className="text-ink font-medium text-right">{value || "—"}</span>
    </div>
  );
}

/* ─── data helpers ─── */

function parseLocalDate(value) {
  if (!value) return null;
  // Firestore Timestamp
  if (value?.seconds) return new Date(value.seconds * 1000);
  // String "YYYY-MM-DD" — añadir T12:00:00 para evitar desfase UTC en Colombia
  if (typeof value === "string") {
    const d = new Date(value.slice(0, 10) + "T12:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatDate(value) {
  if (!value) return "—";
  const d = parseLocalDate(value);
  if (!d) return String(value);
  return d.toLocaleDateString("es-CO");
}

function formatMoney(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return value.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
  }
  const n = Number(String(value).replaceAll(/[^\d]/g, ""));
  if (Number.isFinite(n) && n > 0) {
    return n.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
  }
  return String(value);
}

function DaysRemaining({ endDate }) {
  if (!endDate) return null;
  const end = parseLocalDate(endDate);
  if (Number.isNaN(end.getTime())) return null;

  const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff > 0) {
    return (
      <div className="flex justify-between gap-4 text-[13px]">
        <span className="text-ink/60">Días restantes</span>
        <span className="font-medium text-green-700">{diff} días</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <span className="text-ink/60">Días de retraso</span>
      <span className="font-medium text-red-600">{Math.abs(diff)} días</span>
    </div>
  );
}


ProyectoDetalle.propTypes = {
  canManageDocuments: PropTypes.bool,
  clientView: PropTypes.bool,
};

HeaderDetalle.propTypes = {
  onBack: PropTypes.func,
};

InfoRow.propTypes = {
  label: PropTypes.string,
  value: PropTypes.any,
};

DaysRemaining.propTypes = {
  endDate: PropTypes.any,
};
// src/pages/GarantiasAdmin.jsx
// Módulo de Garantías y Posventa — Vista Admin (Luisa)
// Luisa puede ver todas las solicitudes, responder y cambiar el estado

import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, arrayUnion, deleteDoc, deleteField } from "firebase/firestore";
import { db, storage } from "../lib/firebase";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import PropTypes from "prop-types";
import { ESTADOS, ESTADO_LABEL, calcFechaSolicitud } from "../data/garantias";
import { useGarantiasSolicitudes } from "../hooks/useGarantiasSolicitudes";
import SolicitudCardHeader from "../components/garantias/SolicitudCardHeader";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import FiltroTabs from "../components/ui/FiltroTabs";
import FotoGallery from "../components/garantias/FotoGallery";
import RespuestasGarantia from "../components/garantias/RespuestasGarantia";
import UploadProgress from "../components/ui/UploadProgress";
import AttachIcon from "../components/ui/AttachIcon";
import { useAuth } from "../app/useAuth";
import { createNotification, notifyAdmins } from "../lib/notifications";

export default function GarantiasAdmin() {
    const { id: projectId } = useParams();
    const nav = useNavigate();
    const { user } = useAuth();
    const [filtro, setFiltro] = useState("todas");

    const { projectName, solicitudes, loading } = useGarantiasSolicitudes(projectId);

    const filtradas = filtro === "todas"
        ? solicitudes
        : solicitudes.filter(s => s.estado === filtro);

    const conteo = {
        todas: solicitudes.length,
        pendiente: solicitudes.filter(s => s.estado === "pendiente").length,
        en_revision: solicitudes.filter(s => s.estado === "en_revision").length,
        resuelto: solicitudes.filter(s => s.estado === "resuelto").length,
    };

    return (
        <section className="space-y-4">

            {/* Back */}
            <button
                onClick={() => nav(`/proyectos/${projectId}`)}
                className="text-[12px] text-ink/60 hover:text-ink inline-flex items-center gap-1"
            >
                ‹ Volver al proyecto
            </button>

            {/* Header */}
            <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                    {projectName}
                </p>
                <h1 className="text-[20px] font-bold text-ink leading-tight">
                    Garantías y Posventa
                </h1>
                <p className="text-[12px] text-ink/50 mt-0.5">
                    {solicitudes.length} solicitud{solicitudes.length === 1 ? "" : "es"} en total
                </p>
            </div>

            {/* Filtros */}
            <FiltroTabs
                tabs={[
                    { key: "todas", label: "Todas" },
                    { key: "pendiente", label: "Pendientes" },
                    { key: "en_revision", label: "En revisión" },
                    { key: "resuelto", label: "Resueltas" },
                ]}
                filtro={filtro}
                conteo={conteo}
                onChange={setFiltro}
            />

            {/* Lista */}
            {loading && <LoadingSpinner />}
            {!loading && filtradas.length === 0 && (
                <div className="card text-center py-10 space-y-2">
                    <p className="text-3xl">✅</p>
                    <p className="text-[13px] text-ink/60">
                        {filtro === "todas"
                            ? "Sin solicitudes de garantía"
                            : `Sin solicitudes ${ESTADO_LABEL[filtro]?.toLowerCase()}`}
                    </p>
                </div>
            )}
            {!loading && filtradas.length > 0 && (
                <div className="space-y-3">
                    {filtradas.map(s => (
                        <TarjetaSolicitudAdmin
                            key={s.id}
                            solicitud={s}
                            projectId={projectId}
                            user={user}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

GarantiasAdmin.propTypes = {};

/* ── TARJETA SOLICITUD (vista admin/colaborador) ── */
function TarjetaSolicitudAdmin({ solicitud, projectId, user }) {
    const [expanded, setExpanded] = useState(false);
    const [respuesta, setRespuesta] = useState("");
    const [archivoRespuesta, setArchivoRespuesta] = useState(null);
    const [saving, setSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [changingEstado, setChangingEstado] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showResolucion, setShowResolucion] = useState(false);
    const [pruebaArchivo, setPruebaArchivo] = useState(null);
    const [savingResolucion, setSavingResolucion] = useState(false);
    const [uploadProgressPrueba, setUploadProgressPrueba] = useState(0);
    const [clientEmail, setClientEmail] = useState("");
    const [modalEmail, setModalEmail] = useState(null); // { asunto, cuerpo }
    const [aprobandoPropuesta, setAprobandoPropuesta] = useState(false);
    const [showRechazarModal, setShowRechazarModal] = useState(false);
    const [rechazarMotivo, setRechazarMotivo] = useState("");
    const [rechazandoPropuesta, setRechazandoPropuesta] = useState(false);
    const fileInputRef = useRef(null);
    const pruebaInputRef = useRef(null);

    const isJuridico = user?.role === "colaborador" && !!user?.subRole?.toLowerCase().includes("jur");
    const isAdmin = user?.role === "admin";

    const fecha = calcFechaSolicitud(solicitud);

    const solRef = doc(db, "garantias", projectId, "solicitudes", solicitud.id);

    // Fetch client email when expanded
    useEffect(() => {
        if (!expanded || !solicitud.creadoPor || clientEmail) return;
        getDoc(doc(db, "users", solicitud.creadoPor))
            .then(d => { if (d.exists()) setClientEmail(d.data().email || ""); })
            .catch(console.error);
    }, [expanded, solicitud.creadoPor, clientEmail]);

    const handleEliminar = async (e) => {
        e.stopPropagation();
        if (!confirm(`¿Eliminar esta solicitud de "${solicitud.nombreCliente || "Cliente"}"? Esta acción no se puede deshacer.`)) return;
        setDeleting(true);
        try {
            await deleteDoc(solRef);
        } catch (err) {
            console.error(err);
            alert("No se pudo eliminar. Intenta de nuevo.");
            setDeleting(false);
        }
    };

    const cambiarEstado = async (nuevoEstado) => {
        if (nuevoEstado === solicitud.estado) return;
        if (nuevoEstado === "resuelto") { setShowResolucion(true); return; }
        setChangingEstado(true);
        try {
            await updateDoc(solRef, { estado: nuevoEstado });
        } catch (e) {
            console.error(e);
        } finally {
            setChangingEstado(false);
        }
    };

    const confirmarResolucion = async () => {
        setSavingResolucion(true);
        try {
            let pruebaData = null;
            if (pruebaArchivo) {
                const path = `garantias/${projectId}/pruebas/${Date.now()}_${pruebaArchivo.name}`;
                const sRef = storageRef(storage, path);
                await new Promise((res, rej) => {
                    const task = uploadBytesResumable(sRef, pruebaArchivo);
                    task.on("state_changed",
                        snap => setUploadProgressPrueba(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
                        rej,
                        async () => {
                            const url = await getDownloadURL(task.snapshot.ref);
                            pruebaData = { url, name: pruebaArchivo.name, path };
                            res();
                        }
                    );
                });
            }
            await updateDoc(solRef, {
                estado: "resuelto",
                ...(pruebaData ? { resolucionPrueba: pruebaData } : {}),
            });
            setShowResolucion(false);
            setPruebaArchivo(null);
            if (pruebaInputRef.current) pruebaInputRef.current.value = "";
        } catch (e) {
            console.error(e);
        } finally {
            setSavingResolucion(false);
            setUploadProgressPrueba(0);
        }
    };

    const abrirCorreoResolucion = () => {
        const nombreCompleto = solicitud.nombreCliente || "Cliente";
        const primerNombre = nombreCompleto.split(" ")[0];
        const fechaResolucion = new Date().toLocaleDateString("es-CO", {
            day: "numeric", month: "long", year: "numeric"
        });

        // Si hay respuesta aprobada específica (propuesta por jurídica), usarla primero
        const aprobada = solicitud.aprobadaParaCorreo;
        const respuestasTexto = aprobada?.texto
            ? [aprobada.texto]
            : (solicitud.respuestas || []).map(r => r.texto?.trim()).filter(Boolean);

        // Documento: prueba de resolución o archivo de la respuesta aprobada
        const docResolucion = solicitud.resolucionPrueba || aprobada?.archivo || null;
        const tieneDocumento = !!docResolucion?.url;
        const urlDocumento = docResolucion?.url || "";
        const nombreDocumento = docResolucion?.name || "Documento de resolución";

        const separador = "─────────────────────────────────────────";

        const cuerpo = [
            `${primerNombre},`,
            "",
            `Por medio del presente correo, H&E Arquitectos le informa que su solicitud de garantía ha sido atendida y resuelta satisfactoriamente.`,
            "",
            separador,
            `DETALLE DE LA SOLICITUD`,
            separador,
            `Descripción reportada:`,
            solicitud.descripcion?.trim() || "",
            "",
            `Fecha de resolución: ${fechaResolucion}`,
            "",
            ...(respuestasTexto.length > 0 ? [
                separador,
                `ACCIONES REALIZADAS`,
                separador,
                ...respuestasTexto.map(r => `• ${r}`),
                "",
            ] : []),
            ...(tieneDocumento ? [
                separador,
                `DOCUMENTO DE RESOLUCIÓN`,
                separador,
                `Se adjunta el documento de prueba como constancia oficial de la resolución de esta solicitud.`,
                "",
                `Puede descargarlo directamente desde el siguiente enlace:`,
                urlDocumento,
                `(Archivo: ${nombreDocumento})`,
                "",
            ] : []),
            separador,
            "",
            `Quedamos a su entera disposición para cualquier inquietud adicional.`,
            "",
            `Atentamente,`,
            "",
            `Luisa Erazo`,
            `H&E Arquitectos — Espacios Humanos`,
            `Tel: 321 885 6680`,
            `hyearquitectos@gmail.com`,
            `@hye.arquitectos`,
        ].join("\n");

        setModalEmail({
            asunto: `Resolución de solicitud de garantía — H&E Arquitectos`,
            cuerpo,
        });
    };

    const confirmarEnvioEmail = async () => {
        if (!modalEmail) return;
        const email = clientEmail || "";
        const subject = encodeURIComponent(modalEmail.asunto);
        window.open(`mailto:${email}?subject=${subject}&body=${encodeURIComponent(modalEmail.cuerpo)}`, "_blank");
        setModalEmail(null);
        // Pasar a resuelto automáticamente al enviar el correo
        try {
            await updateDoc(solRef, { estado: "resuelto" });
        } catch (e) {
            console.error(e);
        }
    };

    const aprobarPropuesta = async () => {
        const prop = solicitud.respuestaPropuesta;
        if (!prop) return;
        setAprobandoPropuesta(true);
        try {
            await updateDoc(solRef, {
                respuestas: arrayUnion({
                    texto: prop.texto || "",
                    archivo: prop.archivo || null,
                    fecha: prop.fecha || new Date(),
                    autor: prop.propuestoPor || "Jurídica",
                }),
                // Habilita el botón de correo para ambos (admin + jurídica que propuso)
                aprobadaParaCorreo: {
                    texto: prop.texto || "",
                    archivo: prop.archivo || null,
                    propuestoPorUid: prop.propuestoPorUid || null,
                    aprobadaAt: new Date(),
                },
                respuestaPropuesta: deleteField(),
                propuestaRechazada: deleteField(),
                ...(solicitud.estado === "pendiente" ? { estado: "en_revision" } : {}),
            });
            if (prop.propuestoPorUid) {
                await createNotification(prop.propuestoPorUid, {
                    type: "garantia_respondida",
                    title: "Tu respuesta de garantía fue aprobada ✅",
                    body: "Ya puedes enviar la respuesta al cliente desde la app.",
                    projectId,
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setAprobandoPropuesta(false);
        }
    };

    const rechazarPropuesta = async () => {
        const prop = solicitud.respuestaPropuesta;
        if (!prop) return;
        setRechazandoPropuesta(true);
        try {
            const propUid = prop.propuestoPorUid;
            const motivo = rechazarMotivo.trim() || "El administrador rechazó la propuesta.";
            await updateDoc(solRef, {
                respuestaPropuesta: deleteField(),
                propuestaRechazada: { motivo, fecha: new Date(), propuestoPorUid: propUid },
            });
            if (propUid) {
                await createNotification(propUid, {
                    type: "general",
                    title: "Tu propuesta de garantía fue rechazada",
                    body: motivo,
                    projectId,
                });
            }
            setShowRechazarModal(false);
            setRechazarMotivo("");
        } catch (e) {
            console.error(e);
        } finally {
            setRechazandoPropuesta(false);
        }
    };

    const enviarRespuesta = async () => {
        if (!respuesta.trim() && !archivoRespuesta) return;
        setSaving(true);
        try {
            let archivoData = null;

            // Subir archivo si hay
            if (archivoRespuesta) {
                const path = `garantias/${projectId}/respuestas/${Date.now()}_${archivoRespuesta.name}`;
                const sRef = storageRef(storage, path);
                await new Promise((res, rej) => {
                    const task = uploadBytesResumable(sRef, archivoRespuesta);
                    task.on("state_changed",
                        snap => setUploadProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
                        rej,
                        async () => {
                            const url = await getDownloadURL(task.snapshot.ref);
                            archivoData = { url, name: archivoRespuesta.name, path };
                            res();
                        }
                    );
                });
                setUploadProgress(0);
            }

            if (isJuridico) {
                // Jurídico propone — admin debe aprobar antes de enviar
                await updateDoc(solRef, {
                    respuestaPropuesta: {
                        texto: respuesta.trim(),
                        archivo: archivoData,
                        propuestoPorUid: user.uid,
                        propuestoPor: user.name || user.email || "Jurídica",
                        fecha: new Date(),
                    },
                });
                await notifyAdmins({
                    type: "general",
                    title: "Jurídica propuso una respuesta de garantía",
                    body: `Propuesta para: "${(solicitud.descripcion || "").substring(0, 60)}…"`,
                    projectId,
                });
            } else {
                // Admin envía directamente
                await updateDoc(solRef, {
                    respuestas: arrayUnion({
                        texto: respuesta.trim() || "",
                        archivo: archivoData,
                        fecha: new Date(),
                        autor: "Luisa — H&E Arquitectos",
                    }),
                    ...(solicitud.estado === "pendiente" ? { estado: "en_revision" } : {}),
                });
            }

            setRespuesta("");
            setArchivoRespuesta(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>

        {/* ── Modal editar correo ── */}
        {modalEmail && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4">
                <div className="w-full max-w-[500px] bg-white rounded-2xl shadow-2xl space-y-4 p-5">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[15px] font-semibold text-ink">✉️ Preparar correo al cliente</h3>
                        <button type="button" onClick={() => setModalEmail(null)} className="text-ink/40 hover:text-ink text-xl leading-none">×</button>
                    </div>

                    {/* Descarga del documento si existe */}
                    {solicitud.resolucionPrueba?.url && (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex items-center gap-2">
                            <AttachIcon />
                            <a href={solicitud.resolucionPrueba.url} target="_blank" rel="noopener noreferrer"
                                className="flex-1 text-[12px] text-emerald-700 font-medium truncate hover:underline">
                                {solicitud.resolucionPrueba.name || "Documento de prueba"}
                            </a>
                            <span className="text-[10px] text-emerald-600/60 flex-shrink-0">Descarga y adjunta antes de enviar</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-ink/60 uppercase tracking-wide">Asunto</label>
                        <input
                            type="text"
                            value={modalEmail.asunto}
                            onChange={e => setModalEmail(m => ({ ...m, asunto: e.target.value }))}
                            className="input w-full text-[13px]"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-ink/60 uppercase tracking-wide">Cuerpo del correo</label>
                        <textarea
                            value={modalEmail.cuerpo}
                            onChange={e => setModalEmail(m => ({ ...m, cuerpo: e.target.value }))}
                            rows={12}
                            className="input w-full text-[12px] font-mono resize-none leading-relaxed"
                        />
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => setModalEmail(null)}
                            className="flex-1 btn-outline text-[13px]">
                            Cancelar
                        </button>
                        <button type="button" onClick={confirmarEnvioEmail}
                            className="flex-1 text-[13px] font-semibold text-white rounded-xl py-2.5 transition-all bg-emerald-500 hover:bg-emerald-600">
                            Abrir en correo
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ── Modal rechazar propuesta ── */}
        {showRechazarModal && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4">
                <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl space-y-4 p-5">
                    <h3 className="text-[14px] font-semibold text-ink">Rechazar propuesta</h3>
                    <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-ink/60 uppercase tracking-wide">Motivo (opcional)</label>
                        <textarea
                            value={rechazarMotivo}
                            onChange={e => setRechazarMotivo(e.target.value)}
                            placeholder="Indica al colaborador por qué se rechaza…"
                            rows={3}
                            className="input w-full text-[13px] resize-none"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => { setShowRechazarModal(false); setRechazarMotivo(""); }}
                            disabled={rechazandoPropuesta}
                            className="flex-1 btn-outline text-[12px] disabled:opacity-50">
                            Cancelar
                        </button>
                        <button type="button" onClick={rechazarPropuesta}
                            disabled={rechazandoPropuesta}
                            className="flex-1 py-2 rounded-full text-[12px] font-medium bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50">
                            {rechazandoPropuesta ? "Rechazando…" : "Rechazar y notificar"}
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className={`card space-y-3 ${solicitud.prioridad === "urgente" ? "border-l-4 border-l-red-400" : ""}`}>

            {/* Header */}
            <div className="flex items-start gap-2">
                <button
                    type="button"
                    onClick={() => setExpanded(e => !e)}
                    className="flex-1 text-left"
                >
                    {solicitud.prioridad === "urgente" && (
                        <span className="inline-block text-[10px] font-bold text-red-500 mb-1">
                            🚨 URGENTE
                        </span>
                    )}
                    <SolicitudCardHeader
                        solicitud={solicitud}
                        expanded={expanded}
                        subText={`${solicitud.nombreCliente || "Cliente"} · ${fecha}`}
                        leftExtra={solicitud.fechaRespuestaEstimada && (
                            <p className="text-[11px] text-amber-600 mt-0.5">
                                ⏱ Resp. estimada: {new Date(solicitud.fechaRespuestaEstimada + "T12:00:00").toLocaleDateString("es-CO")}
                            </p>
                        )}
                        rightExtra={solicitud.fotos?.length > 0 && (
                            <span className="text-[10px] text-ink/40">
                                📎 {solicitud.fotos.length} foto{solicitud.fotos.length > 1 ? "s" : ""}
                            </span>
                        )}
                    />
                </button>
                {/* Botón eliminar — solo admin */}
                {isAdmin && (
                <button
                    type="button"
                    onClick={handleEliminar}
                    disabled={deleting}
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-ink/30 hover:text-red-500 hover:bg-red-50 transition-colors mt-0.5"
                    title="Eliminar solicitud"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
                )}
            </div>

            {/* Detalle expandido */}
            {expanded && (
                <div className="space-y-4 pt-1 border-t border-sand">

                    {/* ── ADMIN: propuesta pendiente de jurídica ── */}
                    {isAdmin && solicitud.respuestaPropuesta && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                                <p className="text-[12px] font-semibold text-amber-800">
                                    Propuesta de Jurídica — pendiente de aprobación
                                </p>
                            </div>
                            <div className="rounded-xl bg-white border border-amber-200 px-3 py-2.5 space-y-1.5">
                                <p className="text-[11px] text-amber-700/60">
                                    Por: <span className="font-semibold">{solicitud.respuestaPropuesta.propuestoPor || "Jurídica"}</span>
                                </p>
                                <p className="text-[13px] text-ink/80 leading-relaxed whitespace-pre-wrap">
                                    {solicitud.respuestaPropuesta.texto}
                                </p>
                                {solicitud.respuestaPropuesta.archivo?.url && (
                                    <a href={solicitud.respuestaPropuesta.archivo.url} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 hover:underline">
                                        <AttachIcon />
                                        {solicitud.respuestaPropuesta.archivo.name || "Archivo adjunto"}
                                    </a>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowRechazarModal(true)}
                                    disabled={aprobandoPropuesta}
                                    className="flex-1 py-2 rounded-full text-[12px] font-medium border border-red-300 text-red-600 hover:bg-red-50 transition disabled:opacity-50">
                                    Rechazar
                                </button>
                                <button type="button" onClick={aprobarPropuesta}
                                    disabled={aprobandoPropuesta}
                                    className="flex-1 py-2 rounded-full text-[12px] font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50">
                                    {aprobandoPropuesta ? "Aprobando…" : "✓ Aprobar y habilitar correo"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── JURÍDICA: estado de su propuesta ── */}
                    {isJuridico && solicitud.respuestaPropuesta?.propuestoPorUid === user?.uid && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0 mt-1" />
                            <div>
                                <p className="text-[12px] font-semibold text-amber-800">Tu propuesta está en revisión</p>
                                <p className="text-[11px] text-amber-700/70 mt-0.5">Luisa la aprobará antes de que puedas enviar el correo al cliente.</p>
                            </div>
                        </div>
                    )}
                    {isJuridico && solicitud.propuestaRechazada?.propuestoPorUid === user?.uid && !solicitud.respuestaPropuesta && !solicitud.aprobadaParaCorreo && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                <p className="text-[12px] font-semibold text-red-800">Tu propuesta fue rechazada</p>
                            </div>
                            <div className="rounded-xl bg-white border border-red-200 px-3 py-2">
                                <p className="text-[11px] text-ink/60 font-semibold uppercase tracking-wide mb-0.5">Motivo</p>
                                <p className="text-[12px] text-red-800 leading-snug">{solicitud.propuestaRechazada.motivo}</p>
                            </div>
                            <p className="text-[11px] text-red-700/70">Puedes enviar una nueva propuesta corregida.</p>
                        </div>
                    )}

                    {/* ── Descripción ── */}
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold mb-1">Descripción completa</p>
                        <p className="text-[13px] text-ink/70 leading-relaxed whitespace-pre-wrap">{solicitud.descripcion}</p>
                    </div>

                    {/* ── Fotos ── */}
                    {solicitud.fotos?.length > 0 && (
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold mb-2">Fotos adjuntas</p>
                            <FotoGallery fotos={solicitud.fotos} />
                        </div>
                    )}

                    {/* ── Cambiar estado — SOLO ADMIN ── */}
                    {isAdmin && (
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold mb-2">Estado de la solicitud</p>
                            <div className="flex gap-2">
                                {ESTADOS.map(estado => (
                                    <button key={estado} type="button"
                                        onClick={() => cambiarEstado(estado)}
                                        disabled={changingEstado}
                                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-medium border transition-all disabled:opacity-50 ${
                                            solicitud.estado !== estado
                                                ? "bg-white text-ink/50 border-ink/15 hover:border-ink/30"
                                                : estado === "resuelto" ? "bg-emerald-500 text-white border-emerald-500"
                                                : estado === "en_revision" ? "bg-blue-500 text-white border-blue-500"
                                                : "bg-amber-400 text-white border-amber-400"
                                        }`}>
                                        {ESTADO_LABEL[estado]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Panel confirmar resolución (admin marca como Resuelto) ── */}
                    {showResolucion && isAdmin && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                            <p className="text-[12px] font-semibold text-emerald-700">Confirmar resolución</p>
                            <p className="text-[11px] text-emerald-700/70 leading-relaxed">Adjunta el documento de prueba (opcional) antes de marcar como resuelta.</p>
                            <div>
                                <input ref={pruebaInputRef} type="file"
                                    onChange={e => setPruebaArchivo(e.target.files?.[0] || null)} className="hidden" />
                                <button type="button" onClick={() => pruebaInputRef.current?.click()}
                                    className="w-full border-2 border-dashed border-emerald-300 rounded-xl py-2.5 text-[12px] text-emerald-600 hover:border-emerald-400 transition-all flex items-center justify-center gap-2">
                                    <AttachIcon />
                                    {pruebaArchivo ? pruebaArchivo.name : "Adjuntar prueba de resolución (PDF, imagen…)"}
                                </button>
                                {pruebaArchivo && (
                                    <button type="button"
                                        onClick={() => { setPruebaArchivo(null); if (pruebaInputRef.current) pruebaInputRef.current.value = ""; }}
                                        className="text-[11px] text-ink/40 hover:text-red-500 mt-1 ml-1">× Quitar adjunto</button>
                                )}
                            </div>
                            {savingResolucion && pruebaArchivo && <UploadProgress progress={uploadProgressPrueba} label="Subiendo prueba…" />}
                            <div className="flex gap-2">
                                <button type="button" onClick={() => { setShowResolucion(false); setPruebaArchivo(null); }}
                                    disabled={savingResolucion} className="flex-1 btn-outline text-[12px] disabled:opacity-50">Cancelar</button>
                                <button type="button" onClick={confirmarResolucion}
                                    disabled={savingResolucion}
                                    className="flex-1 py-2 rounded-full text-[12px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50">
                                    {savingResolucion ? "Guardando…" : "Confirmar resolución"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Panel de correo: aparece cuando la respuesta fue aprobada O solicitud resuelta ── */}
                    {(solicitud.aprobadaParaCorreo && (isAdmin || solicitud.aprobadaParaCorreo.propuestoPorUid === user?.uid)) && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 space-y-2.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[14px]">✅</span>
                                <p className="text-[12px] font-semibold text-emerald-700">Respuesta aprobada — lista para enviar</p>
                            </div>
                            {solicitud.aprobadaParaCorreo.archivo?.url && (
                                <a href={solicitud.aprobadaParaCorreo.archivo.url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 border border-emerald-200 text-[11px] text-emerald-700 hover:bg-white transition">
                                    <AttachIcon />
                                    <span className="flex-1 truncate font-medium">{solicitud.aprobadaParaCorreo.archivo.name}</span>
                                    <span className="text-[10px] text-emerald-600/60 flex-shrink-0">Descargar y adjuntar</span>
                                </a>
                            )}
                            <button type="button" onClick={abrirCorreoResolucion} disabled={!clientEmail}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold transition disabled:opacity-40 active:scale-[0.98]">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {clientEmail ? "Preparar correo al cliente" : "Cargando correo…"}
                            </button>
                            <p className="text-[10px] text-emerald-700/60 text-center leading-snug">
                                Descarga el documento de arriba y adjúntalo manualmente antes de enviar.
                            </p>
                        </div>
                    )}

                    {/* ── Panel resuelto (sin aprobadaParaCorreo, flujo directo admin) ── */}
                    {solicitud.estado === "resuelto" && !solicitud.aprobadaParaCorreo && isAdmin && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 space-y-2.5">
                            <p className="text-[11px] font-semibold text-emerald-700">Solicitud resuelta</p>
                            {solicitud.resolucionPrueba?.url ? (
                                <a href={solicitud.resolucionPrueba.url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 border border-emerald-200 text-[11px] text-emerald-700 hover:bg-white transition">
                                    <AttachIcon />
                                    <span className="flex-1 truncate font-medium">{solicitud.resolucionPrueba.name || "Documento de prueba"}</span>
                                    <span className="text-[10px] text-emerald-600/60 flex-shrink-0">Descargar</span>
                                </a>
                            ) : (
                                <p className="text-[11px] text-emerald-600/60 italic">Sin documento de prueba adjunto.</p>
                            )}
                            <button type="button" onClick={abrirCorreoResolucion} disabled={!clientEmail}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold transition disabled:opacity-40 active:scale-[0.98]">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {clientEmail ? "Preparar correo al cliente" : "Cargando correo…"}
                            </button>
                            {solicitud.resolucionPrueba?.url && (
                                <p className="text-[10px] text-emerald-700/60 text-center">
                                    El enlace de descarga queda en el correo. Descárgalo y adjúntalo antes de enviar.
                                </p>
                            )}
                        </div>
                    )}

                    {/* ── Respuestas registradas ── */}
                    <RespuestasGarantia respuestas={solicitud.respuestas} titulo="Respuestas registradas" />

                    {/* ── Formulario de respuesta/propuesta ── */}
                    {/* Admin: siempre puede agregar si no está resuelto */}
                    {/* Jurídica: solo si NO hay propuesta pendiente propia NI aprobadaParaCorreo activa */}
                    {solicitud.estado !== "resuelto" && !(isJuridico && solicitud.respuestaPropuesta?.propuestoPorUid === user?.uid) && !(isJuridico && solicitud.aprobadaParaCorreo) && (
                        <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">
                                {isJuridico ? "Proponer respuesta" : "Agregar respuesta"}
                            </p>
                            {isJuridico && (
                                <p className="text-[11px] text-ink/45 leading-snug -mt-1">
                                    Luisa aprobará tu propuesta antes de que puedas enviar el correo al cliente.
                                </p>
                            )}
                            <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)}
                                placeholder={isJuridico ? "Escribe la respuesta propuesta para el cliente…" : "Escribe una respuesta al cliente…"}
                                rows={3} className="input w-full resize-none text-[13px]" />
                            <div>
                                <input ref={fileInputRef} type="file"
                                    onChange={e => setArchivoRespuesta(e.target.files?.[0] || null)} className="hidden" />
                                <button type="button" onClick={() => fileInputRef.current?.click()}
                                    className="w-full border-2 border-dashed border-ink/20 rounded-xl py-2.5 text-[12px] text-ink/50 hover:border-ink/40 hover:text-ink/70 transition-all flex items-center justify-center gap-2">
                                    <AttachIcon />
                                    {archivoRespuesta ? archivoRespuesta.name : "Adjuntar documento (opcional)"}
                                </button>
                                {archivoRespuesta && (
                                    <button type="button"
                                        onClick={() => { setArchivoRespuesta(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                        className="text-[11px] text-ink/40 hover:text-red-500 mt-1 ml-1">× Quitar adjunto</button>
                                )}
                            </div>
                            {saving && archivoRespuesta && <UploadProgress progress={uploadProgress} label="Subiendo archivo…" />}

                            <button
                                type="button"
                                onClick={enviarRespuesta}
                                disabled={saving || (!respuesta.trim() && !archivoRespuesta)}
                                className="w-full btn-primary text-[13px] disabled:opacity-50"
                            >
                                {saving ? (isJuridico ? "Enviando propuesta…" : "Enviando…") : (isJuridico ? "Enviar propuesta al admin" : "Enviar respuesta")}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
        </>
    );
}

TarjetaSolicitudAdmin.propTypes = {
    solicitud: PropTypes.object.isRequired,
    projectId: PropTypes.string.isRequired,
    user: PropTypes.object,
};
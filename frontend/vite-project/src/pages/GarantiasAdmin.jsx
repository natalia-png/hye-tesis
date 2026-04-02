// src/pages/GarantiasAdmin.jsx
// Módulo de Garantías y Posventa — Vista Admin (Luisa)
// Luisa puede ver todas las solicitudes, responder y cambiar el estado

import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, updateDoc, arrayUnion, deleteDoc } from "firebase/firestore";
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

export default function GarantiasAdmin() {
    const { id: projectId } = useParams();
    const nav = useNavigate();
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
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

GarantiasAdmin.propTypes = {};

/* ── TARJETA SOLICITUD (vista admin) ── */
function TarjetaSolicitudAdmin({ solicitud, projectId }) {
    const [expanded, setExpanded] = useState(false);
    const [respuesta, setRespuesta] = useState("");
    const [archivoRespuesta, setArchivoRespuesta] = useState(null);
    const [saving, setSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [changingEstado, setChangingEstado] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const fileInputRef = useRef(null);

    const fecha = calcFechaSolicitud(solicitud);

    const solRef = doc(db, "garantias", projectId, "solicitudes", solicitud.id);

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
        setChangingEstado(true);
        try {
            await updateDoc(solRef, { estado: nuevoEstado });
        } catch (e) {
            console.error(e);
        } finally {
            setChangingEstado(false);
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

            await updateDoc(solRef, {
                respuestas: arrayUnion({
                    texto: respuesta.trim() || "",
                    archivo: archivoData,
                    fecha: new Date(),
                    autor: "Luisa — H&E Arquitectos",
                }),
                ...(solicitud.estado === "pendiente" ? { estado: "en_revision" } : {}),
            });

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
            </div>

            {/* Detalle expandido */}
            {expanded && (
                <div className="space-y-4 pt-1 border-t border-sand">

                    {/* Descripción completa */}
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold mb-1">
                            Descripción completa
                        </p>
                        <p className="text-[13px] text-ink/70 leading-relaxed whitespace-pre-wrap">
                            {solicitud.descripcion}
                        </p>
                    </div>

                    {/* Fotos */}
                    {solicitud.fotos?.length > 0 && (
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold mb-2">
                                Fotos adjuntas
                            </p>
                            <FotoGallery fotos={solicitud.fotos} />
                        </div>
                    )}

                    {/* Cambiar estado */}
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold mb-2">
                            Estado de la solicitud
                        </p>
                        <div className="flex gap-2">
                            {ESTADOS.map(estado => (
                                <button
                                    key={estado}
                                    type="button"
                                    onClick={() => cambiarEstado(estado)}
                                    disabled={changingEstado}
                                    className={`flex-1 py-1.5 rounded-xl text-[11px] font-medium border transition-all disabled:opacity-50 ${(() => {
                                            if (solicitud.estado !== estado) { return "bg-white text-ink/50 border-ink/15 hover:border-ink/30"; }
                                            if (estado === "resuelto") { return "bg-emerald-500 text-white border-emerald-500"; }
                                            if (estado === "en_revision") { return "bg-blue-500 text-white border-blue-500"; }
                                            return "bg-amber-400 text-white border-amber-400";
                                        })()}`}
                                >
                                    {ESTADO_LABEL[estado]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Respuestas anteriores */}
                    <RespuestasGarantia respuestas={solicitud.respuestas} titulo="Respuestas enviadas" />

                    {/* Agregar respuesta */}
                    {solicitud.estado !== "resuelto" && (
                        <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">
                                Agregar respuesta
                            </p>
                            <textarea
                                value={respuesta}
                                onChange={e => setRespuesta(e.target.value)}
                                placeholder="Escribe una respuesta al cliente… (opcional si adjuntas archivo)"
                                rows={3}
                                className="input w-full resize-none text-[13px]"
                            />

                            {/* Adjunto */}
                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={e => setArchivoRespuesta(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full border-2 border-dashed border-ink/20 rounded-xl py-2.5 text-[12px] text-ink/50 hover:border-ink/40 hover:text-ink/70 transition-all flex items-center justify-center gap-2"
                                >
                                    <AttachIcon />
                                    {archivoRespuesta ? archivoRespuesta.name : "Adjuntar documento (opcional)"}
                                </button>
                                {archivoRespuesta && (
                                    <button
                                        type="button"
                                        onClick={() => { setArchivoRespuesta(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                        className="text-[11px] text-ink/40 hover:text-red-500 mt-1 ml-1"
                                    >
                                        × Quitar adjunto
                                    </button>
                                )}
                            </div>

                            {/* Progreso subida */}
                            {saving && archivoRespuesta && (
                                <UploadProgress progress={uploadProgress} label="Subiendo archivo…" />
                            )}

                            <button
                                type="button"
                                onClick={enviarRespuesta}
                                disabled={saving || (!respuesta.trim() && !archivoRespuesta)}
                                className="w-full btn-primary text-[13px] disabled:opacity-50"
                            >
                                {saving ? "Enviando…" : "Enviar respuesta"}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

TarjetaSolicitudAdmin.propTypes = {
    solicitud: PropTypes.object.isRequired,
    projectId: PropTypes.string.isRequired,
};
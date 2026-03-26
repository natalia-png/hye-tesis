// src/pages/GarantiasAdmin.jsx
// Módulo de Garantías y Posventa — Vista Admin (Luisa)
// Luisa puede ver todas las solicitudes, responder y cambiar el estado

import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    collection, onSnapshot, orderBy, query,
    doc, getDoc, updateDoc, arrayUnion,
} from "firebase/firestore";
import { db, storage } from "../lib/firebase";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import PropTypes from "prop-types";
import { ESTADOS, ESTADO_LABEL, calcFechaSolicitud } from "../data/garantias";
import SolicitudCardHeader from "../components/garantias/SolicitudCardHeader";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import FiltroTabs from "../components/ui/FiltroTabs";
import FotoGallery from "../components/garantias/FotoGallery";
import RespuestasGarantia from "../components/garantias/RespuestasGarantia";

export default function GarantiasAdmin() {
    const { id: projectId } = useParams();
    const nav = useNavigate();

    const [projectName, setProjectName] = useState("");
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState("todas");

    useEffect(() => {
        getDoc(doc(db, "projects", projectId)).then(snap => {
            if (snap.exists()) {
                const d = snap.data();
                setProjectName(d.name || d.nombre || "Proyecto");
            }
        }).catch(() => {});
    }, [projectId]);

    useEffect(() => {
        const q = query(
            collection(db, "garantias", projectId, "solicitudes"),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(q, snap => {
            setSolicitudes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, () => setLoading(false));
        return () => { try { unsub(); } catch (_e) { /* ignore */ } };
    }, [projectId]);

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
                    {solicitudes.length} solicitud{solicitudes.length !== 1 ? "es" : ""} en total
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
            {loading ? (
                <LoadingSpinner />
            ) : filtradas.length === 0 ? (
                <div className="card text-center py-10 space-y-2">
                    <p className="text-3xl">✅</p>
                    <p className="text-[13px] text-ink/60">
                        {filtro === "todas"
                            ? "Sin solicitudes de garantía"
                            : `Sin solicitudes ${ESTADO_LABEL[filtro]?.toLowerCase()}`}
                    </p>
                </div>
            ) : (
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
    const fileInputRef = useRef(null);

    const fecha = calcFechaSolicitud(solicitud);

    const solRef = doc(db, "garantias", projectId, "solicitudes", solicitud.id);

    const cambiarEstado = async (nuevoEstado) => {
        if (nuevoEstado === solicitud.estado) return;
        setChangingEstado(true);
        try {
            await updateDoc(solRef, { estado: nuevoEstado });
        } catch (_e) { /* ignored */
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
        } catch (_e) { /* ignored */
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`card space-y-3 ${solicitud.prioridad === "urgente" ? "border-l-4 border-l-red-400" : ""}`}>

            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="w-full text-left"
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
                    leftExtra={solicitud.fechaLimite && (
                        <p className="text-[11px] text-amber-600 mt-0.5">
                            ⏱ Límite: {new Date(solicitud.fechaLimite).toLocaleDateString("es-CO")}
                        </p>
                    )}
                    rightExtra={solicitud.fotos?.length > 0 && (
                        <span className="text-[10px] text-ink/40">
                            📎 {solicitud.fotos.length} foto{solicitud.fotos.length > 1 ? "s" : ""}
                        </span>
                    )}
                />
            </button>

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
                                    className={`flex-1 py-1.5 rounded-xl text-[11px] font-medium border transition-all disabled:opacity-50 ${solicitud.estado === estado
                                            ? estado === "resuelto"
                                                ? "bg-emerald-500 text-white border-emerald-500"
                                                : estado === "en_revision"
                                                    ? "bg-blue-500 text-white border-blue-500"
                                                    : "bg-amber-400 text-white border-amber-400"
                                            : "bg-white text-ink/50 border-ink/15 hover:border-ink/30"
                                        }`}
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
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
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
                            {saving && archivoRespuesta && uploadProgress > 0 && (
                                <div className="space-y-1">
                                    <div className="h-1.5 bg-sand rounded-full overflow-hidden">
                                        <div className="h-full bg-ink rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                    <p className="text-[11px] text-ink/50">Subiendo archivo… {uploadProgress}%</p>
                                </div>
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
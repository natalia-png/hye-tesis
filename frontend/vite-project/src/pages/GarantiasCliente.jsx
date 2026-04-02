// src/pages/GarantiasCliente.jsx
// Módulo de Garantías y Posventa — Vista del Cliente
// El cliente puede crear solicitudes y ver el estado de cada una

import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    collection, addDoc, serverTimestamp, getDocs, query, where, deleteDoc, doc,
} from "firebase/firestore";
import {
    ref as storageRef, uploadBytesResumable, getDownloadURL,
} from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { createNotification } from "../lib/notifications";
import { useAuth } from "../app/useAuth";
import PropTypes from "prop-types";
import { calcFechaSolicitud } from "../data/garantias";
import { useGarantiasSolicitudes } from "../hooks/useGarantiasSolicitudes";
import SolicitudCardHeader from "../components/garantias/SolicitudCardHeader";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import FotoGallery from "../components/garantias/FotoGallery";
import RespuestasGarantia from "../components/garantias/RespuestasGarantia";
import UploadProgress from "../components/ui/UploadProgress";

const PRIORIDAD = { urgente: "Urgente", normal: "Normal" };

/** Calcula fecha sumando N días hábiles (lun–vie) desde hoy */
function sumarDiasHabiles(diasHabiles) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    let contados = 0;
    while (contados < diasHabiles) {
        d.setDate(d.getDate() + 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) contados++;
    }
    return d;
}

export default function GarantiasCliente() {
    const { id: projectId } = useParams();
    const nav = useNavigate();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);

    const { projectName, solicitudes, loading } = useGarantiasSolicitudes(projectId);

    return (
        <section className="space-y-4">

            {/* Back */}
            <button
                onClick={() => nav(`/mis-proyectos/${projectId}`)}
                className="text-[12px] text-ink/60 hover:text-ink inline-flex items-center gap-1"
            >
                ‹ Volver al proyecto
            </button>

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                        {projectName}
                    </p>
                    <h1 className="text-[20px] font-bold text-ink leading-tight">
                        Garantías y Posventa
                    </h1>
                    <p className="text-[12px] text-ink/50 mt-0.5">
                        Reporta problemas o solicitudes posteriores a la entrega
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex-shrink-0 btn-primary text-[13px] px-4 py-2"
                >
                    + Nueva
                </button>
            </div>

            {/* Formulario nueva solicitud */}
            {showForm && (
                <FormNuevaSolicitud
                    projectId={projectId}
                    userId={user?.uid}
                    userName={user?.displayName || user?.email || "Cliente"}
                    onClose={() => setShowForm(false)}
                />
            )}

            {/* Lista de solicitudes */}
            {loading && <LoadingSpinner text="Cargando solicitudes…" />}
            {!loading && solicitudes.length === 0 && (
                <div className="card text-center py-10 space-y-2">
                    <p className="text-3xl">🛡️</p>
                    <p className="text-[14px] font-medium text-ink/70">
                        Sin solicitudes de garantía
                    </p>
                    <p className="text-[12px] text-ink/40">
                        Cuando necesites reportar un problema, usa el botón &quot;+ Nueva&quot;
                    </p>
                </div>
            )}
            {!loading && solicitudes.length > 0 && (
                <div className="space-y-3">
                    {solicitudes.map(s => (
                        <TarjetaSolicitudCliente key={s.id} solicitud={s} projectId={projectId} userId={user?.uid} />
                    ))}
                </div>
            )}
        </section>
    );
}

GarantiasCliente.propTypes = {};

/* ── FORMULARIO NUEVA SOLICITUD ── */
function FormNuevaSolicitud({ projectId, userId, userName, onClose }) {
    const [descripcion, setDescripcion] = useState("");
    const [prioridad, setPrioridad] = useState("normal");
    const [fotos, setFotos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progreso, setProgreso] = useState(0);
    const [saving, setSaving] = useState(false);
    const fileRef = useRef();

    const fechaEstimada = sumarDiasHabiles(5).toLocaleDateString("es-CO", {
        day: "2-digit", month: "long", year: "numeric",
    });

    const handleFotos = (e) => {
        const files = Array.from(e.target.files || []);
        const validos = files.filter(f => f.type.startsWith("image/")).slice(0, 4);
        setFotos(validos);
    };

    const handleSubmit = async () => {
        if (!descripcion.trim()) return;
        setSaving(true);

        try {
            // 1. Subir fotos si hay
            const fotosURLs = [];
            if (fotos.length > 0) {
                setUploading(true);
                for (let i = 0; i < fotos.length; i++) {
                    const foto = fotos[i];
                    const path = `garantias/${projectId}/${Date.now()}_${foto.name}`;
                    const sRef = storageRef(storage, path);
                    await new Promise((res, rej) => {
                        const task = uploadBytesResumable(sRef, foto);
                        task.on("state_changed",
                            snap => setProgreso(Math.round(((i + snap.bytesTransferred / snap.totalBytes) / fotos.length) * 100)),
                            rej,
                            async () => {
                                const url = await getDownloadURL(task.snapshot.ref);
                                fotosURLs.push({ url, name: foto.name, path });
                                res();
                            }
                        );
                    });
                }
                setUploading(false);
            }

            // 2. Guardar en Firestore — fechaRespuestaEstimada calculada automáticamente
            const fechaRespuestaEstimada = sumarDiasHabiles(5).toISOString().split("T")[0];
            await addDoc(collection(db, "garantias", projectId, "solicitudes"), {
                descripcion: descripcion.trim(),
                prioridad,
                fechaRespuestaEstimada,
                fotos: fotosURLs,
                estado: "pendiente",
                creadoPor: userId,
                nombreCliente: userName,
                createdAt: serverTimestamp(),
                respuestas: [],
            });

            // 3. Notificar a admins y colaboradores
            try {
                const snap = await getDocs(
                    query(collection(db, "users"), where("role", "in", ["admin", "colaborador"]))
                );
                await Promise.all(snap.docs.map(d =>
                    createNotification(d.id, {
                        type: "nueva_garantia",
                        title: "🔧 Nueva solicitud de garantía",
                        body: `${userName}: ${descripcion.trim().slice(0, 80)}`,
                        projectId,
                    })
                ));
            } catch (e) { console.error("Error notificando garantía:", e); }

            onClose();
        } catch (e) {
            console.error(e);
            alert("Ocurrió un error. Intenta de nuevo.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="card space-y-4 border-2 border-ink/10">
            <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-ink">Nueva solicitud</h2>
                <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">×</button>
            </div>

            {/* Banner SLA */}
            <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-ink/[0.04] border border-ink/8">
                <span className="text-base flex-shrink-0 mt-0.5">🕐</span>
                <div>
                    <p className="text-[12px] font-semibold text-ink leading-tight">
                        Tiempo de respuesta: máximo 5 días hábiles
                    </p>
                    <p className="text-[11px] text-ink/50 mt-0.5 leading-relaxed">
                        Nuestro equipo revisará tu solicitud y se pondrá en contacto contigo
                        a más tardar el <strong className="text-ink/70">{fechaEstimada}</strong>.
                    </p>
                </div>
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
                <label htmlFor="garantia-descripcion" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink/50">
                    Descripción del problema *
                </label>
                <textarea
                    id="garantia-descripcion"
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    placeholder="Describe detalladamente el problema o solicitud…"
                    rows={4}
                    className="input w-full resize-none text-[13px]"
                />
            </div>

            {/* Prioridad */}
            <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink/50">
                    Prioridad
                </p>
                <div className="flex gap-2">
                    {Object.entries(PRIORIDAD).map(([val, label]) => {
                        let btnCls = "bg-white text-ink/60 border-ink/15 hover:border-ink/30";
                        if (prioridad === val) {
                            btnCls = val === "urgente" ? "bg-red-500 text-white border-red-500" : "bg-ink text-ivory border-ink";
                        }
                        const iconPrefix = val === "urgente" ? "🚨 " : "📋 ";
                        return (
                            <button
                                key={val}
                                type="button"
                                onClick={() => setPrioridad(val)}
                                className={`flex-1 py-2 rounded-xl text-[13px] font-medium border transition-all ${btnCls}`}
                            >
                                {iconPrefix}{label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Fotos */}
            <div className="space-y-1.5">
                <label htmlFor="garantia-fotos" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink/50">
                    Fotos adjuntas (máx. 4)
                </label>
                <input
                    id="garantia-fotos"
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFotos}
                    className="hidden"
                />
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-ink/20 rounded-xl py-3 text-[12px] text-ink/50 hover:border-ink/40 hover:text-ink/70 transition-all"
                >
                    {fotos.length > 0
                        ? `${fotos.length} foto${fotos.length === 1 ? "" : "s"} seleccionada${fotos.length === 1 ? "" : "s"}`
                        : "Toca para adjuntar fotos"}
                </button>

                {fotos.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        {fotos.map((f) => (
                            <img
                                key={f.name}
                                src={URL.createObjectURL(f)}
                                alt={f.name}
                                className="w-16 h-16 rounded-xl object-cover border border-ink/10"
                            />
                        ))}
                    </div>
                )}

                {uploading && (
                    <UploadProgress progress={progreso} label="Subiendo fotos…" />
                )}
            </div>

            {/* Botones */}
            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 btn-outline text-[13px]"
                    disabled={saving}
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving || !descripcion.trim()}
                    className="flex-1 btn-primary text-[13px] disabled:opacity-50"
                >
                    {saving ? "Enviando…" : "Enviar solicitud"}
                </button>
            </div>
        </div>
    );
}

/* ── TARJETA SOLICITUD (vista cliente) ── */
function TarjetaSolicitudCliente({ solicitud, projectId, userId }) {
    const [expanded, setExpanded] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const fecha = calcFechaSolicitud(solicitud);

    const handleEliminar = async (e) => {
        e.stopPropagation();
        if (!confirm("¿Eliminar esta solicitud? Esta acción no se puede deshacer.")) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, "garantias", projectId, "solicitudes", solicitud.id));
        } catch (err) {
            console.error(err);
            alert("No se pudo eliminar. Intenta de nuevo.");
            setDeleting(false);
        }
    };

    const puedeEliminar = solicitud.creadoPor === userId && solicitud.estado === "pendiente";

    // Fecha estimada de respuesta
    const fechaEstimadaLabel = (() => {
        const f = solicitud.fechaRespuestaEstimada;
        if (!f) return null;
        return new Date(f + "T12:00:00").toLocaleDateString("es-CO", {
            day: "2-digit", month: "long", year: "numeric",
        });
    })();

    return (
        <div className="card space-y-3">
            {/* Header */}
            <div className="flex items-start gap-2">
                <button
                    type="button"
                    onClick={() => setExpanded(e => !e)}
                    className="flex-1 text-left space-y-2"
                >
                    <SolicitudCardHeader
                        solicitud={solicitud}
                        expanded={expanded}
                        subText={fecha}
                        rightExtra={solicitud.prioridad === "urgente" && (
                            <span className="text-[10px] text-red-500 font-semibold">🚨 Urgente</span>
                        )}
                    />
                </button>
                {puedeEliminar && (
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

            {/* Fecha estimada — siempre visible si no está resuelta */}
            {fechaEstimadaLabel && solicitud.estado !== "resuelto" && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-ink/[0.03] border border-ink/8">
                    <span className="text-[11px]">🕐</span>
                    <p className="text-[11px] text-ink/55">
                        Respuesta estimada: <span className="font-medium text-ink/75">{fechaEstimadaLabel}</span>
                    </p>
                </div>
            )}

            {/* Detalle expandido */}
            {expanded && (
                <div className="space-y-3 pt-1 border-t border-sand">

                    {/* Fotos */}
                    {solicitud.fotos?.length > 0 && (
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold mb-2">Fotos</p>
                            <FotoGallery fotos={solicitud.fotos} size="w-20 h-20" />
                        </div>
                    )}

                    {/* Respuestas del equipo */}
                    <RespuestasGarantia respuestas={solicitud.respuestas} titulo="Respuestas del equipo" />

                    {solicitud.estado === "resuelto" && (
                        <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2">
                            <span className="text-emerald-500">✓</span>
                            <p className="text-[12px] text-emerald-700 font-medium">
                                Esta solicitud ha sido resuelta
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

FormNuevaSolicitud.propTypes = {
    projectId: PropTypes.string.isRequired,
    userId: PropTypes.string,
    userName: PropTypes.string,
    onClose: PropTypes.func.isRequired,
};

TarjetaSolicitudCliente.propTypes = {
    solicitud: PropTypes.object.isRequired,
    projectId: PropTypes.string,
    userId: PropTypes.string,
};

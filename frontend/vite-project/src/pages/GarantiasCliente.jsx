// src/pages/GarantiasCliente.jsx
// Módulo de Garantías y Posventa — Vista del Cliente
// El cliente puede crear solicitudes y ver el estado de cada una

import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    collection, addDoc, onSnapshot, orderBy,
    query, serverTimestamp, doc, getDoc, getDocs,
} from "firebase/firestore";
import {
    ref as storageRef, uploadBytesResumable, getDownloadURL,
} from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import PropTypes from "prop-types";
import { ESTADO_LABEL, ESTADO_STYLE } from "../data/garantias";

const PRIORIDAD = { urgente: "Urgente", normal: "Normal" };

export default function GarantiasCliente() {
    const { id: projectId } = useParams();
    const nav = useNavigate();
    const { user } = useAuth();

    const [projectName, setProjectName] = useState("");
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Cargar nombre del proyecto
    useEffect(() => {
        getDoc(doc(db, "projects", projectId)).then(snap => {
            if (snap.exists()) {
                const d = snap.data();
                setProjectName(d.name || d.nombre || "Proyecto");
            }
        }).catch(() => {});
    }, [projectId]);

    // Escuchar solicitudes en tiempo real
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
            {loading ? (
                <div className="flex items-center gap-2 py-6">
                    <div className="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
                    <p className="text-[13px] text-ink/50">Cargando solicitudes…</p>
                </div>
            ) : solicitudes.length === 0 ? (
                <div className="card text-center py-10 space-y-2">
                    <p className="text-3xl">🛡️</p>
                    <p className="text-[14px] font-medium text-ink/70">
                        Sin solicitudes de garantía
                    </p>
                    <p className="text-[12px] text-ink/40">
                        Cuando necesites reportar un problema, usa el botón "+ Nueva"
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {solicitudes.map(s => (
                        <TarjetaSolicitudCliente key={s.id} solicitud={s} />
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
    const [fechaLimite, setFechaLimite] = useState("");
    const [fechasOcupadas, setFechasOcupadas] = useState(new Set());
    const [fotos, setFotos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progreso, setProgreso] = useState(0);
    const [saving, setSaving] = useState(false);
    const fileRef = useRef();

    // Cargar fechas ya ocupadas por otras solicitudes
    useEffect(() => {
        const cargarFechas = async () => {
            try {
                const snap = await getDocs(
                    collection(db, "garantias", projectId, "solicitudes")
                );
                const ocupadas = new Set();
                snap.docs.forEach(d => {
                    const f = d.data().fechaLimite;
                    if (f) ocupadas.add(f); // formato "YYYY-MM-DD"
                });
                setFechasOcupadas(ocupadas);
            } catch (_e) { /* ignored */ }
        };
        cargarFechas();
    }, [projectId]);

    // Fecha mínima = hoy + 5 días
    const fechaMin = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 5);
        return d.toISOString().split("T")[0];
    })();

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

            // 2. Guardar en Firestore
            await addDoc(collection(db, "garantias", projectId, "solicitudes"), {
                descripcion: descripcion.trim(),
                prioridad,
                fechaLimite: fechaLimite || null,
                fotos: fotosURLs,
                estado: "pendiente",
                creadoPor: userId,
                nombreCliente: userName,
                createdAt: serverTimestamp(),
                respuestas: [],
            });

            onClose();
        } catch (_e) { /* ignored */
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
                <label htmlFor="garantia-prioridad" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink/50">
                    Prioridad
                </label>
                <div className="flex gap-2">
                    {Object.entries(PRIORIDAD).map(([val, label]) => (
                        <button
                            key={val}
                            type="button"
                            onClick={() => setPrioridad(val)}
                            className={`flex-1 py-2 rounded-xl text-[13px] font-medium border transition-all ${prioridad === val
                                ? val === "urgente"
                                    ? "bg-red-500 text-white border-red-500"
                                    : "bg-ink text-ivory border-ink"
                                : "bg-white text-ink/60 border-ink/15 hover:border-ink/30"
                                }`}
                        >
                            {val === "urgente" ? "🚨 " : "📋 "}{label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Fecha límite */}
            <div className="space-y-1.5">
                <label htmlFor="garantia-fecha-limite" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink/50">
                    Fecha límite esperada — mínimo 5 días
                </label>
                <input
                    id="garantia-fecha-limite"
                    type="date"
                    value={fechaLimite}
                    onChange={e => {
                        const val = e.target.value;
                        if (fechasOcupadas.has(val)) {
                            alert("Esa fecha ya tiene una solicitud asignada. Por favor elige otra fecha.");
                            return;
                        }
                        setFechaLimite(val);
                    }}
                    min={fechaMin}
                    className="input w-full text-[13px]"
                />
                {fechaLimite && fechasOcupadas.has(fechaLimite) && (
                    <p className="text-[11px] text-red-500 mt-1">
                        ⚠ Esa fecha ya está ocupada. Elige otra.
                    </p>
                )}
                {fechasOcupadas.size > 0 && (
                    <p className="text-[11px] text-ink/40 mt-1">
                        {fechasOcupadas.size} fecha{fechasOcupadas.size > 1 ? "s" : ""} ya reservada{fechasOcupadas.size > 1 ? "s" : ""} en este proyecto.
                    </p>
                )}
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
                        ? `${fotos.length} foto${fotos.length > 1 ? "s" : ""} seleccionada${fotos.length > 1 ? "s" : ""}`
                        : "Toca para adjuntar fotos"}
                </button>

                {/* Preview fotos */}
                {fotos.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        {fotos.map((f, i) => (
                            <div key={i} className="relative">
                                <img
                                    src={URL.createObjectURL(f)}
                                    alt={f.name}
                                    className="w-16 h-16 rounded-xl object-cover border border-ink/10"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Progreso de subida */}
                {uploading && (
                    <div className="space-y-1">
                        <div className="h-1.5 bg-sand rounded-full overflow-hidden">
                            <div
                                className="h-full bg-ink rounded-full transition-all"
                                style={{ width: `${progreso}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-ink/50">Subiendo fotos… {progreso}%</p>
                    </div>
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
                    disabled={saving || !descripcion.trim() || (fechaLimite && fechasOcupadas.has(fechaLimite))}
                    className="flex-1 btn-primary text-[13px] disabled:opacity-50"
                >
                    {saving ? "Enviando…" : "Enviar solicitud"}
                </button>
            </div>
        </div>
    );
}

/* ── TARJETA SOLICITUD (vista cliente) ── */
function TarjetaSolicitudCliente({ solicitud }) {
    const [expanded, setExpanded] = useState(false);

    const fecha = solicitud.createdAt?.toDate
        ? solicitud.createdAt.toDate().toLocaleDateString("es-CO", {
            day: "2-digit", month: "short", year: "numeric",
        })
        : "—";

    return (
        <div className="card space-y-3">
            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="w-full text-left space-y-2"
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-ink line-clamp-2">
                            {solicitud.descripcion}
                        </p>
                        <p className="text-[11px] text-ink/40 mt-0.5">{fecha}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {/* Estado */}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTADO_STYLE[solicitud.estado] || ESTADO_STYLE.pendiente}`}>
                            {ESTADO_LABEL[solicitud.estado] || solicitud.estado}
                        </span>
                        {/* Prioridad */}
                        {solicitud.prioridad === "urgente" && (
                            <span className="text-[10px] text-red-500 font-semibold">🚨 Urgente</span>
                        )}
                    </div>
                </div>

                {/* Flecha expand */}
                <div className="flex justify-end">
                    <svg
                        className={`w-4 h-4 text-ink/30 transition-transform ${expanded ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                        <polyline points="6 9 12 15 18 9" strokeWidth="2" />
                    </svg>
                </div>
            </button>

            {/* Detalle expandido */}
            {expanded && (
                <div className="space-y-3 pt-1 border-t border-sand">

                    {/* Fecha límite */}
                    {solicitud.fechaLimite && (
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Fecha límite</p>
                            <p className="text-[13px] text-ink/70 mt-0.5">
                                {new Date(solicitud.fechaLimite).toLocaleDateString("es-CO", {
                                    day: "2-digit", month: "long", year: "numeric",
                                })}
                            </p>
                        </div>
                    )}

                    {/* Fotos */}
                    {solicitud.fotos?.length > 0 && (
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold mb-2">Fotos</p>
                            <div className="flex gap-2 flex-wrap">
                                {solicitud.fotos.map((f, i) => (
                                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer">
                                        <img
                                            src={f.url}
                                            alt={f.name}
                                            className="w-20 h-20 rounded-xl object-cover border border-ink/10 hover:opacity-80 transition-opacity"
                                        />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Respuestas de Luisa */}
                    {solicitud.respuestas?.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">
                                Respuestas del equipo
                            </p>
                            {solicitud.respuestas.map((r, i) => (
                                <div key={i} className="bg-sand/60 rounded-xl px-3 py-2.5 space-y-2">
                                    {r.texto && <p className="text-[12px] text-ink/80 leading-relaxed">{r.texto}</p>}
                                    {r.archivo && (
                                        <a href={r.archivo.url} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-[11px] text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1.5">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                            </svg>
                                            {r.archivo.name}
                                        </a>
                                    )}
                                    <p className="text-[10px] text-ink/35">
                                        H&E Arquitectos · {r.fecha ? new Date(r.fecha.seconds * 1000).toLocaleDateString("es-CO") : "—"}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

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
};
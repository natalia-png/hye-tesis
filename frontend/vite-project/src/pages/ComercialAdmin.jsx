// src/pages/ComercialAdmin.jsx
// Panel administrativo — Gestión Comercial
// Luisa ve, filtra y gestiona solicitudes de prospectos

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    collection, onSnapshot, orderBy, query,
    doc, updateDoc, serverTimestamp, deleteDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import PropTypes from "prop-types";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ChevronIcon from "../components/ui/ChevronIcon";
import FiltroTabs from "../components/ui/FiltroTabs";

const ESTADOS = ["nueva", "en_analisis", "aprobada", "rechazada"];
const ESTADO_LABEL = {
    nueva: "Nueva",
    en_analisis: "En análisis",
    aprobada: "Aprobada",
    rechazada: "Rechazada",
};
const ESTADO_STYLE = {
    nueva: "bg-blue-50   text-blue-700   border-blue-200",
    en_analisis: "bg-amber-50  text-amber-700  border-amber-200",
    aprobada: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rechazada: "bg-red-50    text-red-700    border-red-200",
};

export default function ComercialAdmin() {
    const nav = useNavigate();
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState("todas");

    useEffect(() => {
        const q = query(
            collection(db, "solicitudesComerciales"),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(q, snap => {
            setSolicitudes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, () => setLoading(false));
        return () => { try { unsub(); } catch (e) { console.error(e); } };
    }, []);

    const filtradas = filtro === "todas"
        ? solicitudes
        : solicitudes.filter(s => s.estado === filtro);

    const conteo = {
        todas: solicitudes.length,
        nueva: solicitudes.filter(s => s.estado === "nueva").length,
        en_analisis: solicitudes.filter(s => s.estado === "en_analisis").length,
        aprobada: solicitudes.filter(s => s.estado === "aprobada").length,
        rechazada: solicitudes.filter(s => s.estado === "rechazada").length,
    };

    const conteoNuevaLabel = conteo.nueva === 0
        ? "Todo al día"
        : `${conteo.nueva} solicitud${conteo.nueva === 1 ? "" : "es"} nueva${conteo.nueva === 1 ? "" : "s"} sin revisar`;

    return (
        <section className="space-y-4">

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                        Módulo comercial
                    </p>
                    <h1 className="text-[20px] font-bold text-ink leading-tight">
                        Solicitudes de servicio
                    </h1>
                    <p className="text-[12px] text-ink/50 mt-0.5">
                        {conteoNuevaLabel}
                    </p>
                </div>
                {/* Link público para compartir */}
                <button
                    type="button"
                    onClick={() => {
                        const url = `${globalThis.location.origin}/solicitar`;
                        navigator.clipboard?.writeText(url);
                        alert("Link copiado:\n" + url);
                    }}
                    className="flex-shrink-0 btn-outline text-[11px] px-3 py-1.5 flex items-center gap-1.5"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copiar link
                </button>
            </div>

            {/* Filtros */}
            <FiltroTabs
                tabs={[
                    { key: "todas", label: "Todas" },
                    { key: "nueva", label: "Nuevas" },
                    { key: "en_analisis", label: "En análisis" },
                    { key: "aprobada", label: "Aprobadas" },
                    { key: "rechazada", label: "Rechazadas" },
                ]}
                filtro={filtro}
                conteo={conteo}
                onChange={setFiltro}
            />

            {/* Lista */}
            {loading && <LoadingSpinner text="Cargando solicitudes…" />}
            {!loading && filtradas.length === 0 && (
                <div className="card text-center py-10 space-y-2">
                    <p className="text-3xl">📋</p>
                    <p className="text-[13px] text-ink/60">
                        {filtro === "todas" ? "Aún no hay solicitudes" : `Sin solicitudes ${ESTADO_LABEL[filtro]?.toLowerCase()}`}
                    </p>
                    <p className="text-[11px] text-ink/40">
                        Comparte el link público para que los prospectos puedan cotizar.
                    </p>
                </div>
            )}
            {!loading && filtradas.length > 0 && (
                <div className="space-y-3">
                    {filtradas.map(s => (
                        <TarjetaSolicitud key={s.id} solicitud={s} nav={nav} />
                    ))}
                </div>
            )}
        </section>
    );
}

ComercialAdmin.propTypes = {};

/* ── TARJETA SOLICITUD ── */
function TarjetaSolicitud({ solicitud, nav }) {
    const [expanded, setExpanded] = useState(false);
    const [nota, setNota] = useState(solicitud.notaAdmin || "");
    const [saving, setSaving] = useState(false);
    const [cambiandoEstado, setCambiandoEstado] = useState(false);
    const [modalEmail, setModalEmail] = useState(null);
    const [enviandoEmail, setEnviandoEmail] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const fecha = solicitud.createdAt?.toDate
        ? solicitud.createdAt.toDate().toLocaleDateString("es-CO", {
            day: "2-digit", month: "short", year: "numeric",
        })
        : "—";

    const solRef = doc(db, "solicitudesComerciales", solicitud.id);

    const plantillaEmail = (estado) => {
        const nombre = solicitud.nombre?.split(" ")[0] || "";
        const aprobada = estado === "aprobada";
        return {
            estado,
            asunto: aprobada
                ? "¡Tu solicitud fue aprobada! — H&E Arquitectos"
                : "Actualización sobre tu solicitud — H&E Arquitectos",
            cuerpo: (() => {
                const notaExtra = nota ? "\nNota adicional:\n" + nota + "\n" : "";
                if (aprobada) {
                    return "Hola " + nombre + ",\n\nNos complace informarte que tu solicitud de servicio para " + solicitud.tipoObra + " ha sido aprobada por nuestro equipo.\n\nNos pondremos en contacto contigo muy pronto para coordinar una reunión inicial y comenzar con el proceso.\n" + notaExtra + "\nGracias por confiar en H&E Arquitectos.\n\nLuisa — H&E Arquitectos\nBogotá, Colombia";
                }
                return "Hola " + nombre + ",\n\nHemos revisado tu solicitud de servicio para " + solicitud.tipoObra + ".\n\nLamentablemente, en este momento no podemos continuar con tu solicitud.\n" + notaExtra + "\nSi tienes preguntas o deseas explorar otras opciones, no dudes en contactarnos.\n\nLuisa — H&E Arquitectos\nBogotá, Colombia";
            })(),
        };
    };

    const cambiarEstado = async (nuevoEstado) => {
        if (nuevoEstado === solicitud.estado) return;
        // Si es aprobada o rechazada, abrir modal de email primero
        if (nuevoEstado === "aprobada" || nuevoEstado === "rechazada") {
            setModalEmail(plantillaEmail(nuevoEstado));
            return;
        }
        // Para otros estados (nueva, en_analisis), cambiar directo
        setCambiandoEstado(true);
        try {
            await updateDoc(solRef, { estado: nuevoEstado, updatedAt: serverTimestamp() });
        } catch (e) {
            console.error(e);
        } finally {
            setCambiandoEstado(false);
        }
    };

    const confirmarEmailYCambiarEstado = async () => {
        if (!modalEmail) return;
        setEnviandoEmail(true);
        try {
            await updateDoc(solRef, {
                estado: modalEmail.estado,
                updatedAt: serverTimestamp(),
                respondidoAt: serverTimestamp(),
                notaAdmin: nota,
                emailEnviado: {
                    asunto: modalEmail.asunto,
                    cuerpo: modalEmail.cuerpo,
                    enviadoAt: new Date().toISOString(),
                },
            });
            setModalEmail(null);
        } catch (e) {
            console.error(e);
        } finally {
            setEnviandoEmail(false);
        }
    };

    const eliminarSolicitud = async () => {
        setDeleting(true);
        try {
            await deleteDoc(solRef);
        } catch (e) {
            console.error(e);
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    const guardarNota = async () => {
        setSaving(true);
        try {
            await updateDoc(solRef, { notaAdmin: nota, updatedAt: serverTimestamp() });
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const isNueva = solicitud.estado === "nueva";

    return (
        <div className={`card space-y-3 ${isNueva ? "border-l-4 border-l-blue-400" : ""}`}>

            {/* Header tarjeta */}
            <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="w-full text-left"
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-[14px] font-semibold text-ink truncate">
                                {solicitud.nombre}
                            </p>
                            {isNueva && (
                                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                            )}
                        </div>
                        <p className="text-[12px] text-ink/50 mt-0.5">
                            {solicitud.tipoObra} · {solicitud.ciudad || "Sin ciudad"} · {fecha}
                        </p>
                        <p className="text-[11px] text-ink/40 mt-0.5">
                            {solicitud.email}
                            {solicitud.telefono ? ` · ${solicitud.telefono}` : ""}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTADO_STYLE[solicitud.estado] || ESTADO_STYLE.nueva}`}>
                            {ESTADO_LABEL[solicitud.estado] || solicitud.estado}
                        </span>
                        {solicitud.presupuesto && (
                            <span className="text-[10px] text-ink/40">{solicitud.presupuesto}</span>
                        )}
                    </div>
                </div>
                <div className="flex justify-end mt-1">
                    <ChevronIcon expanded={expanded} />
                </div>
            </button>

            {/* Detalle expandido */}
            {expanded && (
                <div className="space-y-4 pt-2 border-t border-sand">

                    {/* Descripción */}
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold mb-1">
                            Descripción del cliente
                        </p>
                        <p className="text-[13px] text-ink/70 leading-relaxed whitespace-pre-wrap">
                            {solicitud.descripcion}
                        </p>
                    </div>

                    {/* Datos del proyecto */}
                    <div className="grid grid-cols-2 gap-2">
                        <MiniDato label="Tipo de obra" value={solicitud.tipoObra} />
                        <MiniDato label="Presupuesto" value={solicitud.presupuesto || "—"} />
                        <MiniDato label="Ciudad" value={solicitud.ciudad || "—"} />
                        <MiniDato label="Inicio deseado" value={solicitud.fechaInicio
                            ? new Date(solicitud.fechaInicio).toLocaleDateString("es-CO")
                            : "—"} />
                    </div>

                    {/* Cambiar estado */}
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold mb-2">
                            Estado de la solicitud
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {ESTADOS.map(estado => {
                                let activeCls = "bg-blue-500 text-white border-blue-500";
                                if (estado === "aprobada") { activeCls = "bg-emerald-500 text-white border-emerald-500"; }
                                else if (estado === "rechazada") { activeCls = "bg-red-500 text-white border-red-500"; }
                                else if (estado === "en_analisis") { activeCls = "bg-amber-400 text-white border-amber-400"; }
                                const btnCls = solicitud.estado === estado ? activeCls : "bg-white text-ink/50 border-ink/15 hover:border-ink/30";
                                return (
                                <button
                                    key={estado}
                                    type="button"
                                    onClick={() => cambiarEstado(estado)}
                                    disabled={cambiandoEstado}
                                    className={`py-2 rounded-xl text-[11px] font-medium border transition-all disabled:opacity-50 ${btnCls}`}
                                >
                                    {ESTADO_LABEL[estado]}
                                </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Nota interna */}
                    <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">
                            Nota interna (no visible al cliente)
                        </p>
                        <textarea
                            value={nota}
                            onChange={e => setNota(e.target.value)}
                            placeholder="Observaciones del análisis, resultado de la reunión inicial…"
                            rows={3}
                            className="input w-full resize-none text-[13px]"
                        />
                        <button
                            type="button"
                            onClick={guardarNota}
                            disabled={saving || nota === solicitud.notaAdmin}
                            className="w-full btn-outline text-[12px] disabled:opacity-40"
                        >
                            {saving ? "Guardando…" : "Guardar nota"}
                        </button>
                    </div>

                    {/* Acciones rápidas */}
                    <div className="flex gap-2 pt-1">
                        <a
                            href={(() => {
                                const nombre = solicitud.nombre?.split(" ")[0] || "";
                                const tipo = solicitud.tipoObra || "su proyecto";
                                const asunto = encodeURIComponent(`Tu solicitud en H&E Arquitectos — ${tipo}`);
                                const cuerpo = encodeURIComponent(
                                    `Hola ${nombre},\n\nGracias por contactarnos sobre tu proyecto de ${tipo}.\n\nHemos revisado tu solicitud y nos gustaría coordinar una reunión inicial para conocer mejor tus necesidades y presentarte nuestra propuesta.\n\n¿Tienes disponibilidad esta semana?\n\nQuedamos atentos,\n\nLuisa\nH&E Arquitectos\nBogotá, Colombia`
                                );
                                return `mailto:${solicitud.email}?subject=${asunto}&body=${cuerpo}`;
                            })()}
                            className="flex-1 text-center btn-outline text-[12px] py-2"
                        >
                            ✉ Escribir email
                        </a>
                        {solicitud.telefono && (
                            <a
                                href={`https://wa.me/${solicitud.telefono.replaceAll(/\D/g, "")}?text=Hola ${solicitud.nombre.split(" ")[0]}, soy Luisa de H%26E Arquitectos. Te contacto por tu solicitud de servicio.`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 text-center btn-outline text-[12px] py-2"
                            >
                                💬 WhatsApp
                            </a>
                        )}
                    </div>

                    {/* Botón convertir a proyecto */}
                    {solicitud.estado === "aprobada" && (
                        <button
                            type="button"
                            onClick={() => nav("/proyectos/nuevo", {
                                state: {
                                    prefill: {
                                        client: solicitud.nombre,
                                        clientEmail: solicitud.email,
                                        type: solicitud.tipoObra,
                                        location: solicitud.ciudad,
                                        budget: solicitud.presupuesto,
                                        description: solicitud.descripcion,
                                        startDate: solicitud.fechaInicio,
                                    }
                                }
                            })}
                            className="w-full btn-primary text-[13px] py-2.5 flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Convertir a proyecto
                        </button>
                    )}
                    {/* Eliminar solicitud */}
                    <div className="pt-1 border-t border-sand">
                        {confirmDelete ? (
                            <div className="space-y-2">
                                <p className="text-[12px] text-red-600 text-center font-medium">
                                    ¿Confirmar eliminación? Esta acción no se puede deshacer.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(false)}
                                        disabled={deleting}
                                        className="flex-1 btn-outline text-[12px] py-2"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={eliminarSolicitud}
                                        disabled={deleting}
                                        className="flex-1 bg-red-500 hover:bg-red-600 text-white text-[12px]
                                                   font-medium rounded-xl py-2 transition disabled:opacity-50"
                                    >
                                        {deleting ? "Eliminando…" : "Sí, eliminar"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(true)}
                                className="w-full text-[12px] text-red-400 hover:text-red-600 transition py-1"
                            >
                                Eliminar solicitud
                            </button>
                        )}
                    </div>
                </div>
            )}
            {/* ── Modal editar email ── */}
            {modalEmail && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4">
                    <div className="w-full max-w-[500px] bg-white rounded-2xl shadow-2xl space-y-4 p-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[15px] font-semibold text-ink">
                                {modalEmail.estado === "aprobada" ? "✅ Aprobar y notificar" : "❌ Rechazar y notificar"}
                            </h3>
                            <button onClick={() => setModalEmail(null)} className="text-ink/40 hover:text-ink text-xl">×</button>
                        </div>
                        <p className="text-[11px] text-ink/50">
                            Este email se enviará a <strong>{solicitud.email}</strong>. Puedes editarlo antes de enviar.
                        </p>

                        {/* Asunto */}
                        <div className="space-y-1">
                            <label htmlFor="modal-email-asunto" className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Asunto</label>
                            <input
                                id="modal-email-asunto"
                                type="text"
                                value={modalEmail.asunto}
                                onChange={e => setModalEmail(m => ({ ...m, asunto: e.target.value }))}
                                className="input w-full text-[13px]"
                            />
                        </div>

                        {/* Cuerpo */}
                        <div className="space-y-1">
                            <label htmlFor="modal-email-cuerpo" className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Mensaje</label>
                            <textarea
                                id="modal-email-cuerpo"
                                value={modalEmail.cuerpo}
                                onChange={e => setModalEmail(m => ({ ...m, cuerpo: e.target.value }))}
                                rows={10}
                                className="input w-full resize-none text-[12px] font-mono leading-relaxed"
                            />
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setModalEmail(null)}
                                className="flex-1 btn-outline text-[13px]"
                                disabled={enviandoEmail}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmarEmailYCambiarEstado}
                                disabled={enviandoEmail}
                                className={`flex-1 text-[13px] font-semibold text-white rounded-xl py-2.5 transition-all disabled:opacity-50 ${modalEmail.estado === "aprobada"
                                        ? "bg-emerald-500 hover:bg-emerald-600"
                                        : "bg-red-500 hover:bg-red-600"
                                    }`}
                            >
                                {enviandoEmail ? "Enviando…" : "Enviar y confirmar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MiniDato({ label, value }) {
    return (
        <div className="bg-sand/50 rounded-xl px-3 py-2">
            <p className="text-[10px] text-ink/40 uppercase tracking-[0.12em]">{label}</p>
            <p className="text-[12px] font-medium text-ink mt-0.5">{value}</p>
        </div>
    );
}

TarjetaSolicitud.propTypes = {
    solicitud: PropTypes.object.isRequired,
    nav: PropTypes.func.isRequired,
};

MiniDato.propTypes = {
    label: PropTypes.string,
    value: PropTypes.any,
};
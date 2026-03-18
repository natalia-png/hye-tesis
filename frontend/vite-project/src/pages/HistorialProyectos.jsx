// src/pages/HistorialProyectos.jsx
// Vista admin — proyectos con estado "finalizado"
// Se marcan automáticamente cuando todas las fases llegan al 100%

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import BtnReportePDF from "../components/BtnReportePDF";

export default function HistorialProyectos() {
    const nav = useNavigate();
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");

    useEffect(() => {
        const q = query(
            collection(db, "projects"),
            where("estado", "==", "finalizado"),
            orderBy("fechaCierre", "desc")
        );
        const unsub = onSnapshot(q, snap => {
            setProyectos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
    }, []);

    const filtrados = busqueda.trim()
        ? proyectos.filter(p =>
            (p.name || p.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
            (p.client || p.cliente || "").toLowerCase().includes(busqueda.toLowerCase())
        )
        : proyectos;

    return (
        <section className="space-y-4">

            {/* Header */}
            <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                    Gestión de proyectos
                </p>
                <h1 className="text-[20px] font-bold text-ink leading-tight">
                    Historial de proyectos
                </h1>
                <p className="text-[12px] text-ink/50 mt-0.5">
                    {loading ? "Cargando…" : `${proyectos.length} proyecto${proyectos.length !== 1 ? "s" : ""} finalizado${proyectos.length !== 1 ? "s" : ""}`}
                </p>
            </div>

            {/* Buscador */}
            {proyectos.length > 0 && (
                <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/30"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar por nombre o cliente…"
                        className="input w-full pl-9 text-[13px]"
                    />
                </div>
            )}

            {/* Lista */}
            {loading ? (
                <div className="flex items-center gap-2 py-6">
                    <div className="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
                    <p className="text-[13px] text-ink/50">Cargando historial…</p>
                </div>
            ) : filtrados.length === 0 ? (
                <div className="card text-center py-12 space-y-3">
                    <p className="text-4xl">🏛</p>
                    <p className="text-[14px] font-semibold text-ink">
                        {busqueda ? "Sin resultados" : "Aún no hay proyectos finalizados"}
                    </p>
                    <p className="text-[12px] text-ink/50 leading-relaxed max-w-[260px] mx-auto">
                        {busqueda
                            ? "Intenta con otro nombre o cliente."
                            : "Los proyectos aparecen aquí automáticamente cuando todas sus fases llegan al 100%."}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtrados.map(p => (
                        <TarjetaHistorial key={p.id} proyecto={p} nav={nav} onEliminar={id => {
                            deleteDoc(doc(db, "projects", id)).catch(console.error);
                        }} />
                    ))}
                </div>
            )}
        </section>
    );
}

/* ── TARJETA ── */
function TarjetaHistorial({ proyecto, nav, onEliminar }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleEliminar = async () => {
        setDeleting(true);
        try { await onEliminar(proyecto.id); }
        catch { setDeleting(false); setConfirmDelete(false); }
    };

    const nombre = proyecto.name || proyecto.nombre || "Sin nombre";
    const cliente = proyecto.client || proyecto.cliente || "—";
    const tipo = proyecto.type || proyecto.tipo || "—";
    const ubicacion = proyecto.location || proyecto.ubicacion || "—";

    const fechaInicio = proyecto.startDate
        ? new Date(proyecto.startDate).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
        : "—";

    const fechaCierre = proyecto.fechaCierre?.toDate
        ? proyecto.fechaCierre.toDate().toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
        : proyecto.fechaCierre
            ? new Date(proyecto.fechaCierre).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
            : "—";

    const fases = Array.isArray(proyecto.fases) ? proyecto.fases : [];
    const totalFases = fases.length;

    // Duración en días
    let duracion = null;
    if (proyecto.startDate && proyecto.fechaCierre) {
        const ini = new Date(proyecto.startDate);
        const fin = proyecto.fechaCierre?.toDate
            ? proyecto.fechaCierre.toDate()
            : new Date(proyecto.fechaCierre);
        duracion = Math.ceil((fin - ini) / 86400000);
    }

    return (
        <div className="card space-y-4">

            {/* Header tarjeta */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Finalizado
                        </span>
                    </div>
                    <h2 className="text-[15px] font-semibold text-ink mt-1 leading-tight truncate">
                        {nombre}
                    </h2>
                    <p className="text-[12px] text-ink/50 mt-0.5">
                        {cliente} · {ubicacion}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => nav(`/proyectos/${proyecto.id}`)}
                    className="flex-shrink-0 text-[11px] text-ink/50 hover:text-ink underline transition-colors"
                >
                    Ver detalle →
                </button>
            </div>

            {/* Datos clave */}
            <div className="grid grid-cols-2 gap-2">
                <Dato label="Tipo de obra" value={tipo} />
                <Dato label="Fases" value={`${totalFases} completadas`} />
                <Dato label="Fecha de inicio" value={fechaInicio} />
                <Dato label="Fecha de cierre" value={fechaCierre} />
                {duracion !== null && (
                    <Dato label="Duración total" value={`${duracion} días`} />
                )}
                <Dato label="Avance final" value="100%" />
            </div>

            {/* Barra de progreso 100% */}
            <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-ink/50">
                    <span>Progreso</span>
                    <span className="text-emerald-600 font-medium">100%</span>
                </div>
                <div className="h-2 bg-sand rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-full" />
                </div>
            </div>

            {/* Reporte PDF */}
            <div className="pt-1">
                <BtnReportePDF proyecto={proyecto} isAdmin={true} />
            </div>

            {/* Eliminar */}
            <div className="border-t border-sand pt-3">
                {!confirmDelete ? (
                    <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="text-[11px] text-ink/35 hover:text-red-500 transition-colors"
                    >
                        Eliminar proyecto del historial
                    </button>
                ) : (
                    <div className="flex items-center gap-2">
                        <p className="text-[11px] text-red-600 font-medium">
                            ¿Eliminar permanentemente?
                        </p>
                        <button
                            type="button"
                            onClick={handleEliminar}
                            disabled={deleting}
                            className="px-3 py-1 rounded-lg bg-red-500 text-white text-[11px] font-medium disabled:opacity-50"
                        >
                            {deleting ? "Eliminando…" : "Sí, eliminar"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className="px-3 py-1 rounded-lg text-[11px] text-ink/50 hover:text-ink transition"
                        >
                            Cancelar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function Dato({ label, value }) {
    return (
        <div className="bg-sand/50 rounded-xl px-3 py-2">
            <p className="text-[10px] text-ink/40 uppercase tracking-[0.12em]">{label}</p>
            <p className="text-[12px] font-medium text-ink mt-0.5">{value}</p>
        </div>
    );
}
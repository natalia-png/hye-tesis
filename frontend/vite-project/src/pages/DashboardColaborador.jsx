// src/pages/DashboardColaborador.jsx
// Dashboard para colaboradores (jurídica, sistemas, arquitecto)
// Solo muestra las fases asignadas a este usuario en todos los proyectos

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { SUB_ROLE_LABEL, SUB_ROLE_COLOR } from "../data/roles";
import PropTypes from "prop-types";

export default function DashboardColaborador() {
    const nav = useNavigate();
    const { user, permissionStatus, requestPermission } = useAuth();
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Cargar todos los proyectos y filtrar fases asignadas a este usuario
    useEffect(() => {
        if (!user?.uid) return;
        const q = query(collection(db, "projects"));
        const unsub = onSnapshot(q, snap => {
            const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setProyectos(todos);
            setLoading(false);
        }, () => setLoading(false));
        return () => { try { unsub(); } catch (e) { console.error(e); } };
    }, [user?.uid]);

    // Filtrar fases donde responsableUid == user.uid
    const misFases = [];
    proyectos.forEach(p => {
        const fases = Array.isArray(p.fases) ? p.fases : [];
        fases.forEach(f => {
            if (f.responsableUid === user.uid) {
                misFases.push({
                    ...f,
                    proyectoId: p.id,
                    proyectoNombre: p.name || p.nombre || "Sin nombre",
                    proyectoCliente: p.client || p.cliente || "—",
                });
            }
        });
    });

    const pendientes = misFases.filter(f => f.estado !== "completada");
    const completadas = misFases.filter(f => f.estado === "completada");
    const enCurso = misFases.filter(f => f.estado === "en_curso");
    const vencidas = pendientes.filter(f => isFechaVencida(f.fechaEntregaResponsable));
    const porVencer = pendientes.filter(f => isFechaProxima(f.fechaEntregaResponsable));

    const subRole = user?.subRole || "";
    const rolLabel = SUB_ROLE_LABEL[subRole] || "Colaborador";
    const rolColor = SUB_ROLE_COLOR[subRole] || "bg-sand text-ink border-taupe/30";

    const [filtro, setFiltro] = useState("todas"); // "todas" | "pendiente" | "en_curso" | "completada"

    const fasesFiltradas = filtro === "todas"
        ? misFases
        : misFases.filter(f => f.estado === filtro);

    const pendientesFiltradas = fasesFiltradas.filter(f => f.estado !== "completada");
    const completadasFiltradas = fasesFiltradas.filter(f => f.estado === "completada");

    return (
        <section className="space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                        Panel de trabajo
                    </p>
                    <h1 className="text-[20px] font-bold text-ink leading-tight">
                        Hola, {user?.name?.split(" ")[0]}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${rolColor}`}>
                            {rolLabel}
                        </span>
                        <p className="text-[12px] text-ink/50">
                            {misFases.length} fase{misFases.length === 1 ? "" : "s"} asignada{misFases.length === 1 ? "" : "s"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Banner permisos push */}
            {permissionStatus === "default" && (
                <div className="card bg-ink text-ivory flex items-center gap-3 py-3 px-4">
                    <span className="text-xl flex-shrink-0">🔔</span>
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold leading-tight">Activa las notificaciones</p>
                        <p className="text-[11px] text-ivory/60 mt-0.5">Recibe avisos cuando te asignen fases.</p>
                    </div>
                    <button
                        type="button"
                        onClick={requestPermission}
                        className="flex-shrink-0 bg-ivory text-ink text-[11px] font-semibold px-3 py-1.5 rounded-xl"
                    >
                        Activar
                    </button>
                </div>
            )}

            {/* KPIs — clicables para filtrar */}
            <div className="grid grid-cols-3 gap-2">
                <KpiMini label="Asignadas" value={misFases.length} color="text-ink"
                    active={filtro === "todas"} onClick={() => setFiltro("todas")} />
                <KpiMini label="En curso" value={enCurso.length} color="text-amber-600"
                    active={filtro === "en_curso"} onClick={() => setFiltro(f => f === "en_curso" ? "todas" : "en_curso")} />
                <KpiMini label="Completadas" value={completadas.length} color="text-emerald-600"
                    active={filtro === "completada"} onClick={() => setFiltro(f => f === "completada" ? "todas" : "completada")} />
            </div>

            {(vencidas.length > 0 || porVencer.length > 0) && (
                <div className="flex flex-wrap gap-2">
                    {vencidas.length > 0 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border bg-red-50 text-red-700 border-red-200">
                            {vencidas.length} vencida{vencidas.length === 1 ? "" : "s"}
                        </span>
                    )}
                    {porVencer.length > 0 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border bg-amber-50 text-amber-700 border-amber-200">
                            {porVencer.length} por vencer
                        </span>
                    )}
                </div>
            )}

            {loading && (
                <div className="flex items-center gap-2 py-6">
                    <div className="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
                    <p className="text-[13px] text-ink/50">Cargando fases…</p>
                </div>
            )}
            {!loading && misFases.length === 0 && (
                <div className="card text-center py-10 space-y-2">
                    <p className="text-3xl">📋</p>
                    <p className="text-[14px] font-semibold text-ink">Sin fases asignadas</p>
                    <p className="text-[12px] text-ink/50 max-w-[220px] mx-auto leading-relaxed">
                        Luisa te asignará fases cuando inicien los proyectos.
                    </p>
                </div>
            )}
            {!loading && misFases.length > 0 && (
                <>
                    {fasesFiltradas.length === 0 && (
                        <p className="text-center text-[13px] text-ink/40 py-6">Sin fases en esta categoría.</p>
                    )}

                    {/* Fases pendientes / en curso */}
                    {pendientesFiltradas.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40 font-semibold">
                                Pendientes y en curso
                            </p>
                            {pendientesFiltradas.map((f) => (
                                <TarjetaFase key={`${f.proyectoId}-${f.nombre}`} fase={f} nav={nav} />
                            ))}
                        </div>
                    )}

                    {/* Fases completadas */}
                    {completadasFiltradas.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40 font-semibold">
                                Completadas
                            </p>
                            {completadasFiltradas.map((f) => (
                                <TarjetaFase key={`${f.proyectoId}-${f.nombre}`} fase={f} nav={nav} completada />
                            ))}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

/* ── TARJETA FASE ── */
function TarjetaFase({ fase, nav, completada = false }) {
    const pct = fase.porcentaje || 0;

    const estadoStyle = {
        completada: "bg-emerald-50 text-emerald-700 border-emerald-200",
        en_curso: "bg-amber-50  text-amber-700  border-amber-200",
        pendiente: "bg-sand      text-ink/60     border-taupe/20",
    }[fase.estado] || "bg-sand text-ink/60 border-taupe/20";

    const estadoLabel = {
        completada: "Completada",
        en_curso: "En curso",
        pendiente: "Pendiente",
    }[fase.estado] || fase.estado;

    return (
        <button
            type="button"
            className={`card space-y-3 cursor-pointer hover:shadow-md transition-shadow w-full text-left ${completada ? "opacity-60" : ""}`}
            onClick={() => nav(`/proyectos/${fase.proyectoId}`)}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-ink/40 uppercase tracking-[0.12em] truncate">
                        {fase.proyectoNombre} · {fase.proyectoCliente}
                    </p>
                    <p className="text-[14px] font-semibold text-ink mt-0.5 leading-tight">
                        {fase.nombre}
                    </p>
                </div>
                <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${estadoStyle}`}>
                    {estadoLabel}
                </span>
            </div>

            {/* Barra de progreso */}
            <div className="space-y-1">
                {fase.fechaEntregaResponsable && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-ink/40 uppercase tracking-[0.1em]">Entrega</span>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${getEntregaChipClass(fase.fechaEntregaResponsable, completada)}`}>
                            {getEntregaLabel(fase.fechaEntregaResponsable, completada)}
                        </span>
                    </div>
                )}
                <div className="flex justify-between text-[11px] text-ink/50">
                    <span>Avance</span>
                    <span className="font-medium text-ink">{pct}%</span>
                </div>
                <div className="h-1.5 bg-sand rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${completada ? "bg-emerald-400" : "bg-ink"}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>

            <p className="text-[11px] text-ink/40">
                Toca para abrir el proyecto →
            </p>
        </button>
    );
}

function KpiMini({ label, value, color, active = false, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`card text-center py-3 space-y-0.5 transition-all active:scale-[0.97] w-full ${
                active ? "ring-2 ring-ink/30 shadow-md" : "opacity-80 hover:opacity-100"
            }`}
        >
            <p className={`text-[22px] font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-ink/50 uppercase tracking-[0.12em]">{label}</p>
            {active && <div className="w-4 h-0.5 bg-ink/30 rounded-full mx-auto mt-0.5" />}
        </button>
    );
}

function getEntregaLabel(fecha, completada = false) {
    if (!fecha) return "Sin fecha";
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return fecha;
    const base = date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
    if (completada) return base;

    const diff = diffDays(fecha);
    if (diff < 0) return `Vencida · ${base}`;
    if (diff === 0) return `Entrega hoy · ${base}`;
    if (diff <= 3) return `Vence pronto · ${base}`;
    return base;
}

function getEntregaClass(fecha, completada = false) {
    if (completada || !fecha) return "text-ink/70";
    const diff = diffDays(fecha);
    if (diff < 0) return "text-red-600 font-medium";
    if (diff <= 3) return "text-amber-700 font-medium";
    return "text-ink/70";
}

function getEntregaChipClass(fecha, completada = false) {
    if (completada || !fecha) return "bg-sand text-ink/60";
    const diff = diffDays(fecha);
    if (diff < 0) return "bg-red-50 text-red-600 border border-red-200";
    if (diff <= 3) return "bg-amber-50 text-amber-700 border border-amber-200";
    return "bg-sand text-ink/70";
}

function diffDays(fecha) {
    const end = new Date(fecha);
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((end - today) / 86400000);
}

function isFechaVencida(fecha) {
    return !!fecha && diffDays(fecha) < 0;
}

function isFechaProxima(fecha) {
    if (!fecha) return false;
    const diff = diffDays(fecha);
    return diff >= 0 && diff <= 3;
}

DashboardColaborador.propTypes = {};

TarjetaFase.propTypes = {
    fase: PropTypes.object.isRequired,
    nav: PropTypes.func.isRequired,
    completada: PropTypes.bool,
};

KpiMini.propTypes = {
    label: PropTypes.string,
    value: PropTypes.number,
    color: PropTypes.string,
    active: PropTypes.bool,
    onClick: PropTypes.func,
};

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

    const subRole = user?.subRole || "";
    const rolLabel = SUB_ROLE_LABEL[subRole] || "Colaborador";
    const rolColor = SUB_ROLE_COLOR[subRole] || "bg-sand text-ink border-taupe/30";

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

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2">
                <KpiMini label="Asignadas" value={misFases.length} color="text-ink" />
                <KpiMini label="En curso" value={enCurso.length} color="text-amber-600" />
                <KpiMini label="Completadas" value={completadas.length} color="text-emerald-600" />
            </div>

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
                    {/* Fases pendientes / en curso */}
                    {pendientes.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40 font-semibold">
                                Pendientes y en curso
                            </p>
                            {pendientes.map((f) => (
                                <TarjetaFase key={`${f.proyectoId}-${f.nombre}`} fase={f} nav={nav} />
                            ))}
                        </div>
                    )}

                    {/* Fases completadas */}
                    {completadas.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40 font-semibold">
                                Completadas
                            </p>
                            {completadas.map((f) => (
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

function KpiMini({ label, value, color }) {
    return (
        <div className="card text-center py-3 space-y-0.5">
            <p className={`text-[22px] font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-ink/50 uppercase tracking-[0.12em]">{label}</p>
        </div>
    );
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
};
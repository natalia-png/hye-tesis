// src/pages/DashboardColaborador.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { getSubRoleColor } from "../data/roles";
import PropTypes from "prop-types";

function useCountUp(to, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!to) { setVal(0); return; }
    let frame;
    const timer = setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        setVal(Math.round(eased * to));
        if (t < 1) frame = requestAnimationFrame(tick);
        else setVal(to);
      };
      frame = requestAnimationFrame(tick);
    }, 200);
    return () => { clearTimeout(timer); if (frame) cancelAnimationFrame(frame); };
  }, [to, duration]);
  return val;
}

export default function DashboardColaborador() {
  const nav = useNavigate();
  const { user, permissionStatus, requestPermission } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { title, items: [{label, sub, color, onClick}] }

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(query(collection(db, "projects")), snap => {
      setProyectos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => { try { unsub(); } catch (e) { console.error(e); } };
  }, [user?.uid]);

  const misFases = useMemo(() => {
    const result = [];
    proyectos.forEach(p => {
      (Array.isArray(p.fases) ? p.fases : []).forEach(f => {
        if (f.responsableUid === user?.uid) {
          result.push({
            ...f,
            proyectoId: p.id,
            proyectoNombre: p.name || p.nombre || "Sin nombre",
            proyectoCliente: p.client || p.cliente || "",
            proyectoCodigo: p.code || "",
          });
        }
      });
    });
    return result;
  }, [proyectos, user?.uid]);

  const propuestasPendientes = useMemo(() => misFases.filter(f => {
    const val = Number(f.avancePropuesto);
    return f.avancePropuesto != null && Number.isFinite(val) && val > 0 && !!f.avancePropuestoPorUid;
  }), [misFases]);

  const propuestasRechazadas = useMemo(() => misFases.filter(f =>
    f.ultimoRechazo?.motivo && !f.avancePropuestoPorUid
  ), [misFases]);

  const isJuridico = !!user?.subRole?.toLowerCase().includes("jur");

  // Trazabilidad de contratos para el juridico
  const trazabilidadContratos = useMemo(() => {
    if (!isJuridico) return [];
    const result = [];
    proyectos.forEach(p => {
      const fueYo = p.contratoPropuesto?.subidoPorUid === user?.uid
        || p.contratoPropuesto?.subidoPor === user?.name
        || p.contratoPropuesto?.subidoPor === user?.email;
      const haySolicitud = !!p.contratoSolicitado;
      const hayPropuesta = !!p.contratoPropuesto;
      const hayContrato = !!p.contratoURL;

      // Solo incluir proyectos con solicitud del admin O donde el juridico propuso
      if (!haySolicitud && !fueYo) return;

      let estado, estadoColor;
      if (hayContrato && haySolicitud) {
        estado = "Aprobado";
        estadoColor = "green";
      } else if (hayPropuesta && fueYo) {
        estado = "Enviado — en revisión";
        estadoColor = "amber";
      } else if (haySolicitud && !hayPropuesta) {
        estado = "Pendiente — subir propuesta";
        estadoColor = "red";
      } else {
        return;
      }

      result.push({
        proyectoId: p.id,
        proyectoNombre: p.name || p.nombre || "Sin nombre",
        estado,
        estadoColor,
        solicitadoAt: p.contratoSolicitado?.solicitadoAt || null,
        subidoAt: p.contratoPropuesto?.subidoAt || null,
      });
    });
    // Pendientes primero, luego en revisión, luego aprobados
    const order = { "Pendiente — subir propuesta": 0, "Enviado — en revisión": 1, "Aprobado": 2 };
    return result.sort((a, b) => (order[a.estado] ?? 3) - (order[b.estado] ?? 3));
  }, [proyectos, isJuridico, user?.uid, user?.name, user?.email]);

  const stats = useMemo(() => {
    const activas   = misFases.filter(f => f.estado === "en_curso");
    const pendientes = misFases.filter(f => f.estado !== "completada" && f.estado !== "en_curso");
    const completadas = misFases.filter(f => f.estado === "completada");
    const total = misFases.length;

    // Avance promedio solo de fases activas
    const promedioActivas = activas.length > 0
      ? Math.round(activas.reduce((s, f) => s + clampInt(f.porcentaje, 0, 100), 0) / activas.length)
      : 0;

    // Próxima entrega = fase con fecha más próxima que no esté completada
    const conFecha = misFases
      .filter(f => f.estado !== "completada" && f.fechaEntregaResponsable)
      .sort((a, b) => new Date(a.fechaEntregaResponsable) - new Date(b.fechaEntregaResponsable));
    const proxima = conFecha[0] || null;

    // Vencidas y por vencer
    const vencidas = misFases.filter(f => f.estado !== "completada" && diffDays(f.fechaEntregaResponsable) < 0);
    const porVencer = misFases.filter(f => {
      const d = diffDays(f.fechaEntregaResponsable);
      return f.estado !== "completada" && d !== null && d >= 0 && d <= 3;
    });

    // Per-project grouping — proyectos donde todas mis fases están completadas
    const porProyecto = {};
    misFases.forEach(f => {
      if (!porProyecto[f.proyectoId]) {
        porProyecto[f.proyectoId] = {
          id: f.proyectoId,
          nombre: f.proyectoNombre,
          cliente: f.proyectoCliente,
          codigo: f.proyectoCodigo,
          fases: [],
        };
      }
      porProyecto[f.proyectoId].fases.push(f);
    });
    const proyectosCompletados = Object.values(porProyecto).filter(p =>
      p.fases.length > 0 && p.fases.every(f => f.estado === "completada")
    );

    return { activas, pendientes, completadas, total, promedioActivas, proxima, vencidas, porVencer, proyectosCompletados };
  }, [misFases]);

  const subRole  = user?.subRole || "";
  const rolLabel = subRole || "Colaborador";
  const rolColor = getSubRoleColor(subRole);
  const first    = (user?.name || "Colaborador").trim().split(" ")[0];

  if (!user) return null;

  if (loading) return (
    <div className="space-y-3">
      <div className="rounded-[22px] h-32 animate-pulse" style={{ background: "rgb(var(--ink) / 0.08)" }} />
      <div className="rounded-2xl h-44 animate-pulse" style={{ background: "rgb(var(--ink) / 0.06)" }} />
      <div className="grid grid-cols-3 gap-2">
        {[1,2,3].map(i => <div key={i} className="rounded-2xl h-20 animate-pulse" style={{ background: "rgb(var(--ink) / 0.06)" }} />)}
      </div>
    </div>
  );

  return (
    <section className="space-y-5">

      {/* ── Modal de detalle ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-4"
          onClick={() => setModal(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <p className="text-[14px] font-bold" style={{ color: "rgb(var(--ink))" }}>{modal.title}</p>
              <button type="button" onClick={() => setModal(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
                style={{ color: "rgb(var(--ink) / 0.4)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-black/[0.04]">
              {modal.items.map((item, i) => (
                <button key={i} type="button" onClick={item.onClick}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-black/[0.025] active:bg-black/[0.05] transition-colors">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color === "red" ? "bg-red-500" : item.color === "amber" ? "bg-amber-400" : "bg-emerald-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: "rgb(var(--ink))" }}>{item.label}</p>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: "rgb(var(--ink) / 0.5)" }}>{item.sub}</p>
                  </div>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                    style={{ color: "rgb(var(--ink) / 0.2)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <div className="rounded-[22px] bg-gradient-to-br from-[#141414] via-[#1a1a18] to-[#3a3732] text-ivory p-5 border border-white/8 shadow-xl">
        <p className="text-[10px] uppercase tracking-[0.22em] text-ivory/40 font-medium">Panel de trabajo</p>
        <div className="flex items-end justify-between gap-3 mt-1.5">
          <div>
            <h1 className="text-[24px] font-bold leading-snug tracking-tight">Hola, {first}.</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${rolColor}`}>
                {rolLabel}
              </span>
            </div>
          </div>
          {/* Alertas urgentes en hero */}
          {(stats.vencidas.length > 0 || stats.porVencer.length > 0) && (
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {stats.vencidas.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-400/40 px-2.5 py-0.5 text-[10px] font-semibold text-red-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  {stats.vencidas.length} vencida{stats.vencidas.length > 1 ? "s" : ""}
                </span>
              )}
              {stats.porVencer.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                  ⏱ Vence pronto
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Banner notificaciones ── */}
      {permissionStatus === "default" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <span className="text-[20px] flex-shrink-0">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold" style={{ color: "rgb(var(--ink))" }}>Activa las notificaciones</p>
            <p className="text-[11px] mt-0.5" style={{ color: "rgb(var(--ink) / 0.55)" }}>Recibe avisos cuando te asignen nuevas fases.</p>
          </div>
          <button type="button" onClick={requestPermission}
            className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-[12px] font-semibold px-4 py-2 rounded-xl transition-all">
            Activar
          </button>
        </div>
      )}

      {misFases.length === 0 ? (
        <div className="rounded-2xl border py-14 text-center space-y-3"
          style={{ borderColor: "rgb(var(--taupe) / 0.25)", background: "rgb(var(--sand) / 0.4)" }}>
          <p className="text-[36px]">📋</p>
          <p className="text-[14px] font-semibold" style={{ color: "rgb(var(--ink))" }}>Sin fases asignadas</p>
          <p className="text-[12px] max-w-[220px] mx-auto leading-relaxed" style={{ color: "rgb(var(--ink) / 0.5)" }}>
            Luisa te asignará fases cuando inicien los proyectos.
          </p>
        </div>
      ) : (
        <>
          {/* ── Propuestas enviadas pendientes de aprobacion ── */}
          {propuestasPendientes.length > 0 && (
            <div className="rounded-2xl border bg-ivory p-4 space-y-2.5"
              style={{ borderColor: "rgb(var(--taupe) / 0.25)" }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                <p className="text-[12px] font-semibold" style={{ color: "rgb(var(--ink))" }}>
                  Propuestas enviadas — esperando aprobacion
                </p>
                <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {propuestasPendientes.length}
                </span>
              </div>
              {propuestasPendientes.map(f => (
                <button key={f.id} type="button"
                  onClick={() => nav(`/proyectos/${f.proyectoId}`)}
                  className="w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left hover:shadow-sm active:scale-[0.99] transition-all"
                  style={{ borderColor: "rgb(var(--taupe) / 0.2)", background: "rgb(var(--sand) / 0.5)" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] bg-amber-100 text-amber-700 font-bold">
                    {clampInt(f.avancePropuesto, 0, 100)}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate" style={{ color: "rgb(var(--ink))" }}>
                      {f.nombre}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "rgb(var(--ink) / 0.5)" }}>
                      {f.proyectoNombre} — actual {clampInt(f.porcentaje, 0, 100)}% → propuesto {clampInt(f.avancePropuesto, 0, 100)}%
                    </p>
                  </div>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                    style={{ color: "rgb(var(--ink) / 0.2)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
              <p className="text-[10px] text-center" style={{ color: "rgb(var(--ink) / 0.4)" }}>
                Luisa revisara y aprobara cada propuesta antes de que el cliente lo vea.
              </p>
            </div>
          )}

          {/* ── Trazabilidad de contratos (solo Jurídico) ── */}
          {trazabilidadContratos.length > 0 && (
            <div className="rounded-2xl border bg-ivory p-4 space-y-3"
              style={{ borderColor: "rgb(var(--taupe) / 0.25)" }}>
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold" style={{ color: "rgb(var(--ink))" }}>
                  Contratos asignados
                </p>
                <span className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.4)" }}>
                  {trazabilidadContratos.filter(c => c.estado === "Aprobado").length}/{trazabilidadContratos.length} resueltos
                </span>
              </div>
              <div className="space-y-1.5">
                {trazabilidadContratos.map(c => {
                  const dot = c.estadoColor === "green" ? "bg-emerald-400"
                    : c.estadoColor === "amber" ? "bg-amber-400 animate-pulse"
                    : "bg-red-400 animate-pulse";
                  const badge = c.estadoColor === "green"
                    ? "bg-emerald-100 text-emerald-700"
                    : c.estadoColor === "amber"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-600";
                  return (
                    <button key={c.proyectoId} type="button"
                      onClick={() => nav(`/proyectos/${c.proyectoId}`)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/[0.03] active:scale-[0.99] transition-all text-left"
                      style={{ background: "rgb(var(--sand) / 0.4)" }}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate" style={{ color: "rgb(var(--ink))" }}>
                          {c.proyectoNombre}
                        </p>
                        <p className="text-[10px]" style={{ color: "rgb(var(--ink) / 0.45)" }}>
                          {c.subidoAt ? `Enviado ${timeAgo(c.subidoAt)}` : c.solicitadoAt ? `Solicitado ${timeAgo(c.solicitadoAt)}` : ""}
                        </p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${badge}`}>
                        {c.estado}
                      </span>
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                        style={{ color: "rgb(var(--ink) / 0.2)" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Propuestas rechazadas ── */}
          {propuestasRechazadas.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <p className="text-[12px] font-semibold text-red-800">
                  Propuestas rechazadas — requieren corrección
                </p>
                <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                  {propuestasRechazadas.length}
                </span>
              </div>
              {propuestasRechazadas.map(f => (
                <div key={f.id}
                  className="rounded-xl border border-red-200 bg-white overflow-hidden">
                  {/* Cabecera de la fase */}
                  <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-red-100 text-red-600 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-red-900 truncate">{f.nombre}</p>
                      <p className="text-[11px] text-red-700/70 truncate">{f.proyectoNombre}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 flex-shrink-0">
                      {clampInt(f.porcentaje, 0, 100)}% actual
                    </span>
                  </div>
                  {/* Motivo del rechazo */}
                  <div className="mx-3 mb-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                    <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1">Motivo del rechazo</p>
                    <p className="text-[12px] text-red-800 leading-relaxed">{f.ultimoRechazo.motivo}</p>
                  </div>
                  {/* Fecha + acción */}
                  <div className="flex items-center justify-between px-3 pb-3 gap-2">
                    <p className="text-[10px] text-red-400">
                      {f.ultimoRechazo?.fecha ? timeAgo(f.ultimoRechazo.fecha) : ""}
                    </p>
                    <button type="button"
                      onClick={() => nav(`/proyectos/${f.proyectoId}`)}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white transition active:scale-95">
                      Corregir y reenviar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Próxima entrega ── FOCAL POINT */}
          {stats.proxima ? (
            <ProximaEntrega fase={stats.proxima} nav={nav} />
          ) : (
            <div className="rounded-2xl border px-5 py-4 flex items-center gap-3"
              style={{ borderColor: "rgb(var(--taupe) / 0.2)", background: "rgb(var(--sand) / 0.4)" }}>
              <span className="text-[24px]">🎯</span>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "rgb(var(--ink))" }}>Sin fechas de entrega próximas</p>
                <p className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.5)" }}>Tus {misFases.length} fases no tienen fechas asignadas aún.</p>
              </div>
            </div>
          )}

          {/* ── Mi avance — ring + barras de carga ── */}
          <div className="rounded-2xl border bg-ivory p-4"
            style={{ borderColor: "rgb(var(--taupe) / 0.25)" }}>
            <p className="text-[12px] font-semibold mb-3" style={{ color: "rgb(var(--ink))" }}>Mi progreso</p>
            <div className="flex items-center gap-5">
              {/* Ring de avance de fases activas */}
              <ProgressRing value={stats.promedioActivas} label={stats.activas.length > 0 ? "activas" : "—"} />
              {/* Barras de carga de trabajo */}
              <div className="flex-1 space-y-2.5">
                <WorkBar label="En curso" count={stats.activas.length} total={stats.total} color="bg-amber-400"
                  onClick={stats.activas.length > 0 ? () => setModal({
                    title: "Fases en curso",
                    items: stats.activas.map(f => ({
                      label: f.nombre,
                      sub: `${f.proyectoNombre}${f.proyectoCodigo ? " · " + f.proyectoCodigo : ""} · ${clampInt(f.porcentaje, 0, 100)}% avance`,
                      color: "amber",
                      onClick: () => { setModal(null); nav(`/proyectos/${f.proyectoId}`); },
                    })),
                  }) : undefined} />
                <WorkBar label="Pendientes" count={stats.pendientes.length} total={stats.total} color="bg-ink/30" />
                <WorkBar label="Completadas" count={stats.completadas.length} total={stats.total} color="bg-emerald-400" />
              </div>
            </div>
          </div>

          {/* ── Proyectos completados ── */}
          {stats.proyectosCompletados.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px]">🎉</span>
                <p className="text-[12px] font-semibold text-emerald-700">Proyectos completados</p>
                <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white bg-emerald-500">
                  {stats.proyectosCompletados.length}
                </span>
              </div>
              {stats.proyectosCompletados.slice(0, 3).map(p => (
                <button key={p.id} type="button" onClick={() => nav(`/proyectos/${p.id}`)}
                  className="w-full flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-100 px-3 py-2.5 text-left hover:brightness-95 active:scale-[0.99] transition-all">
                  <span className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[12px] flex-shrink-0">✓</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate text-emerald-800">{p.nombre}</p>
                    <p className="text-[10px] text-emerald-700">
                      {[p.codigo, p.cliente].filter(Boolean).join(" · ")}
                      {" · "}{p.fases.length} fase{p.fases.length !== 1 ? "s" : ""} completada{p.fases.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <svg className="w-3 h-3 flex-shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
              {stats.proyectosCompletados.length > 3 && (
                <p className="text-[11px] text-emerald-600 text-center pt-0.5">
                  +{stats.proyectosCompletados.length - 3} más en el módulo de proyectos
                </p>
              )}
            </div>
          )}

          {/* ── Ir al módulo de proyectos ── */}
          <button type="button" onClick={() => nav("/proyectos")}
            className="w-full rounded-2xl border bg-ivory px-5 py-4 flex items-center justify-between gap-3 hover:shadow-md active:scale-[0.98] transition-all"
            style={{ borderColor: "rgb(var(--taupe) / 0.25)" }}>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[20px]"
                style={{ background: "rgb(var(--sand))" }}>
                📁
              </span>
              <div className="text-left">
                <p className="text-[13px] font-semibold" style={{ color: "rgb(var(--ink))" }}>Ver todos los proyectos</p>
                <p className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.45)" }}>
                  {stats.activas.length} fase{stats.activas.length !== 1 ? "s" : ""} en curso · {stats.total} total asignadas
                </p>
              </div>
            </div>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              style={{ color: "rgb(var(--ink) / 0.25)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}
    </section>
  );
}

/* ── Próxima entrega — focal point ── */
function ProximaEntrega({ fase, nav }) {
  const dl = diffDays(fase.fechaEntregaResponsable);
  const pct = clampInt(fase.porcentaje, 0, 100);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setBarWidth(pct), 500);
    return () => clearTimeout(t);
  }, [pct]);

  const isVencida  = dl !== null && dl < 0;
  const isHoy      = dl === 0;
  const isProxima  = dl !== null && dl > 0 && dl <= 3;

  const cardBg = isVencida ? "bg-red-50"
    : isHoy ? "bg-red-50"
    : isProxima ? "bg-amber-50"
    : "";
  const cardBgStyle = (!isVencida && !isHoy && !isProxima) ? { background: "rgb(var(--sand) / 0.5)" } : {};

  const cardBorder = isVencida || isHoy ? "border-red-200"
    : isProxima ? "border-amber-200"
    : "";

  const barColor = isVencida || isHoy ? "bg-red-400"
    : isProxima ? "bg-amber-400"
    : "bg-emerald-400";

  let countdownText = "";
  let countdownColor = "rgb(var(--ink) / 0.6)";
  if (dl === null) { countdownText = "Sin fecha de entrega"; }
  else if (dl < 0) { countdownText = `Vencida hace ${Math.abs(dl)} día${Math.abs(dl) > 1 ? "s" : ""}`; countdownColor = "#dc2626"; }
  else if (dl === 0) { countdownText = "Entrega HOY"; countdownColor = "#dc2626"; }
  else if (dl === 1) { countdownText = "Entrega mañana"; countdownColor = "#d97706"; }
  else if (dl <= 3) { countdownText = `Vence en ${dl} días`; countdownColor = "#d97706"; }
  else { countdownText = `${dl} días restantes`; }

  return (
    <button type="button" onClick={() => nav(`/proyectos/${fase.proyectoId}`)}
      className={`w-full rounded-[20px] ${cardBg} border ${cardBorder} p-5 text-left space-y-4 hover:shadow-lg active:scale-[0.98] transition-all`}
      style={cardBgStyle}>

      {/* Label + countdown */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            {(isVencida || isHoy) && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
            {isProxima && !isHoy && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: "rgb(var(--ink) / 0.45)" }}>
              Próxima entrega
            </p>
          </div>
          <p className="text-[17px] font-bold leading-snug" style={{ color: "rgb(var(--ink))" }}>
            {fase.nombre}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "rgb(var(--ink) / 0.5)" }}>
            {[fase.proyectoCodigo, fase.proyectoNombre].filter(Boolean).join(" · ")}
          </p>
        </div>
        {/* Countdown grande */}
        <div className="text-right flex-shrink-0">
          {dl !== null && dl >= 0 && (
            <p className="text-[32px] font-black leading-none" style={{ color: countdownColor }}>
              {dl === 0 ? "!" : dl}
            </p>
          )}
          <p className="text-[10px] font-semibold mt-0.5 max-w-[80px]" style={{ color: countdownColor }}>
            {dl === null ? "" : dl === 0 ? "HOY" : dl < 0 ? `hace ${Math.abs(dl)}d` : `día${dl > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.5)" }}>{countdownText}</p>
          <p className="text-[14px] font-bold" style={{ color: "rgb(var(--ink))" }}>{pct}%</p>
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "rgb(var(--ink) / 0.08)" }}>
          <div className={`h-full rounded-full transition-all duration-800 ease-out ${barColor}`}
            style={{ width: `${barWidth}%` }} />
        </div>
      </div>

      <p className="text-[10px]" style={{ color: "rgb(var(--ink) / 0.35)" }}>
        Toca para abrir el proyecto →
      </p>
    </button>
  );
}

/* ── Ring de progreso ── */
function ProgressRing({ value = 0, label = "" }) {
  const [animPct, setAnimPct] = useState(0);
  const counted = useCountUp(value);
  const size = 88;
  const sw = 7;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (animPct / 100) * circ;

  useEffect(() => {
    const t = setTimeout(() => setAnimPct(Math.min(100, Math.max(0, value))), 400);
    return () => clearTimeout(t);
  }, [value]);

  const stroke = value >= 70 ? "#22c55e" : value >= 40 ? "#f59e0b" : value > 0 ? "rgb(var(--ink))" : "rgba(0,0,0,0.1)";

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} className="block">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgb(var(--ink) / 0.07)" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {value > 0 ? (
          <>
            <p className="text-[18px] font-bold leading-none" style={{ color: "rgb(var(--ink))" }}>{counted}%</p>
            <p className="text-[9px] mt-0.5" style={{ color: "rgb(var(--ink) / 0.45)" }}>{label}</p>
          </>
        ) : (
          <p className="text-[11px] font-medium" style={{ color: "rgb(var(--ink) / 0.3)" }}>—</p>
        )}
      </div>
    </div>
  );
}

/* ── Barra de carga de trabajo ── */
function WorkBar({ label, count, total, color, onClick }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 600);
    return () => clearTimeout(t);
  }, [pct]);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={`flex items-center gap-3 w-full text-left ${onClick ? "group cursor-pointer" : ""}`}>
      <p className={`text-[11px] w-20 flex-shrink-0 transition-colors ${onClick ? "group-hover:underline" : ""}`}
        style={{ color: "rgb(var(--ink) / 0.55)" }}>{label}</p>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgb(var(--ink) / 0.07)" }}>
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${width}%` }} />
      </div>
      <p className="text-[11px] font-semibold w-4 text-right flex-shrink-0" style={{ color: "rgb(var(--ink) / 0.6)" }}>{count}</p>
      {onClick && <svg className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-30 transition-opacity" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: "rgb(var(--ink))" }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" /></svg>}
    </Tag>
  );
}

/* ── Helpers ── */
function clampInt(v, a, b) { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, Math.round(n))) : a; }
function timeAgo(value) {
  if (!value) return "";
  const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "hace unos segundos";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}
function diffDays(fecha) {
  if (!fecha) return null;
  const end = new Date(fecha); end.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((end - today) / 86400000);
}

DashboardColaborador.propTypes = {};
ProximaEntrega.propTypes = { fase: PropTypes.object.isRequired, nav: PropTypes.func.isRequired };
ProgressRing.propTypes = { value: PropTypes.number, label: PropTypes.string };
WorkBar.propTypes = { label: PropTypes.string, count: PropTypes.number, total: PropTypes.number, color: PropTypes.string, onClick: PropTypes.func };

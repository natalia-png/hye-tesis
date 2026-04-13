// src/pages/DashboardAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, collectionGroup, doc, getDocs, limit, query, updateDoc, where, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { calcAvanceGlobal } from "../data/fases";

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

export default function DashboardAdmin() {
  const { user, ready } = useAuth();
  const { requestPermission } = usePushNotifications(user?.uid || null, null);
  const nav = useNavigate();

  const role = (user?.role || "sin-rol").toLowerCase().trim();
  const isAdmin = role !== "cliente" && role !== "sin-rol";

  const [projects, setProjects] = useState([]);
  const [garantias, setGarantias] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const [approvalToast, setApprovalToast] = useState("");
  const [approvingId, setApprovingId] = useState(null);
  const [dashRejectModal, setDashRejectModal] = useState(null); // pending item
  const [dashRejectReason, setDashRejectReason] = useState("");
  const [contratoRejectModal, setContratoRejectModal] = useState(null); // { projectId, projectName, propuestoPor, propuestoPorUid }
  const [contratoRejectReason, setContratoRejectReason] = useState("");
  const [contratoActionId, setContratoActionId] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);

  useEffect(() => {
    if (!ready) return;
    if (!isAdmin) { setLoading(false); setErr(`Rol: "${role}". Verifica tu perfil en Firestore.`); return; }
    const load = async () => {
      setLoading(true);
      try {
        const [projSnap, garantSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, "projects"), limit(50))),
          getDocs(query(collectionGroup(db, "solicitudes"), limit(200))),
          getDocs(query(collection(db, "users"), where("role", "==", "colaborador"))),
        ]);
        const projs = projSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        projs.sort((a, b) => (b.updatedAt?.seconds || b.createdAt?.seconds || 0) - (a.updatedAt?.seconds || a.createdAt?.seconds || 0));
        setProjects(projs);
        setGarantias(garantSnap.docs.map(d => ({ id: d.id, _projectId: d.ref.parent.parent.id, ...d.data() })));
        setColaboradores(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        setErr("No se pudieron cargar los datos.");
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isAdmin]);

  const kpis = useMemo(() => {
    const activos = projects.filter(p => {
      const s = (p.status || p.estado || "").toLowerCase();
      return s !== "archivado" && clampInt(p.progress ?? p.avance ?? 0, 0, 100) < 100;
    });
    const promedioAvance = activos.length > 0
      ? Math.round(activos.reduce((s, p) => s + clampInt(p.progress ?? p.avance ?? 0, 0, 100), 0) / activos.length)
      : 0;
    const enRiesgo = activos.filter(p => {
      const dl = daysLeft(p.endDate || p.fechaEntrega);
      const prog = clampInt(p.progress ?? p.avance ?? 0, 0, 100);
      return dl != null && (dl < 0 || (dl <= 14 && prog < 70));
    });
    const garantiasAbiertas = garantias.filter(g => g.estado === "pendiente" || g.estado === "en_revision");
    return { activos, promedioAvance, enRiesgo, garantiasAbiertas };
  }, [projects, garantias]);

  const pulso = useMemo(() => {
    const alerts = [];
    const vencidos = projects.filter(p => {
      const s = (p.status || p.estado || "").toLowerCase();
      if (s === "archivado") return false;
      if (clampInt(p.progress ?? p.avance ?? 0, 0, 100) >= 100) return false;
      const dl = daysLeft(p.endDate || p.fechaEntrega);
      return dl != null && dl < 0;
    });
    if (vencidos.length > 0) {
      alerts.push({
        id: "vencidos", color: "red", icon: "⏰",
        text: `${vencidos.length} proyecto${vencidos.length > 1 ? "s" : ""} con plazo vencido`,
        sub: vencidos.map(p => p.name || p.nombre || "—").slice(0, 2).join(", ") + (vencidos.length > 2 ? ` y ${vencidos.length - 2} más` : ""),
        onPress: () => setModal({
          title: "Proyectos con plazo vencido",
          items: vencidos.map(p => ({
            label: p.name || p.nombre || "—",
            sub: `${p.client || p.cliente || "—"} · ${Math.abs(daysLeft(p.endDate || p.fechaEntrega))}d vencido · ${clampInt(p.progress ?? p.avance ?? 0, 0, 100)}% avance`,
            color: "red",
            onClick: () => { setModal(null); nav(`/proyectos/${p.id}`); },
          })),
        }),
      });
    }
    const garantiasPendientes = garantias.filter(g => g.estado === "pendiente");
    if (garantiasPendientes.length > 0) {
      const urgentes = garantiasPendientes.filter(g => g.prioridad === "urgente");
      alerts.push({
        id: "garantias", color: urgentes.length > 0 ? "red" : "amber", icon: "🛡️",
        text: `${garantiasPendientes.length} garantía${garantiasPendientes.length > 1 ? "s" : ""} sin responder`,
        sub: urgentes.length > 0 ? `${urgentes.length} marcada${urgentes.length > 1 ? "s" : ""} como urgente` : "Pendientes de primera respuesta",
        onPress: () => setModal({
          title: "Garantías pendientes",
          items: garantiasPendientes.map(g => {
            const proj = projects.find(p => p.id === g._projectId);
            return {
              label: g.titulo || g.descripcion?.slice(0, 40) || "Solicitud",
              sub: `${proj?.name || proj?.nombre || g._projectId} · ${g.nombreCliente || "—"}${g.prioridad === "urgente" ? " · 🚨 Urgente" : ""}`,
              color: g.prioridad === "urgente" ? "red" : "amber",
              onClick: () => { setModal(null); nav(`/proyectos/${g._projectId}/garantias`); },
            };
          }),
        }),
      });
    }
    const atrasados = projects.filter(p => {
      const s = (p.status || p.estado || "").toLowerCase();
      if (s === "archivado") return false;
      const prog = clampInt(p.progress ?? p.avance ?? 0, 0, 100);
      if (prog >= 100) return false;
      const dl = daysLeft(p.endDate || p.fechaEntrega);
      return dl != null && dl >= 0 && dl <= 14 && prog < 70;
    });
    if (atrasados.length > 0 && alerts.length < 3) {
      alerts.push({
        id: "atrasados", color: "amber", icon: "📉",
        text: `${atrasados.length} proyecto${atrasados.length > 1 ? "s" : ""} con avance bajo`,
        sub: "Quedan ≤14 días y avance es menor al 70%",
        onPress: () => setModal({
          title: "Proyectos con avance bajo",
          items: atrasados.map(p => ({
            label: p.name || p.nombre || "—",
            sub: `${p.client || p.cliente || "—"} · ${daysLeft(p.endDate || p.fechaEntrega)}d restantes · ${clampInt(p.progress ?? p.avance ?? 0, 0, 100)}% avance`,
            color: "amber",
            onClick: () => { setModal(null); nav(`/proyectos/${p.id}`); },
          })),
        }),
      });
    }
    return alerts.slice(0, 3);
  }, [projects, garantias, nav]);

  const teamStats = useMemo(() => {
    return colaboradores.map(col => {
      const fases = [];
      projects.forEach(p => {
        (Array.isArray(p.fases) ? p.fases : []).forEach(f => {
          if (f.responsableUid === col.uid) fases.push({ ...f, proyectoId: p.id, proyectoNombre: p.name || p.nombre || "—" });
        });
      });
      const completadas = fases.filter(f => f.estado === "completada" || clampInt(f.porcentaje, 0, 100) >= 100).length;
      const pendientes = fases.length - completadas;
      const conFecha = fases
        .filter(f => f.estado !== "completada" && f.fechaEntregaResponsable)
        .sort((a, b) => new Date(a.fechaEntregaResponsable) - new Date(b.fechaEntregaResponsable));
      const proxima = conFecha[0] || null;
      const proximaDl = proxima ? daysLeft(proxima.fechaEntregaResponsable) : null;
      return { ...col, fases, completadas, pendientes, total: fases.length, proxima, proximaDl };
    }).filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [colaboradores, projects]);

  const recientes = useMemo(() => projects.slice(0, 4), [projects]);

  // Avances pendientes de aprobacion — cruza todos los proyectos y sus fases
  const pendingApprovals = useMemo(() => {
    const list = [];
    projects.forEach(p => {
      (Array.isArray(p.fases) ? p.fases : []).forEach(f => {
        const val = Number(f.avancePropuesto);
        if (f.avancePropuesto != null && Number.isFinite(val) && val > 0 && !!f.avancePropuestoPorUid) {
          list.push({
            projectId: p.id,
            projectName: p.name || p.nombre || "Proyecto",
            faseId: f.id,
            faseNombre: f.nombre || "Fase",
            porcentajeActual: clampInt(f.porcentaje, 0, 100),
            avancePropuesto: clampInt(f.avancePropuesto, 0, 100),
            propuestoPor: f.avancePropuestoPorNombre || "Colaborador",
            nota: f.notaAvancePropuesto || "",
            propuestoAt: f.avancePropuestoAt || null,
          });
        }
      });
    });
    return list;
  }, [projects]);

  // Garantías con propuesta de jurídica pendiente de aprobación
  const pendingGarantias = useMemo(() => {
    return garantias
      .filter(g => !!g.respuestaPropuesta)
      .map(g => ({
        ...g,
        proyectoNombre: projects.find(p => p.id === g._projectId)?.name || "Proyecto",
      }));
  }, [garantias, projects]);

  // Trazabilidad de todas las solicitudes de contrato que ha hecho el admin
  const trazabilidadContratos = useMemo(() => {
    return projects
      .filter(p => p.contratoSolicitado)
      .map(p => {
        let estado, estadoColor;
        if (p.contratoURL) {
          estado = "Resuelto";
          estadoColor = "green";
        } else if (p.contratoPropuesto) {
          estado = "Propuesta en revisión";
          estadoColor = "amber";
        } else {
          estado = "Pendiente";
          estadoColor = "neutral";
        }
        return {
          projectId: p.id,
          projectName: p.name || p.nombre || "Proyecto",
          solicitadoAt: p.contratoSolicitado.solicitadoAt || null,
          estado,
          estadoColor,
          propuestoPor: p.contratoPropuesto?.subidoPor || null,
        };
      })
      .sort((a, b) => {
        const order = { "Pendiente": 0, "Propuesta en revisión": 1, "Resuelto": 2 };
        return (order[a.estado] ?? 3) - (order[b.estado] ?? 3);
      });
  }, [projects]);

  // Contratos propuestos pendientes de aprobacion
  const pendingContratos = useMemo(() => {
    return projects
      .filter(p => p.contratoPropuesto?.url)
      .map(p => ({
        projectId: p.id,
        projectName: p.name || p.nombre || "Proyecto",
        url: p.contratoPropuesto.url,
        propuestoPor: p.contratoPropuesto.subidoPor || "Colaborador",
        propuestoPorUid: p.contratoPropuesto.subidoPorUid || null,
        propuestoAt: p.contratoPropuesto.subidoAt || null,
      }));
  }, [projects]);

  const handleAprobarContrato = async ({ projectId }) => {
    setContratoActionId(projectId);
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project?.contratoPropuesto?.url) return;
      await updateDoc(doc(db, "projects", projectId), {
        contratoURL: project.contratoPropuesto.url,
        contratoPropuesto: null,
        updatedAt: serverTimestamp(),
      });
      setProjects(prev => prev.map(p => p.id === projectId
        ? { ...p, contratoURL: p.contratoPropuesto.url, contratoPropuesto: null }
        : p));
      setApprovalToast("Contrato aprobado y publicado al cliente.");
      setTimeout(() => setApprovalToast(""), 3000);
    } catch (e) {
      console.error(e);
      setApprovalToast("Error al aprobar contrato.");
      setTimeout(() => setApprovalToast(""), 3000);
    } finally {
      setContratoActionId(null);
    }
  };

  const handleRechazarContrato = async ({ projectId, projectName, propuestoPor, propuestoPorUid }, reason = "") => {
    setContratoActionId(projectId);
    try {
      await updateDoc(doc(db, "projects", projectId), {
        contratoPropuesto: null,
        updatedAt: serverTimestamp(),
      });
      if (propuestoPorUid && reason.trim()) {
        try {
          const { createNotification } = await import("../lib/notifications.js");
          createNotification(propuestoPorUid, {
            type: "contrato_rechazado",
            title: "Propuesta de contrato rechazada",
            body: `Tu propuesta de contrato para "${projectName}" fue rechazada. Motivo: ${reason.trim()}`,
            projectId,
            projectName,
          });
        } catch (e) { console.error(e); }
      }
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, contratoPropuesto: null } : p));
      setApprovalToast("Propuesta de contrato rechazada.");
      setTimeout(() => setApprovalToast(""), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setContratoActionId(null);
    }
  };

  const confirmContratoReject = async () => {
    if (!contratoRejectModal) return;
    await handleRechazarContrato(contratoRejectModal, contratoRejectReason);
    setContratoRejectModal(null);
    setContratoRejectReason("");
  };

  const handleApproveFromDashboard = async ({ projectId, faseId, avancePropuesto }) => {
    const key = `${projectId}:${faseId}`;
    setApprovingId(key);
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      const nextFases = (project.fases || []).map(f => {
        if (f.id !== faseId) return f;
        const pct = clampInt(avancePropuesto, 0, 100);
        let estado = "pendiente";
        if (pct >= 100) estado = "completada";
        else if (pct > 0) estado = "en_curso";
        return {
          ...f, porcentaje: pct, estado,
          avancePropuesto: null, notaAvancePropuesto: "",
          avancePropuestoPorUid: null, avancePropuestoPorNombre: null, avancePropuestoAt: null,
        };
      });
      const progress = calcAvanceGlobal(nextFases);
      await updateDoc(doc(db, "projects", projectId), {
        fases: nextFases, progress, updatedAt: serverTimestamp(),
      });
      // Hacer archivos de la fase visibles al cliente
      try {
        const archRef = collection(db, "projects", projectId, "fases", faseId, "archivos");
        const archSnap = await getDocs(query(archRef, where("visibleToClient", "==", false)));
        if (!archSnap.empty) {
          const batch = writeBatch(db);
          archSnap.docs.forEach(d => batch.update(d.ref, { visibleToClient: true }));
          await batch.commit();
        }
      } catch (e) { console.error(e); }
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, fases: nextFases, progress } : p));
      setApprovalToast("Avance aprobado correctamente.");
      setTimeout(() => setApprovalToast(""), 3000);
    } catch (e) {
      console.error(e);
      setApprovalToast("Error al aprobar. Intenta de nuevo.");
      setTimeout(() => setApprovalToast(""), 3000);
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectFromDashboard = async ({ projectId, faseId, propuestoPor, faseNombre, projectName }, reason = "") => {
    const key = `${projectId}:${faseId}`;
    setApprovingId(key);
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      const fase = (project.fases || []).find(f => f.id === faseId);
      const nextFases = (project.fases || []).map(f => (
        f.id !== faseId ? f : {
          ...f,
          avancePropuesto: null, notaAvancePropuesto: "",
          avancePropuestoPorUid: null, avancePropuestoPorNombre: null, avancePropuestoAt: null,
        }
      ));
      await updateDoc(doc(db, "projects", projectId), {
        fases: nextFases, updatedAt: serverTimestamp(),
      });
      // Notificar al colaborador con el motivo
      const responsableUid = fase?.responsableUid || fase?.avancePropuestoPorUid;
      if (responsableUid && reason.trim()) {
        try {
          const { createNotification } = await import("../lib/notifications.js");
          createNotification(responsableUid, {
            type: "avance_rechazado",
            title: "Propuesta rechazada",
            body: `Tu propuesta para "${faseNombre}" en ${projectName} fue rechazada. Motivo: ${reason.trim()}`,
            projectId,
            projectName,
          });
        } catch (e) { console.error(e); }
      }
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, fases: nextFases } : p));
      setApprovalToast("Propuesta rechazada.");
      setTimeout(() => setApprovalToast(""), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setApprovingId(null);
    }
  };

  const confirmDashReject = async () => {
    if (!dashRejectModal) return;
    await handleRejectFromDashboard(dashRejectModal, dashRejectReason);
    setDashRejectModal(null);
    setDashRejectReason("");
  };

  if (!ready) return <p className="text-[13px]" style={{ color: "rgb(var(--ink) / 0.6)" }}>Verificando sesión…</p>;

  if (loading) return (
    <div className="space-y-3">
      <div className="rounded-[22px] h-28 animate-pulse" style={{ background: "rgb(var(--ink) / 0.08)" }} />
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="rounded-2xl h-20 animate-pulse" style={{ background: "rgb(var(--ink) / 0.06)" }} />)}
      </div>
      <div className="rounded-2xl h-32 animate-pulse" style={{ background: "rgb(var(--ink) / 0.06)" }} />
    </div>
  );

  if (err) return (
    <div className="space-y-2 py-2">
      <p className="text-[13px] text-red-600">{err}</p>
      <button className="btn-outline text-[12px]" onClick={() => globalThis.location.reload()}>Recargar</button>
    </div>
  );

  const first = (user?.name || "Admin").trim().split(" ")[0];
  const today = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

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
                className="w-7 h-7 rounded-full flex items-center justify-center text-ink/40 hover:bg-black/5 transition-colors">
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
        <p className="text-[10px] uppercase tracking-[0.22em] text-ivory/40 font-medium">{today}</p>
        <div className="flex items-end justify-between gap-3 mt-1.5">
          <div>
            <h1 className="text-[24px] font-bold leading-snug tracking-tight">Buenos días, {first}.</h1>
            <p className="text-[12px] text-ivory/50 mt-0.5">
              {projects.length === 0
                ? "Sin proyectos aún."
                : `${projects.length} proyecto${projects.length > 1 ? "s" : ""} en cartera · ${kpis.activos.length} activo${kpis.activos.length !== 1 ? "s" : ""}.`}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-ivory/20 bg-ivory/8 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-ivory/70 flex-shrink-0">
            Admin
          </span>
        </div>
      </div>

      {/* ── Banner notificaciones ── */}
      {typeof Notification !== "undefined" && Notification.permission !== "granted" && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-amber-800">🔔 Activa las notificaciones</p>
            <p className="text-[11px] text-amber-700/80 mt-0.5">Para recibir alertas en tiempo real.</p>
          </div>
          <button type="button" onClick={async () => { try { await requestPermission(); } catch (e) { console.error(e); } }}
            className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-[12px] font-semibold px-4 py-2 rounded-xl transition-all">
            Activar
          </button>
        </div>
      )}

      {/* ── 4 KPIs ── */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Proyectos activos" value={kpis.activos.length} sub="toca para ver lista"
          color="neutral" icon="🏗️"
          onClick={() => setModal({
            title: "Proyectos activos",
            items: kpis.activos.map(p => ({
              label: p.name || p.nombre || "—",
              sub: `${p.client || p.cliente || "—"} · ${clampInt(p.progress ?? p.avance ?? 0, 0, 100)}% avance`,
              color: "neutral",
              onClick: () => { setModal(null); nav(`/proyectos/${p.id}`); },
            })),
          })} />
        <KpiCard label="Avance promedio" animated={kpis.promedioAvance} sub="sobre proyectos activos"
          color={kpis.promedioAvance >= 60 ? "green" : "amber"} icon="📈" />
        <KpiCard label="Garantías abiertas" value={kpis.garantiasAbiertas.length} sub="toca para ver detalle"
          color={kpis.garantiasAbiertas.length > 0 ? "amber" : "green"} icon="🛡️"
          onClick={kpis.garantiasAbiertas.length > 0 ? () => setModal({
            title: "Garantías abiertas",
            items: kpis.garantiasAbiertas.map(g => {
              const proj = projects.find(p => p.id === g._projectId);
              return {
                label: g.titulo || g.descripcion?.slice(0, 40) || "Solicitud",
                sub: `${proj?.name || proj?.nombre || "—"} · ${g.estado === "pendiente" ? "Sin responder" : "En revisión"}${g.prioridad === "urgente" ? " · 🚨 Urgente" : ""}`,
                color: g.prioridad === "urgente" ? "red" : "amber",
                onClick: () => { setModal(null); nav(`/proyectos/${g._projectId}/garantias`); },
              };
            }),
          }) : null} />
        <KpiCard label="En riesgo" value={kpis.enRiesgo.length} sub="toca para ver detalle"
          color={kpis.enRiesgo.length > 0 ? "red" : "green"} icon={kpis.enRiesgo.length > 0 ? "⚠️" : "✅"}
          onClick={kpis.enRiesgo.length > 0 ? () => setModal({
            title: "Proyectos en riesgo",
            items: kpis.enRiesgo.map(p => {
              const dl = daysLeft(p.endDate || p.fechaEntrega);
              return {
                label: p.name || p.nombre || "—",
                sub: `${p.client || p.cliente || "—"} · ${dl < 0 ? `Vencido ${Math.abs(dl)}d` : `${dl}d restantes`} · ${clampInt(p.progress ?? p.avance ?? 0, 0, 100)}% avance`,
                color: "red",
                onClick: () => { setModal(null); nav(`/proyectos/${p.id}`); },
              };
            }),
          }) : null} />
      </div>

      {/* ── Pulso hoy ── */}
      <div className="rounded-2xl border border-black/[0.07] dark:border-white/10 bg-ivory dark:bg-white/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          {pulso.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
          <p className="text-[12px] font-semibold text-ink dark:text-white/90">Pulso hoy</p>
        </div>
        {pulso.length === 0 ? (
          <div className="flex items-center gap-3 py-1">
            <span className="text-[22px]">✅</span>
            <div>
              <p className="text-[13px] font-medium text-ink dark:text-white/80">Todo en orden</p>
              <p className="text-[11px] text-ink/45 dark:text-white/35">Sin alertas activas en este momento.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {pulso.map(alert => <AlertRow key={alert.id} alert={alert} />)}
          </div>
        )}
      </div>

      {/* ── Modal rechazo dashboard ── */}
      {dashRejectModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 pb-4"
          onClick={() => { setDashRejectModal(null); setDashRejectReason(""); }}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-black/10"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-black/[0.06]">
              <p className="text-[14px] font-bold" style={{ color: "rgb(var(--ink))" }}>Rechazar propuesta</p>
              <p className="text-[12px] mt-0.5" style={{ color: "rgb(var(--ink) / 0.5)" }}>
                {dashRejectModal.projectName} — {dashRejectModal.faseNombre}
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-[12px] font-semibold mb-1.5" style={{ color: "rgb(var(--ink) / 0.7)" }}>
                  Motivo del rechazo <span className="text-red-500">*</span>
                </p>
                <textarea
                  value={dashRejectReason}
                  onChange={e => setDashRejectReason(e.target.value)}
                  rows={3} maxLength={300} autoFocus
                  placeholder="Explica al colaborador que debe corregir..."
                  className="w-full border rounded-xl px-3 py-2 text-[13px] outline-none resize-none"
                  style={{ borderColor: "rgb(var(--taupe) / 0.35)", color: "rgb(var(--ink))" }}
                />
                <p className="text-[10px] mt-1" style={{ color: "rgb(var(--ink) / 0.4)" }}>
                  {dashRejectModal.propuestoPor} recibira una notificacion con este mensaje.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { setDashRejectModal(null); setDashRejectReason(""); }}
                  className="flex-1 py-2.5 rounded-xl border text-[13px] transition"
                  style={{ borderColor: "rgb(var(--ink) / 0.2)", color: "rgb(var(--ink) / 0.6)" }}>
                  Cancelar
                </button>
                <button type="button"
                  onClick={confirmDashReject}
                  disabled={!dashRejectReason.trim() || !!approvingId}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition disabled:opacity-50">
                  {approvingId ? "..." : "Confirmar rechazo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF preview modal ── */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90"
          onClick={() => setPdfPreviewUrl(null)}>
          <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0"
            onClick={e => e.stopPropagation()}>
            <p className="text-white text-[13px] font-medium">Vista previa del contrato</p>
            <div className="flex items-center gap-2">
              <a href={pdfPreviewUrl} target="_blank" rel="noopener noreferrer"
                className="text-[11px] px-3 py-1.5 rounded-full border border-white/30 text-white/80 hover:text-white transition">
                Descargar
              </a>
              <button type="button" onClick={() => setPdfPreviewUrl(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition">
                ×
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden" onClick={e => e.stopPropagation()}>
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfPreviewUrl)}&embedded=true`}
              className="w-full h-full border-0"
              title="Vista previa PDF"
            />
          </div>
        </div>
      )}

      {/* ── Modal rechazo contrato ── */}
      {contratoRejectModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 pb-4"
          onClick={() => { setContratoRejectModal(null); setContratoRejectReason(""); }}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-black/10"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-black/[0.06]">
              <p className="text-[14px] font-bold" style={{ color: "rgb(var(--ink))" }}>Rechazar propuesta de contrato</p>
              <p className="text-[12px] mt-0.5" style={{ color: "rgb(var(--ink) / 0.5)" }}>
                {contratoRejectModal.projectName}
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-[12px] font-semibold mb-1.5" style={{ color: "rgb(var(--ink) / 0.7)" }}>
                  Motivo del rechazo <span className="text-red-500">*</span>
                </p>
                <textarea
                  value={contratoRejectReason}
                  onChange={e => setContratoRejectReason(e.target.value)}
                  rows={3} maxLength={300} autoFocus
                  placeholder="Indica al jurídico qué debe corregir..."
                  className="w-full border rounded-xl px-3 py-2 text-[13px] outline-none resize-none"
                  style={{ borderColor: "rgb(var(--taupe) / 0.35)", color: "rgb(var(--ink))" }}
                />
                <p className="text-[10px] mt-1" style={{ color: "rgb(var(--ink) / 0.4)" }}>
                  {contratoRejectModal.propuestoPor} recibirá una notificación con este mensaje.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { setContratoRejectModal(null); setContratoRejectReason(""); }}
                  className="flex-1 py-2.5 rounded-xl border text-[13px] transition"
                  style={{ borderColor: "rgb(var(--ink) / 0.2)", color: "rgb(var(--ink) / 0.6)" }}>
                  Cancelar
                </button>
                <button type="button"
                  onClick={confirmContratoReject}
                  disabled={!contratoRejectReason.trim() || !!contratoActionId}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition disabled:opacity-50">
                  {contratoActionId ? "..." : "Confirmar rechazo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast aprobacion ── */}
      {approvalToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-ink text-ivory text-[12px] font-medium px-4 py-2.5 rounded-2xl shadow-xl">
          {approvalToast}
        </div>
      )}

      {/* ── Avances pendientes de aprobacion ── */}
      {pendingApprovals.length > 0 && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            <p className="text-[12px] font-semibold text-amber-900 dark:text-amber-200">
              Avances pendientes de aprobacion
            </p>
            <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
              {pendingApprovals.length}
            </span>
          </div>
          <div className="space-y-2">
            {pendingApprovals.map(item => {
              const key = `${item.projectId}:${item.faseId}`;
              const busy = approvingId === key;
              return (
                <div key={key}
                  className="rounded-xl border border-amber-200 dark:border-amber-700 bg-white dark:bg-amber-900/20 p-3 space-y-2.5">
                  {/* Info */}
                  <button type="button" onClick={() => nav(`/proyectos/${item.projectId}`)} className="w-full text-left">
                    <p className="text-[12px] font-semibold text-ink dark:text-white hover:underline truncate">
                      {item.projectName}
                    </p>
                    <p className="text-[11px] text-ink/55 dark:text-white/50 mt-0.5">
                      Fase: <span className="font-medium text-ink/70 dark:text-white/70">{item.faseNombre}</span>
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-ink/60 dark:text-white/50 font-medium">{item.propuestoPor}</span>
                    <span className="text-[10px] text-ink/40 dark:text-white/30">propuso</span>
                    <span className="text-[12px] font-bold text-amber-700 dark:text-amber-300">
                      {item.porcentajeActual}% → {item.avancePropuesto}%
                    </span>
                  </div>
                  {item.nota && (
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap">
                      {item.nota}
                    </p>
                  )}
                  {/* Acciones */}
                  <div className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => handleApproveFromDashboard(item)}
                      disabled={busy}
                      className="flex-1 text-[11px] font-semibold py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white transition disabled:opacity-50 active:scale-[0.98]">
                      {busy ? "..." : "Aprobar"}
                    </button>
                    <button type="button"
                      onClick={() => { setDashRejectModal(item); setDashRejectReason(""); }}
                      disabled={busy}
                      className="flex-1 text-[11px] font-semibold py-2 rounded-xl border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition disabled:opacity-50 active:scale-[0.98]">
                      Rechazar
                    </button>
                    <button type="button"
                      onClick={() => nav(`/proyectos/${item.projectId}`)}
                      className="px-3 py-2 rounded-xl border border-ink/15 dark:border-white/15 text-ink/50 dark:text-white/40 hover:text-ink dark:hover:text-white hover:border-ink/30 dark:hover:border-white/30 transition text-[11px]">
                      Ver
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Garantías propuestas por jurídica pendientes de aprobación ── */}
      {pendingGarantias.length > 0 && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            <p className="text-[12px] font-semibold text-amber-900 dark:text-amber-200">
              Respuestas de garantía — pendientes de aprobación
            </p>
            <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
              {pendingGarantias.length}
            </span>
          </div>
          <div className="space-y-2">
            {pendingGarantias.map(g => (
              <div key={g.id}
                className="rounded-xl border border-amber-200 dark:border-amber-700 bg-white dark:bg-amber-900/20 p-3 space-y-2">
                <button type="button" onClick={() => nav(`/proyectos/${g._projectId}/garantias`)} className="w-full text-left">
                  <p className="text-[12px] font-semibold text-ink dark:text-white hover:underline truncate">
                    {g.proyectoNombre}
                  </p>
                  <p className="text-[11px] text-ink/55 dark:text-white/50 mt-0.5">
                    Por: <span className="font-medium text-ink/70 dark:text-white/70">{g.respuestaPropuesta.propuestoPor || "Jurídica"}</span>
                  </p>
                </button>
                {g.respuestaPropuesta.texto && (
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 rounded-lg px-2.5 py-1.5 line-clamp-2">
                    {g.respuestaPropuesta.texto}
                  </p>
                )}
                <button type="button" onClick={() => nav(`/proyectos/${g._projectId}/garantias`)}
                  className="w-full text-[11px] font-semibold py-2 rounded-xl border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition active:scale-[0.98]">
                  Revisar y aprobar →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Contratos pendientes de aprobacion ── */}
      {pendingContratos.length > 0 && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            <p className="text-[12px] font-semibold text-amber-900 dark:text-amber-200">
              Contratos pendientes de aprobacion
            </p>
            <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
              {pendingContratos.length}
            </span>
          </div>
          <div className="space-y-2">
            {pendingContratos.map(item => {
              const busy = contratoActionId === item.projectId;
              return (
                <div key={item.projectId}
                  className="rounded-xl border border-amber-200 dark:border-amber-700 bg-white dark:bg-amber-900/20 p-3 space-y-2.5">
                  <button type="button" onClick={() => nav(`/proyectos/${item.projectId}`)} className="w-full text-left">
                    <p className="text-[12px] font-semibold text-ink dark:text-white hover:underline truncate">
                      {item.projectName}
                    </p>
                    <p className="text-[11px] text-ink/55 dark:text-white/50 mt-0.5">
                      Propuesto por <span className="font-medium text-ink/70 dark:text-white/70">{item.propuestoPor}</span>
                    </p>
                  </button>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button"
                      onClick={() => setPdfPreviewUrl(item.url)}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition">
                      Ver PDF
                    </button>
                    <button type="button"
                      onClick={() => handleAprobarContrato(item)}
                      disabled={busy}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white transition disabled:opacity-50 active:scale-[0.98]">
                      {busy ? "..." : "Aprobar"}
                    </button>
                    <button type="button"
                      onClick={() => { setContratoRejectModal(item); setContratoRejectReason(""); }}
                      disabled={busy}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50 active:scale-[0.98]">
                      Rechazar
                    </button>
                    <button type="button"
                      onClick={() => nav(`/proyectos/${item.projectId}`)}
                      className="ml-auto text-[11px] text-ink/40 dark:text-white/30 hover:text-ink dark:hover:text-white transition">
                      Ver proyecto →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Trazabilidad de contratos solicitados ── */}
      {trazabilidadContratos.some(c => c.estado !== "Resuelto") && (
        <div className="rounded-2xl border border-black/[0.07] dark:border-white/10 bg-ivory dark:bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            <p className="text-[12px] font-semibold text-ink dark:text-white/90">Contratos solicitados</p>
            <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
              {trazabilidadContratos.filter(c => c.estado !== "Resuelto").length}
            </span>
          </div>
          <div className="space-y-1.5">
            {trazabilidadContratos.filter(c => c.estado !== "Resuelto").map(item => {
              const dot = item.estadoColor === "green" ? "bg-emerald-400"
                : item.estadoColor === "amber" ? "bg-amber-400 animate-pulse"
                : "bg-ink/25 dark:bg-white/25";
              const badge = item.estadoColor === "green"
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                : item.estadoColor === "amber"
                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                : "bg-ink/8 dark:bg-white/8 text-ink/55 dark:text-white/40";
              return (
                <button key={item.projectId} type="button"
                  onClick={() => nav(`/proyectos/${item.projectId}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] active:scale-[0.99] transition-all text-left">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate text-ink dark:text-white/85">{item.projectName}</p>
                    {item.propuestoPor && (
                      <p className="text-[10px] text-ink/45 dark:text-white/30 truncate">
                        Propuesto por {item.propuestoPor}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${badge}`}>
                    {item.estado}
                  </span>
                  <svg className="w-3 h-3 flex-shrink-0 text-ink/20 dark:text-white/20"
                    fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Trazabilidad del equipo ── */}
      {teamStats.length > 0 && (
        <div className="rounded-2xl border border-black/[0.07] dark:border-white/10 bg-ivory dark:bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-ink dark:text-white/90">Trazabilidad del equipo</p>
            <button type="button" onClick={() => nav("/colaboradores")}
              className="text-[11px] text-ink/40 dark:text-white/35 hover:text-ink dark:hover:text-white transition">Ver equipo →</button>
          </div>
          <div className="space-y-2">
            {teamStats.map(col => (
              <ColaboradorRow key={col.uid} col={col} onPress={() => setModal({
                title: `Fases de ${col.name || col.email}`,
                items: col.fases.map(f => {
                  const done = f.estado === "completada" || clampInt(f.porcentaje, 0, 100) >= 100;
                  const dl = f.fechaEntregaResponsable ? daysLeft(f.fechaEntregaResponsable) : null;
                  return {
                    label: f.nombre,
                    sub: `${f.proyectoNombre}${dl !== null ? ` · ${dl < 0 ? `Vencida ${Math.abs(dl)}d` : `${dl}d`}` : ""}`,
                    color: done ? "green" : dl !== null && dl < 0 ? "red" : "neutral",
                    onClick: () => { setModal(null); nav(`/proyectos/${f.proyectoId}`); },
                  };
                }),
              })} />
            ))}
          </div>
        </div>
      )}

      {/* ── Actividad reciente ── */}
      {recientes.length > 0 && (
        <div className="rounded-2xl border border-black/[0.07] dark:border-white/10 bg-ivory dark:bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-ink dark:text-white/90">Actividad reciente</p>
            <button type="button" onClick={() => nav("/proyectos")}
              className="text-[11px] text-ink/40 dark:text-white/35 hover:text-ink dark:hover:text-white transition">Ver todos →</button>
          </div>
          <div className="space-y-1">
            {recientes.map(p => (
              <RecentProject key={p.id} project={p} onClick={() => nav(`/proyectos/${p.id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Acciones rápidas ── */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction icon="➕" label="Nuevo proyecto" sub="Crear" onClick={() => nav("/proyectos/nuevo")} />
        <QuickAction icon="🕐" label="Historial" sub="Archivados" onClick={() => nav("/historial")} />
        <QuickAction icon="👥" label="Colaborador" sub="Equipo" onClick={() => nav("/colaboradores")} />
      </div>

    </section>
  );
}

/* ── Colaborador row en trazabilidad ── */
function ColaboradorRow({ col, onPress }) {
  const pct = col.total > 0 ? Math.round((col.completadas / col.total) * 100) : 0;
  const [barWidth, setBarWidth] = useState(0);
  const dl = col.proximaDl;

  useEffect(() => {
    const t = setTimeout(() => setBarWidth(pct), 600);
    return () => clearTimeout(t);
  }, [pct]);

  let fechaLabel = "", fechaCls = { color: "rgb(var(--ink) / 0.4)" };
  if (col.proxima) {
    if (dl < 0) { fechaLabel = `Vencida ${Math.abs(dl)}d`; fechaCls = { color: "#dc2626", fontWeight: 600 }; }
    else if (dl === 0) { fechaLabel = "Hoy"; fechaCls = { color: "#dc2626", fontWeight: 600 }; }
    else if (dl <= 3) { fechaLabel = `${dl}d`; fechaCls = { color: "#d97706", fontWeight: 600 }; }
    else { fechaLabel = `${dl}d`; }
  }

  const barCls = pct === 100 ? "bg-emerald-400 dark:bg-emerald-500"
    : pct >= 60 ? "bg-amber-400 dark:bg-amber-500"
    : pct > 0 ? "bg-red-400 dark:bg-red-500"
    : "bg-ink/20 dark:bg-white/20";
  const cntCls = pct === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-ink/50 dark:text-white/40";

  return (
    <button type="button" onClick={onPress}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/[0.025] dark:bg-white/[0.04] hover:bg-black/[0.045] dark:hover:bg-white/[0.07] active:scale-[0.99] transition-all text-left">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold text-ivory dark:text-ink bg-ink dark:bg-white/90">
        {(col.name || col.email || "?")[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-[12px] font-semibold truncate text-ink dark:text-white/90">
            {col.name || col.email}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {fechaLabel && <span className="text-[10px]" style={fechaCls}>⏱ {fechaLabel}</span>}
            <span className={`text-[10px] font-semibold ${cntCls}`}>
              {col.completadas}/{col.total}
            </span>
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden bg-ink/8 dark:bg-white/10">
          <div className={`h-full rounded-full transition-all duration-700 ease-out ${barCls}`}
            style={{ width: `${barWidth}%` }} />
        </div>
      </div>
      <svg className="w-3 h-3 flex-shrink-0 text-ink/20 dark:text-white/20"
        fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

/* ── Alert row ── */
function AlertRow({ alert }) {
  const styles = {
    red:   { wrap: "bg-red-50 dark:bg-red-900/25 border-red-200 dark:border-red-800",    title: "text-red-800 dark:text-red-300",    sub: "text-red-600/80 dark:text-red-400/80" },
    amber: { wrap: "bg-amber-50 dark:bg-amber-900/25 border-amber-200 dark:border-amber-800", title: "text-amber-800 dark:text-amber-300", sub: "text-amber-700/80 dark:text-amber-400/80" },
  };
  const s = styles[alert.color] || styles.amber;
  return (
    <button type="button" onClick={alert.onPress}
      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${s.wrap} hover:shadow-sm active:scale-[0.99] transition-all`}>
      <span className="text-[18px] flex-shrink-0">{alert.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-semibold leading-snug ${s.title}`}>{alert.text}</p>
        <p className={`text-[10px] mt-0.5 ${s.sub}`}>{alert.sub}</p>
      </div>
      <svg className={`w-3.5 h-3.5 flex-shrink-0 opacity-40 ${alert.color === "red" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}
        fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

/* ── Recent project row ── */
function RecentProject({ project, onClick }) {
  const prog = clampInt(project.progress ?? project.avance ?? 0, 0, 100);
  const [barWidth, setBarWidth] = useState(0);
  const ts = project.updatedAt?.seconds || project.createdAt?.seconds;
  const ago = ts ? timeAgo(ts) : "";
  const fases = Array.isArray(project.fases) ? project.fases : [];

  // Color semáforo basado en avance global
  const progColor = prog >= 80 ? "text-emerald-600 dark:text-emerald-400"
    : prog >= 40 ? "text-amber-600 dark:text-amber-400"
    : "text-red-500 dark:text-red-400";
  const barColor = prog >= 80 ? "bg-emerald-400 dark:bg-emerald-500"
    : prog >= 40 ? "bg-amber-400 dark:bg-amber-500"
    : "bg-red-400 dark:bg-red-500";

  useEffect(() => {
    const t = setTimeout(() => setBarWidth(prog), 600);
    return () => clearTimeout(t);
  }, [prog]);

  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] active:scale-[0.99] transition-all text-left group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[13px] font-medium truncate text-ink dark:text-white/90">
            {project.name || project.nombre || "Proyecto"}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {ago && <span className="text-[10px] text-ink/35 dark:text-white/30">{ago}</span>}
            <span className={`text-[12px] font-bold ${progColor}`}>{prog}%</span>
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden bg-black/8 dark:bg-white/10">
          <div className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
            style={{ width: `${barWidth}%` }} />
        </div>
      </div>
      <svg className="w-3 h-3 opacity-0 group-hover:opacity-25 transition-opacity flex-shrink-0 text-ink dark:text-white"
        fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

/* ── KPI card ── */
function KpiCard({ label, value, sub, color, icon, animated, onClick }) {
  const borders = { red: "border-l-red-400", amber: "border-l-amber-400", green: "border-l-emerald-400", neutral: "border-l-transparent" };
  const valueColors = { red: "text-red-600", amber: "text-amber-600", green: "text-emerald-600", neutral: "" };
  const counted = useCountUp(typeof animated === "number" ? animated : 0);
  const displayVal = typeof animated === "number" ? `${counted}%` : value;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={`rounded-2xl border border-l-4 ${borders[color]} px-3 py-3 text-left w-full bg-ivory ${onClick ? "active:scale-[0.97] hover:shadow-sm transition-all cursor-pointer" : ""}`}
      style={{ borderColor: "rgb(var(--taupe) / 0.25)" }}>
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <p className="text-[10px] uppercase tracking-[0.1em] font-medium" style={{ color: "rgb(var(--ink) / 0.45)" }}>{label}</p>
        <span className="text-[14px]">{icon}</span>
      </div>
      <p className={`text-[26px] font-bold leading-none ${valueColors[color]}`}
        style={color === "neutral" ? { color: "rgb(var(--ink))" } : {}}>
        {displayVal}
      </p>
      <p className="mt-1 text-[10px]" style={{ color: "rgb(var(--ink) / 0.4)" }}>{sub}</p>
    </Tag>
  );
}

/* ── Quick action ── */
function QuickAction({ icon, label, sub, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-2xl border bg-ivory px-3 py-3 flex flex-col items-center gap-2 hover:shadow-md active:scale-[0.97] transition-all text-center"
      style={{ borderColor: "rgb(var(--taupe) / 0.25)" }}>
      <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[18px]"
        style={{ background: "rgb(var(--sand))" }}>
        {icon}
      </span>
      <div>
        <p className="text-[11px] font-semibold leading-tight" style={{ color: "rgb(var(--ink))" }}>{label}</p>
        <p className="text-[10px] mt-0.5" style={{ color: "rgb(var(--ink) / 0.45)" }}>{sub}</p>
      </div>
    </button>
  );
}

/* ── Helpers ── */
function clampInt(v, a, b) { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, Math.round(n))) : a; }
function daysLeft(d) { if (!d) return null; const t = new Date(d); return Number.isNaN(t.getTime()) ? null : Math.ceil((t - Date.now()) / 86400000); }
function timeAgo(seconds) {
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return "Ahora";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `Hace ${Math.floor(diff / 86400)}d`;
  return new Date(seconds * 1000).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

DashboardAdmin.propTypes = {};
KpiCard.propTypes = { label: PropTypes.string, value: PropTypes.any, sub: PropTypes.string, color: PropTypes.string, icon: PropTypes.string, animated: PropTypes.number, onClick: PropTypes.func };
AlertRow.propTypes = { alert: PropTypes.object.isRequired };
ColaboradorRow.propTypes = { col: PropTypes.object.isRequired, onPress: PropTypes.func.isRequired };
RecentProject.propTypes = { project: PropTypes.object.isRequired, onClick: PropTypes.func.isRequired };
QuickAction.propTypes = { icon: PropTypes.string, label: PropTypes.string, sub: PropTypes.string, onClick: PropTypes.func };

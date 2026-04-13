// src/components/NotificationBell.jsx
import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications.js";
import { useAuth } from "../app/useAuth";
import { timeAgo } from "../utils/timeAgo";

const ICONS = {
  phase_done:                "✅",
  phase_started:             "🚀",
  progress_update:           "📈",
  avance_propuesto:          "📊",
  avance_rechazado:          "↩️",
  deadline_project:          "⏰",
  deadline_fase:             "⏱️",
  new_note:                  "📝",
  new_file:                  "📎",
  new_message:               "💬",
  nueva_garantia:            "🛡️",
  garantia_respondida:       "✔️",
  nueva_solicitud_comercial: "🏗️",
  contrato_propuesto:        "📄",
  contrato_rechazado:        "❌",
  contrato_solicitado:       "📋",
  contrato_aprobado:         "✅",
  general:                   "🔔",
};

const ICON_BG = {
  phase_done:                "bg-emerald-100 text-emerald-700",
  phase_started:             "bg-amber-100 text-amber-700",
  progress_update:           "bg-blue-100 text-blue-700",
  avance_propuesto:          "bg-blue-100 text-blue-700",
  avance_rechazado:          "bg-red-100 text-red-700",
  deadline_project:          "bg-orange-100 text-orange-700",
  deadline_fase:             "bg-orange-100 text-orange-700",
  new_note:                  "bg-violet-100 text-violet-700",
  new_file:                  "bg-sky-100 text-sky-700",
  new_message:               "bg-blue-100 text-blue-700",
  nueva_garantia:            "bg-red-100 text-red-700",
  garantia_respondida:       "bg-emerald-100 text-emerald-700",
  nueva_solicitud_comercial: "bg-amber-100 text-amber-700",
  contrato_propuesto:        "bg-indigo-100 text-indigo-700",
  contrato_rechazado:        "bg-red-100 text-red-700",
  contrato_solicitado:       "bg-indigo-100 text-indigo-700",
  contrato_aprobado:         "bg-emerald-100 text-emerald-700",
  general:                   "bg-gray-100 text-gray-600",
};

/* ── Lista de ítems (componente estable, fuera del render loop) ── */
function NotifList({ items, onItemClick, deleteNotif }) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-2xl mb-2">🔔</p>
        <p className="text-[13px] font-medium text-ink/50">Sin notificaciones aún</p>
        <p className="text-[11px] text-ink/35 mt-1 leading-snug">
          Aparecerán aquí cuando haya actualizaciones en tu proyecto.
        </p>
      </div>
    );
  }
  return (
    <>
      {items.map(n => (
        <div
          key={n.id}
          className={`flex items-start gap-3 px-4 py-3 border-b border-black/[0.04] last:border-0 ${n.read ? "" : "bg-amber-50/60"}`}
        >
          <button type="button" onClick={() => onItemClick(n)}
            className="flex items-start gap-3 flex-1 min-w-0 text-left">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[14px] mt-0.5 ${ICON_BG[n.type] || "bg-gray-100 text-gray-600"}`}>
              {ICONS[n.type] || "🔔"}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[12px] leading-snug ${n.read ? "font-medium text-ink/75" : "font-semibold text-ink"}`}>
                {n.title}
              </p>
              <p className="text-[11px] text-ink/55 mt-0.5 leading-snug line-clamp-2">{n.body}</p>
              <p className="text-[10px] text-ink/35 mt-1">{timeAgo(n.createdAt)}</p>
            </div>
          </button>
          <button type="button" onClick={() => deleteNotif(n.id)}
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-ink/20 hover:text-red-500 hover:bg-red-50 transition-colors mt-0.5"
            aria-label="Eliminar">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </>
  );
}

export default function NotificationBell() {
  const { user, permissionStatus, requestPermission } = useAuth();
  const nav = useNavigate();
  const { items, unread, markAllRead, markRead, deleteNotif, deleteAll } = useNotifications(user?.uid);

  const [open, setOpen] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  // Posición calculada para el dropdown desktop (fixed)
  const [dropPos, setDropPos] = useState({ top: 64, right: 16 });
  const bellRef = useRef(null);
  const dropdownRef = useRef(null);

  const recalcPos = useCallback(() => {
    if (!bellRef.current) return;
    const r = bellRef.current.getBoundingClientRect();
    setDropPos({
      top: Math.round(r.bottom + 8),
      right: Math.round(window.innerWidth - r.right),
    });
  }, []);

  const handleOpen = () => {
    const next = !open;
    if (next) {
      recalcPos();
      if (unread > 0) markAllRead();
    }
    setOpen(next);
  };

  // Cerrar al pulsar fuera — solo desktop
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        dropdownRef.current?.contains(e.target) ||
        bellRef.current?.contains(e.target)
      ) return;
      // Solo aplica en desktop (≥640px)
      if (window.innerWidth >= 640) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Recalcular si el viewport cambia mientras el dropdown desktop está abierto
  useEffect(() => {
    if (!open) return;
    const onResize = () => recalcPos();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, recalcPos]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handleItemClick = (notif) => {
    markRead(notif.id);
    setOpen(false);
    if (notif.projectId) {
      const base = user?.role === "cliente" ? "/mis-proyectos" : "/proyectos";
      nav(`${base}/${notif.projectId}`);
    }
  };

  const handleEnablePush = async () => {
    if (!requestPermission) return;
    setPushLoading(true);
    await requestPermission();
    setPushLoading(false);
  };

  // Encabezado compartido
  const header = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.07] flex-shrink-0">
      <p className="text-[13px] font-bold text-ink">Notificaciones</p>
      <div className="flex items-center gap-3">
        {unread > 0 && (
          <button type="button" onClick={markAllRead}
            className="text-[11px] text-ink/50 hover:text-ink transition-colors">
            Marcar leídas
          </button>
        )}
        {items.length > 0 && (
          <button type="button" onClick={deleteAll}
            className="text-[11px] text-red-400 hover:text-red-600 transition-colors">
            Eliminar todas
          </button>
        )}
      </div>
    </div>
  );

  // Banner de permisos push
  const pushBanner = permissionStatus === "default" ? (
    <div className="bg-amber-50 px-4 py-3 border-b border-amber-100 flex-shrink-0 space-y-2">
      <p className="text-[11px] font-medium text-amber-800 leading-snug">
        Activa notificaciones Push para recibir alertas aunque la app esté cerrada.
      </p>
      <button type="button" onClick={handleEnablePush} disabled={pushLoading}
        className="w-full h-8 bg-amber-500 text-white text-[11px] font-semibold rounded-lg hover:bg-amber-600 transition disabled:opacity-60">
        {pushLoading ? "Activando…" : "Activar notificaciones"}
      </button>
    </div>
  ) : permissionStatus === "denied" ? (
    <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex-shrink-0">
      <p className="text-[11px] text-red-700">
        Notificaciones bloqueadas en el navegador.
      </p>
    </div>
  ) : null;

  return (
    <>
      {/* ── Botón campana ── */}
      <button
        ref={bellRef}
        type="button"
        onClick={handleOpen}
        className="relative h-9 w-9 rounded-xl bg-white border border-ink/10 flex items-center justify-center shadow-sm hover:bg-ink hover:text-white hover:border-ink transition active:scale-[0.97]"
        aria-label="Notificaciones"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          {/* ══════════════════════════════════════════
              MÓVIL (< 640 px): bottom sheet
          ══════════════════════════════════════════ */}
          {/* Backdrop */}
          <div
            className="sm:hidden fixed inset-0 z-[198] bg-black/50"
            onClick={() => setOpen(false)}
          />
          {/* Sheet */}
          <div
            className="sm:hidden fixed left-3 right-3 bottom-3 z-[199] bg-white flex flex-col overflow-hidden"
            style={{
              borderRadius: 24,
              maxHeight: "min(72dvh, 560px)",
              boxShadow: "0 18px 48px rgba(0,0,0,0.22)",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-9 h-1 rounded-full bg-black/15" />
            </div>
            {/* Header con botón cerrar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.07] flex-shrink-0">
              <p className="text-[13px] font-bold text-ink">Notificaciones</p>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button type="button" onClick={markAllRead}
                    className="text-[11px] text-ink/50 hover:text-ink transition-colors">
                    Marcar leídas
                  </button>
                )}
                {items.length > 0 && (
                  <button type="button" onClick={deleteAll}
                    className="text-[11px] text-red-400 hover:text-red-600 transition-colors">
                    Eliminar todas
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-ink/40 hover:bg-black/5 transition">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {pushBanner}
            <div className="overflow-y-auto flex-1 min-h-0">
              <NotifList items={items} onItemClick={handleItemClick} deleteNotif={deleteNotif} />
            </div>
            {/* Safe area Android */}
            <div className="flex-shrink-0" style={{ height: "max(env(safe-area-inset-bottom, 0px), 10px)" }} />
          </div>

          {/* ══════════════════════════════════════════
              DESKTOP (≥ 640 px): dropdown flotante fixed
          ══════════════════════════════════════════ */}
          <div
            ref={dropdownRef}
            className="hidden sm:flex fixed z-[199] flex-col bg-white overflow-hidden"
            style={{
              top: dropPos.top,
              right: dropPos.right,
              width: 340,
              maxHeight: `calc(100svh - ${dropPos.top + 16}px)`,
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            }}
          >
            {header}
            {pushBanner}
            <div className="overflow-y-auto flex-1 min-h-0">
              <NotifList items={items} onItemClick={handleItemClick} deleteNotif={deleteNotif} />
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

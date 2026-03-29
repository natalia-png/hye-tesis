// src/components/NotificationBell.jsx
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications.js";
import { useAuth } from "../app/useAuth";
import { timeAgo } from "../utils/timeAgo";

const ICONS = {
  phase_done:              "✓",
  phase_started:           "→",
  progress_update:         "↑",
  deadline_project:        "⏰",
  deadline_fase:           "⏰",
  new_note:                "📝",
  new_file:                "📎",
  new_message:             "💬",
  nueva_garantia:          "🔧",
  garantia_respondida:     "✅",
  nueva_solicitud_comercial: "🏗",
};

const ICON_BG = {
  phase_done:              "bg-emerald-100 text-emerald-700",
  phase_started:           "bg-amber-100 text-amber-700",
  progress_update:         "bg-blue-100 text-blue-700",
  deadline_project:        "bg-orange-100 text-orange-700",
  deadline_fase:           "bg-orange-100 text-orange-700",
  new_note:                "bg-violet-100 text-violet-700",
  new_file:                "bg-sky-100 text-sky-700",
  new_message:             "bg-blue-100 text-blue-700",
  nueva_garantia:          "bg-red-100 text-red-700",
  garantia_respondida:     "bg-emerald-100 text-emerald-700",
  nueva_solicitud_comercial: "bg-amber-100 text-amber-700",
};

export default function NotificationBell() {
  const { user, permissionStatus, requestPermission } = useAuth(); // ✅ extraídos del contexto
  const nav = useNavigate();
  const { items, unread, markAllRead, markRead, deleteNotif, deleteAll } = useNotifications(user?.uid);

  const [open, setOpen] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const panelRef = useRef(null);

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open && unread > 0) markAllRead();
  };

  const handleClick = (notif) => {
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

  return (
    <div className="relative" ref={panelRef}>

      {/* Botón campana */}
      <button
        type="button"
        onClick={handleOpen}
        className="relative h-9 w-9 rounded-xl bg-white border border-ink/10 flex items-center justify-center shadow-sm hover:bg-ink hover:text-white hover:border-ink transition active:scale-[0.97]"
        aria-label="Notificaciones"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge no leídas */}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Panel desplegable */}
      {open && (
        <div className="absolute right-0 top-11 w-[320px] bg-white rounded-2xl border border-taupe/30 shadow-xl z-[200] overflow-hidden flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-taupe/20">
            <p className="text-[13px] font-semibold text-ink">Notificaciones</p>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] text-ink/50 hover:text-ink transition-colors"
                >
                  Marcar leídas
                </button>
              )}
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={deleteAll}
                  className="text-[11px] text-red-400 hover:text-red-600 transition-colors"
                >
                  Eliminar todas
                </button>
              )}
            </div>
          </div>

          {/* Banner push — solo si el permiso no está concedido ni denegado */}
          {permissionStatus === "default" && (
            <div className="bg-sand/30 px-4 py-3 border-b border-taupe/20 flex flex-col gap-2">
              <p className="text-[11px] font-medium text-ink/80 leading-snug">
                Activa las notificaciones Push para recibir alertas aunque la app esté cerrada.
              </p>
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={pushLoading}
                className="w-full h-7 bg-ink text-ivory text-[11px] font-semibold rounded-lg shadow-sm hover:bg-ink/90 transition active:scale-[0.98] disabled:opacity-60"
              >
                {pushLoading ? "Activando…" : "Activar notificaciones"}
              </button>
            </div>
          )}

          {/* Banner push denegadas */}
          {permissionStatus === "denied" && (
            <div className="bg-red-50 px-4 py-3 border-b border-red-100">
              <p className="text-[11px] text-red-700">
                Las notificaciones están bloqueadas. Habilítalas en la configuración de tu navegador.
              </p>
            </div>
          )}

          {/* Lista notificaciones */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-taupe/10">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-ink/40">Sin notificaciones aún.</p>
                <p className="text-[11px] text-ink/30 mt-1">
                  Aparecerán aquí cuando haya actualizaciones en tu proyecto.
                </p>
              </div>
            ) : (
              items.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 ${n.read ? "" : "bg-amber-50/50"}`}
                >
                  {/* Contenido clickeable */}
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className="flex items-start gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold mt-0.5 ${ICON_BG[n.type] || "bg-sand text-ink"}`}>
                      {ICONS[n.type] || "·"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] leading-snug ${n.read ? "font-medium text-ink/80" : "font-semibold text-ink"}`}>
                        {n.title}
                      </p>
                      <p className="text-[11px] text-ink/55 mt-0.5 leading-snug">{n.body}</p>
                      <p className="text-[10px] text-ink/35 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>

                  {/* Botón eliminar */}
                  <button
                    type="button"
                    onClick={() => deleteNotif(n.id)}
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-ink/20 hover:text-red-500 hover:bg-red-50 transition-colors mt-0.5"
                    aria-label="Eliminar notificación"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


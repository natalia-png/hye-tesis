// src/components/header.jsx
import { useAuth } from "../app/useAuth";
import NotificationBell from "./NotificationBell.jsx";

export default function Header() {
  const { user, logout } = useAuth();
  const first = user?.name?.split(" ")[0] || "Usuario";
  const role  = user?.role || "";

  return (
    <header className="fixed top-0 inset-x-0 z-[100]">
      <div className="bg-[#E9E4DD]/95 backdrop-blur-md border-b border-taupe/30">
        <div className="max-w-[500px] mx-auto h-20 px-4 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center">
            <img
              src="/logo-header.png"
              alt="H&E Arquitectos"
              className="h-14 w-auto object-contain"
              draggable={false}
            />
          </div>

          {/* Derecha */}
          {user && (
            <div className="flex items-center gap-3">

              {/* Info usuario */}
              <div className="text-right leading-tight">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink/50">
                  Bienvenido
                </div>
                <div className="flex items-center justify-end gap-2 mt-0.5">
                  <span className="text-[14px] font-semibold text-ink capitalize">
                    {first}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/80 border border-ink/10 px-2 py-[2px] text-[11px] font-medium text-ink/70 capitalize">
                    {role}
                  </span>
                </div>
              </div>

              {/* Campana de notificaciones */}
              <NotificationBell />

              {/* Botón salir */}
              <button
                onClick={logout}
                type="button"
                className="h-9 px-4 rounded-xl bg-white border border-ink/10 text-[12px] font-semibold text-ink/80 shadow-sm hover:bg-ink hover:text-white transition active:scale-[0.97]"
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
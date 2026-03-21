// src/components/header.jsx
import { useAuth } from "../app/useAuth";
import NotificationBell from "./NotificationBell.jsx";
import logoHye from "../assets/logo-header.png";

export default function Header() {
  const { user, logout } = useAuth();
  const first = user?.name?.split(" ")[0] || "Usuario";
  const role  = user?.role || "";

  return (
    <header className="fixed top-0 inset-x-0 z-[100]">
      <div className="bg-[#E9E4DD]/95 backdrop-blur-md border-b border-taupe/30">
        <div className="max-w-[500px] mx-auto h-16 px-4 flex items-center justify-between gap-2">

          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <img
              src={logoHye}
              alt="H&E Arquitectos"
              className="h-9 w-auto object-contain max-w-[120px]"
              draggable={false}
            />
          </div>

          {/* Derecha */}
          {user && (
            <div className="flex items-center gap-2 min-w-0">

              {/* Info usuario */}
              <div className="text-right leading-tight min-w-0">
                <div className="text-[9px] uppercase tracking-[0.15em] text-ink/50">
                  Bienvenido
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span className="text-[13px] font-semibold text-ink capitalize max-w-[80px] truncate">
                    {first}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/80 border border-ink/10 px-1.5 py-[2px] text-[10px] font-medium text-ink/70 capitalize whitespace-nowrap">
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
                className="h-8 px-3 rounded-xl bg-white border border-ink/10 text-[11px] font-semibold text-ink/80 shadow-sm hover:bg-ink hover:text-white transition active:scale-[0.97] flex-shrink-0"
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
// src/components/header.jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/useAuth";
import { useTheme } from "../app/ThemeContext.jsx";
import NotificationBell from "./NotificationBell.jsx";
import Avatar from "./ui/Avatar.jsx";
import logoHye from "../assets/logo-header.png";

export default function Header() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { dark } = useTheme();
  const first = user?.name?.split(" ")[0] || "Usuario";
  const role = user?.role || "";
  const uiBg = dark ? "rgb(37 35 32 / 0.8)" : "rgb(var(--ivory) / 0.8)";

  return (
    <header className="fixed top-0 inset-x-0 z-[100]">
      <div
        className="backdrop-blur-md border-b transition-colors duration-300"
        style={{
          background: "rgb(var(--sand) / 0.95)",
          borderColor: "rgb(var(--taupe) / 0.35)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="max-w-[560px] mx-auto h-14 px-4 flex items-center justify-between gap-2">
          <div className="flex items-center flex-shrink-0">
            <img
              src={logoHye}
              alt="H&E Arquitectos"
              className="h-9 w-auto object-contain max-w-[120px] dark:invert dark:brightness-90"
              draggable={false}
            />
          </div>

          {user && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-right leading-tight min-w-0">
                <div className="text-[9px] uppercase tracking-[0.15em]" style={{ color: "rgb(var(--ink) / 0.45)" }}>
                  Bienvenido
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span className="text-[13px] font-semibold capitalize max-w-[80px] truncate" style={{ color: "rgb(var(--ink))" }}>
                    {first}
                  </span>
                  <span
                    className="inline-flex items-center rounded-full px-1.5 py-[2px] text-[10px] font-medium capitalize whitespace-nowrap border"
                    style={{
                      background: uiBg,
                      borderColor: "rgb(var(--ink) / 0.1)",
                      color: "rgb(var(--ink) / 0.65)",
                    }}
                  >
                    {role}
                  </span>
                </div>
              </div>

              <NotificationBell />

              <button
                type="button"
                onClick={() => nav("/configuracion")}
                aria-label="Perfil"
                className="flex-shrink-0"
              >
                <Avatar
                  name={user?.name || "Usuario"}
                  photoURL={user?.photoURL || ""}
                  size={34}
                  textClassName="text-[12px]"
                  className="border border-black/10"
                />
              </button>

              <button
                type="button"
                onClick={() => nav("/configuracion")}
                aria-label="Configuracion"
                className="h-8 w-8 rounded-xl flex items-center justify-center border transition active:scale-[0.97] flex-shrink-0"
                style={{
                  background: dark ? "rgb(37 35 32 / 0.7)" : "rgb(var(--ivory) / 0.7)",
                  borderColor: "rgb(var(--ink) / 0.1)",
                  color: "rgb(var(--ink) / 0.55)",
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

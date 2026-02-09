// src/components/BottomNav.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/useAuth";

export default function BottomNav() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();

  const isCliente = user?.role === "cliente";

  const goHome = () => nav("/");
  const goProjects = () =>
    nav(isCliente ? "/mis-proyectos" : "/proyectos");

  const isHome = pathname === "/";
  const isProjects =
    pathname.startsWith("/proyectos") || pathname === "/mis-proyectos";

  return (
    <nav className="fixed bottom-0 inset-x-0 border-t border-black/5 bg-ivory/95 backdrop-blur-sm">
      <div className="mx-auto max-w-[500px] flex items-center justify-around py-2 text-[11px]">

        {/* INICIO */}
        <button
          type="button"
          onClick={goHome}
          className="flex flex-col items-center gap-0.5"
        >
          <span
            className={
              "inline-flex h-6 w-6 items-center justify-center rounded-full border " +
              (isHome
                ? "bg-ink border-ink"
                : "border-ink/20")
            }
          >
            <img
              src="/home.png"
              alt="Inicio"
              className={
                "h-3.5 w-3.5 object-contain " +
                (isHome ? "invert" : "opacity-60")
              }
            />
          </span>
          <span className={isHome ? "text-ink font-medium" : "text-ink/60"}>
            Inicio
          </span>
        </button>

        {/* PROYECTOS */}
        <button
          type="button"
          onClick={goProjects}
          className="flex flex-col items-center gap-0.5"
        >
          <span
            className={
              "inline-flex h-6 w-6 items-center justify-center rounded-full border " +
              (isProjects
                ? "bg-ink text-ivory border-ink"
                : "border-ink/20 text-ink/60")
            }
          >
            {/* icono proyectos (puedes cambiarlo luego por imagen también) */}
            <span className="text-xs">🧱</span>
          </span>
          <span className={isProjects ? "text-ink font-medium" : "text-ink/60"}>
            Proyectos
          </span>
        </button>

      </div>
    </nav>
  );
}
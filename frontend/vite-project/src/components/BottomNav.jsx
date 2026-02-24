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
    pathname.startsWith("/proyectos") || pathname.startsWith("/mis-proyectos");
  const isComercial = pathname.startsWith("/comercial");
  const isHistorial = pathname.startsWith("/historial");

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

        {/* COMERCIAL — solo admin */}
        {!isCliente && (
          <button type="button" onClick={() => nav("/comercial")}
            className="flex flex-col items-center gap-0.5">
            <span className={
              "inline-flex h-6 w-6 items-center justify-center rounded-full border " +
              (isComercial ? "bg-ink border-ink" : "border-ink/20")
            }>
              <svg className={"w-3.5 h-3.5 " + (isComercial ? "text-ivory" : "text-ink/60")}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <span className={isComercial ? "text-ink font-medium" : "text-ink/60"}>Comercial</span>
          </button>
        )}

        {/* HISTORIAL — solo admin */}
        {!isCliente && (
          <button type="button" onClick={() => nav("/historial")}
            className="flex flex-col items-center gap-0.5">
            <span className={
              "inline-flex h-6 w-6 items-center justify-center rounded-full border " +
              (isHistorial ? "bg-ink border-ink" : "border-ink/20")
            }>
              <svg className={"w-3.5 h-3.5 " + (isHistorial ? "text-ivory" : "text-ink/60")}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span className={isHistorial ? "text-ink font-medium" : "text-ink/60"}>Historial</span>
          </button>
        )}

      </div>
    </nav>
  );
}
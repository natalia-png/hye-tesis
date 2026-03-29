// src/components/BottomNav.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/useAuth";
import { useTheme } from "../app/ThemeContext.jsx";
import { useChats } from "../hooks/useChats";
import PropTypes from "prop-types";

function NavBtn({ onClick, active, children, label }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-0.5">
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors"
        style={active
          ? { background: "rgb(var(--ink))", borderColor: "rgb(var(--ink))" }
          : { background: "transparent", borderColor: "rgb(var(--ink) / 0.2)" }
        }
      >
        {children}
      </span>
      <span
        className="text-[10px] transition-colors"
        style={{ color: active ? "rgb(var(--ink))" : "rgb(var(--ink) / 0.5)", fontWeight: active ? 500 : 400 }}
      >
        {label}
      </span>
    </button>
  );
}

NavBtn.propTypes = {
  onClick: PropTypes.func,
  active: PropTypes.bool,
  children: PropTypes.node,
  label: PropTypes.string,
};

export default function BottomNav() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { dark } = useTheme();
  const { unreadTotal } = useChats(user?.uid);

  const isCliente = user?.role === "cliente";

  const isHome        = pathname === "/";
  const isProjects    = pathname.startsWith("/proyectos") || pathname.startsWith("/mis-proyectos");
  const isComercial   = pathname.startsWith("/comercial");
  const isColaboradores = pathname.startsWith("/colaboradores");
  const isMensajes    = pathname.startsWith("/mensajes");

  // En dark mode el círculo activo tiene fondo claro (--ink = crema), así que el ícono debe ser oscuro
  const iconColor = (active) => {
    if (active) return dark ? "rgb(var(--sand))" : "rgb(var(--linen))";
    return "rgb(var(--ink) / 0.55)";
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 border-t backdrop-blur-sm transition-colors duration-300"
      style={{
        background: dark ? "rgb(37 35 32 / 0.95)" : "rgb(var(--ivory) / 0.95)",
        borderColor: "rgb(var(--taupe) / 0.4)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto max-w-[500px] flex items-center justify-around py-2 text-[11px]">

        {/* INICIO */}
        <NavBtn onClick={() => nav("/")} active={isHome} label="Inicio">
          <img src="/home.png" alt="Inicio"
            className="h-3.5 w-3.5 object-contain"
            style={{ filter: isHome ? (dark ? "none" : "invert(1)") : dark ? "invert(1) opacity(0.55)" : "opacity(0.5)" }} />
        </NavBtn>

        {/* PROYECTOS */}
        <NavBtn onClick={() => nav(isCliente ? "/mis-proyectos" : "/proyectos")} active={isProjects} label="Proyectos">
          <span className="text-xs">🧱</span>
        </NavBtn>

        {/* MENSAJES */}
        <button type="button" onClick={() => nav("/mensajes")} className="flex flex-col items-center gap-0.5">
          <span
            className="relative inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors"
            style={isMensajes
              ? { background: "rgb(var(--ink))", borderColor: "rgb(var(--ink))" }
              : { background: "transparent", borderColor: "rgb(var(--ink) / 0.2)" }
            }
          >
            <svg className="w-3.5 h-3.5" style={{ color: iconColor(isMensajes) }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {unreadTotal > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5 leading-none">
                {unreadTotal > 9 ? "9+" : unreadTotal}
              </span>
            )}
          </span>
          <span className="text-[10px] transition-colors"
            style={{ color: isMensajes ? "rgb(var(--ink))" : "rgb(var(--ink) / 0.5)", fontWeight: isMensajes ? 500 : 400 }}>
            Mensajes
          </span>
        </button>

        {/* COMERCIAL */}
        {(user?.role === "admin" || user?.role === "colaborador") && (
          <NavBtn onClick={() => nav("/comercial")} active={isComercial} label="Comercial">
            <svg className="w-3.5 h-3.5" style={{ color: iconColor(isComercial) }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </NavBtn>
        )}

        {/* EQUIPO */}
        {user?.role === "admin" && (
          <NavBtn onClick={() => nav("/colaboradores")} active={isColaboradores} label="Equipo">
            <svg className="w-3.5 h-3.5" style={{ color: iconColor(isColaboradores) }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </NavBtn>
        )}

      </div>
    </nav>
  );
}

BottomNav.propTypes = {};

// src/pages/Proyectos.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, orderBy, query, limit, onSnapshot,
  doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { useTheme } from "../app/ThemeContext.jsx";
import PropTypes from "prop-types";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SEMANA = ["L","M","M","J","V","S","D"];

function parseEndDate(val) {
  if (!val) return null;
  if (typeof val === "string") return new Date(val + "T12:00:00");
  if (val?.toDate) return val.toDate();
  return null;
}

function CalendarioProyectos({ projects, nav }) {
  const { dark } = useTheme();
  const hoy = new Date();
  const [cursor, setCursor] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // Offset lunes-primero: si getDay()=0(Dom) → 6, else getDay()-1
  const primerDia = new Date(year, month, 1);
  const offset = primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1;
  const diasEnMes = new Date(year, month + 1, 0).getDate();

  // Agrupar proyectos con endDate en este mes por día
  const eventosPorDia = {};
  for (const p of projects) {
    const fecha = parseEndDate(p.endDate);
    if (!fecha) continue;
    if (fecha.getFullYear() === year && fecha.getMonth() === month) {
      const d = fecha.getDate();
      if (!eventosPorDia[d]) eventosPorDia[d] = [];
      eventosPorDia[d].push(p);
    }
  }

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);
  while (celdas.length % 7 !== 0) celdas.push(null);

  const esHoy = (d) => d && hoy.getDate() === d && hoy.getMonth() === month && hoy.getFullYear() === year;

  const sinFechas = projects.filter(p => !parseEndDate(p.endDate));

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        {/* Navegación mes */}
        <div className="flex items-center justify-between">
          <button type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink/60 hover:text-ink hover:bg-sand transition text-lg font-light">
            ‹
          </button>
          <span className="text-[14px] font-semibold text-ink capitalize">
            {MESES[month]} {year}
          </span>
          <button type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink/60 hover:text-ink hover:bg-sand transition text-lg font-light">
            ›
          </button>
        </div>

        {/* Cabecera días */}
        <div className="grid grid-cols-7 text-center">
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="text-[10px] font-medium text-ink/40 py-1">{d}</div>
          ))}
        </div>

        {/* Celdas */}
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((dia, i) => {
            const eventos = dia ? (eventosPorDia[dia] || []) : [];
            return (
              <div key={i}
                className={`min-h-[52px] rounded-xl p-1 ${dia ? "" : "opacity-0 pointer-events-none"}`}
                style={{
                  background: !dia ? "transparent"
                    : esHoy(dia) ? "rgb(var(--ink))"
                    : eventos.length > 0 ? (dark ? "rgb(120 60 20 / 0.25)" : "rgb(251 191 36 / 0.12)")
                    : dark ? "rgb(var(--sand))" : "rgb(var(--sand) / 0.5)"
                }}
              >
                {dia && (
                  <>
                    <span className="text-[11px] font-semibold block leading-none mb-1"
                      style={{ color: esHoy(dia) ? (dark ? "#1A1917" : "#F2EEE7") : "rgb(var(--ink) / 0.7)" }}>
                      {dia}
                    </span>
                    {eventos.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => nav(`/proyectos/${p.id}`)}
                        className="w-full text-left text-[8px] leading-tight font-medium rounded px-1 py-0.5 mb-0.5 truncate block transition-opacity hover:opacity-80"
                        style={{ background: "rgb(234 88 12)", color: "#fff" }}
                        title={p.name}>
                        {p.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-3 pt-1 border-t border-taupe/20">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "rgb(234 88 12)" }} />
            <span className="text-[10px] text-ink/50">Vencimiento proyecto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "rgb(var(--ink))" }} />
            <span className="text-[10px] text-ink/50">Hoy</span>
          </div>
        </div>
      </div>

      {/* Proyectos sin fecha configurada */}
      {sinFechas.length > 0 && (
        <div className="card space-y-2">
          <p className="text-[11px] font-semibold text-ink/50 uppercase tracking-wide">Sin fecha de cierre configurada</p>
          {sinFechas.map(p => (
            <button key={p.id} type="button"
              onClick={() => nav(`/proyectos/${p.id}`)}
              className="w-full text-left flex items-center justify-between gap-2 py-1.5 border-b border-taupe/20 last:border-0">
              <span className="text-[13px] text-ink/80">{p.name}</span>
              <span className="text-[11px] text-ink/40">Configurar →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

CalendarioProyectos.propTypes = {
  projects: PropTypes.array,
  nav: PropTypes.func,
};

function getProgress(data) {
  if (typeof data.progress === "number") { return data.progress; }
  if (typeof data.avance === "number") { return data.avance; }
  return 0;
}

export default function Proyectos() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qText, setQText] = useState("");
  const [order, setOrder] = useState("recientes");
  const [view, setView] = useState("lista");

  useEffect(() => {
    const qRef = query(
      collection(db, "projects"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(qRef, snap => {
      const items = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          code: data.code || d.id,
          name: data.name || data.nombre || "Proyecto sin nombre",
          client: data.client || data.cliente || "Cliente sin nombre",
          status: data.status || data.estado || "Sin estado",
          progress: getProgress(data),
          endDate: data.endDate || data.fechaFin || null,
          createdAt: data.createdAt || null,
        };
      // Excluir archivados y finalizados de la lista activa
      }).filter(p => {
        const s = (p.status || "").toLowerCase();
        return s !== "archivado" && s !== "finalizado" && s !== "completado";
      });

      setProjects(items);
      setLoading(false);
    }, e => {
      setError("No se pudieron cargar los proyectos.");
      setLoading(false);
    });

    return () => { try { unsub(); } catch (e) { console.error(e); } };
  }, []);

  const filtered = useMemo(() => {
    const term = qText.trim().toLowerCase();
    let list = [...projects];
    if (term) {
      list = list.filter(p =>
        (p.code || "").toLowerCase().includes(term) ||
        (p.name || "").toLowerCase().includes(term) ||
        (p.client || "").toLowerCase().includes(term)
      );
    }
    if (order === "nombre") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return list;
  }, [projects, qText, order]);

  const stats = useMemo(() => {
    const total = projects.length;
    const enCurso = projects.filter(p => {
      const s = (p.status || "").toLowerCase();
      return s.includes("curso") || s.includes("ejecución") || s.includes("ejecucion");
    }).length;
    return { total, enCurso };
  }, [projects]);

  const handleArchivar = async (id) => {
    try {
      await updateDoc(doc(db, "projects", id), {
        status: "Archivado",
        archivedAt: serverTimestamp(),
      });
      // onSnapshot lo elimina automáticamente de la lista
    } catch (e) { console.error(e); }
  };

  const firstName = user?.name?.split(" ")[0] || "Arquitecta";

  return (
    <section className="space-y-5">
      {/* Encabezado */}
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold text-ink">Proyectos</h1>
            <p className="text-[13px] text-ink/65">
              {stats.total} activos · {stats.enCurso} en curso
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle vista */}
            <div className="flex rounded-xl border border-taupe/30 overflow-hidden text-[12px]">
              <button type="button" onClick={() => setView("lista")}
                className={`px-2.5 py-1.5 transition ${view === "lista" ? "bg-ink text-ivory" : "text-ink/60 hover:text-ink"}`}>
                ☰
              </button>
              <button type="button" onClick={() => setView("calendario")}
                className={`px-2.5 py-1.5 transition border-l border-taupe/30 ${view === "calendario" ? "bg-ink text-ivory" : "text-ink/60 hover:text-ink"}`}>
                📅
              </button>
            </div>
            <button
              type="button"
              className="btn-primary whitespace-nowrap"
              onClick={() => nav("/proyectos/nuevo")}
            >
              + Nuevo
            </button>
          </div>
        </div>
        <p className="text-[12px] text-ink/65 leading-relaxed">
          Vista de <span className="font-medium">{firstName}</span> — portafolio
          activo. Los proyectos archivados se mueven al Historial.
        </p>
      </header>

      {/* Búsqueda y orden — solo en lista */}
      {view === "lista" && <div className="space-y-3 rounded-2xl bg-ivory/80 p-3 border border-taupe/20">
        <input
          value={qText}
          onChange={e => setQText(e.target.value)}
          placeholder="Buscar por ID, nombre o cliente…"
          className="input w-full"
        />
        <div className="flex gap-2 text-[12px]">
          {["recientes", "nombre"].map(o => (
            <button
              key={o}
              type="button"
              onClick={() => setOrder(o)}
              className={`px-3 py-1 rounded-full border ${
                order === o
                  ? "bg-ink text-ivory border-ink"
                  : "bg-transparent text-ink/70 border-taupe/40"
              }`}
            >
              {o === "recientes" ? "Recientes" : "A-Z por nombre"}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink/50">
          Se muestran los 50 proyectos activos más recientes.
        </p>
      </div>}

      {/* Contenido */}
      {loading && <p className="text-[13px] text-ink/60">Cargando proyectos…</p>}
      {error && !loading && <p className="text-[13px] text-red-600">{error}</p>}

      {!loading && !error && view === "calendario" && (
        <CalendarioProyectos projects={projects} nav={nav} />
      )}

      {!loading && !error && view === "lista" && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-[13px] text-ink/50">
              No se encontraron proyectos con ese criterio.
            </p>
          )}
          {filtered.map(p => (
            <TarjetaProyecto
              key={p.id}
              proyecto={p}
              onNav={() => nav(`/proyectos/${p.id}`)}
              onArchivar={() => handleArchivar(p.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── TARJETA ── */
function TarjetaProyecto({ proyecto: p, onNav, onArchivar }) {
  const [confirm, setConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const handleArchivar = async (e) => {
    e.stopPropagation();
    setArchiving(true);
    await onArchivar();
    setArchiving(false);
    setConfirm(false);
  };

  return (
    <article className="card flex flex-col gap-2">
      {/* Zona clickeable principal */}
      <button
        type="button"
        className="flex items-start justify-between gap-4 cursor-pointer w-full text-left"
        onClick={onNav}
      >
        <div>
          <h3 className="text-[15px] font-medium text-ink">{p.name}</h3>
          <p className="text-[12px] text-ink/70">Cliente: {p.client}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[11px] text-ink/70 font-semibold tracking-wide">{p.code}</span>
          <span className="inline-flex items-center rounded-full bg-sand px-2 py-[2px] text-[11px] text-ink/80">
            {p.status}
          </span>
        </div>
      </button>

      {/* Barra de progreso */}
      <button
        type="button"
        className="mt-1 cursor-pointer w-full text-left"
        onClick={onNav}
      >
        <div className="flex justify-between text-[11px] text-ink/60 mb-1">
          <span>Avance</span>
          <span>{p.progress}%</span>
        </div>
        <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
          <div className="h-full bg-ink" style={{ width: `${p.progress}%` }} />
        </div>
      </button>

      {/* Archivar */}
      <div className="border-t border-sand pt-2.5 mt-1">
        {confirm ? (
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-amber-700 font-medium">¿Mover al historial?</p>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleArchivar(e); }}
              disabled={archiving}
              className="px-3 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-medium disabled:opacity-50"
            >
              {archiving ? "Archivando…" : "Sí, archivar"}
            </button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setConfirm(false); }}
              className="px-3 py-1 rounded-lg text-[11px] text-ink/50 hover:text-ink transition"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setConfirm(true); }}
            className="text-[11px] text-ink/35 hover:text-amber-600 transition-colors"
          >
            Archivar proyecto →
          </button>
        )}
      </div>
    </article>
  );
}

TarjetaProyecto.propTypes = {
  proyecto: PropTypes.object,
  onNav: PropTypes.func,
  onArchivar: PropTypes.func,
};

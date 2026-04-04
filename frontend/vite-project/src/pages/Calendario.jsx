// src/pages/Calendario.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection, onSnapshot, query, addDoc, deleteDoc,
  doc, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import { useNavigate } from "react-router-dom";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SHORT = ["Lu","Ma","Mi","Ju","Vi","Sa","Do"];

const EVENT_COLORS = [
  { id: "amber",   dot: "bg-amber-400",   ring: "ring-amber-400",   label: "Ámbar"   },
  { id: "emerald", dot: "bg-emerald-400", ring: "ring-emerald-400", label: "Verde"   },
  { id: "blue",    dot: "bg-blue-400",    ring: "ring-blue-400",    label: "Azul"    },
  { id: "rose",    dot: "bg-rose-400",    ring: "ring-rose-400",    label: "Rosa"    },
  { id: "violet",  dot: "bg-violet-400",  ring: "ring-violet-400",  label: "Morado"  },
];

function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(val) {
  if (!val) return null;
  if (typeof val === "string") {
    const d = new Date(val + "T12:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val.toDate === "function") return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  return null;
}

function dotColor(id) {
  return EVENT_COLORS.find(c => c.id === id)?.dot || "bg-ink/40";
}

export default function Calendario() {
  const { user } = useAuth();
  const nav = useNavigate();
  const today = new Date();
  const todayKey = toKey(today);

  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [personalEvents, setPersonalEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm(todayKey));
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const isAdminOrColab = user?.role === "admin" || user?.role === "colaborador";

  /* ── Personal events — real-time ── */
  useEffect(() => {
    if (!user?.uid) return;
    const ref = collection(db, "eventos", user.uid, "items");
    const unsub = onSnapshot(
      query(ref, orderBy("fecha", "asc")),
      snap => setPersonalEvents(snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "personal" }))),
      err => console.error("eventos:", err)
    );
    return () => unsub();
  }, [user?.uid]);

  /* ── Projects — real-time ── */
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      collection(db, "projects"),
      snap => setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("projects:", err)
    );
    return () => unsub();
  }, [user?.uid]);

  /* ── Events map: { "YYYY-MM-DD": [event…] } ── */
  const eventsMap = useMemo(() => {
    const map = {};
    const push = (key, ev) => {
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    };

    personalEvents.forEach(e => push(e.fecha, e));

    projects.forEach(p => {
      const status = (p.status || p.estado || "").toLowerCase();
      if (["archivado", "finalizado", "completado"].includes(status)) return;

      // Project delivery date
      const d = parseDate(p.endDate || p.fechaEntrega);
      if (d) {
        push(toKey(d), {
          id: `proj_${p.id}`,
          titulo: p.name || p.nombre || "Proyecto",
          fecha: toKey(d),
          color: "amber",
          tipo: "entrega_proyecto",
          _source: "proyecto",
          _projectId: p.id,
        });
      }

      // Phase deadlines (admin/colab only)
      if (isAdminOrColab) {
        (Array.isArray(p.fases) ? p.fases : []).forEach(f => {
          if (!f.fechaEntregaResponsable) return;
          if (f.estado === "completada") return;
          const fd = parseDate(f.fechaEntregaResponsable);
          if (!fd) return;
          push(toKey(fd), {
            id: `fase_${p.id}_${f.id || f.nombre}`,
            titulo: `${f.nombre || "Fase"} — ${p.name || p.nombre || ""}`,
            fecha: toKey(fd),
            color: "blue",
            tipo: "entrega_fase",
            _source: "fase",
            _projectId: p.id,
          });
        });
      }
    });

    return map;
  }, [personalEvents, projects, isAdminOrColab]);

  /* ── Calendar grid ── */
  const gridDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);

    // Mon-based: Sun(0)→6, Mon(1)→0, …
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const days = [];
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, key: toKey(d), inMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, key: toKey(d), inMonth: true });
    }
    const rem = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= rem; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, key: toKey(d), inMonth: false });
    }
    return days;
  }, [currentMonth]);

  /* ── Selected day events ── */
  const selectedEvents = useMemo(() => {
    return (eventsMap[selectedKey] || []).sort((a, b) => {
      const order = { proyecto: 2, fase: 1, personal: 0 };
      const diff = (order[a._source] ?? 0) - (order[b._source] ?? 0);
      if (diff !== 0) return diff;
      if (a.hora && b.hora) return a.hora.localeCompare(b.hora);
      return 0;
    });
  }, [eventsMap, selectedKey]);

  const selectedDate = useMemo(
    () => new Date(selectedKey + "T12:00:00"),
    [selectedKey]
  );

  /* ── Counts for summary ── */
  const monthSummary = useMemo(() => {
    const year  = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    let total = 0, proyectos = 0;
    Object.entries(eventsMap).forEach(([key, evs]) => {
      const d = new Date(key + "T12:00:00");
      if (d.getFullYear() === year && d.getMonth() === month) {
        total += evs.length;
        proyectos += evs.filter(e => e._source === "proyecto").length;
      }
    });
    return { total, proyectos };
  }, [eventsMap, currentMonth]);

  /* ── Actions ── */
  function openAdd(dateKey) {
    setForm(defaultForm(dateKey || selectedKey));
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.titulo.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "eventos", user.uid, "items"), {
        titulo: form.titulo.trim(),
        fecha:  form.fecha,
        hora:   form.hora || null,
        color:  form.color,
        tipo:   form.tipo,
        descripcion: form.descripcion.trim() || null,
        creadoAt: serverTimestamp(),
      });
      setShowModal(false);
    } catch (e) { console.error(e); }
    finally     { setSaving(false); }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try { await deleteDoc(doc(db, "eventos", user.uid, "items", id)); }
    catch (e) { console.error(e); }
    finally   { setDeletingId(null); }
  }

  const prevMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToday   = () => {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedKey(todayKey);
  };

  const isThisMonth =
    currentMonth.getFullYear() === today.getFullYear() &&
    currentMonth.getMonth()    === today.getMonth();

  const selectedLabel = selectedDate.toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <section className="space-y-4">

      {/* ── Add event modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 pb-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden"
            style={{ background: "rgb(var(--ivory))", borderColor: "rgb(var(--taupe) / 0.3)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgb(var(--taupe) / 0.2)" }}>
              <p className="text-[14px] font-bold" style={{ color: "rgb(var(--ink))" }}>Nuevo evento</p>
              <button type="button" onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[18px] hover:bg-ink/8 transition"
                style={{ color: "rgb(var(--ink) / 0.4)" }}>×
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-[72dvh] overflow-y-auto">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.45)" }}>Título *</label>
                <input
                  type="text" autoFocus maxLength={80}
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleSave()}
                  placeholder="¿Qué es este evento?"
                  className="input w-full text-[13px]"
                />
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.45)" }}>Fecha</label>
                  <input type="date" value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    className="input w-full text-[13px]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.45)" }}>Hora (opcional)</label>
                  <input type="time" value={form.hora}
                    onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}
                    className="input w-full text-[13px]" />
                </div>
              </div>

              {/* Color picker */}
              <div className="space-y-1.5">
                <label className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.45)" }}>Color</label>
                <div className="flex gap-2">
                  {EVENT_COLORS.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => setForm(f => ({ ...f, color: c.id }))}
                      title={c.label}
                      className={`w-7 h-7 rounded-full transition-all ${c.dot} ${
                        form.color === c.id
                          ? `ring-2 ring-offset-2 ${c.ring} scale-110`
                          : "opacity-55 hover:opacity-80"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Tipo */}
              <div className="space-y-1.5">
                <label className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.45)" }}>Tipo</label>
                <div className="flex gap-2 flex-wrap">
                  {TIPOS.map(t => (
                    <button key={t.id} type="button"
                      onClick={() => setForm(f => ({ ...f, tipo: t.id }))}
                      className="px-3 py-1.5 rounded-full text-[11px] font-medium border transition"
                      style={form.tipo === t.id
                        ? { background: "rgb(var(--ink))", borderColor: "rgb(var(--ink))", color: "rgb(var(--ivory))" }
                        : { borderColor: "rgb(var(--taupe) / 0.3)", color: "rgb(var(--ink) / 0.6)" }
                      }>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.45)" }}>Descripción (opcional)</label>
                <textarea rows={2} maxLength={200}
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Detalles adicionales..."
                  className="input w-full text-[13px] resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border text-[13px] transition"
                  style={{ borderColor: "rgb(var(--ink) / 0.2)", color: "rgb(var(--ink) / 0.6)" }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleSave}
                  disabled={!form.titulo.trim() || saving}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition disabled:opacity-50"
                  style={{ background: "rgb(var(--ink))", color: "rgb(var(--ivory))" }}>
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium" style={{ color: "rgb(var(--ink) / 0.4)" }}>
            Agenda
          </p>
          <h1 className="text-[20px] font-bold leading-tight" style={{ color: "rgb(var(--ink))" }}>
            Calendario
          </h1>
        </div>
        {monthSummary.total > 0 && (
          <p className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.4)" }}>
            {monthSummary.total} evento{monthSummary.total !== 1 ? "s" : ""} este mes
          </p>
        )}
      </div>

      {/* ── Calendar card ── */}
      <div className="card space-y-3">

        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button type="button" onClick={prevMonth}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[20px] font-medium hover:bg-ink/8 transition"
            style={{ color: "rgb(var(--ink) / 0.55)" }}>
            ‹
          </button>
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-semibold" style={{ color: "rgb(var(--ink))" }}>
              {MESES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </p>
            {!isThisMonth && (
              <button type="button" onClick={goToday}
                className="text-[10px] px-2 py-0.5 rounded-full border transition hover:bg-ink/5"
                style={{ borderColor: "rgb(var(--ink) / 0.2)", color: "rgb(var(--ink) / 0.5)" }}>
                Hoy
              </button>
            )}
          </div>
          <button type="button" onClick={nextMonth}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[20px] font-medium hover:bg-ink/8 transition"
            style={{ color: "rgb(var(--ink) / 0.55)" }}>
            ›
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7">
          {DIAS_SHORT.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold py-1"
              style={{ color: "rgb(var(--ink) / 0.38)" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {gridDays.map(({ date, key, inMonth }) => {
            const isToday    = key === todayKey;
            const isSelected = key === selectedKey;
            const evs = eventsMap[key] || [];
            const uniqueColors = [...new Set(evs.map(e => e.color))].slice(0, 3);

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                className={`flex flex-col items-center gap-0.5 pt-1.5 pb-1.5 rounded-xl transition-all min-h-[52px]
                  ${isSelected && !isToday ? "ring-1" : ""}
                  ${!inMonth ? "opacity-30" : ""}
                `}
                style={
                  isSelected && !isToday
                    ? { background: "rgb(var(--sand))", ringColor: "rgb(var(--taupe) / 0.5)" }
                    : isSelected
                    ? {}
                    : inMonth
                    ? { }
                    : {}
                }
              >
                {/* Day number */}
                <span
                  className={`text-[13px] font-medium leading-none w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                    isToday ? "font-bold" : ""
                  }`}
                  style={
                    isToday
                      ? { background: "rgb(var(--ink))", color: "rgb(var(--ivory))" }
                      : isSelected
                      ? { color: "rgb(var(--ink))", fontWeight: 600 }
                      : { color: "rgb(var(--ink) / 0.75)" }
                  }
                >
                  {date.getDate()}
                </span>

                {/* Event dots */}
                {uniqueColors.length > 0 && (
                  <div className="flex gap-0.5 items-center">
                    {uniqueColors.map((color, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${dotColor(color)}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected day events panel ── */}
      <div className="card space-y-3">

        {/* Panel header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] capitalize font-medium" style={{ color: "rgb(var(--ink) / 0.45)" }}>
              {selectedLabel}
            </p>
            <p className="text-[14px] font-semibold mt-0.5" style={{ color: "rgb(var(--ink))" }}>
              {selectedEvents.length === 0
                ? "Sin eventos"
                : `${selectedEvents.length} evento${selectedEvents.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAdd(selectedKey)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold flex-shrink-0 transition active:scale-95 hover:opacity-80"
            style={{ background: "rgb(var(--ink))", color: "rgb(var(--ivory))" }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Agregar
          </button>
        </div>

        {/* Event list */}
        {selectedEvents.length === 0 ? (
          <div className="flex flex-col items-center py-7 gap-2">
            <span className="text-[36px]">📅</span>
            <p className="text-[12px]" style={{ color: "rgb(var(--ink) / 0.38)" }}>
              Nada programado para este día
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedEvents.map(ev => {
              const colorCfg = EVENT_COLORS.find(c => c.id === ev.color) || EVENT_COLORS[0];
              const isPersonal = ev._source === "personal";

              return (
                <div key={ev.id}
                  className="flex items-start gap-3 rounded-xl border px-3 py-2.5"
                  style={
                    ev._source === "proyecto"
                      ? { borderColor: "rgb(251 191 36 / 0.4)", background: "rgb(254 243 199 / 0.4)" }
                      : ev._source === "fase"
                      ? { borderColor: "rgb(147 197 253 / 0.5)", background: "rgb(219 234 254 / 0.4)" }
                      : { borderColor: "rgb(var(--taupe) / 0.2)", background: "rgb(var(--sand) / 0.35)" }
                  }
                >
                  {/* Color bar */}
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${colorCfg.dot}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium leading-snug" style={{ color: "rgb(var(--ink))" }}>
                      {ev.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {ev.hora && (
                        <span className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.5)" }}>
                          🕐 {ev.hora}
                        </span>
                      )}
                      <EventBadge ev={ev} />
                    </div>
                    {ev.descripcion && (
                      <p className="text-[11px] mt-1 leading-snug" style={{ color: "rgb(var(--ink) / 0.5)" }}>
                        {ev.descripcion}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Go to project (auto events) */}
                    {ev._projectId && (
                      <button type="button"
                        onClick={() => nav(`/proyectos/${ev._projectId}`)}
                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-ink/8 transition"
                        title="Ver proyecto"
                        style={{ color: "rgb(var(--ink) / 0.35)" }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    )}
                    {/* Delete (personal only) */}
                    {isPersonal && (
                      <button type="button"
                        onClick={() => handleDelete(ev.id)}
                        disabled={deletingId === ev.id}
                        className="w-6 h-6 flex items-center justify-center rounded-full transition hover:bg-red-50 disabled:opacity-30"
                        title="Eliminar"
                        style={{ color: "rgb(var(--ink) / 0.25)" }}>
                        {deletingId === ev.id ? (
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5 hover:text-red-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 pb-1">
        <LegendDot color="bg-amber-400" label="Entrega proyecto" />
        {isAdminOrColab && <LegendDot color="bg-blue-400" label="Entrega fase" />}
        <LegendDot color="bg-emerald-400" label="Evento personal" />
        <LegendDot color="bg-rose-400" label="Reunión / otro" />
      </div>

    </section>
  );
}

/* ── Helpers ── */

function defaultForm(dateKey) {
  return { titulo: "", fecha: dateKey, hora: "", color: "emerald", descripcion: "", tipo: "personal" };
}

const TIPOS = [
  { id: "personal", label: "Personal"  },
  { id: "reunion",  label: "Reunión"   },
  { id: "otro",     label: "Otro"      },
];

function EventBadge({ ev }) {
  const cfg = {
    proyecto: { cls: "bg-amber-100 text-amber-700",   label: "Entrega proyecto" },
    fase:     { cls: "bg-blue-100 text-blue-700",     label: "Entrega fase"     },
    reunion:  { cls: "bg-violet-100 text-violet-700", label: "Reunión"          },
    personal: { cls: "bg-sand text-ink/55",           label: "Personal"         },
    otro:     { cls: "bg-sand text-ink/55",           label: "Otro"             },
  };
  const key = ev._source === "proyecto" ? "proyecto"
            : ev._source === "fase"     ? "fase"
            : ev.tipo                   || "personal";
  const { cls, label } = cfg[key] || cfg.personal;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
      <span className="text-[10px]" style={{ color: "rgb(var(--ink) / 0.42)" }}>{label}</span>
    </div>
  );
}

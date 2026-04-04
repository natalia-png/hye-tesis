// src/pages/Proyectos.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, orderBy, query, limit, onSnapshot,
  doc, updateDoc, serverTimestamp, addDoc, deleteDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import PropTypes from "prop-types";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SHORT = ["Lu","Ma","Mi","Ju","Vi","Sa","Do"];

const EVENT_COLORS = [
  { id: "amber",   dot: "bg-amber-400",   ring: "ring-amber-400"   },
  { id: "emerald", dot: "bg-emerald-400", ring: "ring-emerald-400" },
  { id: "blue",    dot: "bg-blue-400",    ring: "ring-blue-400"    },
  { id: "rose",    dot: "bg-rose-400",    ring: "ring-rose-400"    },
  { id: "violet",  dot: "bg-violet-400",  ring: "ring-violet-400"  },
];
const TIPOS_EVENTO = [
  { id: "personal", label: "Personal" },
  { id: "reunion",  label: "Reunión"  },
  { id: "otro",     label: "Otro"     },
];

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function parseAnyDate(val) {
  if (!val) return null;
  let d;
  if (typeof val === "string") {
    // "YYYY-MM-DD" → mediodía local para evitar desfase UTC
    const clean = val.slice(0, 10);
    d = new Date(clean + "T12:00:00");
  } else if (typeof val.toDate === "function") {
    d = val.toDate(); // Firestore Timestamp → Date local
  } else if (val.seconds) {
    d = new Date(val.seconds * 1000);
  } else {
    return null;
  }
  if (isNaN(d.getTime())) return null;
  // Normalizar a mediodía local para que toKey() no dependa de la hora
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}
function dotColor(id) { return EVENT_COLORS.find(c=>c.id===id)?.dot || "bg-ink/40"; }
function defaultForm(dateKey) {
  return { titulo:"", fecha: dateKey, hora:"", color:"emerald", tipo:"personal", descripcion:"" };
}

function CalendarioProyectos({ projects, nav, user }) {
  const today    = new Date();
  const todayKey = toKey(today);
  const isAdminOrColab = user?.role === "admin" || user?.role === "colaborador";

  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedKey, setSelectedKey]   = useState(todayKey);
  const [personalEvents, setPersonalEvents] = useState([]);
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(defaultForm(todayKey));
  const [editingId, setEditingId]       = useState(null); // id del evento en edición
  const [saving, setSaving]             = useState(false);
  const [deletingId, setDeletingId]     = useState(null);

  /* ── Personal events real-time ── */
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      query(collection(db,"eventos",user.uid,"items"), orderBy("fecha","asc")),
      snap => setPersonalEvents(snap.docs.map(d=>({id:d.id,...d.data(),_source:"personal"}))),
      err  => console.error("eventos:",err)
    );
    return () => unsub();
  }, [user?.uid]);

  /* ── Events map ── */
  const eventsMap = useMemo(() => {
    const map = {};
    const push = (key,ev) => { if(!key) return; if(!map[key]) map[key]=[]; map[key].push(ev); };

    personalEvents.forEach(e => push(e.fecha, e));

    projects.forEach(p => {
      const status = (p.status||"").toLowerCase();
      if (["archivado","finalizado","completado"].includes(status)) return;
      // Entrega proyecto
      const d = parseAnyDate(p.endDate);
      if (d) push(toKey(d), { id:`proj_${p.id}`, titulo: p.name||"Proyecto", fecha: toKey(d),
        color:"amber", _source:"proyecto", _projectId:p.id });
      // Entregas de fases (admin/colab)
      if (isAdminOrColab) {
        (Array.isArray(p.fases)?p.fases:[]).forEach(f => {
          if (!f.fechaEntregaResponsable || f.estado==="completada") return;
          const fd = parseAnyDate(f.fechaEntregaResponsable);
          if (!fd) return;
          push(toKey(fd), { id:`fase_${p.id}_${f.id||f.nombre}`, titulo:`${f.nombre||"Fase"} — ${p.name||""}`,
            fecha: toKey(fd), color:"blue", _source:"fase", _projectId:p.id });
        });
      }
    });
    return map;
  }, [personalEvents, projects, isAdminOrColab]);

  /* ── Grid days ── */
  const gridDays = useMemo(() => {
    const y=currentMonth.getFullYear(), m=currentMonth.getMonth();
    const first=new Date(y,m,1), last=new Date(y,m+1,0);
    let dow=first.getDay(); dow=dow===0?6:dow-1;
    const days=[];
    for(let i=dow-1;i>=0;i--) { const d=new Date(y,m,-i); days.push({date:d,key:toKey(d),inMonth:false}); }
    for(let i=1;i<=last.getDate();i++) { const d=new Date(y,m,i); days.push({date:d,key:toKey(d),inMonth:true}); }
    const rem=(7-(days.length%7))%7;
    for(let i=1;i<=rem;i++) { const d=new Date(y,m+1,i); days.push({date:d,key:toKey(d),inMonth:false}); }
    return days;
  }, [currentMonth]);

  const selectedEvents = useMemo(() => {
    return (eventsMap[selectedKey]||[]).sort((a,b)=>{
      const ord={proyecto:2,fase:1,personal:0};
      const diff=(ord[a._source]??0)-(ord[b._source]??0);
      if(diff!==0) return diff;
      if(a.hora&&b.hora) return a.hora.localeCompare(b.hora);
      return 0;
    });
  }, [eventsMap, selectedKey]);

  const selectedDate = useMemo(()=>new Date(selectedKey+"T12:00:00"),[selectedKey]);
  const isThisMonth  = currentMonth.getFullYear()===today.getFullYear() && currentMonth.getMonth()===today.getMonth();

  /* ── Actions ── */
  function openEdit(ev) {
    setEditingId(ev.id);
    setForm({ titulo: ev.titulo||"", fecha: ev.fecha||selectedKey, hora: ev.hora||"", color: ev.color||"emerald", tipo: ev.tipo||"personal", descripcion: ev.descripcion||"" });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.titulo.trim()) return;
    setSaving(true);
    try {
      const payload = {
        titulo: form.titulo.trim(), fecha: form.fecha, hora: form.hora||null,
        color: form.color, tipo: form.tipo, descripcion: form.descripcion.trim()||null,
      };
      if (editingId) {
        await updateDoc(doc(db,"eventos",user.uid,"items",editingId), payload);
      } else {
        await addDoc(collection(db,"eventos",user.uid,"items"), { ...payload, creadoAt: serverTimestamp() });
      }
      setShowModal(false);
      setEditingId(null);
    } catch(e){ console.error(e); } finally { setSaving(false); }
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(defaultForm(selectedKey));
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try { await deleteDoc(doc(db,"eventos",user.uid,"items",id)); }
    catch(e){ console.error(e); } finally { setDeletingId(null); }
  }

  const selectedLabel = selectedDate.toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"});

  return (
    <div className="space-y-3">

      {/* ── Add event modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 pb-4"
          onClick={closeModal}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden"
            style={{background:"rgb(var(--ivory))",borderColor:"rgb(var(--taupe)/0.3)"}}
            onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{borderColor:"rgb(var(--taupe)/0.2)"}}>
              <p className="text-[14px] font-bold" style={{color:"rgb(var(--ink))"}}>{editingId?"Editar evento":"Nuevo evento"}</p>
              <button type="button" onClick={closeModal}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[18px] hover:bg-ink/8 transition"
                style={{color:"rgb(var(--ink)/0.4)"}}>×</button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[70dvh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-[11px]" style={{color:"rgb(var(--ink)/0.45)"}}>Título *</label>
                <input type="text" autoFocus maxLength={80} value={form.titulo}
                  onChange={e=>setForm(f=>({...f,titulo:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleSave()}
                  placeholder="¿Qué es este evento?" className="input w-full text-[13px]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px]" style={{color:"rgb(var(--ink)/0.45)"}}>Fecha</label>
                  <input type="date" value={form.fecha}
                    onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}
                    className="input w-full text-[13px]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px]" style={{color:"rgb(var(--ink)/0.45)"}}>Hora (opcional)</label>
                  <input type="time" value={form.hora}
                    onChange={e=>setForm(f=>({...f,hora:e.target.value}))}
                    className="input w-full text-[13px]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px]" style={{color:"rgb(var(--ink)/0.45)"}}>Color</label>
                <div className="flex gap-2">
                  {EVENT_COLORS.map(c=>(
                    <button key={c.id} type="button" onClick={()=>setForm(f=>({...f,color:c.id}))}
                      className={`w-7 h-7 rounded-full transition-all ${c.dot} ${
                        form.color===c.id?`ring-2 ring-offset-2 ${c.ring} scale-110`:"opacity-50 hover:opacity-75"}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px]" style={{color:"rgb(var(--ink)/0.45)"}}>Tipo</label>
                <div className="flex gap-2">
                  {TIPOS_EVENTO.map(t=>(
                    <button key={t.id} type="button" onClick={()=>setForm(f=>({...f,tipo:t.id}))}
                      className="px-3 py-1.5 rounded-full text-[11px] font-medium border transition"
                      style={form.tipo===t.id
                        ?{background:"rgb(var(--ink))",borderColor:"rgb(var(--ink))",color:"rgb(var(--ivory))"}
                        :{borderColor:"rgb(var(--taupe)/0.3)",color:"rgb(var(--ink)/0.6)"}}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px]" style={{color:"rgb(var(--ink)/0.45)"}}>Descripción (opcional)</label>
                <textarea rows={2} maxLength={200} value={form.descripcion}
                  onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))}
                  placeholder="Detalles adicionales…" className="input w-full text-[13px] resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border text-[13px] transition"
                  style={{borderColor:"rgb(var(--ink)/0.2)",color:"rgb(var(--ink)/0.6)"}}>Cancelar</button>
                <button type="button" onClick={handleSave} disabled={!form.titulo.trim()||saving}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition disabled:opacity-50"
                  style={{background:"rgb(var(--ink))",color:"rgb(var(--ivory))"}}>
                  {saving?"Guardando…":editingId?"Actualizar":"Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Calendar card ── */}
      <div className="card space-y-3">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button type="button" onClick={()=>setCurrentMonth(m=>new Date(m.getFullYear(),m.getMonth()-1,1))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[20px] font-medium hover:bg-ink/8 transition"
            style={{color:"rgb(var(--ink)/0.55)"}}>‹</button>
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-semibold" style={{color:"rgb(var(--ink))"}}>
              {MESES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </p>
            {!isThisMonth && (
              <button type="button"
                onClick={()=>{ setCurrentMonth(new Date(today.getFullYear(),today.getMonth(),1)); setSelectedKey(todayKey); }}
                className="text-[10px] px-2 py-0.5 rounded-full border transition hover:bg-ink/5"
                style={{borderColor:"rgb(var(--ink)/0.2)",color:"rgb(var(--ink)/0.5)"}}>Hoy</button>
            )}
          </div>
          <button type="button" onClick={()=>setCurrentMonth(m=>new Date(m.getFullYear(),m.getMonth()+1,1))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[20px] font-medium hover:bg-ink/8 transition"
            style={{color:"rgb(var(--ink)/0.55)"}}>›</button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7">
          {DIAS_SHORT.map(d=>(
            <div key={d} className="text-center text-[10px] font-semibold py-1" style={{color:"rgb(var(--ink)/0.38)"}}>{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {gridDays.map(({date,key,inMonth})=>{
            const isToday    = key===todayKey;
            const isSelected = key===selectedKey;
            const evs = eventsMap[key]||[];
            const uniqColors = [...new Set(evs.map(e=>e.color))].slice(0,3);
            return (
              <button key={key} type="button" onClick={()=>setSelectedKey(key)}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all min-h-[50px] ${!inMonth?"opacity-30":""}`}
                style={isSelected&&!isToday?{background:"rgb(var(--sand))"}:{}}>
                <span className="text-[13px] font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                  style={isToday
                    ?{background:"rgb(var(--ink))",color:"rgb(var(--ivory))",fontWeight:700}
                    :isSelected?{color:"rgb(var(--ink))",fontWeight:600}
                    :{color:"rgb(var(--ink)/0.75)"}}>
                  {date.getDate()}
                </span>
                {uniqColors.length>0&&(
                  <div className="flex gap-0.5">
                    {uniqColors.map((c,i)=><div key={i} className={`w-1.5 h-1.5 rounded-full ${dotColor(c)}`}/>)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Day panel ── */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] capitalize" style={{color:"rgb(var(--ink)/0.45)"}}>{selectedLabel}</p>
            <p className="text-[14px] font-semibold mt-0.5" style={{color:"rgb(var(--ink))"}}>
              {selectedEvents.length===0?"Sin eventos":`${selectedEvents.length} evento${selectedEvents.length!==1?"s":""}`}
            </p>
          </div>
          <button type="button"
            onClick={()=>{ setEditingId(null); setForm(defaultForm(selectedKey)); setShowModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold flex-shrink-0 transition active:scale-95"
            style={{background:"rgb(var(--ink))",color:"rgb(var(--ivory))"}}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Agregar
          </button>
        </div>

        {selectedEvents.length===0?(
          <div className="flex flex-col items-center py-6 gap-2">
            <span className="text-[32px]">📅</span>
            <p className="text-[12px]" style={{color:"rgb(var(--ink)/0.38)"}}>Nada programado para este día</p>
          </div>
        ):(
          <div className="space-y-2">
            {selectedEvents.map(ev=>{
              const colorCfg = EVENT_COLORS.find(c=>c.id===ev.color)||EVENT_COLORS[0];
              const isPersonal = ev._source==="personal";
              const bgStyle = ev._source==="proyecto"
                ?{borderColor:"rgb(251 191 36/0.4)",background:"rgb(254 243 199/0.35)"}
                :ev._source==="fase"
                ?{borderColor:"rgb(147 197 253/0.5)",background:"rgb(219 234 254/0.35)"}
                :{borderColor:"rgb(var(--taupe)/0.2)",background:"rgb(var(--sand)/0.4)"};
              return (
                <div key={ev.id} className="flex items-start gap-3 rounded-xl border px-3 py-2.5" style={bgStyle}>
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${colorCfg.dot}`}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium leading-snug" style={{color:"rgb(var(--ink))"}}>
                      {ev.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {ev.hora&&<span className="text-[11px]" style={{color:"rgb(var(--ink)/0.5)"}}>🕐 {ev.hora}</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        ev._source==="proyecto"?"bg-amber-100 text-amber-700":
                        ev._source==="fase"?"bg-blue-100 text-blue-700":
                        ev.tipo==="reunion"?"bg-violet-100 text-violet-700":"bg-sand text-ink/55"
                      }`}>
                        {ev._source==="proyecto"?"Entrega proyecto":ev._source==="fase"?"Entrega fase":
                         ev.tipo==="reunion"?"Reunión":ev.tipo==="personal"?"Personal":"Otro"}
                      </span>
                    </div>
                    {ev.descripcion&&<p className="text-[11px] mt-1" style={{color:"rgb(var(--ink)/0.5)"}}>{ev.descripcion}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {ev._projectId&&(
                      <button type="button" onClick={()=>nav(`/proyectos/${ev._projectId}`)}
                        title="Ver proyecto"
                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-ink/8 transition"
                        style={{color:"rgb(var(--ink)/0.35)"}}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6"/>
                        </svg>
                      </button>
                    )}
                    {isPersonal&&(
                      <>
                        <button type="button" onClick={()=>openEdit(ev)}
                          title="Editar"
                          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-ink/8 transition"
                          style={{color:"rgb(var(--ink)/0.35)"}}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button type="button" onClick={()=>handleDelete(ev.id)} disabled={deletingId===ev.id}
                          title="Eliminar"
                          className="w-6 h-6 flex items-center justify-center rounded-full transition hover:bg-red-50 disabled:opacity-30"
                          style={{color:"rgb(var(--ink)/0.25)"}}>
                          {deletingId===ev.id?(
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"/>
                          ):(
                            <svg className="w-3.5 h-3.5 hover:text-red-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 pb-1">
        <LegendDot color="bg-amber-400" label="Entrega proyecto" />
        {isAdminOrColab&&<LegendDot color="bg-blue-400" label="Entrega fase" />}
        <LegendDot color="bg-emerald-400" label="Evento personal" />
        <LegendDot color="bg-rose-400" label="Reunión / otro" />
      </div>
    </div>
  );
}

function LegendDot({color,label}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`}/>
      <span className="text-[10px]" style={{color:"rgb(var(--ink)/0.42)"}}>{label}</span>
    </div>
  );
}
LegendDot.propTypes = { color: PropTypes.string, label: PropTypes.string };

CalendarioProyectos.propTypes = {
  projects: PropTypes.array,
  nav: PropTypes.func,
  user: PropTypes.object,
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
  const [filterType, setFilterType] = useState("");

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
          type: data.type || data.tipo || null,
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

  const tiposDisponibles = useMemo(() => {
    const tipos = projects.map(p => p.type).filter(Boolean);
    return [...new Set(tipos)].sort();
  }, [projects]);

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
    if (filterType) {
      list = list.filter(p => p.type === filterType);
    }
    if (order === "nombre") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return list;
  }, [projects, qText, order, filterType]);

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

        {/* Filtro por tipo */}
        {tiposDisponibles.length > 0 && (
          <div className="relative">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className={`w-full input text-[12px] pr-8 appearance-none ${filterType ? "font-medium" : "text-ink/50"}`}
            >
              <option value="">Filtrar por tipo de proyecto…</option>
              {tiposDisponibles.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {filterType && (
                <button type="button" className="pointer-events-auto text-ink/40 hover:text-ink text-[15px] leading-none mr-1"
                  onClick={() => setFilterType("")}>×</button>
              )}
              <svg className="w-3.5 h-3.5 text-ink/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        <p className="text-[11px] text-ink/50">
          Se muestran los 50 proyectos activos más recientes.
        </p>
      </div>}

      {/* Contenido */}
      {loading && <p className="text-[13px] text-ink/60">Cargando proyectos…</p>}
      {error && !loading && <p className="text-[13px] text-red-600">{error}</p>}

      {!loading && !error && view === "calendario" && (
        <CalendarioProyectos projects={projects} nav={nav} user={user} />
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
        <div className="flex-1 min-w-0">
          {p.type && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-ink text-ivory mb-1">
              {p.type}
            </span>
          )}
          <h3 className="text-[15px] font-medium text-ink">{p.name}</h3>
          <p className="text-[12px] text-ink/70">Cliente: {p.client}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
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

// src/pages/mensajes/BandejaMensajes.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, doc, updateDoc, arrayRemove, query, where, limit, documentId } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../app/useAuth";
import { useChats } from "../../hooks/useChats";
import { ensureDirectChat, archiveChat, leaveChat } from "../../hooks/useChatMessages";
import PropTypes from "prop-types";
import { timeAgo as timeAgoUtil } from "../../utils/timeAgo";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function BandejaMensajes() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { chats, archivedChats, ready } = useChats(user?.uid);
  const [tab, setTab] = useState("mensajes");

  const isAdmin = user?.role === "admin";

  // Pestañas disponibles según rol
  const tabs = [
    { id: "mensajes", label: "Bandeja" },
    { id: "archivados", label: "Archivados" },
    ...(isAdmin ? [{ id: "permisos", label: "Permisos" }] : []),
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">Comunicación</p>
          <h1 className="text-[20px] font-bold text-ink leading-tight">Mensajes</h1>
        </div>
        <div className="flex rounded-xl border border-taupe/30 overflow-hidden text-[11px]">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 font-medium transition ${tab === t.id ? "bg-ink text-ivory" : "text-ink/60"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "permisos" && isAdmin
        ? <PermisosPanel />
        : tab === "archivados"
          ? <ChatList chats={archivedChats} ready={ready} user={user} nav={nav} isArchived />
          : <ChatList chats={chats} ready={ready} user={user} nav={nav} />
      }
    </section>
  );
}

/* ── Lista de chats ── */
function ChatList({ chats, ready, user, nav, isArchived = false }) {
  const [showNuevo, setShowNuevo] = useState(false);
  const isCliente = user?.role === "cliente";

  return (
    <div className="space-y-3">
      {/* Botón nuevo chat — solo en bandeja activa */}
      {!isArchived && (
        <>
          <button type="button" onClick={() => setShowNuevo(v => !v)}
            className="w-full flex items-center gap-2 rounded-2xl border border-dashed border-taupe/40 px-4 py-3 text-[12px] text-ink/50 hover:text-ink hover:border-ink/30 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {isCliente ? "Contactar a H&E Arquitectos" : "Nuevo chat"}
          </button>

          {showNuevo && (
            <NuevoChatDirecto
              currentUser={user}
              onCreated={(chatId) => { setShowNuevo(false); nav(`/mensajes/${chatId}`); }}
              onClose={() => setShowNuevo(false)}
            />
          )}
        </>
      )}

      {!ready ? (
        <LoadingSpinner text="Cargando mensajes…" />
      ) : chats.length === 0 ? (
        <div className="card text-center py-10 space-y-2">
          <p className="text-3xl">{isArchived ? "🗄️" : "💬"}</p>
          <p className="text-[14px] font-semibold text-ink">
            {isArchived ? "Sin chats archivados" : "Sin conversaciones aún"}
          </p>
          {!isArchived && (
            <p className="text-[12px] text-ink/50 max-w-[220px] mx-auto leading-relaxed">
              {isCliente
                ? "Pulsa \"Contactar a H&E\" para hablar con el equipo."
                : "Inicia un chat directo o espera mensajes de proyecto."}
            </p>
          )}
        </div>
      ) : (
        chats.map(chat => (
          <TarjetaChat key={chat.id} chat={chat} currentUid={user?.uid}
            isArchived={isArchived}
            onClick={() => nav(`/mensajes/${chat.id}`)} />
        ))
      )}
    </div>
  );
}

/* ── Tarjeta chat en bandeja ── */
function TarjetaChat({ chat, currentUid, onClick, isArchived = false }) {
  const unread = chat.unread?.[currentUid] || 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef(null);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  let displayName = "";
  let subtitle = "";

  if (chat.type === "project") {
    displayName = chat.projectName || "Proyecto";
    const others = (chat.participants || [])
      .filter(uid => uid !== currentUid)
      .map(uid => chat.participantNames?.[uid]?.split(" ")[0])
      .filter(Boolean).join(", ");
    subtitle = others || "Chat de proyecto";
  } else {
    const otherUid = (chat.participants || []).find(uid => uid !== currentUid);
    displayName = otherUid ? (chat.participantNames?.[otherUid] || "Usuario") : "Chat";
    const otherRole = otherUid ? chat.participantRoles?.[otherUid] : "";
    subtitle = ROLE_LABEL[otherRole] || "Usuario";
  }

  const lastTime = chat.lastAt?.seconds
    ? timeAgoUtil(new Date(chat.lastAt.seconds * 1000)) : "";

  const handleArchive = async (e) => {
    e.stopPropagation();
    setLoading(true);
    try { await archiveChat(chat.id, currentUid); } catch (_e) { /* ignored */ }
    setMenuOpen(false);
    setLoading(false);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    setLoading(true);
    try {
      if (chat.type === "direct") {
        await leaveChat(chat.id, currentUid);
      } else {
        await archiveChat(chat.id, currentUid);
      }
    } catch (_e) { /* ignored */ }
    setMenuOpen(false);
    setLoading(false);
  };

  const handleUnarchive = async (e) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await updateDoc(doc(db, "chats", chat.id), { hiddenFor: arrayRemove(currentUid) });
    } catch (_e) { /* ignored */ }
    setLoading(false);
  };

  return (
    <div className="relative">
      <button type="button" onClick={onClick} className="w-full card flex items-center gap-3 text-left pr-10">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[14px] ${
          chat.type === "project" ? "bg-ink" : "bg-[#5C5852]"
        }`}>
          {chat.type === "project" ? "🏗" : (
            <span className="font-bold text-ivory text-[13px]">{displayName[0]?.toUpperCase() || "?"}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-[13px] truncate ${unread > 0 ? "font-semibold text-ink" : "font-medium text-ink/80"}`}>
              {displayName}
            </p>
            <span className="text-[10px] text-ink/40 flex-shrink-0">{lastTime}</span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[11px] text-ink/50 truncate">
              {chat.lastMessage
                ? `${chat.lastMessageSender?.split(" ")[0] || ""}: ${chat.lastMessage}`
                : subtitle}
            </p>
            {unread > 0 && (
              <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-ink text-ivory text-[9px] font-bold flex items-center justify-center px-1">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Acción derecha: desarchivar (vista archivados) o menú ⋯ (bandeja) */}
      <div ref={menuRef} className="absolute right-3 top-1/2 -translate-y-1/2">
        {isArchived ? (
          /* Botón desarchivar directo */
          <button
            type="button"
            onClick={handleUnarchive}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-ink/60 hover:text-ink hover:bg-ink/10 transition disabled:opacity-50"
          >
            {loading
              ? <span className="w-3 h-3 rounded-full border-2 border-ink/20 border-t-ink animate-spin block" />
              : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Mover
                </>
              )
            }
          </button>
        ) : (
          /* Menú ⋯ normal */
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
              disabled={loading}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-ink/10 text-ink/40 hover:text-ink transition text-[16px] leading-none"
            >
              {loading ? (
                <span className="w-3 h-3 rounded-full border-2 border-ink/20 border-t-ink animate-spin block" />
              ) : "⋯"}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border border-taupe/20 overflow-hidden w-40">
                <button
                  type="button"
                  onClick={handleArchive}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-ink/70 hover:bg-sand/60 transition text-left"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12" />
                  </svg>
                  Archivar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-red-500 hover:bg-red-50 transition text-left border-t border-taupe/10"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {chat.type === "direct" ? "Eliminar chat" : "Archivar"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Selector de persona para nuevo chat ── */
function NuevoChatDirecto({ currentUser, onCreated, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        let list = [];

        if (currentUser.role === "admin") {
          // Admin ve a todos
          const snaps = await Promise.all([
            getDocs(query(collection(db, "users"), where("role", "==", "colaborador"), limit(30))),
            getDocs(query(collection(db, "users"), where("role", "==", "cliente"), limit(30))),
          ]);
          list = snaps.flatMap(s => s.docs.map(d => ({ uid: d.id, ...d.data() })));

        } else if (currentUser.role === "colaborador") {
          // Colaborador: admin + otros colaboradores + clientes de proyectos con permiso
          const [adminSnap, colabSnap, proySnap] = await Promise.all([
            getDocs(query(collection(db, "users"), where("role", "==", "admin"), limit(10))),
            getDocs(query(collection(db, "users"), where("role", "==", "colaborador"), limit(30))),
            getDocs(query(collection(db, "projects"), where(`chatPermisos.${currentUser.uid}`, "==", true), limit(20))),
          ]);
          const base = [
            ...adminSnap.docs.map(d => ({ uid: d.id, ...d.data() })),
            ...colabSnap.docs.map(d => ({ uid: d.id, ...d.data() })),
          ];
          // Obtener clientIds únicos de los proyectos con permiso
          const clientIds = [...new Set(
            proySnap.docs.map(d => d.data().clientId).filter(Boolean)
          )];
          let clientUsers = [];
          if (clientIds.length > 0) {
            // Firestore "in" soporta hasta 30 valores
            const chunks = [];
            for (let i = 0; i < clientIds.length; i += 30) chunks.push(clientIds.slice(i, i + 30));
            const clientSnaps = await Promise.all(
              chunks.map(chunk => getDocs(query(collection(db, "users"), where(documentId(), "in", chunk))))
            );
            clientUsers = clientSnaps.flatMap(s => s.docs.map(d => ({ uid: d.id, ...d.data() })));
          }
          list = [...base, ...clientUsers];

        } else if (currentUser.role === "cliente") {
          // Cliente: admin + colaboradores con permiso en sus proyectos
          const [adminSnap, proySnap] = await Promise.all([
            getDocs(query(collection(db, "users"), where("role", "==", "admin"), limit(10))),
            getDocs(query(collection(db, "projects"), where("clientId", "==", currentUser.uid), limit(20))),
          ]);
          const base = adminSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
          // Recolectar UIDs de colaboradores con permiso
          const colabIds = [...new Set(
            proySnap.docs.flatMap(d => {
              const permisos = d.data().chatPermisos || {};
              return Object.entries(permisos).filter(([, v]) => v).map(([uid]) => uid);
            })
          )];
          let colabUsers = [];
          if (colabIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < colabIds.length; i += 30) chunks.push(colabIds.slice(i, i + 30));
            const colabSnaps = await Promise.all(
              chunks.map(chunk => getDocs(query(collection(db, "users"), where(documentId(), "in", chunk))))
            );
            colabUsers = colabSnaps.flatMap(s => s.docs.map(d => ({ uid: d.id, ...d.data() })));
          }
          list = [...base, ...colabUsers];
        }

        setUsers(list.filter(u => u.uid !== currentUser.uid));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const handleSelect = async (otherUser) => {
    setCreating(otherUser.uid);
    try {
      const chatId = await ensureDirectChat(
        currentUser.uid, currentUser.name || currentUser.email, currentUser.role,
        otherUser.uid, otherUser.name || otherUser.email, otherUser.role,
      );
      onCreated(chatId);
    } catch (_e) { /* ignored */
      setCreating(null);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink">
          {currentUser.role === "cliente" ? "Contactar a H&E Arquitectos" : "Seleccionar persona"}
        </p>
        <button type="button" onClick={onClose} className="text-ink/40 hover:text-ink text-lg leading-none">×</button>
      </div>

      {loading ? (
        <p className="text-[12px] text-ink/50 py-2">Cargando…</p>
      ) : users.length === 0 ? (
        <p className="text-[12px] text-ink/50 py-2">Sin usuarios disponibles.</p>
      ) : (
        <div className="space-y-1.5">
          {users.map(u => (
            <button key={u.uid} type="button" disabled={!!creating}
              onClick={() => handleSelect(u)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sand/60 transition text-left disabled:opacity-60">
              <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center flex-shrink-0">
                <span className="text-[12px] font-bold text-ivory">{(u.name || "?")[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink truncate">{u.name}</p>
                <p className="text-[11px] text-ink/50">{ROLE_LABEL[u.role] || u.role}</p>
              </div>
              {creating === u.uid && (
                <div className="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Panel de permisos (admin) ── */
function PermisosPanel() {
  const [proyectos, setProyectos] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  useEffect(() => {
    const load = async () => {
      const [pSnap, cSnap] = await Promise.all([
        getDocs(query(collection(db, "projects"), limit(50))),
        getDocs(query(collection(db, "users"), where("role", "==", "colaborador"), limit(30))),
      ]);
      setColaboradores(cSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
      setProyectos(
        pSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => {
            const s = (p.status || "").toLowerCase();
            return s !== "archivado" && s !== "finalizado" && p.clientId;
          })
      );
      setLoading(false);
    };
    load();
  }, []);

  const togglePermiso = async (proyecto, colaborador) => {
    const key = `${proyecto.id}_${colaborador.uid}`;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const { doc, updateDoc, arrayUnion, arrayRemove, getDoc } = await import("firebase/firestore");
      const actual = proyecto.chatPermisos?.[colaborador.uid] || false;
      const nuevoValor = !actual;

      await updateDoc(doc(db, "projects", proyecto.id), {
        [`chatPermisos.${colaborador.uid}`]: nuevoValor,
      });

      const chatRef = doc(db, "chats", `project_${proyecto.id}`);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        if (nuevoValor) {
          await updateDoc(chatRef, {
            participants: arrayUnion(colaborador.uid),
            [`participantNames.${colaborador.uid}`]: colaborador.name,
            [`participantRoles.${colaborador.uid}`]: "colaborador",
            [`unread.${colaborador.uid}`]: 0,
          });
        } else {
          await updateDoc(chatRef, { participants: arrayRemove(colaborador.uid) });
        }
      }

      setProyectos(prev => prev.map(p => p.id === proyecto.id
        ? { ...p, chatPermisos: { ...p.chatPermisos, [colaborador.uid]: nuevoValor } }
        : p
      ));
    } catch (_e) { /* ignored */
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  };

  if (loading) return <LoadingSpinner text="Cargando…" />;

  if (proyectos.length === 0) return (
    <div className="card text-center py-10">
      <p className="text-[13px] text-ink/50">No hay proyectos activos con cliente asignado.</p>
    </div>
  );

  if (colaboradores.length === 0) return (
    <div className="card text-center py-10">
      <p className="text-[13px] text-ink/50">No hay colaboradores registrados aún.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-ink/60 leading-relaxed">
        Activa qué colaboradores pueden chatear con el cliente de cada proyecto.
      </p>
      {proyectos.map(p => (
        <div key={p.id} className="card space-y-3">
          <div>
            <p className="text-[13px] font-semibold text-ink">{p.name || p.nombre}</p>
            <p className="text-[11px] text-ink/50">Cliente: {p.client || p.cliente || "—"}</p>
          </div>
          <div className="space-y-2.5">
            {colaboradores.map(c => {
              const key = `${p.id}_${c.uid}`;
              const activo = p.chatPermisos?.[c.uid] || false;
              return (
                <div key={c.uid} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#5C5852] flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-ivory">{(c.name || "?")[0].toUpperCase()}</span>
                    </div>
                    <p className="text-[12px] text-ink truncate">{c.name}</p>
                  </div>
                  <button type="button" disabled={saving[key]}
                    onClick={() => togglePermiso(p, c)}
                    className="relative flex-shrink-0 w-10 rounded-full transition-colors duration-200 disabled:opacity-50"
                    style={{ height: "22px", backgroundColor: activo ? "#141414" : "#d1c9bf" }}>
                    <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform duration-200 ${activo ? "translate-x-[20px]" : "translate-x-0.5"}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const ROLE_LABEL = { admin: "Admin · H&E", colaborador: "Colaborador", cliente: "Cliente" };


ChatList.propTypes = {
  chats: PropTypes.array,
  ready: PropTypes.bool,
  user: PropTypes.object,
  nav: PropTypes.func,
  isArchived: PropTypes.bool,
};

TarjetaChat.propTypes = {
  chat: PropTypes.object,
  currentUid: PropTypes.string,
  onClick: PropTypes.func,
  isArchived: PropTypes.bool,
};

NuevoChatDirecto.propTypes = {
  currentUser: PropTypes.object,
  onCreated: PropTypes.func,
  onClose: PropTypes.func,
};

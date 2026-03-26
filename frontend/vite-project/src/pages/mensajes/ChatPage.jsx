// src/pages/mensajes/ChatPage.jsx
// Chat individual — project_xxx o direct_uid_uid
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, limit, getDoc, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../app/useAuth";
import { useChatMessages, ensureProjectChat } from "../../hooks/useChatMessages";
import ChatWindow from "../../components/ChatWindow";
import PropTypes from "prop-types";

export default function ChatPage() {
  const { chatId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [initializing, setInitializing] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [resolvedChatId, setResolvedChatId] = useState(null);

  // Si el chatId es un projectId (viene desde el detalle del proyecto),
  // asegurar que existe el chat y verificar acceso
  useEffect(() => {
    if (!chatId || !user) return;

    const init = async () => {
      setInitializing(true);

      try {
        // Si ya tiene prefijo, usar directo
        if (chatId.startsWith("project_") || chatId.startsWith("direct_")) {
          // Verificar acceso
          const chatSnap = await getDoc(doc(db, "chats", chatId));
          if (chatSnap.exists()) {
            const data = chatSnap.data();
            if (!data.participants?.includes(user.uid) && user.role !== "admin") {
              setAccessDenied(true);
              return;
            }
          }
          setResolvedChatId(chatId);
          return;
        }

        // Es un projectId sin prefijo → inicializar chat de proyecto
        const projectSnap = await getDoc(doc(db, "projects", chatId));
        if (!projectSnap.exists()) { setAccessDenied(true); return; }

        const project = projectSnap.data();

        // Obtener uid del admin
        const adminSnap = await getDocs(query(
          collection(db, "users"), where("role", "==", "admin"), limit(1)
        ));
        const adminDoc = adminSnap.docs[0];
        const adminId = adminDoc?.id || null;
        const adminName = adminDoc?.data()?.name || "H&E Arquitectos";

        const cId = await ensureProjectChat(
          chatId,
          project.name || project.nombre || "Proyecto",
          project.clientId || null,
          project.client || project.cliente || "Cliente",
          adminId,
          adminName,
        );

        // Verificar acceso para colaboradores
        if (user.role === "colaborador") {
          const chatSnap = await getDoc(doc(db, "chats", cId));
          const chatData = chatSnap.data();
          if (!chatData?.participants?.includes(user.uid)) {
            setAccessDenied(true);
            return;
          }
        }

        setResolvedChatId(cId);
      } catch (_e) { /* ignored */
        setAccessDenied(true);
      } finally {
        setInitializing(false);
      }
    };

    init();
  }, [chatId, user]);

  if (initializing) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="space-y-3 text-center py-10">
        <p className="text-3xl">🔒</p>
        <p className="text-[14px] font-semibold text-ink">Sin acceso</p>
        <p className="text-[12px] text-ink/55">No tienes permiso para ver este chat.</p>
        <button type="button" onClick={() => nav("/mensajes")} className="btn-outline text-[12px]">
          Volver a mensajes
        </button>
      </div>
    );
  }

  return <ChatInner chatId={resolvedChatId} user={user} onBack={() => nav("/mensajes")} />;
}

function ChatInner({ chatId, user, onBack }) {
  const { messages, chat, ready, sendMessage } = useChatMessages(chatId, user?.uid);

  // Nombre a mostrar en el header
  let chatName = "";
  let subtitle = "";

  if (chat) {
    if (chat.type === "project") {
      chatName = chat.projectName || "Proyecto";
      const others = (chat.participants || [])
        .filter(uid => uid !== user?.uid)
        .map(uid => chat.participantNames?.[uid])
        .filter(Boolean)
        .join(", ");
      subtitle = others || "Chat de proyecto";
    } else {
      const otherUid = (chat.participants || []).find(uid => uid !== user?.uid);
      chatName = otherUid ? (chat.participantNames?.[otherUid] || "Usuario") : "Chat";
      const otherRole = otherUid ? chat.participantRoles?.[otherUid] : "";
      subtitle = { admin: "Admin", colaborador: "Colaborador", cliente: "Cliente" }[otherRole] || "";
    }
  }

  const handleSend = (text) => {
    return sendMessage(text, {
      uid: user.uid,
      name: user.name || user.email || "Usuario",
      role: user.role,
    });
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 10rem)" }}>
      {/* Botón volver */}
      <button
        type="button"
        onClick={onBack}
        className="text-[12px] text-ink/60 hover:text-ink flex items-center gap-1 mb-2 self-start"
      >
        ‹ Mensajes
      </button>

      {/* Participantes activos */}
      {chat?.participants?.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {chat.participants.map(uid => {
            const name = chat.participantNames?.[uid] || "Usuario";
            const role = chat.participantRoles?.[uid] || "";
            const isMe = uid === user?.uid;
            return (
              <span key={uid} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                isMe ? "bg-ink/10 border-ink/20 text-ink" : "bg-sand border-taupe/30 text-ink/70"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  role === "admin" ? "bg-ink" : role === "colaborador" ? "bg-[#5C5852]" : "bg-emerald-600"
                }`} />
                {name.split(" ")[0]}{isMe ? " (tú)" : ""}
              </span>
            );
          })}
        </div>
      )}

      {/* Ventana de chat */}
      <div className="flex-1 rounded-2xl border border-taupe/25 overflow-hidden bg-[#F7F4EE]">
        <ChatWindow
          messages={messages}
          onSend={handleSend}
          ready={ready}
          currentUid={user?.uid}
          chatName={chatName}
          subtitle={subtitle}
        />
      </div>
    </div>
  );
}

ChatPage.propTypes = {
  chatId: PropTypes.string,
  user: PropTypes.object,
  onBack: PropTypes.func,
};

ChatInner.propTypes = {
  chatId: PropTypes.string,
  user: PropTypes.object,
  onBack: PropTypes.func,
};

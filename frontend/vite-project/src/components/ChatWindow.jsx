// src/components/ChatWindow.jsx
// UI reutilizable de mensajería
import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

const ROLE_COLOR = {
  admin: "bg-ink text-ivory",
  colaborador: "bg-[#5C5852] text-ivory",
  cliente: "bg-emerald-700 text-ivory",
};

const ROLE_LABEL = {
  admin: "Admin",
  colaborador: "Colaborador",
  cliente: "Cliente",
};

export default function ChatWindow({ messages, onSend, ready, currentUid, chatName, subtitle }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await onSend(text);
    setText("");
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header del chat */}
      {chatName && (
        <div className="px-4 py-3 border-b border-taupe/20 bg-ivory flex-shrink-0">
          <p className="text-[14px] font-semibold text-ink leading-tight">{chatName}</p>
          {subtitle && <p className="text-[11px] text-ink/50 mt-0.5">{subtitle}</p>}
        </div>
      )}

      {/* Lista de mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {!ready && (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
          </div>
        )}

        {ready && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-[13px] font-medium text-ink/60">Sin mensajes aún</p>
            <p className="text-[11px] text-ink/40 mt-1">Sé el primero en escribir</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isOwn = msg.senderId === currentUid;
          const prevMsg = messages[idx - 1];
          const showSender = !prevMsg || prevMsg.senderId !== msg.senderId;
          const time = msg.createdAt?.seconds
            ? timeAgo(new Date(msg.createdAt.seconds * 1000))
            : "";

          return (
            <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
              {/* Nombre + rol (solo al cambiar de remitente) */}
              {showSender && !isOwn && (
                <div className="flex items-center gap-1.5 mb-1 ml-1">
                  <span className="text-[11px] font-semibold text-ink/70">{msg.senderName}</span>
                  {msg.senderRole && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_COLOR[msg.senderRole] || "bg-sand text-ink"}`}>
                      {ROLE_LABEL[msg.senderRole] || msg.senderRole}
                    </span>
                  )}
                </div>
              )}

              {/* Burbuja */}
              <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-[13px] leading-snug ${
                isOwn
                  ? "bg-ink text-ivory rounded-br-sm"
                  : "bg-white border border-taupe/25 text-ink rounded-bl-sm"
              }`}>
                {msg.text}
              </div>

              {/* Hora */}
              <p className="text-[10px] text-ink/35 mt-0.5 mx-1">{time}</p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-taupe/20 bg-ivory px-3 py-2.5 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe un mensaje…"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-taupe/30 bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink/40 focus:outline-none focus:border-ink/40 transition max-h-[80px] overflow-y-auto"
          style={{ lineHeight: "1.4" }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-ink text-ivory flex items-center justify-center disabled:opacity-40 transition active:scale-95"
        >
          {sending ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-ivory/40 border-t-ivory animate-spin" />
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

ChatWindow.propTypes = {
  messages: PropTypes.array.isRequired,
  onSend: PropTypes.func.isRequired,
  ready: PropTypes.bool,
  currentUid: PropTypes.string,
  chatName: PropTypes.string,
  subtitle: PropTypes.string,
};

function timeAgo(date) {
  if (!date) return "";
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

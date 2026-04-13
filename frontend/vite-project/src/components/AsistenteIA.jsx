// src/components/AsistenteIA.jsx
// Asistente IA con Gemini via Firebase AI Logic

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDocs, onSnapshot, query, where, limit, orderBy } from "firebase/firestore";
import PropTypes from "prop-types";
import { db, geminiModel } from "../lib/firebase";
import { useAuth } from "../app/useAuth";

const CONTACTO_HYE = {
  telefono: "321 885 6680",
  correo: "hyearquitectos@gmail.com",
};

const EMPRESA_INFO = `
## Sobre H&E Arquitectos
- **Nombre completo**: H&E Arquitectos (HYE - Espacios Humanos)
- **Mision**: Disenamos espacios con proposito y vision colaborativa.
- **Fundadora**: Luisa Erazo, arquitecta y directora de la firma.
- **Ubicacion**: Cali, Colombia.
- **Telefono / WhatsApp**: ${CONTACTO_HYE.telefono}
- **Correo**: ${CONTACTO_HYE.correo}
- **Instagram**: @hye.arquitectos
- **Horario de atencion**: Lunes a viernes, 7:00 a.m. - 5:00 p.m.
- **Servicios**:
  - Diseno arquitectonico (vivienda, comercial, institucional)
  - Diseno de interiores
  - Consultorias especializadas en arquitectura y construccion
- **Equipo**: H&E cuenta con un equipo multidisciplinario de profesionales en arquitectura, diseno, ingenieria y gestion de proyectos.
- **Filosofia**: Cada proyecto es unico. Trabajamos de cerca con el cliente para entender sus necesidades.
`;

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-current">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded-md bg-black/10 text-[0.95em] font-medium"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

function renderMarkdown(text) {
  const lines = text.split("\n");
  const out = [];
  let key = 0;

  for (const line of lines) {
    if (/^\s*#{1,3}\s+/.test(line)) {
      const content = line.replace(/^\s*#{1,3}\s+/, "");
      out.push(
        <p key={key++} className="mt-1 mb-2 text-[12px] font-semibold tracking-tight">
          {renderInline(content)}
        </p>
      );
    } else if (/^\s*([-*]|•)\s+/.test(line)) {
      const content = line.replace(/^\s*([-*]|•)\s+/, "");
      out.push(
        <div key={key++} className="flex gap-2 items-start mt-1">
          <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-current opacity-45 flex-shrink-0" />
          <span className="flex-1 leading-6">{renderInline(content)}</span>
        </div>
      );
    } else if (line.trim() === "") {
      out.push(<div key={key++} className="h-2" />);
    } else {
      out.push(
        <p key={key++} className="leading-6 text-[12.5px]">
          {renderInline(line)}
        </p>
      );
    }
  }

  return out;
}

function getSupportInstructions(role) {
  const base = `

Si no tienes informacion suficiente, no puedes confirmar un dato o la solicitud requiere ayuda humana:
- dilo con honestidad en una frase corta
- indica que se contacten con el admin o con el equipo de H&E
- invitalos a ir a la seccion de mensajes para iniciar un nuevo chat
- no inventes datos ni estados de proyecto

Usa formato ordenado y legible cuando ayude: titulo corto y vinetas breves.`;

  if (role === "cliente") {
    return `${base}

Si el cliente dice que tu respuesta no le sirvio, no le ayudo o quiere atencion humana:
- disculpate brevemente
- ofrece escribir al equipo de H&E
- comparte este telefono: ${CONTACTO_HYE.telefono}
- comparte este correo: ${CONTACTO_HYE.correo}`;
  }

  return base;
}

function needsHumanEscalation(prompt, response) {
  const combined = `${prompt}\n${response}`;
  return /(no me sirv|no me ayud|no entend|hablar con|contact(ar|arme)?|asesor|persona|humano|admin|administrador|soporte|no (sabes|sabe)|no puedes|no estoy seguro|no tengo acceso|no cuento con esa informaci[oó]n|no puedo confirmar)/i.test(combined);
}

function needsDirectContact(role, prompt) {
  if (role !== "cliente") return false;
  return /(no me sirv|no me ayud|no entend|quiero hablar con alguien|quiero hablar con una persona|necesito ayuda humana|necesito que me contacten|quiero contactarlos)/i.test(prompt);
}

function buildSystemPrompt(user, proyectos) {
  const rol = user?.role || "sin-rol";
  const nombre = user?.name?.split(" ")[0] || "Usuario";

  if (rol === "admin") {
    const resumen = proyectos.length
      ? proyectos.map((p) => {
        const fases = Array.isArray(p.fases) ? p.fases : [];
        const completadas = fases.filter((f) => f.estado === "completada").length;
        const enCurso = fases.filter((f) => f.estado === "en_curso").length;
        return `- "${p.name || p.nombre}": ${p.progress || 0}% avance, ${completadas}/${fases.length} fases completadas, ${enCurso} en curso, cliente: ${p.client || p.cliente || "sin asignar"}`;
      }).join("\n")
      : "Sin proyectos registrados.";

    return `Eres el asistente inteligente de H&E Arquitectos. Estas hablando con ${nombre}, la administradora de la firma.

${EMPRESA_INFO}

Estado actual de los proyectos:
${resumen}

Ayudala con consultas sobre proyectos, alertas de fases, preguntas tecnicas de arquitectura y uso de la plataforma.
${getSupportInstructions(rol)}
Responde siempre en espanol, de forma profesional y concisa. Maximo 3 parrafos.`;
  }

  if (rol === "colaborador") {
    const subRoleLabel = { juridica: "Juridica", sistemas: "Sistemas", arquitecto: "Arquitecto" }[user?.subRole] || "Colaborador";
    const misFases = [];

    proyectos.forEach((p) => {
      (p.fases || []).forEach((f) => {
        if (f.responsableUid === user?.uid) {
          misFases.push(`- "${f.nombre}" en "${p.name || p.nombre}": ${f.porcentaje || 0}% (${f.estado || "pendiente"})`);
        }
      });
    });

    return `Eres el asistente de H&E Arquitectos. Estas hablando con ${nombre}, colaborador del area de ${subRoleLabel}.

${EMPRESA_INFO}

Fases asignadas:
${misFases.length ? misFases.join("\n") : "Sin fases asignadas aun."}

Ayudalo con sus fases, preguntas tecnicas y uso de la plataforma.
${getSupportInstructions(rol)}
Responde en espanol, claro y practico. Maximo 3 parrafos.`;
  }

  if (rol === "cliente") {
    const p = proyectos[0];
    let info = "Sin proyecto activo.";

    if (p) {
      const fases = (p.fases || []).map((f) => {
        const estadoEnCursoLabel = f.estado === "en_curso" ? "En curso" : "Pendiente";
        const estadoLabel = f.estado === "completada" ? "Completada" : estadoEnCursoLabel;
        return `- ${f.nombre}: ${f.porcentaje || 0}% - ${estadoLabel}`;
      }).join("\n");

      info = `Proyecto: "${p.name || p.nombre}" - ${p.progress || 0}% avance\nFases:\n${fases}`;
    }

    return `Eres el asistente de H&E Arquitectos. Estas hablando con ${nombre}, cliente de la firma.

${EMPRESA_INFO}

${info}

Tu rol es orientar al cliente sobre el estado de su proyecto, explicar las fases del proceso, responder preguntas sobre arquitectura y brindar informacion general sobre la firma cuando lo solicite. No compartas informacion de otros clientes.
${getSupportInstructions(rol)}
Responde en espanol, de forma amigable y profesional. Maximo 3 parrafos.`;
  }

  return "Eres el asistente de H&E Arquitectos. Responde en espanol de forma profesional.";
}

export default function AsistenteIA() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [proyectos, setProyectos] = useState([]);
  const [error, setError] = useState("");
  // Escucha directa de iaHabilitada — independiente del contexto
  const [iaHabilitada, setIaHabilitada] = useState(true);
  const [pos, setPos] = useState(() => {
    try {
      const s = localStorage.getItem("hye-ia-pos");
      return s ? JSON.parse(s) : { right: 16, bottom: 128 };
    } catch { return { right: 16, bottom: 128 }; }
  });
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const chatSessionRef = useRef(null);
  const wrapperRef = useRef(null);
  const drag = useRef({ active: false, sx: 0, sy: 0, sr: 0, sb: 0, moved: false });

  // Listener directo al documento del usuario para iaHabilitada en tiempo real
  useEffect(() => {
    if (!user?.uid || user.role === "admin") return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setIaHabilitada(data.iaHabilitada !== false);
    });
    return () => unsub();
  }, [user?.uid, user?.role]);

  useEffect(() => {
    if (!user?.uid) return;

    const cargar = async () => {
      try {
        const col = collection(db, "projects");
        let snap;

        if (user.role === "admin") {
          snap = await getDocs(query(col, orderBy("updatedAt", "desc"), limit(20)));
        } else if (user.role === "colaborador") {
          snap = await getDocs(query(col, limit(30)));
        } else {
          snap = await getDocs(query(col, where("clientId", "==", user.uid), limit(5)));
          if (snap.empty) {
            snap = await getDocs(query(col, where("clientEmail", "==", user.email), limit(5)));
          }
        }

        setProyectos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
    };

    cargar();
  }, [user?.uid, user?.role, user?.email]);

  useEffect(() => {
    if (!abierto || !user || !geminiModel) return;

    chatSessionRef.current = geminiModel.startChat({
      history: [],
      systemInstruction: { parts: [{ text: buildSystemPrompt(user, proyectos) }] },
    });
  }, [abierto, proyectos, user]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [mensajes, cargando]);

  useEffect(() => {
    if (abierto) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [abierto]);

  const enviar = async () => {
    const texto = input.trim();
    if (!texto || cargando || !chatSessionRef.current) return;

    setMensajes((prev) => [...prev, { role: "user", content: texto }]);
    setInput("");
    setCargando(true);
    setError("");

    try {
      const result = await chatSessionRef.current.sendMessage(texto);
      const respuesta = result.response.text();
      const showMessages = needsHumanEscalation(texto, respuesta);
      const showContact = needsDirectContact(user?.role, texto);

      setMensajes((prev) => [...prev, {
        role: "assistant",
        content: respuesta,
        actions: {
          messages: showMessages,
          contact: showContact,
        },
      }]);
    } catch (e) {
      console.error(e);
      setError("No pude conectar con el asistente. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  const limpiar = () => {
    setMensajes([]);
    setError("");

    if (user && geminiModel) {
      chatSessionRef.current = geminiModel.startChat({
        history: [],
        systemInstruction: { parts: [{ text: buildSystemPrompt(user, proyectos) }] },
      });
    }
  };

  if (!user) return null;
  if (user.role !== "admin" && !iaHabilitada) return null;

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    drag.current = { active: true, sx: e.clientX, sy: e.clientY, sr: pos.right, sb: pos.bottom, moved: false };
    wrapperRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!drag.current.active) return;
    const dx = drag.current.sx - e.clientX;
    const dy = drag.current.sy - e.clientY;
    if (!drag.current.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) drag.current.moved = true;
    if (drag.current.moved) {
      const r = Math.max(4, Math.min(drag.current.sr + dx, window.innerWidth - 56));
      const b = Math.max(4, Math.min(drag.current.sb + dy, window.innerHeight - 56));
      setPos({ right: r, bottom: b });
    }
  };

  const handlePointerUp = (e) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (drag.current.moved) {
      const dx = drag.current.sx - e.clientX;
      const dy = drag.current.sy - e.clientY;
      const r = Math.max(4, Math.min(drag.current.sr + dx, window.innerWidth - 56));
      const b = Math.max(4, Math.min(drag.current.sb + dy, window.innerHeight - 56));
      localStorage.setItem("hye-ia-pos", JSON.stringify({ right: r, bottom: b }));
    } else {
      setAbierto((v) => !v);
    }
  };

  const sugerencias = {
    admin: ["Como van los proyectos?", "Que fases estan en curso?", "Que es un anteproyecto?"],
    colaborador: ["Que fases tengo asignadas?", "Como esta mi avance?", "Que entregables necesito?"],
    cliente: ["Como va mi proyecto?", "Que servicios ofrecen?", "Como los contacto?"],
  }[user.role] || ["En que me puedes ayudar?"];

  return (
    <div
      ref={wrapperRef}
      style={{ position: "fixed", right: pos.right, bottom: pos.bottom, zIndex: 50, touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {abierto && (
        <div
          className="absolute right-0 w-[min(380px,calc(100vw-2rem))] bg-white rounded-2xl shadow-2xl border border-sand flex flex-col overflow-hidden"
          style={{ bottom: "56px", maxHeight: "55dvh" }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-ink text-ivory flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[13px] font-semibold">Asistente H&amp;E</p>
              <span className="text-[9px] text-ivory/40 uppercase tracking-widest">IA</span>
            </div>
            <button
              type="button"
              onClick={limpiar}
              className="text-[10px] text-ivory/50 hover:text-ivory dark:text-stone dark:hover:text-[#1A1917]"
            >
              Limpiar
            </button>
          </div>

          <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {mensajes.length === 0 && (
              <div className="text-center py-4 space-y-2">
                <p className="text-2xl">*</p>
                <p className="text-[12px] text-ink/60 leading-relaxed px-2">
                  Hola {user?.name?.split(" ")[0]}. Puedo ayudarte con tus proyectos y preguntas de arquitectura.
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                  {sugerencias.map((s) => (
                    <Chip key={s} texto={s} onClick={(t) => { setInput(t); inputRef.current?.focus(); }} />
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((m, i) => (
              <div key={m.id || String(i)} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-[12px] leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-ink text-ivory rounded-br-sm" : "bg-sand text-ink rounded-bl-sm"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="space-y-2 whitespace-normal break-words">
                      {renderMarkdown(m.content)}
                      {(m.actions?.messages || m.actions?.contact) && (
                        <div className="pt-1 flex flex-wrap gap-2">
                          {m.actions?.messages && (
                            <button
                              type="button"
                              onClick={() => {
                                setAbierto(false);
                                navigate("/mensajes");
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-ink text-ivory text-[11px] font-medium hover:opacity-90 transition"
                            >
                              Ir a Mensajes
                            </button>
                          )}

                          {m.actions?.contact && (
                            <>
                              <a
                                href={`tel:${CONTACTO_HYE.telefono.replace(/\s+/g, "")}`}
                                className="px-2.5 py-1.5 rounded-xl border border-ink/15 text-[11px] font-medium hover:bg-black/5 transition"
                              >
                                Llamar a H&amp;E
                              </a>
                              <a
                                href={`mailto:${CONTACTO_HYE.correo}`}
                                className="px-2.5 py-1.5 rounded-xl border border-ink/15 text-[11px] font-medium hover:bg-black/5 transition"
                              >
                                Escribir correo
                              </a>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {cargando && (
              <div className="flex justify-start">
                <div className="bg-sand px-3 py-2.5 rounded-2xl rounded-bl-sm flex gap-1.5">
                  {[0, 150, 300].map((d) => (
                    <div
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-ink/40 animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-[11px] text-red-500 text-center">{error}</p>}
          </div>

          <div className="flex items-end gap-2 px-3 py-3 border-t border-sand flex-shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pregunta algo..."
              rows={1}
              disabled={cargando}
              className="flex-1 resize-none text-[13px] bg-sand rounded-xl px-3 py-2 outline-none placeholder:text-ink/40 text-ink max-h-24 disabled:opacity-50"
              style={{ minHeight: "36px" }}
            />
            <button
              type="button"
              onClick={enviar}
              disabled={!input.trim() || cargando}
              className="w-9 h-9 rounded-xl bg-ink text-ivory flex items-center justify-center disabled:opacity-40 hover:opacity-80"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
          abierto ? "bg-ink text-ivory scale-95" : "bg-ink text-ivory hover:scale-110"
        }`}
        aria-label="Asistente IA"
        tabIndex={0}
      >
        {abierto ? (
          <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

AsistenteIA.propTypes = {};

function Chip({ texto, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(texto)}
      className="px-2.5 py-1 rounded-full text-[10px] bg-sand text-ink/70 hover:bg-ink/10 border border-ink/10 transition-colors"
    >
      {texto}
    </button>
  );
}

Chip.propTypes = {
  texto: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};

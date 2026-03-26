// src/components/AsistenteIA.jsx
// Asistente IA con Gemini via Firebase AI Logic
// Botón flotante — contextual según rol (admin, colaborador, cliente)

import { useState, useEffect, useRef } from "react";
import { collection, getDocs, query, where, limit, orderBy } from "firebase/firestore";
import { db, geminiModel } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import PropTypes from "prop-types";

const EMPRESA_INFO = `
## Sobre H&E Arquitectos
- **Nombre completo**: H&E Arquitectos (HYE — Espacios Humanos)
- **Misión**: Diseñamos espacios con propósito y visión colaborativa.
- **Fundadora**: Luisa Erazo, arquitecta y directora de la firma.
- **Ubicación**: Cali, Colombia.
- **Teléfono / WhatsApp**: 321 885 6680
- **Instagram**: @hye.arquitectos
- **Horario de atención**: Lunes a viernes, 7:00 a.m. – 5:00 p.m.
- **Servicios**:
  · Diseño arquitectónico (vivienda, comercial, institucional)
  · Diseño de interiores
  · Consultorías especializadas en arquitectura y construcción
- **Equipo**: H&E cuenta con un equipo multidisciplinario de profesionales en arquitectura, diseño, ingeniería y gestión de proyectos, seleccionados por su experiencia y compromiso con la calidad.
- **Filosofía**: Cada proyecto es único. Trabajamos de cerca con el cliente para entender sus necesidades, garantizando diseños funcionales, estéticos y sostenibles.
`;

function buildSystemPrompt(user, proyectos) {
    const rol = user?.role || "sin-rol";
    const nombre = user?.name?.split(" ")[0] || "Usuario";

    if (rol === "admin") {
        const resumen = proyectos.length
            ? proyectos.map(p => {
                const fases = Array.isArray(p.fases) ? p.fases : [];
                const completadas = fases.filter(f => f.estado === "completada").length;
                const enCurso = fases.filter(f => f.estado === "en_curso").length;
                return `• "${p.name || p.nombre}" — ${p.progress || 0}% avance, ${completadas}/${fases.length} fases completadas, ${enCurso} en curso, cliente: ${p.client || p.cliente || "sin asignar"}`;
            }).join("\n")
            : "Sin proyectos registrados.";

        return `Eres el asistente inteligente de H&E Arquitectos. Estás hablando con ${nombre}, la administradora de la firma.

${EMPRESA_INFO}

Estado actual de los proyectos:
${resumen}

Ayúdala con consultas sobre proyectos, alertas de fases, preguntas técnicas de arquitectura y uso de la plataforma.
Responde siempre en español, de forma profesional y concisa. Máximo 3 párrafos.`;
    }

    if (rol === "colaborador") {
        const subRoleLabel = { juridica: "Jurídica", sistemas: "Sistemas", arquitecto: "Arquitecto" }[user?.subRole] || "Colaborador";
        const misFases = [];
        proyectos.forEach(p => {
            (p.fases || []).forEach(f => {
                if (f.responsableUid === user?.uid) {
                    misFases.push(`• "${f.nombre}" en "${p.name || p.nombre}": ${f.porcentaje || 0}% (${f.estado || "pendiente"})`);
                }
            });
        });
        return `Eres el asistente de H&E Arquitectos. Estás hablando con ${nombre}, colaborador del área de ${subRoleLabel}.

${EMPRESA_INFO}

Fases asignadas:
${misFases.length ? misFases.join("\n") : "Sin fases asignadas aún."}

Ayúdalo con sus fases, preguntas técnicas y uso de la plataforma. Responde en español, claro y práctico. Máximo 3 párrafos.`;
    }

    if (rol === "cliente") {
        const p = proyectos[0];
        let info = "Sin proyecto activo.";
        if (p) {
            const fases = (p.fases || []).map(f =>
                `  · ${f.nombre}: ${f.porcentaje || 0}% — ${f.estado === "completada" ? "Completada" : f.estado === "en_curso" ? "En curso" : "Pendiente"}`
            ).join("\n");
            info = `Proyecto: "${p.name || p.nombre}" — ${p.progress || 0}% avance\nFases:\n${fases}`;
        }
        return `Eres el asistente de H&E Arquitectos. Estás hablando con ${nombre}, cliente de la firma.

${EMPRESA_INFO}

${info}

Tu rol es orientar al cliente sobre el estado de su proyecto, explicar las fases del proceso, responder preguntas sobre arquitectura y brindar información general sobre la firma cuando lo solicite. No compartas información de otros clientes. Responde en español, de forma amigable y profesional. Máximo 3 párrafos.`;
    }

    return "Eres el asistente de H&E Arquitectos. Responde en español de forma profesional.";
}

export default function AsistenteIA() {
    const { user } = useAuth();
    const [abierto, setAbierto] = useState(false);
    const [mensajes, setMensajes] = useState([]);
    const [input, setInput] = useState("");
    const [cargando, setCargando] = useState(false);
    const [proyectos, setProyectos] = useState([]);
    const [error, setError] = useState("");
    const chatRef = useRef(null);
    const inputRef = useRef(null);
    const chatSessionRef = useRef(null);

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
                    if (snap.empty) snap = await getDocs(query(col, where("clientEmail", "==", user.email), limit(5)));
                }
                setProyectos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (_e) { /* ignored */ }
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
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, [mensajes, cargando]);

    useEffect(() => {
        if (abierto) setTimeout(() => inputRef.current?.focus(), 100);
    }, [abierto]);

    const enviar = async () => {
        const texto = input.trim();
        if (!texto || cargando || !chatSessionRef.current) return;
        setMensajes(prev => [...prev, { role: "user", content: texto }]);
        setInput("");
        setCargando(true);
        setError("");
        try {
            const result = await chatSessionRef.current.sendMessage(texto);
            const respuesta = result.response.text();
            setMensajes(prev => [...prev, { role: "assistant", content: respuesta }]);
        } catch (_e) { /* ignored */
            setError("No pude conectar con el asistente. Intenta de nuevo.");
        } finally {
            setCargando(false);
        }
    };

    const handleKey = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
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

    const sugerencias = {
        admin: ["¿Cómo van los proyectos?", "¿Qué fases están en curso?", "¿Qué es un anteproyecto?"],
        colaborador: ["¿Qué fases tengo asignadas?", "¿Cómo está mi avance?", "¿Qué entregables necesito?"],
        cliente: ["¿Cómo va mi proyecto?", "¿Qué servicios ofrecen?", "¿Cómo los contacto?"],
    }[user.role] || ["¿En qué me puedes ayudar?"];

    return (
        <>
            <button
                type="button"
                onClick={() => setAbierto(v => !v)}
                className={`fixed right-4 z-50 w-12 h-12 rounded-full shadow-lg
          flex items-center justify-center transition-all duration-200
          ${abierto ? "bg-ink text-ivory scale-95" : "bg-ink text-ivory hover:scale-110"}`}
                style={{ bottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}
                aria-label="Asistente IA"
            >
                {abierto ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round"
                            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                )}
            </button>

            {abierto && (
                <div className="fixed right-4 z-50 w-[calc(100vw-2rem)] max-w-[380px]
          bg-white rounded-2xl shadow-2xl border border-sand flex flex-col overflow-hidden"
                    style={{ bottom: 'calc(13rem + env(safe-area-inset-bottom, 0px))', maxHeight: "55dvh" }}>

                    <div className="flex items-center justify-between px-4 py-3 bg-ink text-ivory flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <p className="text-[13px] font-semibold">Asistente H&E</p>
                            <span className="text-[9px] text-ivory/40 uppercase tracking-widest">IA</span>
                        </div>
                        <button type="button" onClick={limpiar}
                            className="text-[10px] text-ivory/50 hover:text-ivory">Limpiar</button>
                    </div>

                    <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                        {mensajes.length === 0 && (
                            <div className="text-center py-4 space-y-2">
                                <p className="text-2xl">✦</p>
                                <p className="text-[12px] text-ink/60 leading-relaxed px-2">
                                    Hola {user?.name?.split(" ")[0]}. Puedo ayudarte con tus proyectos y preguntas de arquitectura.
                                </p>
                                <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                                    {sugerencias.map(s => (
                                        <Chip key={s} texto={s} onClick={t => { setInput(t); inputRef.current?.focus(); }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        {mensajes.map((m, i) => (
                            <div key={m.id || String(i)} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[12px] leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-ink text-ivory rounded-br-sm" : "bg-sand text-ink rounded-bl-sm"
                                    }`}>{m.content}</div>
                            </div>
                        ))}
                        {cargando && (
                            <div className="flex justify-start">
                                <div className="bg-sand px-3 py-2.5 rounded-2xl rounded-bl-sm flex gap-1.5">
                                    {[0, 150, 300].map(d => (
                                        <div key={d} className="w-1.5 h-1.5 rounded-full bg-ink/40 animate-bounce"
                                            style={{ animationDelay: `${d}ms` }} />
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
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            placeholder="Pregunta algo…"
                            rows={1}
                            disabled={cargando}
                            className="flex-1 resize-none text-[13px] bg-sand rounded-xl px-3 py-2
                outline-none placeholder:text-ink/40 text-ink max-h-24 disabled:opacity-50"
                            style={{ minHeight: "36px" }}
                        />
                        <button type="button" onClick={enviar}
                            disabled={!input.trim() || cargando}
                            className="w-9 h-9 rounded-xl bg-ink text-ivory flex items-center justify-center
                disabled:opacity-40 hover:opacity-80">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

AsistenteIA.propTypes = {};

function Chip({ texto, onClick }) {
    return (
        <button type="button" onClick={() => onClick(texto)}
            className="px-2.5 py-1 rounded-full text-[10px] bg-sand text-ink/70
        hover:bg-ink/10 border border-ink/10 transition-colors">
            {texto}
        </button>
    );
}

Chip.propTypes = {
  texto: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};
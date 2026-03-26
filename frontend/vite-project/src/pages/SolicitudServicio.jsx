// src/pages/SolicitudServicio.jsx
// Ruta pública /solicitar — sin login requerido
// Cualquier prospecto puede enviar una solicitud de servicio a H&E

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import logoHye from "../assets/logo-header.png";
import PropTypes from "prop-types";

const TIPOS_OBRA = [
    "Diseño arquitectónico",
    "Diseño de interiores",
    "Dirección de obra",
    "Remodelación",
    "Otro",
];

const PRESUPUESTOS = [
    "Menos de $50M COP",
    "$50M – $150M COP",
    "$150M – $300M COP",
    "$300M – $500M COP",
    "Más de $500M COP",
    "Por definir",
];

export default function SolicitudServicio() {
    const [paso, setPaso] = useState(1); // 1: formulario, 2: enviado
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [form, setForm] = useState({
        nombre: "",
        email: "",
        telefono: "",
        tipoObra: "",
        presupuesto: "",
        ciudad: "",
        descripcion: "",
        fechaInicio: "",
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const valido =
        form.nombre.trim() &&
        form.email.trim() &&
        form.tipoObra &&
        form.descripcion.trim();

    const handleSubmit = async () => {
        if (!valido) return;
        setSaving(true);
        setError("");
        try {
            await addDoc(collection(db, "solicitudesComerciales"), {
                ...form,
                nombre: form.nombre.trim(),
                email: form.email.trim().toLowerCase(),
                telefono: form.telefono.trim(),
                descripcion: form.descripcion.trim(),
                ciudad: form.ciudad.trim(),
                estado: "nueva",
                notaAdmin: "",
                createdAt: serverTimestamp(),
            });
            setPaso(2);
        } catch (e) {
            setError("Ocurrió un error al enviar. Intenta de nuevo.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-[#F2EEE7] flex flex-col">

            {/* Header */}
            <header className="bg-[#141414] text-ivory px-6 py-4 flex items-center gap-3">
                <img src={logoHye} alt="H&E" className="h-8 object-contain invert" />
                <div>
                    <p className="text-[13px] font-semibold leading-tight">H&E Arquitectos</p>
                    <p className="text-[10px] text-ivory/50">Solicitud de servicio</p>
                </div>
            </header>

            <main className="flex-1 px-4 py-6 max-w-[500px] mx-auto w-full space-y-5">

                {paso === 2 ? (
                    /* ── Confirmación ── */
                    <div className="card text-center space-y-4 py-10">
                        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                            <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-[18px] font-bold text-ink">¡Solicitud enviada!</h1>
                            <p className="text-[13px] text-ink/60 mt-2 leading-relaxed">
                                Gracias, <strong>{form.nombre.split(" ")[0]}</strong>. Hemos recibido tu solicitud y
                                nos pondremos en contacto contigo pronto al correo{" "}
                                <strong>{form.email}</strong>.
                            </p>
                        </div>
                        <div className="bg-sand/60 rounded-2xl p-4 text-left space-y-2">
                            <p className="text-[11px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Resumen</p>
                            <InfoRow label="Tipo de obra" value={form.tipoObra} />
                            <InfoRow label="Ciudad" value={form.ciudad || "—"} />
                            <InfoRow label="Presupuesto" value={form.presupuesto || "—"} />
                            <InfoRow label="Inicio deseado" value={form.fechaInicio
                                ? new Date(form.fechaInicio).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })
                                : "—"} />
                        </div>
                        <p className="text-[11px] text-ink/40">
                            H&E Arquitectos · Bogotá, Colombia
                        </p>
                    </div>
                ) : (
                    /* ── Formulario ── */
                    <>
                        <div>
                            <h1 className="text-[22px] font-bold text-ink leading-tight">
                                Cotiza tu proyecto
                            </h1>
                            <p className="text-[13px] text-ink/55 mt-1">
                                Cuéntanos qué tienes en mente y te contactamos en menos de 24 horas.
                            </p>
                        </div>

                        {/* Datos de contacto */}
                        <div className="card space-y-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40 font-semibold">
                                Datos de contacto
                            </p>

                            <Field label="Nombre completo *" value={form.nombre}
                                onChange={v => set("nombre", v)} placeholder="Tu nombre" />

                            <Field label="Correo electrónico *" value={form.email} type="email"
                                onChange={v => set("email", v)} placeholder="correo@ejemplo.com" />

                            <Field label="Teléfono / WhatsApp" value={form.telefono} type="tel"
                                onChange={v => set("telefono", v)} placeholder="+57 300 000 0000" />
                        </div>

                        {/* Datos del proyecto */}
                        <div className="card space-y-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40 font-semibold">
                                Tu proyecto
                            </p>

                            {/* Tipo de obra */}
                            <div className="space-y-1.5">
                                <label htmlFor="solicitud-tipo-obra" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink/50">
                                    Tipo de obra *
                                </label>
                                <div id="solicitud-tipo-obra" className="flex flex-wrap gap-2">
                                    {TIPOS_OBRA.map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => set("tipoObra", t)}
                                            className={`px-3 py-1.5 rounded-xl text-[12px] font-medium border transition-all ${form.tipoObra === t
                                                    ? "bg-ink text-ivory border-ink"
                                                    : "bg-white text-ink/60 border-ink/15 hover:border-ink/30"
                                                }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Presupuesto */}
                            <div className="space-y-1.5">
                                <label htmlFor="solicitud-presupuesto" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink/50">
                                    Presupuesto estimado
                                </label>
                                <div id="solicitud-presupuesto" className="flex flex-wrap gap-2">
                                    {PRESUPUESTOS.map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => set("presupuesto", p)}
                                            className={`px-3 py-1.5 rounded-xl text-[12px] font-medium border transition-all ${form.presupuesto === p
                                                    ? "bg-ink text-ivory border-ink"
                                                    : "bg-white text-ink/60 border-ink/15 hover:border-ink/30"
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Ciudad */}
                            <Field label="Ciudad / Municipio" value={form.ciudad}
                                onChange={v => set("ciudad", v)} placeholder="Bogotá, Medellín..." />

                            {/* Fecha de inicio */}
                            <div className="space-y-1.5">
                                <label htmlFor="solicitud-fecha-inicio" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink/50">
                                    Fecha de inicio deseada
                                </label>
                                <input
                                    id="solicitud-fecha-inicio"
                                    type="date"
                                    value={form.fechaInicio}
                                    onChange={e => set("fechaInicio", e.target.value)}
                                    min={new Date().toISOString().split("T")[0]}
                                    className="input w-full text-[13px]"
                                />
                            </div>

                            {/* Descripción */}
                            <div className="space-y-1.5">
                                <label htmlFor="solicitud-descripcion" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink/50">
                                    Descripción de necesidades *
                                </label>
                                <textarea
                                    id="solicitud-descripcion"
                                    value={form.descripcion}
                                    onChange={e => set("descripcion", e.target.value)}
                                    placeholder="Cuéntanos qué quieres construir, remodelar o diseñar…"
                                    rows={4}
                                    className="input w-full resize-none text-[13px]"
                                />
                            </div>
                        </div>

                        {error && (
                            <p className="text-[12px] text-red-600 text-center">{error}</p>
                        )}

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={saving || !valido}
                            className="w-full btn-primary text-[14px] py-3 disabled:opacity-50"
                        >
                            {saving ? "Enviando solicitud…" : "Enviar solicitud →"}
                        </button>

                        <p className="text-[11px] text-ink/35 text-center">
                            Al enviar aceptas que H&E Arquitectos use tus datos para contactarte.
                        </p>
                    </>
                )}
            </main>
        </div>
    );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
    return (
        <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink/50">
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="input w-full text-[13px]"
            />
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex justify-between gap-3 text-[12px]">
            <span className="text-ink/50">{label}</span>
            <span className="text-ink font-medium text-right">{value}</span>
        </div>
    );
}

Field.propTypes = {
    label: PropTypes.string,
    value: PropTypes.string,
    onChange: PropTypes.func,
    placeholder: PropTypes.string,
    type: PropTypes.string,
};

InfoRow.propTypes = {
    label: PropTypes.string,
    value: PropTypes.any,
};
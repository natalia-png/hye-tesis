// src/pages/GestionColaboradores.jsx
// Panel admin — gestión de equipo interno y proveedores externos

import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import GestionProveedores from "./GestionProveedores";

const FUNCTIONS_URL = "https://us-central1-hye-tesis.cloudfunctions.net";
import { getSubRoleColor } from "../data/roles";

const SUB_ROLES_SUGERIDOS = [
    "Arquitecto", "Diseño", "Residente de obra", "Jurídica", "Coordinación",
];

export default function GestionColaboradores() {
    const [tab, setTab] = useState("colaboradores"); // "colaboradores" | "proveedores"
    const [colaboradores, setColaboradores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [form, setForm] = useState({
        name: "", email: "", password: "", subRole: "", telefono: "", cedula: "",
    });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "users"),
            snap => {
                const cols = snap.docs
                    .map(d => ({ uid: d.id, ...d.data() }))
                    .filter(u => u.role === "colaborador");
                setColaboradores(cols);
                setLoading(false);
            },
            () => setLoading(false)
        );
        return () => { try { unsub(); } catch (e) { console.error(e); } };
    }, []);

    const handleCrear = async () => {
        if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
            setError("Nombre, correo y contraseña son obligatorios.");
            return;
        }
        if (form.password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const token = await getAuth().currentUser.getIdToken();
            const res = await fetch(`${FUNCTIONS_URL}/crearColaborador`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: form.name.trim(),
                    email: form.email.trim().toLowerCase(),
                    password: form.password,
                    subRole: form.subRole || "",
                    telefono: form.telefono?.trim() || "",
                    cedula: form.cedula?.trim() || "",
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al crear el colaborador.");

            // Guardar teléfono y cédula directamente (la Cloud Function puede no incluirlos)
            if (data.uid && (form.telefono?.trim() || form.cedula?.trim())) {
                try {
                    await updateDoc(doc(db, "users", data.uid), {
                        telefono: form.telefono?.trim() || "",
                        cedula: form.cedula?.trim() || "",
                    });
                } catch (e) {
                    console.warn("No se guardaron teléfono/cédula:", e);
                }
            }

            setModal(false);
            setForm({ name: "", email: "", password: "", subRole: "", telefono: "", cedula: "" });
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEliminar = async (uid, nombre) => {
        if (!confirm(`¿Eliminar a ${nombre} del equipo?`)) return;
        try {
            // Eliminar de Auth + Firestore via Cloud Function
            const mainAuth = getAuth();
            const token = await mainAuth.currentUser.getIdToken();

            const res = await fetch(`${FUNCTIONS_URL}/eliminarColaborador`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ uid }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al eliminar");
        } catch (e) {
            alert("Error: " + e.message);
        }
    };

    return (
        <section className="space-y-4">

            {/* Header fijo */}
            <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                    Administración
                </p>
                <h1 className="text-[20px] font-bold text-ink leading-tight">Equipo</h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-ink/5 dark:bg-white/5 rounded-xl p-1">
                {[
                    { key: "colaboradores", label: "Colaboradores" },
                    { key: "proveedores", label: "Proveedores" },
                ].map(t => (
                    <button key={t.key} type="button" onClick={() => setTab(t.key)}
                        className={`flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                            tab === t.key
                                ? "bg-ink text-ivory shadow-sm"
                                : "text-ink/50 hover:text-ink"
                        }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Contenido de tab Proveedores */}
            {tab === "proveedores" && <GestionProveedores />}

            {/* Contenido de tab Colaboradores */}
            {tab === "colaboradores" && <>

            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[12px] text-ink/50">
                        {colaboradores.length} miembro{colaboradores.length === 1 ? "" : "s"} del equipo
                    </p>
                </div>
                <button type="button" onClick={() => { setModal(true); setError(""); }}
                    className="btn-primary text-[12px] px-3 py-2 flex-shrink-0 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar
                </button>
            </div>

            {loading && (
                <div className="flex items-center gap-2 py-6">
                    <div className="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
                    <p className="text-[13px] text-ink/50">Cargando equipo…</p>
                </div>
            )}
            {!loading && colaboradores.length === 0 && (
                <div className="card text-center py-10 space-y-2">
                    <p className="text-3xl">👥</p>
                    <p className="text-[14px] font-semibold text-ink">Sin colaboradores aún</p>
                    <p className="text-[12px] text-ink/50 max-w-[220px] mx-auto leading-relaxed">
                        Agrega a los miembros del equipo para asignarles fases en los proyectos.
                    </p>
                </div>
            )}
            {!loading && colaboradores.length > 0 && (
                <div className="space-y-2">
                    {colaboradores.map(c => (
                        <TarjetaColaborador key={c.uid} colaborador={c} onEliminar={handleEliminar} />
                    ))}
                </div>
            )}

            </>}

            {modal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4">
                    <div className="w-full max-w-[460px] bg-white dark:bg-[#1a1a18] rounded-2xl shadow-2xl p-5 max-h-[90dvh] overflow-y-auto space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[15px] font-semibold text-ink">Agregar colaborador</h3>
                            <button onClick={() => setModal(false)} className="text-ink/40 hover:text-ink text-xl">×</button>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Área</label>
                            <div className="flex gap-1.5 flex-wrap">
                                {SUB_ROLES_SUGERIDOS.map(s => (
                                    <button key={s} type="button" onClick={() => set("subRole", s)}
                                        className={`px-3 py-1.5 rounded-xl text-[12px] font-medium border transition-all ${form.subRole === s
                                            ? "bg-ink text-ivory border-ink"
                                            : "bg-white text-ink/60 border-ink/15 hover:border-ink/30"
                                        }`}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                value={form.subRole}
                                onChange={e => set("subRole", e.target.value)}
                                placeholder="O escribe un área personalizada…"
                                className="w-full border border-taupe/30 rounded-xl px-3 py-2 text-[12px] bg-white outline-none focus:border-ink/40 text-ink placeholder:text-ink/30 mt-1"
                            />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="colab-nombre" className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Nombre completo</label>
                            <input id="colab-nombre" type="text" value={form.name} onChange={e => set("name", e.target.value)}
                                placeholder="Ej: Carlos Medina" className="input w-full text-[13px]" />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="colab-email" className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Correo electrónico</label>
                            <input id="colab-email" type="email" value={form.email} onChange={e => set("email", e.target.value)}
                                placeholder="correo@ejemplo.com" className="input w-full text-[13px]" />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="colab-telefono" className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Teléfono</label>
                            <input id="colab-telefono" type="tel" value={form.telefono} onChange={e => set("telefono", e.target.value)}
                                placeholder="Ej: +57 300 000 0000" className="input w-full text-[13px]" />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="colab-cedula" className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Cédula / NIT</label>
                            <input id="colab-cedula" type="text" value={form.cedula} onChange={e => set("cedula", e.target.value)}
                                placeholder="Ej: 1234567890" className="input w-full text-[13px]" />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="colab-password" className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Contraseña temporal</label>
                            <input id="colab-password" type="password" value={form.password} onChange={e => set("password", e.target.value)}
                                placeholder="Mínimo 6 caracteres" className="input w-full text-[13px]" />
                            <p className="text-[10px] text-ink/40">El colaborador puede cambiarla después.</p>
                        </div>

                        {error && <p className="text-[12px] text-red-600">{error}</p>}

                        <div className="flex gap-2 pt-1">
                            <button type="button" onClick={() => setModal(false)}
                                className="flex-1 btn-outline text-[13px]" disabled={saving}>
                                Cancelar
                            </button>
                            <button type="button" onClick={handleCrear} disabled={saving}
                                className="flex-1 btn-primary text-[13px] disabled:opacity-50">
                                {saving ? "Creando…" : "Crear colaborador"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

function TarjetaColaborador({ colaborador, onEliminar }) {
    const subRole = colaborador.subRole || "";
    const rolLabel = subRole || "Colaborador";
    const rolColor = getSubRoleColor(subRole);

    const [editing, setEditing] = useState(false);
    const [editTel, setEditTel] = useState(colaborador.telefono || "");
    const [editCed, setEditCed] = useState(colaborador.cedula || "");
    const [savingEdit, setSavingEdit] = useState(false);

    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [contratoURL, setContratoURL] = useState(colaborador.contratoURL || "");

    const handleSaveEdit = async () => {
        setSavingEdit(true);
        try {
            await updateDoc(doc(db, "users", colaborador.uid), {
                telefono: editTel.trim(),
                cedula: editCed.trim(),
            });
            setEditing(false);
        } catch (e) {
            alert("Error al guardar: " + e.message);
        } finally {
            setSavingEdit(false);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (file.type !== "application/pdf") { alert("Solo se permiten archivos PDF."); return; }
        if (file.size > 5 * 1024 * 1024) { alert("El archivo no debe superar 5 MB."); return; }
        setUploading(true);
        try {
            const path = `contratos/colaboradores/${colaborador.uid}/contrato-${Date.now()}.pdf`;
            const ref = storageRef(storage, path);
            await new Promise((resolve, reject) => {
                const task = uploadBytesResumable(ref, file, { contentType: "application/pdf" });
                task.on("state_changed", null, reject, resolve);
            });
            const url = await getDownloadURL(ref);
            await updateDoc(doc(db, "users", colaborador.uid), { contratoURL: url });
            setContratoURL(url);
        } catch (e) {
            alert("Error al subir contrato: " + e.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="card space-y-2">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-ink dark:bg-white/90 flex items-center justify-center flex-shrink-0">
                        <span className="text-[14px] font-bold text-ivory dark:text-[#1A1917]">
                            {(colaborador.name || "?")[0].toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-ink truncate">{colaborador.name}</p>
                        <p className="text-[11px] text-ink/50 truncate">{colaborador.email}</p>
                        {(colaborador.telefono || colaborador.cedula) && !editing && (
                            <div className="flex flex-wrap gap-x-3 mt-0.5">
                                {colaborador.telefono && (
                                    <p className="text-[11px] text-ink/50">{colaborador.telefono}</p>
                                )}
                                {colaborador.cedula && (
                                    <p className="text-[11px] text-ink/50">CC/NIT: {colaborador.cedula}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${rolColor}`}>
                        {rolLabel}
                    </span>
                    <button type="button" onClick={() => { setEditing(v => !v); setEditTel(colaborador.telefono || ""); setEditCed(colaborador.cedula || ""); }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-ink/30 hover:text-ink hover:bg-ink/5 transition-colors"
                        title="Editar teléfono y cédula">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
                        </svg>
                    </button>
                    <button type="button" onClick={() => onEliminar(colaborador.uid, colaborador.name)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-ink/30 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {editing && (
                <div className="border-t border-taupe/20 pt-2 space-y-2">
                    <div className="flex gap-2">
                        <input
                            type="tel"
                            value={editTel}
                            onChange={e => setEditTel(e.target.value)}
                            placeholder="Teléfono"
                            className="flex-1 border border-taupe/30 rounded-xl px-3 py-1.5 text-[12px] bg-white dark:bg-transparent outline-none focus:border-ink/40 text-ink placeholder:text-ink/30"
                        />
                        <input
                            type="text"
                            value={editCed}
                            onChange={e => setEditCed(e.target.value)}
                            placeholder="Cédula / NIT"
                            className="flex-1 border border-taupe/30 rounded-xl px-3 py-1.5 text-[12px] bg-white dark:bg-transparent outline-none focus:border-ink/40 text-ink placeholder:text-ink/30"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setEditing(false)} disabled={savingEdit}
                            className="flex-1 btn-outline text-[12px] py-1.5">Cancelar</button>
                        <button type="button" onClick={handleSaveEdit} disabled={savingEdit}
                            className="flex-1 btn-primary text-[12px] py-1.5 disabled:opacity-50">
                            {savingEdit ? "Guardando…" : "Guardar"}
                        </button>
                    </div>
                </div>
            )}

            <div className="border-t border-taupe/20 pt-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold mb-1.5">Contrato</p>
                <div className="flex items-center gap-2 flex-wrap">
                    {contratoURL && (
                        <button type="button"
                            onClick={() => window.open(contratoURL, "_blank", "noopener,noreferrer")}
                            className="text-[11px] px-3 py-1 rounded-full bg-ink text-ivory font-medium hover:opacity-80 transition">
                            Ver contrato
                        </button>
                    )}
                    {uploading ? (
                        <span className="text-[11px] text-ink/50">Subiendo...</span>
                    ) : (
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="text-[11px] px-3 py-1 rounded-full border border-taupe/40 text-ink/60 hover:text-ink hover:border-ink/30 transition">
                            {contratoURL ? "Reemplazar" : "Subir contrato"}
                        </button>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                </div>
            </div>
        </div>
    );
}

TarjetaColaborador.propTypes = {
    colaborador: PropTypes.object,
    onEliminar: PropTypes.func,
};